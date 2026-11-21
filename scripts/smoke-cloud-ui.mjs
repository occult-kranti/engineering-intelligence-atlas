#!/usr/bin/env node
/**
 * Real built cloud UI, local Wrangler, public synthetic API fixtures only.
 * This is a rendering/interaction gate, never production authentication proof.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installRendererFixture } from '../desktop-shell/tests/fixtures/renderer-bridge.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cloudRoot = path.resolve(process.env.DAFTAR_CLOUD_UI_SOURCE || path.join(repository, 'cloud-workspace'));
const artifactRoot = path.join(repository, 'cloud-workspace', 'outputs', 'ui-smoke');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'daftar-cloud-ui-'));
const require = createRequire(path.join(repository, 'site-source', 'package.json'));
const { chromium } = require('playwright');
const fixtureAt = '2026-11-20T12:00:00.000Z';
const screenshots = [], checks = [], pageErrors = [], unexpectedRequests = [], blockedExternal = [];
const receipt = {
  schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(),
  scope: 'Built cloud homepage, directory and scoped shared-renderer links with public synthetic API fixtures',
  data: 'Test-only Fixture companies; no owner portfolio, credentials, private source metadata or production API responses',
  apiMode: 'Every browser /api/* request is intercepted; only the local built pages/assets reach Wrangler',
  authentication: 'Synthetic /api/session responses exercise client states only',
  productionAuthenticationVerified: false, productionPersistenceVerified: false, providerCalls: 0,
  serverMode: 'Local Wrangler using the real built Worker and client assets with an isolated empty runtime configuration',
  sourceCommit: process.env.GITHUB_SHA || null, checks, screenshots, pageErrors, unexpectedRequests, blockedExternal,
};
let server, browser, activePage, stage = 'setup';
let serverLog = '';
await fs.mkdir(artifactRoot, { recursive: true });

function fixture() {
  // Reuse only the repository's explicit test fixture, never native user state.
  const office = structuredClone(installRendererFixture({}).office);
  office.companies[0].visibility = 'private';
  office.companies.push(
    { id: 'fixture-sketchbook', name: 'Fixture Sketchbook', repoUrl: 'https://github.com/example/fixture-sketchbook', visibility: 'public', status: 'active', assistantId: 'donna', createdAt: fixtureAt, source: 'ui-test-fixture', importedAt: null, githubStatus: 'unchecked' },
    { id: 'fixture-shared', name: 'Fixture Shared Services', repoUrl: null, status: 'active', assistantId: 'donna', createdAt: fixtureAt, source: 'ui-test-fixture', importedAt: null, githubStatus: 'unchecked' },
  );
  office.portfolio.groups = [
    { id: 'fixture-products', name: 'Fixture products', description: 'Public UI test grouping.', companyIds: ['fixture-company', 'fixture-sketchbook'], status: 'active', createdAt: fixtureAt, updatedAt: fixtureAt },
    { id: 'fixture-services', name: 'Fixture services', description: 'Public UI test grouping.', companyIds: ['fixture-shared'], status: 'active', createdAt: fixtureAt, updatedAt: fixtureAt },
  ];
  office.portfolio.roadmap = [{ id: 'fixture-outcome', scope: {kind: 'company', id: 'fixture-company'}, title: 'Fixture ownership example', description: 'Synthetic UI record, not completed user work.', ownerEmployeeId: 'donna', departmentId: null, serviceContractId: null, status: 'planned', dependencies: [], goalIds: [], jobIds: [], evidence: null, createdAt: fixtureAt, updatedAt: fixtureAt }];
  const entries = [
    { id: 'fixture-dashboard', companyId: 'fixture-company', name: 'Fixture project dashboard', description: 'UI sample dashboard for engineering work. This is synthetic test data.', kind: 'dashboard', status: 'live', repositoryCreatedAt: '2024-04-01T00:00:00.000Z', websiteCreatedAt: '2025-03-12T00:00:00.000Z', firstPublishedAt: '2026-01-15T00:00:00.000Z', updatedAt: fixtureAt, dateSourceUrl: 'https://example.invalid/fixture-date-source', relatedCompanyIds: ['fixture-sketchbook'], links: [{ label: 'Open fixture dashboard', url: 'https://example.invalid/fixture-dashboard', kind: 'dashboard', verification: 'verified', verifiedAt: '2020-01-01T00:00:00.000Z', sourceUrl: 'https://example.invalid/fixture-link-check' }] },
    { id: 'fixture-notes', companyId: 'fixture-sketchbook', name: 'Fixture field notes', description: 'Unpublished fieldwork sample. The publication date is unknown in this fixture.', kind: 'repository', status: 'unverified', repositoryCreatedAt: '2025-08-18T00:00:00.000Z', relatedCompanyIds: [], links: [{ label: 'Fixture repository', url: 'https://github.com/example/fixture-sketchbook', kind: 'repository', verification: 'reported' }] },
  ];
  const queue = [{ id: 'fixture-command', status: 'queued', baseRevision: 4, createdAt: fixtureAt, command: {action: 'pause_employee', payload: {employeeId: 'fixture-specialist'}} }];
  const budget = {capUsd: 5, observedUsd: .25, reservedUsd: .5, committedUsd: .75, remainingUsd: 4.25};
  return {
    authenticated: true, sessionSeen: false, calls: [], figmaPosts: [], failFigmaSave: true, integrations: [],
    ledger: [{ id: 'fixture-index-event', actorId: 'fixture-owner', action: 'update_application_index', scopeId: 'owner', summary: 'Synthetic application records loaded for UI verification.', createdAt: fixtureAt }],
    session: {signedIn: true, user: {email: 'fixture-owner@example.invalid'}, capabilities: {chat: true, pairDevices: true, writeSnapshot: false}, budget},
    workspace: {revision: 4, snapshot: office, sourceClientId: null, updatedAt: fixtureAt},
    catalog: {revision: 2, entries, updatedAt: '2020-01-01T00:00:00.000Z'},
    devices: [{id: 'fixture-desktop', clientId: 'fixture-desktop', name: 'Fixture laptop', kind: 'desktop', createdAt: fixtureAt, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), revokedAt: null}],
    queue, budget,
  };
}

function cleanEnvironment() {
  const environment = {};
  for (const key of ['PATH', 'HOME', 'LANG', 'LC_ALL', 'SystemRoot', 'WINDIR', 'TMPDIR', 'TEMP', 'TMP', 'LD_LIBRARY_PATH']) if (process.env[key]) environment[key] = process.env[key];
  return {
    ...environment, CI: 'true', NO_COLOR: '1', NO_UPDATE_NOTIFIER: '1',
    XDG_CONFIG_HOME: path.join(temporary, 'config'), XDG_CACHE_HOME: path.join(temporary, 'cache'),
    CLOUDFLARE_CF_FETCH_ENABLED: 'false', WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false',
    WRANGLER_LOG_PATH: path.join(temporary, 'logs'), WRANGLER_REGISTRY_PATH: path.join(temporary, 'dev-registry'),
    MINIFLARE_REGISTRY_PATH: path.join(temporary, 'registry'), WRANGLER_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
  };
}
async function freePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}
async function startBuiltServer() {
  const configPath = path.join(cloudRoot, 'dist/server/wrangler.json');
  assert.ok(existsSync(configPath), 'Build cloud-workspace before running the cloud UI gate.');
  const built = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const main = path.resolve(path.dirname(configPath), built.main);
  const assets = path.resolve(path.dirname(configPath), built.assets.directory);
  receipt.workerEntrySha256 = crypto.createHash('sha256').update(await fs.readFile(main)).digest('hex');
  const port = await freePort();
  // The built code/assets are unchanged. A temporary runtime config prevents
  // local .env/.dev.vars files or production service bindings from being read.
  const isolated = {
    name: 'daftar-cloud-ui-fixture', main, compatibility_date: built.compatibility_date,
    compatibility_flags: built.compatibility_flags, no_bundle: true, rules: built.rules,
    assets: {directory: assets}, vars: {},
    d1_databases: [{binding: 'DB', database_name: 'daftar-ui-fixture', database_id: '00000000-0000-4000-8000-000000000000'}],
  };
  const isolatedPath = path.join(temporary, 'wrangler.json');
  await fs.writeFile(isolatedPath, JSON.stringify(isolated));
  const environment = cleanEnvironment();
  for (const key of ['XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'WRANGLER_LOG_PATH', 'WRANGLER_REGISTRY_PATH', 'MINIFLARE_REGISTRY_PATH']) await fs.mkdir(environment[key], {recursive: true});
  server = spawn(process.execPath, [path.join(cloudRoot, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--config', isolatedPath, '--local', '--persist-to', path.join(temporary, 'state'), '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0', '--log-level', 'warn'], {cwd: temporary, env: environment, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']});
  const collect = chunk => { if (serverLog.length < 1024 * 1024) serverLog += chunk.toString('utf8').slice(0, 1024 * 1024 - serverLog.length); };
  server.stdout.on('data', collect); server.stderr.on('data', collect); server.on('error', error => collect(error.message));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    assert.equal(server.exitCode, null, 'Local Wrangler exited before the built cloud UI was ready; inspect server.log.');
    try { const response = await fetch(base + '/', {redirect: 'error', signal: AbortSignal.timeout(1000)}); if (response.ok && response.headers.get('content-type')?.includes('text/html')) return base; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Local Wrangler did not serve the built cloud UI within 45 seconds; inspect server.log.');
}
async function stopServer() {
  if (!server?.pid) return;
  const signal = name => { try { if (process.platform === 'win32') server.kill(name); else process.kill(-server.pid, name); } catch {} };
  signal('SIGTERM');
  await Promise.race([new Promise(resolve => server.once('close', resolve)), new Promise(resolve => setTimeout(resolve, 1500))]);
  signal('SIGKILL');
}
async function installApiFixture(context, base, state) {
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) {
      if (['http:', 'https:'].includes(url.protocol)) { blockedExternal.push({method: request.method(), url: url.origin + url.pathname}); return route.abort('blockedbyclient'); }
      return route.continue();
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const key = request.method() + ' ' + url.pathname;
    state.calls.push(key);
    const json = (body, status = 200) => route.fulfill({status, contentType: 'application/json', headers: {'cache-control': 'no-store'}, body: JSON.stringify(body)});
    if (key === 'GET /api/session') { state.sessionSeen = true; return state.authenticated ? json(state.session) : json({ok: false, error: 'Fixture owner sign-in required.'}, 401); }
    if (!state.authenticated || !state.sessionSeen) { unexpectedRequests.push({key, reason: 'Private fixture API requested before a successful session'}); return json({ok: false, error: 'UI fixture requires the session step.'}, 401); }
    if (key === 'GET /api/workspace') return json(state.workspace);
    if (key === 'GET /api/applications') return json(state.catalog);
    if (key === 'GET /api/devices') return json({devices: state.devices});
    if (key === 'GET /api/activity') return json({commands: state.queue, requests: [], budget: state.budget});
    if (key === 'GET /api/commands') return json({commands: state.queue});
    if (key === 'GET /api/cloud-threads') return json({threads: []});
    if (key === 'GET /api/integration-ledger') return json({events: state.ledger});
    if (key === 'GET /api/integrations/figma') return json({integrations: state.integrations});
    if (key === 'POST /api/integrations/figma') {
      const body = request.postDataJSON(); state.figmaPosts.push(body);
      if (state.failFigmaSave) return json({ok: false, error: 'Fixture save failure: your design draft is unchanged.'}, 503);
      const integration = {...body, endpoint: 'https://mcp.figma.com/mcp', connectionStatus: 'client-authorization-required', updatedAt: fixtureAt};
      state.integrations = [integration];
      state.ledger.unshift({id: 'fixture-figma-event', action: 'link_figma_file', scopeId: body.companyId, summary: 'Synthetic design reference saved; client sign-in remains required.', createdAt: fixtureAt});
      return json({ok: true, integration});
    }
    unexpectedRequests.push({key, reason: 'No fixture route is authorized for this operation'});
    return json({ok: false, error: 'This UI gate does not execute this operation.'}, 501);
  });
}
async function assertLayout(page, label) {
  const layout = await page.evaluate(() => {
    const actual = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const offenders = actual > innerWidth + 1 ? [...document.querySelectorAll('body *')].filter(element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      return box.width > 0 && style.visibility !== 'hidden' && style.display !== 'none' && box.right > innerWidth + 1;
    }).slice(-10).map(element => ({tag: element.tagName, id: element.id, className: element.getAttribute('class'), right: Math.round(element.getBoundingClientRect().right)})) : [];
    const unlabelled = [...document.querySelectorAll('.office-home input:not([type=hidden]), .office-home select, .office-home textarea')].filter(element => {
      if (!element.getClientRects().length) return false;
      return ![...(element.labels ?? [])].some(label => label.textContent?.trim()) && !element.getAttribute('aria-label')?.trim() && !element.getAttribute('aria-labelledby')?.trim();
    }).map(element => element.id || element.tagName);
    return {actual, expected: innerWidth, offenders, unlabelled};
  });
  assert.ok(layout.actual <= layout.expected + 1, `${label}: horizontal overflow ${JSON.stringify(layout)}`);
  assert.deepEqual(layout.unlabelled, [], `${label}: visible inputs need accessible labels`);
  checks.push(`${label}: no horizontal overflow; visible form controls have labels`);
}
async function capture(page, name, viewport, fullPage = true) {
  await assertLayout(page, name);
  const file = `${name}-${viewport.width}.png`;
  await page.screenshot({path: path.join(artifactRoot, file), fullPage, animations: 'disabled'});
  screenshots.push({file, viewport, fixtureOnly: true, fullPage});
}
async function checkScopedLinks(page, base) {
  const company = page.locator('#company-fixture-company');
  for (const [name, view] of [['Donna', 'chat'], ['Blueprint', 'blueprint'], ['Roadmap & whiteboard', 'whiteboard'], ['Expert panels', 'decisions']]) {
    const href = await company.getByRole('link', {name, exact: true}).getAttribute('href');
    const url = new URL(href, base);
    assert.equal(url.pathname, '/workspace/chrome.html'); assert.equal(url.searchParams.get('company'), 'fixture-company'); assert.equal(url.searchParams.get('workspace'), view); assert.equal(url.hash, '#office');
  }
  checks.push('Directory links retain the company and intended Donna/Blueprint/Whiteboard/Panel scope');
}

try {
  stage = 'start-local-built-worker';
  const base = await startBuiltServer();
  receipt.localServerReady = true;
  stage = 'launch-browser';
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({executablePath, args: ['--no-sandbox'], env: cleanEnvironment(), timeout: 30000});
  receipt.browserVersion = browser.version();
  for (const viewport of [{width: 1440, height: 1000}, {width: 390, height: 844}]) {
    stage = `browser-${viewport.width}`;
    const context = await browser.newContext({viewport, reducedMotion: 'reduce', serviceWorkers: 'block'});
    const state = fixture();
    await installApiFixture(context, base, state);
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', error => pageErrors.push({viewport: viewport.width, message: error.message}));
    page.on('response', response => { if (response.url().startsWith(base) && !new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 400) unexpectedRequests.push({key: String(response.status()) + ' ' + new URL(response.url()).pathname, reason: 'Built page or asset failed'}); });

    await page.goto(base + '/', {waitUntil: 'networkidle'});
    await page.getByText('Your saved office is ready.', {exact: false}).waitFor({state: 'visible'});
    assert.equal(state.calls[0], 'GET /api/session', 'Homepage must load its session before private records');
    await page.getByRole('navigation', {name: 'Daftar workspace'}).getByRole('link', {name: 'Directory', exact: true}).waitFor({state: 'visible'});
    assert.equal(await page.getByRole('link', {name: 'Open your office', exact: true}).getAttribute('href'), '/workspace/chrome.html#office');
    await page.getByLabel('Device name', {exact: true}).fill('Fixture laptop');
    await capture(page, 'fixture-home', viewport);
    checks.push(`Homepage ${viewport.width}: Daftar navigation, saved-state summary, devices and office entry`);

    const beforeDirectory = state.calls.length;
    await page.getByRole('navigation', {name: 'Daftar workspace'}).getByRole('link', {name: 'Directory', exact: true}).click();
    await page.waitForURL(base + '/applications');
    await page.locator('.directory-company').first().waitFor({state: 'visible'});
    await page.waitForFunction(() => document.querySelectorAll('.directory-company').length === 3);
    assert.equal(state.calls[beforeDirectory], 'GET /api/session', 'Directory must load its session before private records');
    assert.match(await page.title(), /Daftar.*Application Directory/);
    await page.getByText('Website record created', {exact: true}).waitFor({state: 'visible'});
    await page.getByText('Repository created', {exact: true}).first().waitFor({state: 'visible'});
    await page.getByText('First published', {exact: true}).first().waitFor({state: 'visible'});
    assert.ok(await page.getByText('Not recorded', {exact: true}).count() >= 1, 'Missing publication dates must stay unknown');
    await page.getByText('Ready to be catalogued.', {exact: true}).waitFor({state: 'visible'});
    await page.locator('.directory-badge.status-live').filter({hasText: 'Reachability checked'}).waitFor({state: 'visible'});
    assert.match(await page.locator('.status-banner').innerText(), /Review due/);
    await checkScopedLinks(page, base);
    await capture(page, 'fixture-directory', viewport);
    checks.push(`Directory ${viewport.width}: all companies, distinct source dates, unknown publication and reachability labels`);

    const search = page.getByLabel('Search your work', {exact: true});
    await search.focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'directory-group', 'Keyboard focus should move from search to the labelled group selector');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'directory-search');
    await search.fill('unpublished fieldwork');
    await page.waitForFunction(() => document.querySelectorAll('.directory-company').length === 1);
    assert.match(await page.locator('.directory-company h2').innerText(), /Fixture Sketchbook/);
    await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
    await page.getByLabel('Group', {exact: true}).selectOption('fixture-services');
    await page.waitForFunction(() => document.querySelectorAll('.directory-company').length === 1);
    assert.match(await page.locator('.directory-company h2').innerText(), /Fixture Shared Services/);
    await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
    await page.getByLabel('Status', {exact: true}).selectOption('live');
    await page.waitForFunction(() => document.querySelectorAll('.directory-company').length === 1);
    assert.match(await page.locator('.directory-company h2').innerText(), /Fixture Engineering/);
    await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
    await search.fill('no matching synthetic project');
    await page.getByRole('heading', {name: 'No companies match these filters.', exact: true}).waitFor({state: 'visible'});
    assert.equal(await page.locator('.directory-company').count(), 0);
    await capture(page, 'fixture-directory-empty', viewport, false);
    await page.getByRole('button', {name: 'Show all companies', exact: true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.directory-company').length === 3);
    checks.push(`Directory ${viewport.width}: keyboard labels, search, group/status filters and clear empty state`);

    const form = page.locator('.figma-reference form');
    await form.scrollIntoViewIfNeeded();
    await page.getByLabel('Company', {exact: true}).selectOption('fixture-company');
    const figmaUrl = 'https://www.figma.com/design/DaftarUiFixture123/Reference?node-id=1-2';
    await page.getByLabel('Figma file URL', {exact: true}).fill(figmaUrl);
    await page.getByRole('button', {name: 'Save design reference', exact: true}).click();
    await page.getByText('Fixture save failure: your design draft is unchanged.', {exact: true}).waitFor({state: 'visible'});
    assert.equal(await page.getByLabel('Figma file URL', {exact: true}).inputValue(), figmaUrl);
    assert.equal(await page.getByLabel('Company', {exact: true}).inputValue(), 'fixture-company');
    assert.deepEqual(state.figmaPosts, [{companyId: 'fixture-company', fileUrl: figmaUrl}], 'A failed save must not retry automatically or change its scope');
    await capture(page, 'fixture-figma-save-error', viewport, false);
    state.failFigmaSave = false;
    await page.getByRole('button', {name: 'Save design reference', exact: true}).click();
    const savedReference = page.getByRole('link', {name: 'Open saved Figma reference ↗', exact: true});
    await savedReference.waitFor({state: 'visible'});
    assert.equal(await savedReference.getAttribute('href'), figmaUrl);
    assert.equal(state.figmaPosts.length, 2, 'Only the explicit second click may retry the save');
    await page.getByText('Client sign-in required', {exact: true}).waitFor({state: 'visible'});
    const installLink = await page.getByRole('link', {name: 'Set up Figma in VS Code', exact: true}).getAttribute('href');
    assert.ok(installLink.startsWith('vscode:mcp/install?'));
    assert.deepEqual(JSON.parse(decodeURIComponent(installLink.split('?')[1])), {name: 'figma', type: 'http', url: 'https://mcp.figma.com/mcp'});
    checks.push(`Figma ${viewport.width}: scoped POST, failure keeps draft, no automatic retry, explicit save updates reference without claiming OAuth`);

    // Follow a real connected route into the shared cloud renderer. Its data is
    // still the same synthetic office supplied by the API fixture above.
    await page.locator('#company-fixture-company').getByRole('link', {name: 'Blueprint', exact: true}).click();
    await page.waitForURL(url => url.pathname === '/workspace/chrome.html' && url.searchParams.get('workspace') === 'blueprint');
    await page.locator('#office-native-status').filter({hasText: 'Cloud workspace'}).waitFor({state: 'visible'});
    await page.locator('#workspace-panel-blueprint').waitFor({state: 'visible'});
    assert.equal(new URL(page.url()).searchParams.get('company'), 'fixture-company');
    assert.ok(await page.locator('#office-blueprint .blueprint-room').count() > 0, 'Connected blueprint should show the synthetic saved room');
    await capture(page, 'fixture-connected-blueprint', viewport, false);
    checks.push(`Connected renderer ${viewport.width}: directory blueprint link opens the scoped saved room`);

    if (viewport.width === 390) {
      state.authenticated = false; state.sessionSeen = false;
      const previousCalls = state.calls.length;
      await page.goto(base + '/applications', {waitUntil: 'networkidle'});
      await page.getByRole('heading', {name: 'Your directory stays private.', exact: true}).waitFor({state: 'visible'});
      assert.equal(await page.locator('.directory-company').count(), 0);
      assert.deepEqual(state.calls.slice(previousCalls), ['GET /api/session'], 'A rejected synthetic session must not fetch private directory APIs');
      await capture(page, 'fixture-directory-signin-required', viewport, false);
      checks.push('Client sign-in state: failed synthetic session shows no company metadata and makes no directory API requests');
    }
    assert.deepEqual(pageErrors, [], 'Cloud UI emitted browser exceptions');
    await context.close(); activePage = null;
  }
  assert.deepEqual(unexpectedRequests, [], 'Cloud UI made an unhandled API request or failed to load a built asset');
  assert.equal(screenshots.length >= 4, true);
  receipt.status = 'passed';
} catch (error) {
  receipt.status = 'failed'; receipt.failedStage = stage;
  receipt.error = error instanceof Error ? error.message : String(error);
  if (activePage && !activePage.isClosed()) {
    try { const file = 'failure.png'; await activePage.screenshot({path: path.join(artifactRoot, file), fullPage: true}); screenshots.push({file, fixtureOnly: true, failure: true}); } catch {}
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stopServer();
  receipt.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(artifactRoot, 'server.log'), serverLog);
  await fs.writeFile(path.join(artifactRoot, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await fs.rm(temporary, {recursive: true, force: true});
  console.log(JSON.stringify({status: receipt.status, stage: receipt.failedStage, error: receipt.error, checks: checks.length, screenshots: screenshots.length, artifactDirectory: artifactRoot, productionAuthenticationVerified: false, providerCalls: 0}));
}
