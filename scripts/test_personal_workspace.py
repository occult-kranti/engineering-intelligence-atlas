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

    def test_schema_two_roundtrip_preserves_paired_receipts_revisions_and_request_identity(self):
        data = json.loads(json.dumps(self.data))
        office = data['office']
        office['schemaVersion'] = 2
        artifact_hash = hashlib.sha256(self.artifact.read_bytes()).hexdigest()
        stamp = '2026-11-22T00:00:00Z'
        old = str(self.artifact)
        uri = self.artifact.as_uri()
        pair = {'stepId': 'step-a', 'phase': 'primary', 'peerEmployeeId': 'reviewer', 'primaryJobId': 'producer', 'reviewJobId': 'reviewer-job'}
        primary = {'id': 'producer', 'employeeId': 'producer-employee', 'status': 'completed', 'pair': pair,
                   'artifactUri': old, 'artifactSha256': artifact_hash, 'requestSha256': 'b' * 64,
                   'review': None, 'reviewFailure': None, 'usageRecorded': True, 'usage': {'costUsd': 0.125},
                   'goal': old, 'summary': uri}
        review = {'id': 'reviewer-job', 'employeeId': 'reviewer', 'status': 'completed',
                  'pair': {**pair, 'phase': 'review', 'peerEmployeeId': 'producer-employee'},
                  'artifactUri': old, 'artifactSha256': artifact_hash, 'requestSha256': 'c' * 64,
                  'usageRecorded': True, 'usage': {'costUsd': 0.05}, 'reviewFailure': None,
                  'review': {'verdict': 'accepted', 'primaryArtifactSha256': artifact_hash,
                             'reviewArtifactSha256': artifact_hash, 'primaryArtifactComplete': True,
                             'summary': old, 'evidenceRefs': [old, uri, 'https://example.org/evidence', 'project/check.md'],
                             'recordedAt': stamp}}
        failure = {'id': 'failed-review', 'status': 'completed', 'artifactUri': old,
                   'artifactSha256': artifact_hash, 'review': None,
                   'reviewFailure': {'reason': 'malformed-output', 'summary': old, 'recordedAt': stamp},
                   'usageRecorded': True, 'usage': {'costUsd': 0.025}}
        office['jobs'] = [primary, review, failure]
        estimate = {'optimisticMinutes': 1, 'likelyMinutes': 2, 'pessimisticMinutes': 4}
        office['goals'] = [{'id': 'goal-a', 'description': old, 'sourceRequestId': 'request-a',
                            'requestSha256': 'd' * 64, 'sourceMessageId': 'brief-a',
                            'steps': [{'id': 'step-a', 'employeeId': 'producer-employee', 'reviewerEmployeeId': 'reviewer',
                                       'reviewerServiceContractId': 'contract-a', 'estimate': estimate, 'reviewEstimate': estimate}]}]
        office['chatThreads'] = [{'id': 'thread-a', 'messages': [{'id': 'brief-a', 'content': old}]}]
        office['blueprints'] = [{'id': 'blueprint-a', 'revision': 8, 'whiteboards': [{'id': 'board-a', 'revision': 3, 'goalIds': ['goal-a'], 'jobIds': ['producer', 'reviewer-job']}]}]
        office['portfolio']['roadmap'][0].update({'revision': 5, 'reviewerEmployeeId': 'reviewer',
                                                'reviewerServiceContractId': 'contract-a', 'estimate': estimate,
                                                'reviewEstimate': estimate, 'goalIds': ['goal-a'], 'jobIds': ['producer']})
        self.state.write_text(json.dumps(data))
        exported = self.command('export-personal-workspace.py', '--state', self.state, '--out', self.archive, '--artifact-root', self.artifacts)
        self.assertEqual(exported.returncode, 0, exported.stderr)
        destination = self.root / 'v2-restored'
        result = self.command('restore-personal-workspace.py', '--archive', self.archive, '--user-data-path', destination)
        self.assertEqual(result.returncode, 0, result.stderr)
        restored = json.loads((destination / 'company' / 'company-state.json').read_text())
        relocated = str(destination / 'office-artifacts' / (artifact_hash + '.md'))
        expected = json.loads(json.dumps(data))
        for job in expected['office']['jobs']:
            job['artifactUri'] = relocated
        expected['office']['jobs'][1]['review']['evidenceRefs'][:2] = [relocated, relocated]
        expected['office']['knowledge'][0]['artifactUri'] = relocated
        expected['office']['cache']['entries'][0]['artifactUri'] = relocated
        self.assertEqual(restored, expected)
        self.assertEqual(restored['schemaVersion'], 1)
        self.assertEqual(restored['office']['schemaVersion'], 2)
        self.assertEqual(hashlib.sha256(Path(relocated).read_bytes()).hexdigest(), artifact_hash)
        self.assertEqual(json.loads(self.state.read_text()), data)
        with zipfile.ZipFile(self.archive) as archive:
            self.assertEqual(json.loads(archive.read('company-state.json')), data)

    def test_future_and_noninteger_state_versions_are_rejected_before_writes(self):
        for index, (outer_version, office_version) in enumerate([(1, 4), (1, 99), (2, 3), (True, 3), (1, True), (1, 3.0)]):
            with self.subTest(outer=outer_version, office=office_version):
                data = json.loads(json.dumps(self.data))
                data['schemaVersion'] = outer_version
                data['office']['schemaVersion'] = office_version
                self.state.write_text(json.dumps(data))
                output = self.root / f'unsupported-export-{index}.zip'
                exported = self.command('export-personal-workspace.py', '--state', self.state, '--out', output)
                self.assertNotEqual(exported.returncode, 0)
                self.assertIn('version', exported.stderr.lower())
                self.assertFalse(output.exists())
                with zipfile.ZipFile(self.archive) as original:
                    payloads = {name: original.read(name) for name in original.namelist() if name != 'SHA256SUMS'}
                payloads['company-state.json'] = json.dumps(data).encode()
                payloads['SHA256SUMS'] = ''.join(hashlib.sha256(body).hexdigest() + '  ' + name + '\n' for name, body in sorted(payloads.items())).encode()
                invalid_archive = self.root / f'unsupported-restore-{index}.zip'
                with zipfile.ZipFile(invalid_archive, 'w') as archive:
                    for name, body in payloads.items():
                        archive.writestr(name, body)
                destination = self.root / f'unsupported-destination-{index}'
                restored = self.command('restore-personal-workspace.py', '--archive', invalid_archive, '--user-data-path', destination)
                self.assertNotEqual(restored.returncode, 0)
                self.assertIn('version', restored.stderr.lower())
                self.assertFalse(destination.exists())

    def test_schema_three_roundtrip_preserves_notes_allowance_and_paused_session(self):
        data = json.loads(json.dumps(self.data)); office = data['office']; office['schemaVersion'] = 3
        stamp = '2026-11-22T00:00:00Z'
        office['stickyNotes'] = [{'id': 'sticky-fixture', 'revision': 7, 'companyId': 'fixture', 'officeId': 'office-fixture', 'departmentId': None,
            'kind': 'todo', 'color': 'purple', 'text': 'Review the next iteration 🎨', 'status': 'open', 'ownerEmployeeId': 'donna',
            'goalIds': ['goal-fixture'], 'x': 0.2, 'y': 0.3, 'createdAt': stamp, 'updatedAt': stamp}]
        office['improvementAllowance'] = {'id': 'allowance-fixture', 'capUsd': 20, 'carriedObservedUsd': 0.234182, 'carriedEstimatedUsd': 0, 'sourceReference': 'fixture:prior-usage', 'createdAt': stamp}
        office['improvementSessions'] = [{'id': 'session-fixture', 'revision': 4, 'allowanceId': 'allowance-fixture', 'companyId': 'fixture',
            'continuation': 'until-budget', 'maxCycles': None, 'status': 'paused', 'cycle': 2, 'activeGoalId': 'goal-fixture',
            'goalIds': ['goal-fixture'], 'taskNoteIds': ['sticky-fixture'], 'stopReason': 'owner-paused', 'objective': str(self.artifact)}]
        office['improvementReceipts'] = [{'requestId': 'create-fixture', 'requestSha256': 'a' * 64, 'result': {'sessionId': 'session-fixture'}}]
        office['jobs'][0].update({'improvementSessionId': 'session-fixture', 'budgetHoldUsd': 0.12})
        self.state.write_text(json.dumps(data))
        exported = self.command('export-personal-workspace.py', '--state', self.state, '--out', self.archive, '--artifact-root', self.artifacts)
        self.assertEqual(exported.returncode, 0, exported.stderr)
        destination = self.root / 'v3-restored'
        restored_run = self.command('restore-personal-workspace.py', '--archive', self.archive, '--user-data-path', destination)
        self.assertEqual(restored_run.returncode, 0, restored_run.stderr)
        restored = json.loads((destination / 'company' / 'company-state.json').read_text())
        for field in ['stickyNotes', 'improvementAllowance', 'improvementSessions', 'improvementReceipts']:
            self.assertEqual(restored['office'][field], office[field])
        self.assertEqual(restored['office']['jobs'][0]['improvementSessionId'], 'session-fixture')
        self.assertEqual(restored['office']['jobs'][0]['budgetHoldUsd'], 0.12)
        self.assertEqual(restored['office']['schemaVersion'], 3)
        self.assertEqual(restored['office']['improvementSessions'][0]['objective'], str(self.artifact))
        self.assertEqual(json.loads(self.state.read_text()), data)

    def test_export_reports_missing_structured_review_artifacts_only(self):
        missing = str(self.artifacts / ('f' * 64 + '.md'))
        self.data['office']['schemaVersion'] = 2
        self.data['office']['jobs'][0]['review'] = {'evidenceRefs': [missing, 'https://example.org/report', 'project/check.md'], 'summary': str(self.root / 'private-note.md')}
        self.state.write_text(json.dumps(self.data))
        result = self.command('export-personal-workspace.py', '--state', self.state, '--out', self.archive, '--artifact-root', self.artifacts)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['missingArtifactReferences'], 1)
        with zipfile.ZipFile(self.archive) as archive:
            self.assertEqual(json.loads(archive.read('artifact-map.json'))['missingArtifactReferences'], [missing])

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
        state = {'artifactUri': node, 'review': {'evidenceRefs': [py]}, 'summary': node, 'note': 'see ' + node + ' for details'}
        result = self.restore.remap_references(state, {py: new})
        self.assertEqual(result['artifactUri'], new)
        self.assertEqual(result['review']['evidenceRefs'], [new])
        self.assertEqual(result['summary'], node)
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
