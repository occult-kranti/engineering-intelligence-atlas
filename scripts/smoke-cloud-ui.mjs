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
import { runFreeflowCloudChecks } from './freeflow-browser-checks.mjs';

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
  // Bounded synthetic records distinguish known activity from an employee with
  // no records. They never schedule or execute provider work.
  office.employees.push(...[
    ['fixture-specialist', 'Fixture engineer', 'Backend engineering'],
    ['fixture-researcher', 'Fixture researcher', 'Research and evidence'],
  ].map(([id, name, role]) => ({id, name, role, companyId: 'fixture-company', officeId: 'fixture-office', departmentId: 'fixture-department', kind: 'specialist', status: 'active', skillPaths: [], createdAt: fixtureAt, updatedAt: fixtureAt})));
  office.blueprints[0].rooms[0].departmentId = 'fixture-department';
  office.blueprints[0].desks = office.employees.filter(employee => employee.companyId === 'fixture-company').map((employee, index) => ({id: `fixture-desk-${index}`, employeeId: employee.id, roomId: 'fixture-room', x: .1 + index * .18, y: .14, width: .14, height: .12}));
  office.jobs = [
    {id: 'fixture-queued', goal: 'Fixture queued review', status: 'queued', costStatus: 'none', costUsd: 0},
    {id: 'fixture-review', goal: 'Fixture review result', status: 'needs-review', costStatus: 'observed', costUsd: .2},
  ].map(({costUsd, ...job}) => ({...job, companyId: 'fixture-company', officeId: 'fixture-office', departmentId: 'fixture-department', employeeId: 'fixture-specialist', mode: 'provider', provider: 'anthropic', model: 'fixture-no-provider', authorized: false, allowedTools: [], dependencies: [], limits: {maxTokens: 1000, maxUsd: 1, maxMinutes: 5}, priceRates: {inputUsdPerMillion: null, outputUsdPerMillion: null}, usage: {inputTokens: 0, outputTokens: 0, costUsd}, reservation: null, usageRecorded: false, idempotencyKey: job.id, dueAt: fixtureAt, createdAt: fixtureAt, updatedAt: fixtureAt, startedAt: null, finishedAt: null, artifactUri: null, error: null, summary: null, contextHash: null, cacheKey: null, promptVersion: 'fixture', workerId: null, leaseToken: null, leaseExpiresAt: null}));
  Object.assign(office.budget, {observedUsd: .2, committedUsd: .2, remainingUsd: 9.8});
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
    authenticated: true, sessionSeen: false, allowRejectedRendererReads: false, rejectedRendererReads: [], calls: [], figmaPosts: [], failFigmaSave: true, integrations: [],
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
    if (!state.authenticated || !state.sessionSeen) {
      // A direct signed-out renderer has no successful session to reuse. Permit
      // only its expected read attempts, return no private payload, and record
      // each denial separately; all writes still fail the security gate.
      if (!state.authenticated && state.allowRejectedRendererReads && ['GET /api/workspace', 'GET /api/cloud-threads', 'GET /api/commands'].includes(key)) state.rejectedRendererReads.push(key);
      else unexpectedRequests.push({key, reason: 'Private fixture API requested before a successful session'});
      return json({ok: false, error: 'UI fixture requires the session step.'}, 401);
    }
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
  for (const [name, view] of [['Donna', 'chat'], ['Blueprint', 'blueprint'], ['Ownership', 'softboard'], ['Roadmap', 'timeline'], ['Whiteboard', 'whiteboard'], ['Expert panels', 'decisions']]) {
    const href = await company.getByRole('link', {name, exact: true}).getAttribute('href');
    const url = new URL(href, base);
    assert.equal(url.pathname, '/workspace/chrome.html'); assert.equal(url.searchParams.get('company'), 'fixture-company'); assert.equal(url.searchParams.get('workspace'), view); assert.equal(url.hash, '#office');
  }
  checks.push('Directory links retain the company and distinct Donna, Blueprint, Ownership, Roadmap, Whiteboard and Expert panel routes');
}

