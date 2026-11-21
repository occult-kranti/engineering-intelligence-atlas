#!/usr/bin/env python3
"""Build a private, source-attributed application index without inventing URLs.

Imported metadata is reported evidence, not a fresh repository verification.
Only api.github.com receives the GitHub credential. Deployment probes carry no
credentials, do not follow redirects, and share a URL cap and dispatch deadline.
Private atomic checkpoints retain every matched repository even if lookups stop.
"""
import argparse
import base64
import concurrent.futures
import datetime
import hashlib
import http.client
import json
import os
import re
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEPLOYMENT_SUFFIXES = ('.github.io', '.pages.dev', '.vercel.app', '.netlify.app', '.chatgpt.site', '.web.app', '.onrender.com', '.replit.app')
SECRET_KEY = re.compile(r'token|secret|password|api[-_]?key', re.I)
MAX_API_BYTES = 2 * 1024 * 1024
MAX_PROBE_BYTES = 32768
MAX_CACHE_BYTES = 4 * 1024 * 1024
MAX_REPOSITORIES = 500
REPO_ROOT = Path(__file__).resolve().parent.parent


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def stamp(value=None):
    return datetime.datetime.fromtimestamp(time.time() if value is None else value, datetime.timezone.utc).isoformat().replace('+00:00', 'Z')


def fresh(value, age, now):
    try:
        elapsed = now - datetime.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
        return 0 <= elapsed <= age
    except (ValueError, TypeError, AttributeError, OverflowError):
        return False


def safe_url(raw):
    if not isinstance(raw, str) or len(raw) > 2000 or re.search(r'[\x00-\x20\x7f]', raw):
        return None
    try:
        u = urllib.parse.urlsplit(raw)
        if u.scheme != 'https' or not u.hostname or u.username is not None or u.password is not None:
            return None
        u.port  # Reject malformed ports before either indexing or probing.
        for component in (u.query, u.fragment):
            if any(SECRET_KEY.search(k) for k, _ in urllib.parse.parse_qsl(component, keep_blank_values=True)):
                return None
        return urllib.parse.urlunsplit(u)
    except (ValueError, TypeError):
        return None


def probe_key(url):
    """Fragments never reach a server; equivalent default ports share a probe."""
    if not safe_url(url):
        return None
    u = urllib.parse.urlsplit(url)
    if not u.hostname.endswith(DEPLOYMENT_SUFFIXES) or u.port not in (None, 443):
        return None
    return urllib.parse.urlunsplit(('https', u.hostname.lower(), u.path or '/', u.query, ''))


def atomic_private_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, prefix='.' + path.name + '.', delete=False) as handle:
            temporary = handle.name
            os.fchmod(handle.fileno(), 0o600)
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def load_cache(path):
    try:
        if Path(path).stat().st_size > MAX_CACHE_BYTES:
            return {}
        value = json.loads(Path(path).read_text())
        return value if isinstance(value, dict) and value.get('schemaVersion') == 1 else {}
    except (OSError, ValueError):
        return {}


