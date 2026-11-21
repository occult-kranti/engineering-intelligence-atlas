#!/usr/bin/env python3
"""Validate and restore an Atlas personal export without extracting arbitrary files."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import tempfile
import zipfile
from urllib.parse import unquote, urlsplit

MAX_STATE_BYTES = 64 * 1024 * 1024
MAX_ARTIFACT_BYTES = 512_000
MAX_ARTIFACT_TOTAL = 96 * 1024 * 1024
MAX_REPORT_BYTES = 32 * 1024 * 1024
MAX_TOTAL_BYTES = MAX_STATE_BYTES + MAX_ARTIFACT_TOTAL + MAX_REPORT_BYTES
MAX_ARTIFACTS = 5000
MAX_MEMBERS = 8000
ARTIFACT = re.compile(r'artifacts/[0-9a-f]{64}\.md\Z')
COMPANY = re.compile(r'companies/[0-9a-f]{64}\.md\Z')
BASE_MEMBERS = {'company-state.json', 'artifact-map.json', 'PORTFOLIO.md', 'RESTORE.md', 'SHA256SUMS'}

def safe_path(value):
    path = Path(value).expanduser().absolute()
    if '..' in path.parts:
        raise ValueError('Parent traversal is not allowed in workspace paths.')
    cursor = Path(path.anchor)
    for part in path.parts[1:]:
        cursor = cursor / part
        if cursor.is_symlink():
            raise ValueError('Symbolic-link source or destination paths are not allowed.')
    return path

def read_regular(path, limit):
    path = safe_path(path)
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            raise ValueError('Expected a bounded regular file.')
        with os.fdopen(fd, 'rb', closefd=False) as source:
            content = source.read(limit + 1)
        if len(content) > limit:
            raise ValueError('File exceeds its size limit.')
        return content
    finally:
        os.close(fd)

def parse_json(raw):
    def object_pairs(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError('Duplicate JSON keys are not allowed.')
            value[key] = item
        return value
    def invalid_number(_):
        raise ValueError('Non-finite JSON numbers are not allowed.')
    value = json.loads(raw, object_pairs_hook=object_pairs, parse_constant=invalid_number)
    stack = [(value, 0)]
    count = 0
    while stack:
        item, depth = stack.pop()
        count += 1
        if depth > 64 or count > 1_000_000:
            raise ValueError('JSON nesting or record count exceeds its limit.')
        if isinstance(item, float) and not math.isfinite(item):
            raise ValueError('Non-finite JSON numbers are not allowed.')
        if isinstance(item, dict):
            stack.extend((x, depth + 1) for x in item.values())
        elif isinstance(item, list):
            stack.extend((x, depth + 1) for x in item)
    return value

def parse_state(raw):
    if len(raw) > MAX_STATE_BYTES:
        raise ValueError('State exceeds its 64 MiB limit.')
    data = parse_json(raw)
    if not isinstance(data, dict) or data.get('schemaVersion') != 1 or not isinstance(data.get('office'), dict):
        raise ValueError('Expected a complete schema-version-1 Atlas company state.')
    office = data['office']
    if office.get('schemaVersion') != 1:
        raise ValueError('Unsupported office state version.')
    limits = {'companies': 2000, 'offices': 5000, 'departments': 16000, 'employees': 30000, 'jobs': 5000, 'schedules': 1000, 'knowledge': 5000, 'events': 1000, 'goals': 2000, 'checkpoints': 20000, 'blueprints': 5000, 'chatThreads': 5000, 'externalAttempts': 10000}
    for key, maximum in limits.items():
        values = office.get(key, [])
        if not isinstance(values, list) or len(values) > maximum:
            raise ValueError('Invalid office collection bounds: ' + key)
    if not office.get('companies') or any(not isinstance(c, dict) or not isinstance(c.get('id'), str) or not c['id'] for c in office['companies']):
        raise ValueError('Company records are missing valid identities.')
    if len({c['id'] for c in office['companies']}) != len(office['companies']):
        raise ValueError('Duplicate company identities are not allowed.')
    portfolio = office.get('portfolio', {})
    if not isinstance(portfolio, dict):
        raise ValueError('Invalid portfolio state.')
    for key, maximum in {'groups': 100, 'services': 100, 'contracts': 12000, 'transfers': 10000, 'roadmap': 20000, 'recommendations': 3000}.items():
        values = portfolio.get(key, [])
        if not isinstance(values, list) or len(values) > maximum:
            raise ValueError('Invalid portfolio collection bounds: ' + key)
    return data

def validate_archive(path):
    path = safe_path(path)
    if not path.is_file() or path.stat().st_size > MAX_TOTAL_BYTES + 8 * 1024 * 1024:
        raise ValueError('Choose a bounded regular workspace archive.')
    payloads = {}
    with zipfile.ZipFile(path) as archive:
        infos = archive.infolist()
        if len(infos) > MAX_MEMBERS:
            raise ValueError('Too many archive members.')
        total = 0
        artifact_total = 0
        for info in infos:
            name = info.filename
            if name in payloads:
                raise ValueError('Duplicate archive member.')
            if name not in BASE_MEMBERS and not ARTIFACT.fullmatch(name) and not COMPANY.fullmatch(name):
                raise ValueError('Unexpected or unsafe archive member.')
            mode = info.external_attr >> 16
            if info.is_dir() or stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0, stat.S_IFREG)) or info.flag_bits & 1:
                raise ValueError('Archive directories, symlinks, special files and encrypted members are refused.')
            limit = MAX_STATE_BYTES if name == 'company-state.json' else MAX_ARTIFACT_BYTES if ARTIFACT.fullmatch(name) else 8 * 1024 * 1024
            if info.file_size < 0 or info.file_size > limit:
                raise ValueError('Archive member exceeds its size limit.')
            total += info.file_size
            if ARTIFACT.fullmatch(name):
                artifact_total += info.file_size
            if total > MAX_TOTAL_BYTES or artifact_total > MAX_ARTIFACT_TOTAL:
                raise ValueError('Archive exceeds its total size limit.')
            with archive.open(info) as source:
                body = source.read(limit + 1)
            if len(body) != info.file_size or len(body) > limit:
                raise ValueError('Archive member size is inconsistent.')
            payloads[name] = body
    if not BASE_MEMBERS.issubset(payloads):
        raise ValueError('Workspace archive is missing required records.')
    expected = {}
    for line in payloads['SHA256SUMS'].decode('ascii').splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  (.+)', line)
        if not match or match[2] in expected:
            raise ValueError('Invalid or duplicate checksum entry.')
        expected[match[2]] = match[1]
    if set(expected) != set(payloads) - {'SHA256SUMS'}:
        raise ValueError('Checksum manifest does not exactly match archive contents.')
    for name, digest in expected.items():
        if hashlib.sha256(payloads[name]).hexdigest() != digest:
            raise ValueError('Archive checksum mismatch.')
        if ARTIFACT.fullmatch(name) and Path(name).stem != digest:
            raise ValueError('Artifact filename does not match its content checksum.')
    data = parse_state(payloads['company-state.json'])
    artifact_map = parse_json(payloads['artifact-map.json'])
    if not isinstance(artifact_map, dict) or artifact_map.get('schemaVersion') != 1 or not isinstance(artifact_map.get('artifacts'), dict):
        raise ValueError('Invalid artifact map.')
    mapping = artifact_map['artifacts']
    if len(mapping) > MAX_ARTIFACTS * 2:
        raise ValueError('Artifact map exceeds its limit.')
    for old, member in mapping.items():
        if not isinstance(old, str) or len(old) > 8192 or not (old.startswith('/') or old.startswith('file:///') or re.match(r'^[A-Za-z]:[\\/]', old)) or not isinstance(member, str) or not ARTIFACT.fullmatch(member) or member not in payloads:
            raise ValueError('Invalid mapped artifact reference.')
    artifact_names = {name for name in payloads if ARTIFACT.fullmatch(name)}
    if len(artifact_names) > MAX_ARTIFACTS or artifact_names != set(mapping.values()):
        raise ValueError('Artifact map does not exactly cover the managed artifacts.')
    return data, mapping, payloads

def atomic_private_write(path, content):
    path = safe_path(path)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.atlas-restore-', dir=path.parent, delete=False) as output:
            temporary = Path(output.name)
            os.chmod(temporary, 0o600)
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        safe_path(path)
        os.replace(temporary, path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)

def canonical_file_uri(value):
    """Canonical key for an exact local file URI, else None. Percent-decodes and normalizes Windows drive syntax."""
    if not isinstance(value, str) or not value.startswith('file:///') or len(value) > 8192:
        return None
    parts = urlsplit(value)
    if parts.scheme != 'file' or parts.netloc or parts.query or parts.fragment:
        return None
    path = unquote(parts.path)
    if '\x00' in path:
        return None
    match = re.match(r'^/([A-Za-z]):[\\/](.*)$', path)
    if match:
        return 'file-win:' + match[1].lower() + ':/' + match[2].replace('\\', '/')
    return 'file:' + path

def remap_references(value, replacements):
    canonical = {}
    for old, new in replacements.items():
        key = canonical_file_uri(old)
        if key is not None:
            canonical.setdefault(key, new)
    def walk(item):
        if isinstance(item, str):
            if item in replacements:
                return replacements[item]
            key = canonical_file_uri(item)
            if key is not None and key in canonical:
                return canonical[key]
            return item
        if isinstance(item, list):
            return [walk(x) for x in item]
        if isinstance(item, dict):
            return {k: walk(v) for k, v in item.items()}
        return item
    return walk(value)

def restore_workspace(archive, user_data, replace=False):
    root = safe_path(user_data)
    state_path = safe_path(root / 'company' / 'company-state.json')
    if state_path.exists() and not replace:
        raise ValueError('Existing workspace preserved. Use --replace to make a timestamped backup and replace it.')
    data, mapping, payloads = validate_archive(archive)
    artifact_dir = safe_path(root / 'office-artifacts')
    destinations = {member: safe_path(artifact_dir / Path(member).name) for member in set(mapping.values())}
    for member, destination in destinations.items():
        if destination.exists() and read_regular(destination, MAX_ARTIFACT_BYTES) != payloads[member]:
            raise ValueError('A conflicting existing artifact was preserved; restore to a different user-data directory.')
    old_state = read_regular(state_path, MAX_STATE_BYTES) if state_path.exists() else None
    replacements = {old: str(destinations[member]) for old, member in mapping.items()}
    restored = json.dumps(remap_references(data, replacements), ensure_ascii=False, indent=2).encode()
    parse_state(restored)
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    state_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    artifact_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    safe_path(state_path)
    safe_path(artifact_dir)
    for member, destination in destinations.items():
        if not destination.exists():
            atomic_private_write(destination, payloads[member])
        os.chmod(destination, 0o600)
    backup = None
    if old_state is not None:
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup = safe_path(state_path.with_name('company-state.backup-' + stamp + '.json'))
        atomic_private_write(backup, old_state)
    atomic_private_write(state_path, restored)
    missing = parse_json(payloads['artifact-map.json']).get('missingArtifactReferences', [])
    return {'state': str(state_path), 'companies': len(data['office']['companies']), 'artifacts': len(destinations), 'backup': str(backup) if backup else None, 'missingArtifactReferences': len(missing), 'credentialsRestored': False}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path)
    parser.add_argument('--user-data-path', required=True, type=Path)
    parser.add_argument('--replace', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(restore_workspace(args.archive, args.user_data_path, args.replace)))
    except (OSError, ValueError, RecursionError, zipfile.BadZipFile) as error:
        raise SystemExit('Restore refused: ' + str(error))

if __name__ == '__main__':
    main()