async function checkConnectedStudio(page, viewport) {
  const company = page.locator('#office-company-select');
  const assertScope = async () => {
    assert.equal(await company.inputValue(), 'fixture-company');
    assert.equal(new URL(page.url()).searchParams.get('company'), 'fixture-company');
  };
  await page.waitForFunction(() => typeof window.DaftarSignals?.build === 'function');
  await assertScope();
  assert.equal(await page.locator('#workspace-theme').inputValue(), 'drafting', 'The cloud choice must reach the shared renderer');
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('#workspace-panel-blueprint').waitFor({state: 'visible'});
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'drafting' && document.querySelector('#office-company-select')?.value === 'fixture-company' && document.querySelectorAll('#office-blueprint .blueprint-room').length > 0);
  assert.equal(await page.locator('#workspace-theme').inputValue(), 'drafting');
  await assertScope();

  const heat = page.locator('#workspace-heat-mode');
  await page.locator('.heat-key > summary').click();
  for (const [mode, label] of [['workload', '1 unresolved job'], ['budget', '10% job allowance'], ['attention', '1 flagged job']]) {
    await heat.selectOption(mode);
    assert.match(await page.locator('#workspace-signal-summary').innerText(), new RegExp(label));
    assert.deepEqual(await page.locator('#workspace-heat-legend .heat-legend-row').evaluateAll(rows => rows.map(row => row.dataset.heatLevel)), ['0', '1', '2', '3', '4', 'unknown']);
    await page.locator('#workspace-heat-legend').getByText('Unknown / stale', {exact: true}).waitFor({state: 'visible'});
    const room = page.locator('#office-blueprint .blueprint-room').first();
    assert.equal(await room.getAttribute('data-heat-level'), '1', `${mode}: fixture room must use actual job records`);
    assert.equal(await room.locator('.heat-reading').innerText(), label);
  }
  await heat.selectOption('off');
  assert.match(await page.locator('#workspace-signal-summary').innerText(), /Heat map off/);
  assert.match(await page.locator('#workspace-heat-legend').innerText(), /Color overlay is off/);
  assert.equal(await page.locator('#office-blueprint .blueprint-room').first().getAttribute('data-heat-level'), 'off');
  assert.equal(await page.locator('#office-blueprint .heat-reading').count(), 0, 'Off must remove the color readings, not retain a misleading intensity');
  await heat.selectOption('workload');
  await page.locator('.heat-key > summary').click();
  await capture(page, 'fixture-connected-blueprint-drafting', viewport, false);
  checks.push(`Studio ${viewport.width}: loaded signal engine, actual workload/cost/attention, six labelled levels, and an explicit off state`);

  await page.locator('#workspace-tab-softboard').click();
  await page.getByRole('heading', {name: 'See the people behind the work.', exact: true}).waitFor({state: 'visible'});
  assert.equal(await page.locator('#workspace-softboard .org-company').innerText(), 'Fixture Engineering');
  assert.equal(await page.locator('#workspace-softboard .org-office').innerText(), 'Product studio');
  assert.equal(await page.locator('#workspace-softboard .org-person').count(), 3);
  const unknownPerson = page.locator('.org-person[data-employee-id="fixture-researcher"]');
  assert.equal(await unknownPerson.getAttribute('data-heat-level'), 'unknown');
  assert.equal(await unknownPerson.locator('.heat-reading').innerText(), 'No comparable data', 'No jobs must not imply a measured zero');
  await page.locator('.org-person[data-employee-id="fixture-specialist"]').click();
  assert.equal(await page.locator('#softboard-person-title').innerText(), 'Fixture engineer');
  assert.match(await page.locator('#softboard-person-detail').innerText(), /Backend engineering/);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'softboard-person-title');
  await page.locator('#softboard-search').fill('no matching synthetic person');
  assert.equal(await page.locator('#workspace-softboard .org-person').count(), 0);
  await page.locator('#softboard-search').fill('');
  assert.equal(await page.locator('#workspace-softboard .org-person').count(), 3);
  await page.locator('.org-person[data-employee-id="fixture-specialist"]').click();
  await assertScope();
  await capture(page, 'fixture-connected-ownership', viewport);
  checks.push(`Ownership ${viewport.width}: actual hierarchy, searchable people, focused inspector, unknown data and company scope`);

  await page.locator('#workspace-tab-timeline').click();
  await page.getByRole('heading', {name: 'From intention to evidence.', exact: true}).waitFor({state: 'visible'});
  assert.deepEqual(await page.locator('#workspace-timeline .roadmap-lane').evaluateAll(rows => rows.map(row => row.dataset.stage)), ['planned', 'in-progress', 'blocked', 'done']);
  const outcome = page.locator('.studio-outcome[data-roadmap-id="fixture-outcome"]');
  assert.equal(await outcome.locator('h4').innerText(), 'Fixture ownership example');
  assert.equal(await outcome.locator('.outcome-person strong').innerText(), 'Donna');
  await page.locator('#studio-roadmap-status').selectOption('blocked');
  assert.equal(await page.locator('#workspace-timeline .studio-outcome').count(), 0);
  await page.getByText('No saved outcomes in this stage.', {exact: true}).waitFor({state: 'visible'});
  assert.match(await page.locator('#studio-roadmap-summary').innerText(), /^0 outcomes in view/);
  await page.locator('#studio-roadmap-status').selectOption('all');
  assert.equal(await page.locator('#workspace-timeline .studio-outcome').count(), 1);
  await assertScope();
  await capture(page, 'fixture-connected-roadmap', viewport);
  checks.push(`Roadmap ${viewport.width}: recorded ownership, four delivery stages, empty filtered lane and restored scope`);

  // A draft never invokes /api/chat. Follow the same conversation DOM node
  // between its home and dock so duplicate composers cannot hide data loss.
  await page.locator('#workspace-tab-chat').click();
  const draft = `Unsent synthetic brief at ${viewport.width}px`;
  await page.locator('#chat-message').fill(draft);
  const conversation = await page.locator('#donna-conversation').elementHandle();
  await page.locator('#workspace-tab-blueprint').click();
  await page.locator('#donna-dock-toggle').click();
  assert.equal(await conversation.evaluate(node => node.parentElement?.id), 'donna-dock-slot');
  assert.equal(await page.locator('#chat-message').inputValue(), draft);
  await page.locator('#workspace-tab-timeline').click();
  assert.equal(await page.locator('#chat-message').inputValue(), draft);
  assert.equal(await page.locator('#donna-conversation').count(), 1);
  if (viewport.width === 1440) await capture(page, 'fixture-connected-donna-dock', viewport, false);
  await page.locator('#donna-dock-close').click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'donna-dock-toggle');
  await page.locator('#workspace-tab-chat').click();
  assert.equal(await conversation.evaluate(node => node.parentElement?.id), 'donna-chat-home');
  assert.equal(await page.locator('#chat-message').inputValue(), draft);
  await conversation.dispose();
  await assertScope();
  checks.push(`Donna ${viewport.width}: one conversation, unsent draft survives tab/dock switches, focus returns and company stays selected`);
}

