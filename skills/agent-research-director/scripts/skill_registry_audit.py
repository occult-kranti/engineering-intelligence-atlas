#!/usr/bin/env python3
"""Non-executing skill inventory/provenance audit; not a malware scanner or safety verdict."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path

import yaml

RISK_SIGNALS = ('requests.', 'urllib', 'socket.', 'subprocess', 'os.environ', 'api_key', 'token', 'secret', 'credential', 'eval(', 'exec(', 'rm -rf', 'sudo ', 'chmod ', 'docker ', 'podman ', 'curl ', 'wget ', 'upload')
CONFIG_NAMES = ('hooks.json', '.mcp.json', 'mcp.json', 'plugin.json', 'marketplace.json')

def sha256_file(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    args = p.parse_args()
    root = args.root.resolve()
    if not root.is_dir():
        p.error('root must be a directory')
    if args.output.exists():
        p.error('output exists; preserve prior audits')
    skills = []
    for skill_file in sorted(root.rglob('SKILL.md')):
        if any(part.startswith('.') for part in skill_file.relative_to(root).parts[:-1]):
            continue
        skill_root = skill_file.parent
        entry = {'path': str(skill_root.relative_to(root)), 'name_reported': None, 'frontmatter_fields': [], 'required_metadata_present': False, 'name_matches_directory': None, 'files': [], 'license_or_notice_files': [], 'config_or_hook_files': [], 'review_signals': []}
        try:
            text = skill_file.read_text(encoding='utf-8')
            parts = text.split('---', 2)
            meta = yaml.safe_load(parts[1]) if len(parts) >= 3 else None
            if isinstance(meta, dict):
                entry['name_reported'] = meta.get('name')
                entry['frontmatter_fields'] = sorted(map(str, meta.keys()))
                entry['required_metadata_present'] = bool(meta.get('name') and meta.get('description'))
                entry['name_matches_directory'] = meta.get('name') == skill_root.name
        except Exception as exc:
            entry['metadata_error'] = type(exc).__name__
        for file in sorted(skill_root.rglob('*')):
            if not file.is_file():
                continue
            if file.is_symlink():
                entry['review_signals'].append({'file': str(file.relative_to(skill_root)), 'signal': 'symlink requires manual target review'})
                continue
            rel = str(file.relative_to(skill_root))
            item = {'path': rel, 'bytes': file.stat().st_size, 'sha256': sha256_file(file)}
            entry['files'].append(item)
            lower = file.name.lower()
            if 'license' in lower or 'copying' in lower or 'notice' in lower:
                entry['license_or_notice_files'].append(rel)
            if lower in CONFIG_NAMES or 'hook' in lower or lower.endswith(('.mcp.json', '.plugin.json')):
                entry['config_or_hook_files'].append(rel)
            if file.suffix.lower() in ('.py', '.sh', '.js', '.ts', '.mjs', '.ps1', '.rb', '.go', '.rs'):
                try:
                    content = file.read_text(encoding='utf-8')
                    for line_no, line in enumerate(content.splitlines(), 1):
                        for signal in RISK_SIGNALS:
                            if signal.lower() in line.lower():
                                entry['review_signals'].append({'file': rel, 'line': line_no, 'signal': signal})
                except UnicodeDecodeError:
                    entry['review_signals'].append({'file': rel, 'signal': 'binary script not text-reviewed'})
        entry['review_required'] = bool(entry['review_signals'] or entry['config_or_hook_files'] or not entry['required_metadata_present'] or not entry['license_or_notice_files'])
        skills.append(entry)
    output = {
        'schema_version': '1.0', 'created_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'root': str(root), 'skill_count': len(skills), 'skills': skills,
        'summary': {'skills_requiring_review': sum(bool(s['review_required']) for s in skills), 'symlinks_flagged': sum(any(x['signal'].startswith('symlink') for x in s['review_signals']) for s in skills)},
        'limitations': ['Static inventory and keyword signals only', 'Not a malware scan, license opinion, sandbox, or safety certification', 'Review full instructions, scripts, dependencies, manifests, network/data effects, and hashes before activation']
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(json.dumps({'output': str(args.output), 'skill_count': len(skills), 'skills_requiring_review': output['summary']['skills_requiring_review']}, indent=2))


if __name__ == '__main__':
    main()
