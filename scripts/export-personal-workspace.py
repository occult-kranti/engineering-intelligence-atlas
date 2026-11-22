#!/usr/bin/env python3
"""Export a private Atlas workspace, readable records and optional managed artifacts."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import zipfile

# Share archive limits and validation with the standalone restore implementation.
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('atlas_workspace_restore', Path(__file__).with_name('restore-personal-workspace.py'))
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)

RESTORE = '''# Restore your private Daftar workspace

This archive contains the complete company-state JSON, readable portfolio/company records, and the managed Markdown artifacts included during export. It does not include the credential vault, API tokens, model downloads, or executable code. Treat all workspace text and repository names as private.

1. Close Daftar and stop any headless worker using this workspace.
2. Use the restore script from the same Daftar release:

   python3 scripts/restore-personal-workspace.py --archive /path/to/workspace.zip --user-data-path /path/to/Daftar-user-data

The destination is the application user-data directory, not its company subdirectory. Daftar shows this location in its System panel. The command validates every checksum, JSON limits, archive path and managed artifact before writing state. It restores artifacts under office-artifacts/ and rewrites structured artifact references to their new paths. It never executes archive content or extracts arbitrary paths.

An existing company/company-state.json is preserved by default. To intentionally replace it, add --replace. The prior state receives a timestamped private backup. Existing artifacts are retained. A conflicting artifact or symlink destination is refused. Open Daftar afterward; its Rust core performs its normal state validation. Review policies and reconnect credentials through the destination computer's OS-backed keychain. Workers start disabled.

PORTFOLIO.md and companies/*.md are readable archive views; company-state.json is the complete canonical record. artifact-map.json lists included artifacts and any referenced files that were unavailable or outside the selected managed artifact root. Missing artifacts are not silently replaced. Textual history is preserved; structured artifact references are relocated. Checksums detect corruption, not who created the archive. Restore only your own trusted export. Never commit this archive to a public repository.
'''

def md(value):
    return str(value or '').replace('\r', ' ').replace('\n', ' ').replace('|', '\\|')

def artifact_references(value):
    found = set()
    stack = [value]
    while stack:
        item = stack.pop()
        if isinstance(item, dict):
            for key, child in item.items():
                if key in ('artifactUri', 'artifactPath', 'evidence', 'evidenceRefs'):
                    for reference in child if isinstance(child, list) else [child]:
                        if isinstance(reference, str) and (reference.startswith(('/', '\\\\')) or reference.lower().startswith('file:') or re.match(r'^[A-Za-z]:[\\/]', reference)):
                            found.add(reference)
                stack.append(child)
        elif isinstance(item, list):
            stack.extend(item)
    return found

def readable_records(data, mapping):
    office = data['office']
    companies = office['companies']
    portfolio = office.get('portfolio') or {}
    groups = portfolio.get('groups') or []
    roadmap = portfolio.get('roadmap') or []
    knowledge = office.get('knowledge') or []
    records = {}
    lines = ['# Private Daftar portfolio', '', f'Companies: {len(companies)}', '', 'This is a readable view of the canonical company-state.json. No credentials are included by the exporter.', '', '| Company | Repository | Status |', '| --- | --- | --- |']
    for company in companies:
        company_id = str(company['id'])
        filename = hashlib.sha256(company_id.encode()).hexdigest() + '.md'
        lines.append(f"| [{md(company.get('name'))}](companies/{filename}) | {md(company.get('repoUrl'))} | {md(company.get('status'))} |")
        company_groups = [g for g in groups if company_id in g.get('companyIds', [])]
        group_ids = {g['id'] for g in company_groups}
        items = [r for r in roadmap if (r.get('scope') or {}).get('kind') == 'global' or ((r.get('scope') or {}).get('kind') == 'company' and (r.get('scope') or {}).get('id') == company_id) or ((r.get('scope') or {}).get('kind') == 'group' and (r.get('scope') or {}).get('id') in group_ids)]
        notes = [k for k in knowledge if k.get('companyId') == company_id]
        body = [f"# {md(company.get('name'))}", '', f"Company ID: {md(company_id)}", f"Repository: {md(company.get('repoUrl'))}", f"Visibility: {md(company.get('visibility') or 'unspecified')}", f"Groups: {', '.join(md(g.get('name')) for g in company_groups) or 'None'}", '', '## Roadmap', '']
        for item in items[:200]:
            body.extend([f"### {md(item.get('title'))}", f"Status: {md(item.get('status'))} · Owner: {md(item.get('ownerEmployeeId'))} · Department: {md(item.get('departmentId'))}", md(item.get('description')), f"Dependencies: {', '.join(md(x) for x in item.get('dependencies', [])) or 'None'}", f"Evidence: {md(item.get('evidence'))}", ''])
        if not items:
            body.append('No portfolio roadmap items recorded.')
        body.extend(['', '## Knowledge and evidence', ''])
        for note in notes[:200]:
            ref = note.get('artifactUri')
            link = '../' + mapping[ref] if ref in mapping else str(ref or 'No artifact reference')
            body.extend([f"### {md(note.get('title'))}", md(note.get('summary')), f'Artifact: {link}', ''])
        if not notes:
            body.append('No company knowledge records recorded.')
        if len(items) > 200 or len(notes) > 200:
            body.append('This readable view shows the first 200 items of each section; the JSON retains every record.')
        records['companies/' + filename] = ('\n'.join(body) + '\n').encode()
    records['PORTFOLIO.md'] = ('\n'.join(lines) + '\n').encode()
    if sum(len(b) for b in records.values()) > restore.MAX_REPORT_BYTES:
        raise ValueError('Readable portfolio reports exceed the archive report limit.')
    return records

def export_workspace(state_path, output_path, artifact_root=None):
    state_path = restore.safe_path(state_path)
    raw = restore.read_regular(state_path, restore.MAX_STATE_BYTES)
    data = restore.parse_state(raw)
    payloads = {'company-state.json': raw, 'RESTORE.md': RESTORE.encode()}
    mapping = {}
    artifact_bytes = 0
    artifact_count = 0
    if artifact_root is not None:
        root = restore.safe_path(artifact_root)
        if not root.is_dir():
            raise ValueError('Choose an existing managed artifact directory.')
        entries = sorted(root.iterdir())
        if len(entries) > restore.MAX_ARTIFACTS * 2:
            raise ValueError('Managed artifact directory exceeds the bounded entry count.')
        for source in entries:
            if not re.fullmatch(r'[0-9a-f]{64}\.md', source.name):
                continue
            content = restore.read_regular(source, restore.MAX_ARTIFACT_BYTES)
            artifact_count += 1
            if artifact_count > restore.MAX_ARTIFACTS:
                raise ValueError('Too many managed artifact source files.')
            artifact_bytes += len(content)
            if artifact_bytes > restore.MAX_ARTIFACT_TOTAL:
                raise ValueError('Managed artifacts exceed the 96 MiB export limit.')
            member = 'artifacts/' + hashlib.sha256(content).hexdigest() + '.md'
            payloads.setdefault(member, content)
            mapping[str(source)] = member
            mapping[source.as_uri()] = member
            if len([name for name in payloads if name.startswith('artifacts/')]) > restore.MAX_ARTIFACTS:
                raise ValueError('Too many managed artifacts.')
    references = artifact_references(data)
    payloads['artifact-map.json'] = json.dumps({'schemaVersion': 1, 'artifacts': mapping, 'missingArtifactReferences': sorted(references - mapping.keys())}, ensure_ascii=False, indent=2).encode()
    payloads.update(readable_records(data, mapping))
    for name, body in payloads.items():
        maximum = restore.MAX_STATE_BYTES if name == 'company-state.json' else restore.MAX_ARTIFACT_BYTES if restore.ARTIFACT.fullmatch(name) else 8 * 1024 * 1024
        if len(body) > maximum:
            raise ValueError('Export member exceeds its restore size limit.')
    if len(payloads) + 1 > restore.MAX_MEMBERS or sum(len(b) for b in payloads.values()) > restore.MAX_TOTAL_BYTES:
        raise ValueError('Workspace exceeds the bounded archive limits.')
    payloads['SHA256SUMS'] = ''.join(hashlib.sha256(body).hexdigest() + '  ' + name + '\n' for name, body in sorted(payloads.items())).encode()
    output_path = restore.safe_path(output_path)
    if output_path == state_path:
        raise ValueError('Export output must not replace its source state.')
    output_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    restore.safe_path(output_path.parent)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.atlas-export-', dir=output_path.parent, delete=False) as handle:
            temporary = Path(handle.name)
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, body in sorted(payloads.items()):
                info = zipfile.ZipInfo(name)
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o600) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, body)
        os.chmod(temporary, 0o600)
        restore.safe_path(output_path)
        os.replace(temporary, output_path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {'output': str(output_path), 'bytes': output_path.stat().st_size, 'companies': len(data['office']['companies']), 'artifacts': len(set(mapping.values())), 'missingArtifactReferences': len(references - mapping.keys()), 'credentialsIncluded': False}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--artifact-root', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(export_workspace(args.state, args.out, args.artifact_root)))
    except (OSError, ValueError, RecursionError, zipfile.BadZipFile) as error:
        raise SystemExit('Export refused: ' + str(error))

if __name__ == '__main__':
    main()
