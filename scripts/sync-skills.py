#!/usr/bin/env python3
"""Build/check inert skill packages and native briefs; never executes skill content."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tempfile
import zipfile

NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
MAX_BODY_CHARACTERS = 16000  # JavaScript UTF-16 units; OfficeWorker's loaded limit.
MAX_BUNDLE_BYTES = 500000
MAX_FILE_BYTES = 5 * 1024 * 1024
PROTOCOL_REL = Path("references/collaboration_protocol.md")
IGNORED = {"__pycache__"}


class SkillSyncError(ValueError):
    pass


def safe_file(root, relative, *, missing=False):
    relative = Path(relative)
    if relative.is_absolute() or any(p in {"", ".", ".."} or "\\" in p or any(ord(c) < 32 for c in p) for p in relative.parts):
        raise SkillSyncError(f"Unsafe relative path: {relative}")
    target = root / relative
    for item in [target, *target.parents]:
        if item == root:
            break
        if item.is_symlink():
            raise SkillSyncError(f"Symlink is not a source or output: {relative}")
    if target.exists() and not target.is_file():
        raise SkillSyncError(f"Expected a regular file: {relative}")
    if not missing and not target.exists():
        raise SkillSyncError(f"Missing source: {relative}")
    return target


def source_files(root, directory):
    result = {}
    for base, dirs, names in os.walk(directory, followlinks=False):
        base = Path(base)
        for name in dirs + names:
            child = base / name
            if child.is_symlink():
                raise SkillSyncError(f"Symlink in skill: {child.relative_to(root)}")
            if name.startswith('.'):
                raise SkillSyncError(f"Hidden skill content needs explicit review: {child.relative_to(root)}")
        dirs[:] = sorted(n for n in dirs if n not in IGNORED)
        for name in sorted(names):
            if name.endswith(('.pyc', '.pyo')):
                continue
            child = safe_file(root, (base / name).relative_to(root))
            if child.stat().st_size > MAX_FILE_BYTES:
                raise SkillSyncError(f"Skill file exceeds 5 MiB: {child.relative_to(root)}")
            result[child.relative_to(directory).as_posix()] = child.read_bytes()
    return result


def archive_bytes(name, files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for relative, body in sorted(files.items()):
            info = zipfile.ZipInfo(f"{name}/{relative}", date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, body, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    return output.getvalue()


def plan(root):
    root = Path(root).resolve()
    skills = root / 'skills'
    if not skills.is_dir() or skills.is_symlink():
        raise SkillSyncError('A regular skills directory is required')
    protocol = safe_file(root, 'organization/skill_collaboration_protocol.md').read_bytes()
    protocol.decode('utf8')
    expected, packages, briefs, obsolete = {}, {}, [], []
    for directory in sorted(skills.iterdir()):
        if directory.is_symlink():
            raise SkillSyncError(f"Symlink in skills: {directory.name}")
        if not directory.is_dir():
            continue
        name = directory.name
        if not NAME.fullmatch(name) or len(name) > 64:
            raise SkillSyncError(f"Invalid skill directory name: {name}")
        files = source_files(root, directory)
        if 'SKILL.md' not in files:
            raise SkillSyncError(f"Missing SKILL.md: {name}")
        body = files['SKILL.md'].decode('utf8')
        front = re.match(r"\A---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|\Z)", body)
        names = re.findall(r"^name:\s*([^\r\n]+)", front.group(1), re.M) if front else []
        if len(names) != 1 or names[0].strip().strip("\"'") != name:
            raise SkillSyncError(f"Missing, duplicate or mismatched frontmatter name: {name}")
        if len(body.encode('utf-16-le')) // 2 > MAX_BODY_CHARACTERS:
            raise SkillSyncError(f"Skill body exceeds native 16000-character limit: {name}")
        files[PROTOCOL_REL.as_posix()] = protocol
        packages[name] = files
        expected[Path('skills') / name / PROTOCOL_REL] = protocol
        expected[Path('skills') / (name + '.skill')] = archive_bytes(name, files)
        briefs.append({'path': f'skills/{name}/SKILL.md', 'name': name,
                       'sha256': hashlib.sha256(files['SKILL.md']).hexdigest(), 'body': body})
    if not packages:
        raise SkillSyncError('No skill sources found')
    for archive in skills.glob('*.skill'):
        if archive.stem not in packages:
            raise SkillSyncError(f"Orphan skill archive requires review: {archive.name}")
    bundle = (json.dumps(briefs, ensure_ascii=False, indent=2) + '\n').encode('utf8')
    if len(bundle) > MAX_BUNDLE_BYTES:
        raise SkillSyncError('Native skill brief bundle exceeds 500000 bytes')
    expected[Path('company/skill-briefs.json')] = bundle
    mirror_root = root / 'site-source/public/research/skills'
    mirror_count = 0
    if mirror_root.exists():
        if mirror_root.is_symlink():
            raise SkillSyncError('Public mirror root may not be a symlink')
        for mirror in sorted(mirror_root.iterdir()):
            if not mirror.is_dir() or mirror.is_symlink() or mirror.name not in packages:
                raise SkillSyncError(f"Unexpected public skill mirror: {mirror.name}")
            mirror_count += 1
            current = source_files(root, mirror)
            prefix = mirror.relative_to(root)
            for relative, body in packages[mirror.name].items():
                expected[prefix / relative] = body
            obsolete.extend(prefix / relative for relative in current.keys() - packages[mirror.name].keys())
    for relative in [*expected, *obsolete]:
        safe_file(root, relative, missing=True)
    return expected, sorted(obsolete), {'skills': len(packages), 'public_mirrors': mirror_count,
        'brief_bundle_bytes': len(bundle), 'max_body_characters': max(len(b['body'].encode('utf-16-le')) // 2 for b in briefs)}


def synchronize(root, *, write=False):
    root = Path(root).resolve()
    expected, obsolete, stats = plan(root)
    changed = [p for p, body in expected.items() if not (root / p).exists() or (root / p).read_bytes() != body]
    if write:
        for relative in changed:
            target = safe_file(root, relative, missing=True)
            target.parent.mkdir(parents=True, exist_ok=True)
            fd, temporary = tempfile.mkstemp(prefix='.skill-sync-', dir=target.parent)
            try:
                with os.fdopen(fd, 'wb') as handle:
                    handle.write(expected[relative])
                os.chmod(temporary, 0o644)
                safe_file(root, relative, missing=True)
                os.replace(temporary, target)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
        for relative in obsolete:
            safe_file(root, relative).unlink()
    return {**stats, 'mode': 'write' if write else 'check', 'changed': [p.as_posix() for p in sorted(changed)],
            'removed': [p.as_posix() for p in obsolete], 'ok': write or not (changed or obsolete)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true', help='Regenerate reviewed derived files')
    mode.add_argument('--check', action='store_true', help='Report drift without writing (default)')
    args = parser.parse_args()
    try:
        result = synchronize(args.root, write=args.write)
    except (OSError, UnicodeError, SkillSyncError) as error:
        parser.exit(2, f'Skill synchronization rejected: {error}\n')
    print(json.dumps(result, indent=2))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
