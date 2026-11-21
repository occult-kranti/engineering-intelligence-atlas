#!/usr/bin/env python3
"""Portable workspace integration checks using synthetic temporary data only."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPTS = Path(__file__).resolve().parent

class PersonalWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='atlas-portability-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.artifacts = self.root / 'old-user-data' / 'office-artifacts'
        self.artifacts.mkdir(parents=True)
        self.artifact = self.artifacts / ('a' * 64 + '.md')
        self.artifact.write_text('# Fixture deliverable\n\nObserved evidence remains readable.\n')
        self.state = self.root / 'company-state.json'
        self.data = {'schemaVersion': 1, 'company': {'id': 'fixture', 'githubStatus': 'verified'}, 'tasks': [{'id': 'done', 'status': 'done', 'evidence': 'Fixture release history'}], 'office': {'schemaVersion': 1, 'activeCompanyId': 'fixture', 'companies': [{'id': 'fixture', 'name': 'Synthetic company', 'repoUrl': 'https://github.com/example/fixture', 'status': 'active', 'visibility': 'private'}], 'jobs': [{'id': 'job', 'status': 'completed', 'artifactUri': str(self.artifact), 'usage': {'costUsd': 0.125}}], 'knowledge': [{'id': 'knowledge', 'companyId': 'fixture', 'title': 'Fixture evidence', 'summary': 'Retained evidence summary', 'artifactUri': str(self.artifact)}], 'events': [{'action': 'job-settled', 'summary': 'Actual prior history'}], 'cache': {'entries': [{'artifactUri': str(self.artifact)}]}, 'portfolio': {'groups': [], 'roadmap': [{'id': 'roadmap', 'scope': {'kind': 'company', 'id': 'fixture'}, 'title': 'Complete fixture', 'status': 'done', 'ownerEmployeeId': 'donna', 'evidence': 'Retained evidence'}]}}}
        self.state.write_text(json.dumps(self.data))
        self.archive = self.root / 'workspace.zip'
        result = self.command('export-personal-workspace.py', '--state', self.state, '--out', self.archive, '--artifact-root', self.artifacts)
        self.assertEqual(result.returncode, 0, result.stderr)

    def command(self, script, *args):
        return subprocess.run([sys.executable, str(SCRIPTS / script), *map(str, args)], capture_output=True, text=True, timeout=20)

    def test_roundtrip_relocates_artifacts_and_preserves_history(self):
        destination = self.root / 'new-user-data'
        result = self.command('restore-personal-workspace.py', '--archive', self.archive, '--user-data-path', destination)
        self.assertEqual(result.returncode, 0, result.stderr)
        restored_path = destination / 'company' / 'company-state.json'
        restored = json.loads(restored_path.read_text())
        artifact = Path(restored['office']['jobs'][0]['artifactUri'])
        self.assertEqual(artifact.parent, destination / 'office-artifacts')
        self.assertEqual(artifact.read_text(), self.artifact.read_text())
        self.assertEqual(restored['office']['knowledge'][0]['artifactUri'], str(artifact))
        self.assertEqual(restored['office']['cache']['entries'][0]['artifactUri'], str(artifact))
        self.assertEqual(restored['office']['events'], self.data['office']['events'])
        self.assertEqual(restored['tasks'], self.data['tasks'])
        self.assertEqual(restored['office']['jobs'][0]['usage'], {'costUsd': 0.125})
        self.assertEqual(json.loads(self.state.read_text()), self.data)
        if os.name == 'posix':
            self.assertEqual(stat.S_IMODE(restored_path.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(artifact.stat().st_mode), 0o600)
        with zipfile.ZipFile(self.archive) as archive:
            company = 'companies/' + hashlib.sha256(b'fixture').hexdigest() + '.md'
            self.assertIn(company, archive.namelist())
            self.assertIn('Retained evidence summary', archive.read(company).decode())
            self.assertIn('--replace', archive.read('RESTORE.md').decode())
            self.assertIn('Synthetic company', archive.read('PORTFOLIO.md').decode())
            self.assertFalse(any('vault' in name for name in archive.namelist()))

    def test_checksum_tampering_is_rejected_before_destination_creation(self):
        tampered = self.root / 'tampered.zip'
        with zipfile.ZipFile(self.archive) as source, zipfile.ZipFile(tampered, 'w') as target:
            for info in source.infolist():
                body = source.read(info)
                if info.filename.startswith('artifacts/'):
                    body += b'Altered evidence'
                target.writestr(info, body)
        destination = self.root / 'tampered-destination'
        result = self.command('restore-personal-workspace.py', '--archive', tampered, '--user-data-path', destination)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('checksum', result.stderr.lower())
        self.assertFalse(destination.exists())

    def test_existing_destination_is_preserved_unless_replace_creates_backup(self):
        destination = self.root / 'existing-user-data'
        state = destination / 'company' / 'company-state.json'
        state.parent.mkdir(parents=True)
        previous = b'{"original":"preserve every byte"}\n'
        state.write_bytes(previous)
        refused = self.command('restore-personal-workspace.py', '--archive', self.archive, '--user-data-path', destination)
        self.assertNotEqual(refused.returncode, 0)
        self.assertEqual(state.read_bytes(), previous)
        restored = self.command('restore-personal-workspace.py', '--archive', self.archive, '--user-data-path', destination, '--replace')
        self.assertEqual(restored.returncode, 0, restored.stderr)
        backup = Path(json.loads(restored.stdout)['backup'])
        self.assertEqual(backup.read_bytes(), previous)
        self.assertEqual(json.loads(state.read_text())['tasks'], self.data['tasks'])

    def test_symlink_destination_and_unsafe_zip_member_are_refused(self):
        external = self.root / 'external'
        external.mkdir()
        destination = self.root / 'symlink-destination'
        destination.mkdir()
        (destination / 'company').symlink_to(external, target_is_directory=True)
        result = self.command('restore-personal-workspace.py', '--archive', self.archive, '--user-data-path', destination)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((external / 'company-state.json').exists())
        unsafe = self.root / 'unsafe.zip'
        with zipfile.ZipFile(self.archive) as source, zipfile.ZipFile(unsafe, 'w') as target:
            for info in source.infolist():
                target.writestr(info, source.read(info))
            target.writestr('../escaped.md', 'Must not extract')
        fresh = self.root / 'unsafe-destination'
        result = self.command('restore-personal-workspace.py', '--archive', unsafe, '--user-data-path', fresh)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(fresh.exists())
        self.assertFalse((self.root / 'escaped.md').exists())

class FileUriCanonicalizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import importlib.util
        spec = importlib.util.spec_from_file_location('atlas_restore_under_test', SCRIPTS / 'restore-personal-workspace.py')
        cls.restore = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.restore)

    def test_encoded_and_unencoded_tilde_are_equivalent(self):
        py = 'file:///C:/Users/RUNNER~1/AppData/office-artifacts/' + 'a' * 64 + '.md'
        node = 'file:///C:/Users/RUNNER%7E1/AppData/office-artifacts/' + 'a' * 64 + '.md'
        self.assertEqual(self.restore.canonical_file_uri(py), self.restore.canonical_file_uri(node))
        new = 'C:/new/office-artifacts/' + 'a' * 64 + '.md'
        state = {'a': node, 'b': [py], 'note': 'see ' + node + ' for details'}
        result = self.restore.remap_references(state, {py: new})
        self.assertEqual(result['a'], new)
        self.assertEqual(result['b'], [new])
        self.assertEqual(result['note'], 'see ' + node + ' for details')

    def test_unrelated_local_and_remote_references_are_untouched(self):
        py = 'file:///C:/Users/RUNNER~1/x/' + 'a' * 64 + '.md'
        other = 'file:///C:/Users/RUNNER~1/x/' + 'b' * 64 + '.md'
        unc = 'file://server/share/x/' + 'a' * 64 + '.md'
        https = 'https://example.com/C:/Users/RUNNER~1/x/' + 'a' * 64 + '.md'
        result = self.restore.remap_references([other, unc, https], {py: '/new/a.md'})
        self.assertEqual(result, [other, unc, https])
        self.assertIsNone(self.restore.canonical_file_uri(unc))
        self.assertIsNone(self.restore.canonical_file_uri(https))

if __name__ == '__main__':
    unittest.main()