class Indexer:
    def __init__(self, token, *, max_probes=60, max_seconds=180, max_links=20,
                 cache=None, opener=None, clock=time.monotonic, wall_clock=time.time):
        self.token = token
        self.max_probes = max_probes
        self.max_links = max_links
        self.clock = clock
        self.wall_clock = wall_clock
        self.deadline = clock() + max_seconds
        self.opener = opener
        self.lock = threading.Lock()
        self.inflight = {}
        self.cache = {'schemaVersion': 1, 'discovery': {}, 'probes': {}}
        for name in ('discovery', 'probes'):
            supplied = (cache or {}).get(name, {})
            if isinstance(supplied, dict):
                self.cache[name] = {key: value for key, value in supplied.items() if isinstance(value, dict)}
        self.counts = {'apiRequests': 0, 'probeRequests': 0, 'probeCacheHits': 0, 'discoveryCacheHits': 0,
                       'probeLimitSkips': 0, 'deadlineSkips': 0, 'lookupFailures': 0}

    def count(self, name):
        with self.lock:
            self.counts[name] += 1

    def request(self, url, *, headers, timeout, limit):
        remaining = min(timeout, self.deadline - self.clock())
        if remaining <= 0:
            self.count('deadlineSkips')
            return None
        end = self.clock() + remaining
        opener = self.opener or urllib.request.build_opener(NoRedirect())
        try:
            with opener.open(urllib.request.Request(url, headers=headers), timeout=remaining) as response:
                chunks, size = [], 0
                read = getattr(response, 'read1', response.read)
                while True:
                    if self.clock() >= end:
                        raise TimeoutError('Response deadline reached')
                    chunk = read(min(16384, limit + 1 - size))
                    if not chunk:
                        return response.status, b''.join(chunks)
                    chunks.append(chunk)
                    size += len(chunk)
                    if size > limit:
                        raise ValueError('Response exceeds the bounded sample')
                    # Probes inspect a prefix; API JSON must be complete.
                    if limit == MAX_PROBE_BYTES and size == limit:
                        return response.status, b''.join(chunks)
        except (urllib.error.URLError, OSError, ValueError, http.client.HTTPException):
            self.count('lookupFailures')
            return None

    def api(self, full_name, endpoint):
        if not isinstance(full_name, str) or not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', full_name) or any(part in ('.', '..') for part in full_name.split('/')) or endpoint not in ('pages', 'readme'):
            return None
        if self.clock() >= self.deadline:
            self.count('deadlineSkips')
            return None
        self.count('apiRequests')
        result = self.request('https://api.github.com/repos/' + full_name + '/' + endpoint, timeout=12, limit=MAX_API_BYTES,
                              headers={'Authorization': 'Bearer ' + self.token, 'Accept': 'application/vnd.github+json',
                                       'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Daftar-Application-Indexer'})
        try:
            value = json.loads(result[1]) if result and result[0] == 200 else None
            return value if isinstance(value, dict) else None
        except (ValueError, UnicodeError):
            self.count('lookupFailures')
            return None

    def probe(self, url):
        key = probe_key(url)
        if not key:
            return None
        with self.lock:
            saved = self.cache['probes'].get(key)
            age = 3600 if saved and saved.get('verified') is True else 300
            if saved and fresh(saved.get('checkedAt'), age, self.wall_clock()):
                self.counts['probeCacheHits'] += 1
                return saved
            pending = self.inflight.get(key)
            if pending is None:
                if self.clock() >= self.deadline:
                    self.counts['deadlineSkips'] += 1
                    return None
                if self.counts['probeRequests'] >= self.max_probes:
                    self.counts['probeLimitSkips'] += 1
                    return None
                pending = self.inflight[key] = concurrent.futures.Future()
                self.counts['probeRequests'] += 1
                lead = True
            else:
                lead = False
        if not lead:
            try:
                return pending.result(timeout=max(0.01, self.deadline - self.clock()))
            except concurrent.futures.TimeoutError:
                self.count('deadlineSkips')
                return None
        result = None
        try:
            response = self.request(key, timeout=6, limit=MAX_PROBE_BYTES,
                                    headers={'User-Agent': 'Daftar-Link-Checker', 'Range': 'bytes=0-32767'})
            body = response[1].decode('utf-8', errors='replace') if response else ''
            verified = bool(response and response[0] in (200, 206) and not re.search(
                r'<title[^>]*>[^<]*(sign.?in|log.?in|404|not found)|Sign in required', body, re.I))
            result = {'verified': verified, 'checkedAt': stamp(self.wall_clock())}
            with self.lock:
                self.cache['probes'][key] = result
            return result
        finally:
            pending.set_result(result)

    def discover(self, repo):
        signature = hashlib.sha256(json.dumps({'maxLinks': self.max_links, **{k: repo.get(k) for k in (
            'full_name', 'html_url', 'homepage', 'updated_at', 'pushed_at', 'default_branch', 'has_pages'
        )}}, sort_keys=True).encode()).hexdigest()
        cache_key = repo['html_url'].lower().rstrip('/')
        with self.lock:
            saved = self.cache['discovery'].get(cache_key)
            age = 21600 if saved and saved.get('complete') is True else 60
            if saved and saved.get('signature') == signature and fresh(saved.get('checkedAt'), age, self.wall_clock()) and isinstance(saved.get('links'), list):
                self.counts['discoveryCacheHits'] += 1
                return saved['links']
        links, seen = [], set()

        def add(label, raw, source):
            url = safe_url(raw)
            key = probe_key(url) if url else None
            if url and (key or url) not in seen and len(links) < self.max_links:
                seen.add(key or url)
                links.append([str(label)[:120], url, safe_url(source) or repo['html_url']])

        add('Repository homepage', repo.get('homepage'), repo['html_url'])
        complete = True
        if repo.get('has_pages'):
            pages = self.api(repo.get('full_name'), 'pages')
            complete = pages is not None
            if pages:
                add('GitHub Pages dashboard', pages.get('html_url'), repo['html_url'] + '/settings/pages')
        readme = self.api(repo.get('full_name'), 'readme')
        complete = complete and readme is not None
        if readme:
            try:
                content = base64.b64decode(readme.get('content', '')).decode('utf-8', errors='replace')
                for match in re.finditer(r'\[([^\]\n]{1,100})\]\((https://[^\s)]+)\)', content):
                    label, raw = match.groups()
                    if probe_key(raw) and re.search(r'live|demo|dashboard|app|website|open|preview', label, re.I):
                        add(label, raw, readme.get('html_url'))
                    if len(links) >= self.max_links:
                        break
            except (ValueError, TypeError):
                complete = False
        with self.lock:
            self.cache['discovery'][cache_key] = {'signature': signature, 'checkedAt': stamp(self.wall_clock()), 'complete': complete, 'links': links}
        return links

    def record(self, repo, company, groups, *, look_up=True):
        repo_url = repo['html_url']
        # An imported array is not a new observation. Preserve reported status.
        links = [{'label': 'GitHub repository', 'url': repo_url, 'kind': 'repository', 'verification': 'reported', 'sourceUrl': repo_url}]
        reported = self.discover(repo) if look_up else [('Repository homepage', repo.get('homepage'), repo_url)]
        reachable = False
        for item in reported[:self.max_links]:
            if not isinstance(item, (list, tuple)) or len(item) != 3:
                continue
            label, raw, source = item
            url = safe_url(raw)
            if not url or url == repo_url:
                continue
            link = {'label': str(label)[:120], 'url': url, 'kind': 'dashboard', 'verification': 'reported', 'sourceUrl': safe_url(source) or repo_url}
            proof = self.probe(url) if look_up else None
            if proof and proof.get('verified') is True:
                link.update(verification='verified', verifiedAt=proof['checkedAt'])
                reachable = True
            links.append(link)
        related = sorted({cid for group in groups if company['id'] in group.get('companyIds', []) for cid in group['companyIds'] if cid != company['id']})
        return {'id': 'repository-' + company['id'], 'companyId': company['id'], 'name': company.get('name') or repo.get('name', 'Unnamed repository'),
                'description': repo.get('description') or 'Repository description not supplied; open its README for the current project brief.',
                'kind': 'dashboard' if len(links) > 1 else 'repository',
                'status': 'archived' if repo.get('archived') else 'live' if reachable else 'unverified',
                'repositoryCreatedAt': repo.get('created_at'), 'updatedAt': repo.get('updated_at'),
                'dateSourceUrl': repo_url, 'relatedCompanyIds': related, 'links': links}

    def cache_snapshot(self):
        with self.lock:
            # Retain bounded URL/source metadata, never tokens or README bodies.
            result = {'schemaVersion': 1, 'discovery': {}, 'probes': {}}
            remaining = MAX_CACHE_BYTES - 1024
            for name, limit in [('probes', 1000), ('discovery', 500)]:
                recent = sorted(self.cache[name].items(), key=lambda item: str(item[1].get('checkedAt', '')), reverse=True)[:limit]
                for key, value in recent:
                    encoded = json.dumps({key: value}, ensure_ascii=False, indent=2)
                    # Account conservatively for indentation in the outer object.
                    cost = len(encoded.encode()) + 4 * encoded.count('\n') + 16
                    if cost <= remaining:
                        result[name][key] = value
                        remaining -= cost
            return result

    def build(self, repos, state, output, cache_path, *, metadata_fetched_at=None):
        by_repo = {str(c.get('repoUrl', '')).rstrip('/').lower(): c for c in state['companies'] if c.get('repoUrl')}
        matched = {}
        for repo in repos:
            if isinstance(repo, dict) and safe_url(repo.get('html_url')):
                company = by_repo.get(repo['html_url'].rstrip('/').lower())
                if company:
                    matched[company['id']] = (repo, company)
        if len(matched) > MAX_REPOSITORIES:
            raise ValueError('Application directory supports at most 500 matched repositories per import')
        groups = state.get('portfolio', {}).get('groups', [])
        rows = {key: self.record(repo, company, groups, look_up=False) for key, (repo, company) in matched.items()}
        started = stamp(self.wall_clock())
        completed = 0

        def checkpoint(complete):
            with self.lock:
                counts = dict(self.counts)
            payload = {'indexedAt': started, 'checkpointAt': stamp(self.wall_clock()), 'complete': complete,
                       'repositoriesProcessed': completed, 'repositoriesMatched': len(matched),
                       'metadataFetchedAt': metadata_fetched_at,
                       'source': 'Imported repository metadata (reported), optional authenticated Pages/README discovery, and bounded unauthenticated HTTP probes. Verified means reachable at verifiedAt, not functional acceptance.',
                       'limits': {'maxUniqueProbes': self.max_probes, 'maxDeploymentLinksPerRepository': self.max_links},
                       'lookupSummary': counts, 'entries': sorted(rows.values(), key=lambda row: row['name'].casefold())}
            atomic_private_json(output, payload)
            atomic_private_json(cache_path, self.cache_snapshot())
            return payload

        checkpoint(False)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            pending = {pool.submit(self.record, repo, company, groups): key for key, (repo, company) in matched.items()}
            for future in concurrent.futures.as_completed(pending):
                rows[pending[future]] = future.result()
                completed += 1
                checkpoint(False)
        return checkpoint(True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--token-file', required=True)
    p.add_argument('--metadata-file', required=True, help='Complete /user/repos JSON array or {repositories,fetchedAt} export')
    p.add_argument('--office-state', required=True)
    p.add_argument('--output', required=True, help='Private JSON path outside the public repository')
    p.add_argument('--cache-file', help='Private incremental lookup cache; defaults to OUTPUT.cache.json')
    p.add_argument('--max-probes', type=int, default=60, help='Global cap on unique deployment probes (0–500)')
    p.add_argument('--max-seconds', type=float, default=180, help='Shared request dispatch deadline (1–900 seconds)')
    p.add_argument('--max-links-per-repo', type=int, default=20, help='Unique deployment links retained per repository (1–20)')
    args = p.parse_args()
    if not 0 <= args.max_probes <= 500 or not 1 <= args.max_seconds <= 900 or not 1 <= args.max_links_per_repo <= 20:
        p.error('Lookup limits are outside the supported bounds')
    output = Path(args.output).resolve()
    cache_path = Path(args.cache_file or (str(output) + '.cache.json')).resolve()
    inputs = {Path(value).resolve() for value in (args.token_file, args.metadata_file, args.office_state)}
    if output == cache_path or {output, cache_path} & inputs or any(path.is_relative_to(REPO_ROOT) for path in (output, cache_path)):
        p.error('Output and cache must be distinct private paths outside the repository and input files')
    try:
        metadata = json.loads(Path(args.metadata_file).read_text())
        repos = metadata.get('repositories') if isinstance(metadata, dict) else metadata
        if not isinstance(repos, list):
            raise ValueError('Expected a repository metadata array')
        state = json.loads(Path(args.office_state).read_text())
        state = state.get('office', state)
        fetched_at = metadata.get('fetchedAt') if isinstance(metadata, dict) else None
        token = Path(args.token_file).read_text().strip()
        if not token or re.search(r'[\r\n]', token):
            raise ValueError('Expected one credential')
        indexer = Indexer(token, max_probes=args.max_probes, max_seconds=args.max_seconds, max_links=args.max_links_per_repo,
                          cache=load_cache(cache_path))
        result = indexer.build(repos, state, output, cache_path, metadata_fetched_at=fetched_at)
    except (OSError, ValueError, KeyError, TypeError):
        p.exit(1, 'Indexing could not finish. Check input format and private file access; any saved checkpoint is preserved.\n')
    entries = result['entries']
    print(json.dumps({'repositoriesIndexed': len(entries), 'deploymentLinks': sum(sum(l['kind'] == 'dashboard' for l in e['links']) for e in entries),
                      'reachableApplications': sum(e['status'] == 'live' for e in entries), **result['lookupSummary'], 'outputSaved': True}))


if __name__ == '__main__':
    main()
