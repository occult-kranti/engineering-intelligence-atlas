# deploy/vast-status.py
"""Read-only Vast.ai diagnostic CLI for the Daftar project.

Official API docs: https://docs.vast.ai/api-reference/instances/show-instances

Issues a single GET to the canonical instances endpoint. It never mutates
anything, never follows redirects, never reads credentials from the
environment or argv, and never connects over SSH or runs nvidia-smi.
"""
import argparse
import ipaddress
import json
import os
import re
import stat
import sys
import urllib.error
import urllib.request

API_URL = "https://console.vast.ai/api/v1/instances/"
TIMEOUT = 20
MAX_BODY = 2 * 1024 * 1024
MAX_KEY_FILE = 512
MAX_TEXT = 160
KEY_RE = re.compile(r"[A-Za-z0-9_-]{32,256}")
HOST_RE = re.compile(r"^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$")
TEXT_FIELDS = ("actual_status", "intended_status", "gpu_name", "cpu_name")
NUM_FIELDS = ("gpu_ram", "num_gpus", "cpu_cores", "cpu_ram", "disk_space")


class CliError(Exception):
    """Failure carrying only a generic, non-sensitive message."""

    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def read_api_key(path):
    """Validate the credential file strictly and return the key."""
    if not isinstance(path, str) or not os.path.isabs(path):
        raise CliError("API key file path must be absolute")
    try:
        st = os.lstat(path)
    except OSError:
        raise CliError("cannot access API key file")
    if stat.S_ISLNK(st.st_mode):
        raise CliError("API key file must not be a symlink")
    if not stat.S_ISREG(st.st_mode):
        raise CliError("API key file must be a regular file")
    if st.st_uid != os.getuid():
        raise CliError("API key file must be owned by the current user")
    if stat.S_IMODE(st.st_mode) not in (0o400, 0o600):
        raise CliError("API key file permissions must be 0400 or 0600")
    if st.st_size > MAX_KEY_FILE:
        raise CliError("API key file too large")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    try:
        fd = os.open(path, flags)
        try:
            st2 = os.fstat(fd)
            if (st2.st_ino, st2.st_dev) != (st.st_ino, st.st_dev):
                raise CliError("API key file changed during read")
            if (not stat.S_ISREG(st2.st_mode) or st2.st_uid != os.getuid()
                    or stat.S_IMODE(st2.st_mode) not in (0o400, 0o600)):
                raise CliError("API key file changed during read")
            data = os.read(fd, MAX_KEY_FILE + 1)
        finally:
            os.close(fd)
    except OSError:
        raise CliError("cannot read API key file")
    if len(data) > MAX_KEY_FILE:
        raise CliError("API key file too large")
    try:
        key = data.decode("ascii").strip()
    except UnicodeDecodeError:
        raise CliError("API key file format invalid")
    if not KEY_RE.fullmatch(key):
        raise CliError("API key file format invalid")
    return key


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def default_transport(url, headers, timeout, max_bytes):
    """GET url without following redirects. Returns (status, body bytes)."""
    if url != API_URL:
        raise CliError("refusing unexpected endpoint")
    opener = urllib.request.build_opener(_NoRedirect)
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        resp = opener.open(req, timeout=timeout)
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, b""
        finally:
            exc.close()
    except (urllib.error.URLError, OSError, ValueError):
        raise CliError("network request failed")
    try:
        body = resp.read(max_bytes + 1)
        return resp.status, body
    except (urllib.error.URLError, OSError, ValueError):
        raise CliError("network response could not be read")
    finally:
        resp.close()


def _text(value):
    if isinstance(value, str):
        clean = "".join(c for c in value if c.isprintable())
        return clean[:MAX_TEXT]
    return None


def _num(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
            return None
        return value
    return None


def _valid_host(value):
    if (not isinstance(value, str) or len(value) > MAX_TEXT or not value
            or any(c.isspace() or not c.isprintable() for c in value) or "%" in value):
        return False
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        pass
    return bool(HOST_RE.fullmatch(value))


def _valid_port(value):
    return isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 65535


def sanitize_instance(raw):
    """Project an API instance onto the allowlist with validated types."""
    if not isinstance(raw, dict):
        raise CliError("unexpected API response schema")
    out = {"id": raw.get("id") if _valid_id(raw.get("id")) else None}
    for f in TEXT_FIELDS:
        out[f] = _text(raw.get(f))
    for f in NUM_FIELDS:
        out[f] = _num(raw.get(f))
    host, port = raw.get("ssh_host"), raw.get("ssh_port")
    out["ssh_host"] = host if _valid_host(host) else None
    out["ssh_port"] = port if _valid_port(port) else None
    out["public_ipaddr"] = None
    ip = raw.get("public_ipaddr")
    if isinstance(ip, str):
        try:
            out["public_ipaddr"] = str(ipaddress.ip_address(ip.strip()))
        except ValueError:
            pass
    if out["ssh_host"] and out["ssh_port"]:
        out["ssh_hint"] = ["ssh", "-p", str(out["ssh_port"]), "root@" + out["ssh_host"]]
    else:
        out["ssh_hint"] = None
    out["gpu_verified"] = False
    out["api_metadata_only"] = True
    return out


def _valid_id(v):
    return isinstance(v, int) and not isinstance(v, bool) and v > 0


def fetch_instances(api_key, transport=default_transport):
    headers = {"Authorization": "Bearer " + api_key, "Accept": "application/json"}
    status, body = transport(API_URL, headers, TIMEOUT, MAX_BODY)
    if status != 200:
        raise CliError("Vast API request failed", status=status)
    if len(body) > MAX_BODY:
        raise CliError("API response too large")
    try:
        data = json.loads(body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise CliError("API response was not valid JSON")
    if (not isinstance(data, dict) or data.get("success") is not True
            or not isinstance(data.get("instances"), list)):
        raise CliError("unexpected API response schema")
    return data


def build_report(data, instance_id=None):
    instances = [sanitize_instance(i) for i in data["instances"]]
    token = data.get("next_token")
    has_more = token not in (None, "", False)
    total = data.get("total_instances")
    report = {
        "account_instance_count": total if isinstance(total, int) and not isinstance(total, bool) and total >= 0 else None,
        "has_more": bool(has_more),
        "pagination_note": "results may be incomplete; only the first page was fetched" if has_more else "single page returned",
        "gpu_verified": False,
        "api_metadata_only": True,
    }
    if instance_id is None:
        report["instances"] = instances
        return report
    match = [i for i in instances if i["id"] == instance_id]
    if not match:
        raise CliError("instance not found in fetched results")
    report["instance"] = match[0]
    return report


def positive_int(text):
    try:
        v = int(text)
    except ValueError:
        raise argparse.ArgumentTypeError("must be a positive integer")
    if v <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return v


def main(argv=None, transport=default_transport, out=None):
    out = out or sys.stdout
    parser = argparse.ArgumentParser(description="Read-only Vast.ai instance status")
    parser.add_argument("--api-key-file", required=True)
    parser.add_argument("--instance", type=positive_int, default=None)
    args = parser.parse_args(argv)
    try:
        key = read_api_key(args.api_key_file)
        data = fetch_instances(key, transport)
        report = build_report(data, args.instance)
    except CliError as exc:
        msg = "error: " + str(exc)
        if exc.status is not None:
            msg += " (HTTP %d)" % exc.status
        print(msg, file=sys.stderr)
        return 1
    json.dump(report, out, indent=2, sort_keys=True)
    out.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
