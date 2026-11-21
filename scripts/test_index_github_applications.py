"""Synthetic read-only indexer checks. No credentials, real repositories, or network."""
import base64
import concurrent.futures
import copy
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import threading
import unittest
from unittest.mock import patch

import index_github_applications as subject


class Response(io.BytesIO):
    status = 200


class FakeOpener:
    def __init__(self, body=b'<title>Synthetic dashboard</title>'):
        self.body = body
        self.calls = []
        self.lock = threading.Lock()

    def open(self, request, timeout):
        with self.lock:
            self.calls.append((request, timeout))
        value = self.body(request) if callable(self.body) else self.body
        return Response(value)


class IndexerTests(unittest.TestCase):
    def setUp(self):
        self.now = 1795219200
        self.repo = {'html_url': 'https://github.com/example/synthetic-app', 'full_name': 'example/synthetic-app',
                     'name': 'synthetic-app', 'homepage': 'https://synthetic.pages.dev/#overview',
                     'updated_at': '2026-11-20T00:00:00Z', 'created_at': '2025-01-01T00:00:00Z',
                     'pushed_at': '2026-11-20T00:00:00Z', 'has_pages': False, 'default_branch': 'main'}
        self.company = {'id': 'synthetic', 'name': 'Synthetic application', 'repoUrl': self.repo['html_url']}

    def indexer(self, opener=None, **kwargs):
        return subject.Indexer('synthetic-test-credential', opener=opener or FakeOpener(), wall_clock=lambda: self.now, **kwargs)

    def test_safe_links_and_normalized_probe_identity(self):
        for raw in (None, '', 'http://synthetic.pages.dev', 'https://a:b@synthetic.pages.dev',
                    'https://synthetic.pages.dev/?token=', 'https://synthetic.pages.dev/#access_token=value',
                    'https://synthetic.pages.dev/?api_key=secret', 'https://synthetic.pages.dev:\n443',
                    'https://synthetic.pages.dev:bad', 'https://synthetic.pages.dev/a b'):
            self.assertIsNone(subject.safe_url(raw), raw)
        self.assertEqual(subject.probe_key('https://SYNTHETIC.pages.dev:443/#one'), 'https://synthetic.pages.dev/')
        for url in ('https://synthetic.pages.dev.attacker.example/', 'https://github.com/example/app',
                    'https://synthetic.pages.dev:444/'):
            self.assertIsNone(subject.probe_key(url))
        self.assertIsNone(subject.NoRedirect().redirect_request(None))

    def test_parallel_duplicate_probes_share_one_request(self):
        opener = FakeOpener()
        indexer = self.indexer(opener)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(indexer.probe, [f'https://synthetic.pages.dev/#{i}' for i in range(40)]))
        self.assertEqual(len(opener.calls), 1)
        self.assertEqual(indexer.counts['probeRequests'], 1)
        self.assertTrue(all(result['verified'] for result in results))
        self.assertEqual(opener.calls[0][0].full_url, 'https://synthetic.pages.dev/')

    def test_global_cap_and_deadline_retain_unprobed_links(self):
        opener = FakeOpener()
        indexer = self.indexer(opener, max_probes=2)
        for i in range(8):
            indexer.probe(f'https://synthetic-{i}.pages.dev/')
        self.assertEqual(len(opener.calls), 2)
        self.assertEqual(indexer.counts['probeLimitSkips'], 6)
        clock = [0]
        stopped = self.indexer(opener, clock=lambda: clock[0], max_seconds=1)
        clock[0] = 2
        row = stopped.record(self.repo, self.company, [])
        self.assertEqual(len(opener.calls), 2)
        self.assertEqual(row['status'], 'unverified')
        self.assertEqual(len(row['links']), 2)
        self.assertNotIn('verifiedAt', row['links'][1])

    def test_cached_proof_keeps_observed_time_and_future_proof_is_rejected(self):
        key = 'https://synthetic.pages.dev/'
        observed = subject.stamp(self.now - 300)
        cached = {'probes': {key: {'verified': True, 'checkedAt': observed}}}
        opener = FakeOpener()
        indexer = self.indexer(opener, cache=cached)
        indexer.discover = lambda repo: [('Dashboard', key, repo['html_url'])]
        row = indexer.record(self.repo, self.company, [])
        self.assertEqual(row['links'][1]['verifiedAt'], observed)
        self.assertEqual(len(opener.calls), 0)
        self.assertEqual(row['links'][0]['verification'], 'reported')
        self.assertNotIn('verifiedAt', row['links'][0])
        cached['probes'][key]['checkedAt'] = subject.stamp(self.now + 60)
        self.indexer(opener, cache=cached).probe(key)
        self.assertEqual(len(opener.calls), 1)

    def test_credentials_are_sent_only_to_fixed_github_api(self):
        opener = FakeOpener(lambda req: b'{}' if req.full_url.startswith('https://api.github.com/') else b'<title>App</title>')
        indexer = self.indexer(opener)
        indexer.api('example/synthetic-app', 'readme')
        indexer.probe('https://synthetic.pages.dev/')
        self.assertEqual(opener.calls[0][0].get_header('Authorization'), 'Bearer synthetic-test-credential')
        self.assertIsNone(opener.calls[1][0].get_header('Authorization'))
        self.assertIsNone(opener.calls[1][0].get_header('Cookie'))
        self.assertLessEqual(opener.calls[0][1], 12)
        self.assertLessEqual(opener.calls[1][1], 6)
        for name in ('example/repo?access_token=bad', '../api', 'example/repo\n', 'https://other.example/'):
            self.assertIsNone(indexer.api(name, 'readme'))
        self.assertEqual(len(opener.calls), 2)

    def test_discovery_cache_invalidates_on_push_without_storing_readme(self):
        text = '[Live app](https://synthetic.pages.dev/#again)\n[Preview](https://other.pages.dev/)\nPRIVATE FIXTURE BODY'
        body = json.dumps({'content': base64.b64encode(text.encode()).decode(), 'html_url': self.repo['html_url'] + '/blob/main/README.md'}).encode()
        opener = FakeOpener(body)
        indexer = self.indexer(opener)
        self.assertEqual(len(indexer.discover(self.repo)), 2)
        self.assertEqual(len(indexer.discover(self.repo)), 2)
        self.assertEqual(len(opener.calls), 1)
        changed = {**self.repo, 'pushed_at': '2026-11-21T00:00:00Z'}
        indexer.discover(changed)
        self.assertEqual(len(opener.calls), 2)
        saved = json.dumps(indexer.cache_snapshot())
        self.assertNotIn('PRIVATE FIXTURE BODY', saved)
        self.assertNotIn('synthetic-test-credential', saved)

    def test_response_limit_and_sign_in_pages_are_not_verified(self):
        opener = FakeOpener(b'x' * (subject.MAX_API_BYTES + 1))
        indexer = self.indexer(opener)
        self.assertIsNone(indexer.api('example/synthetic-app', 'readme'))
        for body in (b'<title>Sign in required</title>', b'<title>404 Not Found</title>'):
            self.assertFalse(self.indexer(FakeOpener(body)).probe('https://synthetic.pages.dev/')['verified'])

    def test_cache_stays_within_its_reload_bound_for_large_link_catalogs(self):
        indexer = self.indexer()
        for i in range(150):
            indexer.cache['discovery'][f'https://github.com/example/app-{i}'] = {
                'checkedAt': subject.stamp(self.now), 'links': [['Application', 'https://synthetic.pages.dev/' + 'x' * 1800, self.repo['html_url']]] * 20}
        saved = indexer.cache_snapshot()
        self.assertLess(len(json.dumps(saved, indent=2, ensure_ascii=False).encode()), subject.MAX_CACHE_BYTES)
        self.assertGreater(len(saved['discovery']), 0)
        self.assertLess(len(saved['discovery']), 150)

    def test_drip_response_stops_at_request_deadline(self):
        clock = [0]

        class Drip(Response):
            def read1(self, size):
                clock[0] += 2
                return b'x'

        class DripOpener:
            def open(self, request, timeout):
                return Drip()

        indexer = self.indexer(DripOpener(), clock=lambda: clock[0], max_seconds=60)
        self.assertFalse(indexer.probe('https://synthetic.pages.dev/')['verified'])
        self.assertEqual(clock[0], 6)

    def test_checkpoints_keep_all_rows_and_have_private_permissions(self):
        other_repo = {**self.repo, 'html_url': 'https://github.com/example/other-app', 'full_name': 'example/other-app'}
        other_company = {**self.company, 'id': 'other', 'repoUrl': other_repo['html_url']}
        indexer = self.indexer(FakeOpener(b'{}'), max_probes=0)
        snapshots = []
        write = subject.atomic_private_json

        def capture(path, value):
            if Path(path).name == 'index.json':
                snapshots.append(copy.deepcopy(value))
            write(path, value)

        with tempfile.TemporaryDirectory() as temporary:
            output, cache = Path(temporary) / 'index.json', Path(temporary) / 'cache.json'
            with patch.object(subject, 'atomic_private_json', side_effect=capture):
                result = indexer.build([self.repo, other_repo], {'companies': [self.company, other_company]}, output, cache)
            self.assertEqual([s['repositoriesProcessed'] for s in snapshots], [0, 1, 2, 2])
            self.assertTrue(all(len(s['entries']) == 2 for s in snapshots))
            self.assertFalse(snapshots[0]['complete'])
            self.assertTrue(result['complete'])
            self.assertIsNone(result['metadataFetchedAt'])
            self.assertEqual(result['entries'][0]['repositoryCreatedAt'], self.repo['created_at'])
            self.assertNotIn('firstPublishedAt', result['entries'][0])
            self.assertEqual(json.loads(output.read_text()), result)
            self.assertEqual(subject.load_cache(cache)['schemaVersion'], 1)
            if os.name == 'posix':
                self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(cache.stat().st_mode), 0o600)
            self.assertEqual(len(list(Path(temporary).iterdir())), 2)


if __name__ == '__main__':
    unittest.main()
