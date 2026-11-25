#!/usr/bin/env python3
"""Validate the actual Docker-merged creative profile, without starting it."""
import argparse
import json


def verify(document, gpu=False):
    runtime = document["services"]["runtime"]
    assert runtime["read_only"] is True, "Runtime root must remain read-only"
    assert runtime["user"] == "10001:10001", "Runtime must remain unprivileged"
    assert "ALL" in runtime["cap_drop"], "Runtime must drop capabilities"
    assert not runtime.get("cap_add"), "Creative overlay must not add capabilities"
    assert not runtime.get("privileged", False), "Creative overlay must not be privileged"
    assert any(item in {"no-new-privileges:true", "no-new-privileges"} for item in runtime["security_opt"])
    ports = runtime.get("ports", [])
    assert len(ports) == 1 and ports[0]["host_ip"] == "127.0.0.1" and int(ports[0]["target"]) == 8788, "Only the private authenticated control port may be published"
    tmp = [item for item in runtime["tmpfs"] if item.split(":", 1)[0] == "/tmp"]
    assert len(tmp) == 1, "Exactly one /tmp mount is required; Compose concatenates tmpfs without !override"
    options = set(tmp[0].split(":", 1)[1].split(","))
    assert {"noexec", "nosuid", "nodev", "size=1073741824"} <= options, "Creative /tmp needs its intended 1 GiB bound and restrictions"
    assert int(runtime["mem_limit"]) == 16 * 1024**3 and float(runtime["cpus"]) == 4, "CI checks the declared creative resource defaults"
    assert runtime["pids_limit"] == 512
    volumes = {item["target"]: item for item in runtime["volumes"]}
    for target in ("/opt/daftar-tools", "/run/daftar/creative-tools.json", "/run/secrets"):
        assert volumes[target]["read_only"] is True, f"{target} must be read-only"
        assert volumes[target].get("bind", {}).get("create_host_path", False) is False
    assert volumes["/var/lib/daftar-creative"]["type"] == "bind"
    assert volumes["/var/lib/daftar-creative"].get("bind", {}).get("create_host_path", False) is False
    devices = runtime.get("deploy", {}).get("resources", {}).get("reservations", {}).get("devices", [])
    if gpu:
        assert len(devices) == 1 and devices[0]["driver"] == "nvidia" and devices[0]["count"] == 1 and "gpu" in devices[0]["capabilities"]
    else:
        assert devices == [], "CPU profile must not request a GPU"
    return {"ok": True, "profile": "creative-gpu" if gpu else "creative-cpu", "tmpMounts": len(tmp), "publishedPorts": len(ports)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", help="Output of docker compose ... config --format json")
    parser.add_argument("--gpu", action="store_true")
    args = parser.parse_args()
    with open(args.config, encoding="utf-8") as handle:
        print(json.dumps(verify(json.load(handle), args.gpu)))