try {
  stage = 'start-local-built-worker';
  const base = await startBuiltServer();
  receipt.localServerReady = true;
  stage = 'launch-browser';
  // CI installs the Playwright-managed browser matched to this driver.
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  browser = await chromium.launch({executablePath, args: ['--no-sandbox'], env: cleanEnvironment(), timeout: 30000});
  receipt.browserVersion = browser.version();
  receipt.browserSource = executablePath ? 'explicit-override' : 'playwright-managed';
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
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'blueprint');
    const darkCanvas = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim());
    assert.ok(darkCanvas, 'The built homepage must load the shared studio palette');
    await page.locator('#cloud-studio-theme').selectOption('drafting');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'drafting');
    assert.equal(await page.evaluate(() => localStorage.getItem('daftar-studio-theme')), 'drafting');
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim()), darkCanvas, 'Changing the appearance must apply a different canvas palette');
    if (viewport.width === 1440) await capture(page, 'fixture-home-drafting', viewport);

    const beforeDirectory = state.calls.length;
    await page.getByRole('navigation', {name: 'Daftar workspace'}).getByRole('link', {name: 'Directory', exact: true}).click();
    await page.waitForURL(base + '/applications');
    await page.locator('.directory-company').first().waitFor({state: 'visible'});
    await page.waitForFunction(() => document.querySelectorAll('.directory-company').length === 3);
    assert.equal(state.calls[beforeDirectory], 'GET /api/session', 'Directory must load its session before private records');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'drafting');
    assert.equal(await page.locator('#cloud-studio-theme').inputValue(), 'drafting');
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
    // Fresh default navigation (no workspace param): the newly mounted Freeflow host must be visible first.
    await page.goto(base + '/workspace/chrome.html?company=fixture-company#office', {waitUntil: 'networkidle'});
    await page.locator('#freeflow-host').waitFor({state: 'visible'});
    assert.equal(await page.locator('#freeflow-host').count(), 1, 'Cloud renderer is missing the Freeflow host; the synced renderer is stale.');
    assert.ok(await page.locator('#office-native-status').isHidden(), 'Legacy status must be hidden while Freeflow is the default surface.');
    checks.push(`Freeflow ${viewport.width}: fresh default cloud navigation shows the mounted Freeflow host first`);
    await page.goto(base + '/applications', {waitUntil: 'networkidle'});
    await page.waitForFunction(() => document.querySelectorAll('.directory-company').length === 3);
    await page.locator('#company-fixture-company').getByRole('link', {name: 'Blueprint', exact: true}).click();
    // Workers assets canonicalizes this existing HTML asset with a 307 to the
    // extensionless path. Both forms must retain the exact company/tab query.
    await page.waitForURL(url => ['/workspace/chrome.html', '/workspace/chrome'].includes(url.pathname)
      && url.searchParams.get('company') === 'fixture-company' && url.searchParams.get('workspace') === 'blueprint');
    // Explicit legacy workspace links open Operations; use the real visible control if the status is still hidden.
    if (await page.locator('#office-native-status').isHidden()) await page.locator('#ff-nav-operations').click();
    await page.locator('#office-native-status').filter({hasText: 'Cloud workspace'}).waitFor({state: 'visible'});
    await page.locator('#workspace-panel-blueprint').waitFor({state: 'visible'});
    assert.equal(new URL(page.url()).searchParams.get('company'), 'fixture-company');
    assert.ok(await page.locator('#office-blueprint .blueprint-room').count() > 0, 'Connected blueprint should show the synthetic saved room');
    await checkConnectedStudio(page, viewport);
    // Also exercise the reverse shared-renderer → cloud boundary, then reload
    // the React page. This is a local preference, not a production save claim.
    await page.locator('#workspace-theme').selectOption('blueprint');
    assert.equal(await page.evaluate(() => localStorage.getItem('daftar-studio-theme')), 'blueprint');
    await page.goto(base + '/applications', {waitUntil: 'networkidle'});
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'blueprint' && document.querySelectorAll('.directory-company').length === 3);
    assert.equal(await page.locator('#cloud-studio-theme').inputValue(), 'blueprint');
    await page.reload({waitUntil: 'networkidle'});
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'blueprint' && document.querySelectorAll('.directory-company').length === 3);
    assert.equal(await page.locator('#cloud-studio-theme').inputValue(), 'blueprint');
    await checkScopedLinks(page, base);
    checks.push(`Theme ${viewport.width}: cloud → shared renderer → cloud, distinct palettes and persistence across both reloads`);

    if (viewport.width === 390) {
      state.authenticated = false; state.sessionSeen = false;
      const previousCalls = state.calls.length;
      await page.goto(base + '/applications', {waitUntil: 'networkidle'});
      await page.getByRole('heading', {name: 'Your directory stays private.', exact: true}).waitFor({state: 'visible'});
      assert.equal(await page.locator('.directory-company').count(), 0);
      assert.deepEqual(state.calls.slice(previousCalls), ['GET /api/session'], 'A rejected synthetic session must not fetch private directory APIs');
      await capture(page, 'fixture-directory-signin-required', viewport, false);
      checks.push('Client sign-in state: failed synthetic session shows no company metadata and makes no directory API requests');

      state.allowRejectedRendererReads = true;
      const beforeDirectRenderer = state.calls.length;
      await page.goto(base + '/workspace/chrome.html?company=fixture-company&workspace=blueprint#office', {waitUntil: 'networkidle'});
      await page.locator('#cloud-workspace-notice').waitFor({state: 'visible'});
      assert.equal(await page.locator('#workspace-save-label').innerText(), 'Cloud not loaded');
      assert.equal(await page.locator('#workspace-budget-label').innerText(), 'Budget not loaded');
      assert.match(await page.locator('#cloud-workspace-notice-message').innerText(), /Cloud workspace is not loaded/);
      assert.equal(await page.locator('#office-blueprint .blueprint-room').count(), 0);
      assert.equal(await page.locator('#workspace-softboard .org-person').count(), 0);
      assert.equal(await page.getByText('Fixture Engineering', {exact: true}).count(), 0, 'A new signed-out renderer must not expose fixture company metadata');
      assert(await page.locator('#chat-send').isDisabled(), 'An unavailable cloud snapshot must not enable chat submission');
      assert(state.rejectedRendererReads.length > 0, 'Direct cloud read attempts must receive fixture 401s');
      assert(state.calls.slice(beforeDirectRenderer).every(key => ['GET /api/session', 'GET /api/workspace', 'GET /api/cloud-threads', 'GET /api/commands'].includes(key)), 'The unavailable renderer may only check session and denied read-only workspace routes');
      await capture(page, 'fixture-connected-signin-required', viewport, false);
      state.allowRejectedRendererReads = false;
      const beforeWelcome = state.calls.length;
      await page.locator('#cloud-welcome').click();
      await page.waitForURL(base + '/');
      await page.getByRole('link', {name: 'Sign in', exact: true}).waitFor({state: 'visible'});
      assert.deepEqual(state.calls.slice(beforeWelcome), ['GET /api/session'], 'Welcome must not fetch private records after a rejected session');
      checks.push('Direct renderer sign-in state: denied reads expose no metadata, cloud/budget status stays unavailable, chat is disabled and welcome opens sign-in');
    }
    assert.deepEqual(pageErrors, [], 'Cloud UI emitted browser exceptions');
    await context.close(); activePage = null;
  }
  stage = 'freeflow-matrix';
  receipt.freeflow = await runFreeflowCloudChecks({ browser, base, makeState: fixture, installApiFixture, outDir: artifactRoot });
  assert.deepEqual(unexpectedRequests, [], 'Cloud UI made an unhandled API request or failed to load a built asset');
  assert.equal(screenshots.length >= 4, true);
  receipt.status = 'passed';
} catch (error) {
  receipt.status = 'failed'; receipt.failedStage = stage;
  receipt.error = error instanceof Error ? error.message : String(error);
  if (activePage && !activePage.isClosed()) {
    // This browser contains only the synthetic fixture routes defined above.
    receipt.finalPageUrl = activePage.url();
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
