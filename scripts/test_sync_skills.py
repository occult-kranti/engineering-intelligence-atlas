"""Skill package tests use disposable synthetic files and never run bundled code."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
import zipfile

SPEC = importlib.util.spec_from_file_location('sync_skills', Path(__file__).with_name('sync-skills.py'))
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)


class SkillSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'organization').mkdir()
        (self.root / 'organization/skill_collaboration_protocol.md').write_text('# Canonical protocol\n')
        for name in ['first-skill', 'second-skill']:
            directory = self.root / 'skills' / name
            (directory / 'references').mkdir(parents=True)
            (directory / 'SKILL.md').write_text(f'---\nname: {name}\ndescription: >-\n  Useful synthetic skill.\n---\n# Skill\n')
            (directory / 'references/example.md').write_text('Reviewed fixture\n')
        mirror = self.root / 'site-source/public/research/skills/first-skill'
        mirror.mkdir(parents=True)
        (mirror / 'SKILL.md').write_text('stale')

    def test_complete_bundle_protocol_archives_and_mirror(self):
        result = sync.synchronize(self.root, write=True)
        self.assertEqual((result['skills'], result['public_mirrors']), (2, 1))
        self.assertTrue(sync.synchronize(self.root)['ok'])
        briefs = json.loads((self.root / 'company/skill-briefs.json').read_text())
        for brief in briefs:
            body = (self.root / brief['path']).read_bytes()
            self.assertEqual(body.decode(), brief['body'])
            self.assertEqual(hashlib.sha256(body).hexdigest(), brief['sha256'])
            name = brief['name']
            with zipfile.ZipFile(self.root / 'skills' / f'{name}.skill') as archive:
                self.assertEqual(archive.read(f'{name}/SKILL.md'), body)
                self.assertEqual(archive.read(f'{name}/references/collaboration_protocol.md'), b'# Canonical protocol\n')
        self.assertFalse((self.root / 'site-source/public/research/skills/second-skill').exists())

    def test_check_is_read_only_and_repeat_write_is_deterministic(self):
        initial = sync.synchronize(self.root)
        self.assertFalse(initial['ok'])
        self.assertFalse((self.root / 'company').exists())
        sync.synchronize(self.root, write=True)
        expected, _, _ = sync.plan(self.root)
        before = {p: (self.root / p).read_bytes() for p in expected}
        for p in (self.root / 'skills').glob('*/SKILL.md'):
            os.utime(p, (1000000000, 1000000000))
        self.assertEqual(sync.synchronize(self.root, write=True)['changed'], [])
        self.assertEqual(before, {p: (self.root / p).read_bytes() for p in expected})

    def test_source_and_protocol_edits_have_detectable_drift(self):
        sync.synchronize(self.root, write=True)
        body = self.root / 'skills/first-skill/SKILL.md'
        body.write_text(body.read_text() + 'New task contract.\n')
        (self.root / 'organization/skill_collaboration_protocol.md').write_text('# Revised canonical\n')
        result = sync.synchronize(self.root)
        self.assertIn('company/skill-briefs.json', result['changed'])
        self.assertIn('skills/second-skill/references/collaboration_protocol.md', result['changed'])
        sync.synchronize(self.root, write=True)
        self.assertTrue(sync.synchronize(self.root)['ok'])

    def test_removed_source_reference_is_removed_only_from_mirror_and_archive(self):
        sync.synchronize(self.root, write=True)
        (self.root / 'skills/first-skill/references/example.md').unlink()
        sync.synchronize(self.root, write=True)
        self.assertFalse((self.root / 'site-source/public/research/skills/first-skill/references/example.md').exists())
        with zipfile.ZipFile(self.root / 'skills/first-skill.skill') as archive:
            self.assertNotIn('first-skill/references/example.md', archive.namelist())

    def test_bundled_code_is_inert_and_cache_is_excluded(self):
        directory = self.root / 'skills/first-skill'
        (directory / 'scripts').mkdir()
        (directory / 'scripts/never_execute.py').write_text('raise RuntimeError("must not run")\n')
        (directory / 'scripts/__pycache__').mkdir()
        (directory / 'scripts/__pycache__/cache.pyc').write_bytes(b'not a source')
        sync.synchronize(self.root, write=True)
        with zipfile.ZipFile(self.root / 'skills/first-skill.skill') as archive:
            self.assertIn('first-skill/scripts/never_execute.py', archive.namelist())
            self.assertFalse(any('__pycache__' in p for p in archive.namelist()))

    def test_symlink_source_and_output_are_rejected_before_writes(self):
        link = self.root / 'skills/first-skill/references/linked.md'
        link.symlink_to(self.root / 'organization/skill_collaboration_protocol.md')
        with self.assertRaises(sync.SkillSyncError): sync.synchronize(self.root, write=True)
        self.assertFalse((self.root / 'company').exists())
        link.unlink()
        (self.root / 'company').symlink_to(self.root / 'organization', target_is_directory=True)
        with self.assertRaises(sync.SkillSyncError): sync.synchronize(self.root, write=True)
        self.assertFalse((self.root / 'skills/first-skill.skill').exists())

    def test_name_mismatch_duplicate_and_missing_frontmatter_rejected(self):
        path = self.root / 'skills/first-skill/SKILL.md'
        for text in ['---\nname: other\n---\nBody', '---\nname: first-skill\nname: first-skill\n---\nBody', '# no frontmatter']:
            path.write_text(text)
            with self.assertRaises(sync.SkillSyncError): sync.synchronize(self.root, write=True)
        self.assertFalse((self.root / 'company').exists())

    def test_utf16_body_limit_and_orphan_archive(self):
        path = self.root / 'skills/first-skill/SKILL.md'
        original = path.read_text()
        path.write_text(original + '\U0001f600' * 8000)
        with self.assertRaisesRegex(sync.SkillSyncError, '16000'): sync.synchronize(self.root)
        path.write_text(original)
        (self.root / 'skills/unknown.skill').write_bytes(b'old package')
        with self.assertRaisesRegex(sync.SkillSyncError, 'Orphan'): sync.synchronize(self.root)

    def test_unexpected_mirror_and_hidden_source_rejected(self):
        hidden = self.root / 'skills/first-skill/.env'
        hidden.write_text('synthetic placeholder')
        with self.assertRaises(sync.SkillSyncError): sync.synchronize(self.root)
        hidden.unlink()
        (self.root / 'site-source/public/research/skills/unregistered').mkdir()
        with self.assertRaisesRegex(sync.SkillSyncError, 'Unexpected'): sync.synchronize(self.root)


if __name__ == '__main__':
    unittest.main()
