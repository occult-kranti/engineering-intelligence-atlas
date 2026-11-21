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
import { assertEndlessShell, checkEndlessPanelInteractions, openCanvasSurface, settleCanvas } from './endless-canvas-browser-checks.mjs';

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
  scope: 'Built continuous canvas, owner entry routing, embedded connections/directory/access, visiting office, invitation review and shared-renderer links with synthetic API fixtures',
  data: 'Test-only Fixture companies; no owner portfolio, credentials, private source metadata or production API responses',
  apiMode: 'Every browser /api/* request is intercepted; only the local built pages/assets reach Wrangler',
  authentication: 'Synthetic /api/session and /api/collaboration/session responses exercise client states only',
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
    queue, budget, collaboration: collaborationFixture(office),
  };
}

function collaborationFixture(office) {
  const companies = office.companies.filter(company => ['fixture-company', 'fixture-sketchbook'].includes(company.id)).map(({id, name}) => ({id, name}));
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const access = Object.fromEntries(companies.map(company => [company.id, {
    ok: true, company, memberships: [{id: `membership-${company.id}`, userId: 'fixture-member', displayName: `${company.name} teammate`, email: 'fixture-member@example.invalid', role: 'viewer', status: 'active', expiresAt, revokedAt: null, aclRevision: 1, createdAt: fixtureAt, updatedAt: fixtureAt}],
    invitations: [], audit: [], truncation: {memberships: false, invitations: false}, siteAccessNote: 'Synthetic company access only.',
  }]));
  const memberView = {
    company: {id: 'fixture-company', name: 'Fixture Engineering', status: 'active'},
    offices: [{id: 'fixture-office', companyId: 'fixture-company', name: 'Product studio', status: 'active'}],
    departments: [{id: 'fixture-department', companyId: 'fixture-company', officeId: 'fixture-office', parentDepartmentId: null, name: 'Fixture engineering department', status: 'active'}],
    roleCards: [
      {id: 'fixture-specialist', name: 'Fixture engineer', role: 'Backend engineering', kind: 'specialist', officeId: 'fixture-office', departmentId: 'fixture-department', shared: false, availability: 'active', provenance: 'company', toolAccess: false},
      {id: 'fixture-shared-reference', name: 'Fixture shared specialist', role: 'Research reference', kind: 'specialist', shared: true, availability: 'active', provenance: 'service-contract', toolAccess: false},
    ],
    blueprints: [{id: 'fixture-member-blueprint', officeId: 'fixture-office', rooms: [{id: 'fixture-room', name: 'Fixture shared room', departmentId: 'fixture-department', x: .05, y: .05, width: .9, height: .8}], desks: [{id: 'fixture-member-desk', roomId: 'fixture-room', employeeId: 'fixture-specialist', x: .3, y: .3}], whiteboards: []}],
    jobs: [], goals: [{id: 'fixture-member-goal', title: 'Fixture shared goal', status: 'planned'}], roadmap: [], counts: {}, truncation: {},
    membership: {role: 'viewer', expiresAt, aclRevision: 1},
    access: {mode: 'member', role: 'viewer', restrictedRegions: [{id: 'private-workspace', label: 'Private workspace', reason: 'A separate company membership is required.'}]},
  };
  return {
    authenticated: true, sessionSeen: false, isOwner: true, companies, access, memberView, deniedCompany: false,
    holdAccess: null, invitationPosts: [], inspectPosts: [], acceptPosts: [], token: 'a'.repeat(64),
    invitation: {id: 'fixture-invitation', companyId: 'fixture-company', intendedEmail: 'fixture-guest@example.invalid', role: 'contributor', status: 'pending', expiresAt},
  };
}

async function collaborationApiFixture(request, url, state, json) {
  const fixture = state.collaboration, key = request.method() + ' ' + url.pathname;
  if (key === 'GET /api/collaboration/session') {
    fixture.sessionSeen = fixture.authenticated;
    if (!fixture.authenticated) return json({ok: false, error: 'Fixture account sign-in required.'}, 401);
    return json({ok: true, user: {id: fixture.isOwner ? 'fixture-owner' : 'fixture-member', displayName: fixture.isOwner ? 'Fixture owner' : 'Fixture guest', isOwner: fixture.isOwner},
      companies: (fixture.isOwner ? fixture.companies : fixture.companies.filter(company => company.id === 'fixture-company')).map(company => ({...company, role: fixture.isOwner ? 'owner' : 'viewer', capabilities: [], expiresAt: fixture.memberView.membership.expiresAt}))});
  }
  if (!fixture.sessionSeen) unexpectedRequests.push({key, reason: 'Collaboration fixture API requested before its own session'});
  if (!fixture.authenticated || !fixture.sessionSeen) return json({ok: false, error: 'Fixture account sign-in required.'}, 401);
  const company = url.pathname.match(/^\/api\/collaboration\/companies\/(fixture-company|fixture-sketchbook)(?:\/(access|invitations|members|messages|proposals))?$/);
  if (company) {
    const [, companyId, suffix] = company;
    if (suffix === 'access' && request.method() === 'GET' && fixture.isOwner) {
      const hold = fixture.holdAccess;
      if (hold?.companyId === companyId) {
        fixture.holdAccess = null; hold.started.resolve(); await hold.release.promise;
        return json(hold.response);
      }
      return json(fixture.access[companyId]);
    }
    if (suffix === 'invitations' && request.method() === 'POST' && fixture.isOwner) {
      const body = request.postDataJSON(); fixture.invitationPosts.push({companyId, body});
      fixture.invitation = {id: 'fixture-created-invitation', companyId, ...body, status: 'pending', createdAt: fixtureAt};
      fixture.access[companyId].invitations.push(fixture.invitation);
      return json({ok: true, invitation: fixture.invitation, token: fixture.token, joinPath: `/join#invite=${fixture.token}`, shownOnce: true, siteAccessNote: 'Synthetic company access only.'}, 201);
    }
    if (companyId === 'fixture-company' && request.method() === 'GET' && !fixture.isOwner) {
      if (fixture.deniedCompany) return json({ok: false, error: 'Fixture company membership has expired.', code: 'not_found'}, 403);
      if (!suffix) return json(fixture.memberView);
      if (suffix === 'members') return json({humans: [{membershipId: 'fixture-human-membership', userId: 'fixture-member', displayName: 'Fixture guest', role: 'viewer', expiresAt: fixture.memberView.membership.expiresAt}]});
      if (suffix === 'messages') return json({messages: [{id: 'fixture-member-note', authorUserId: 'fixture-member', authorName: 'Fixture guest', content: 'Fixture member note', createdAt: fixtureAt}], nextCursor: null});
      if (suffix === 'proposals') return json({proposals: [{id: 'fixture-member-proposal', requesterUserId: 'fixture-member', assignedUserId: null, brief: 'Fixture member proposal', evidenceLinks: [], status: 'proposed', queuedCommandId: null, nativeRef: null, createdAt: fixtureAt, decidedAt: null}]});
    }
  }
  if (key === 'POST /api/collaboration/invitations/inspect') {
    fixture.inspectPosts.push(request.postDataJSON());
    return json({invitation: {...fixture.invitation, company: fixture.companies.find(company => company.id === fixture.invitation.companyId), accountEmail: fixture.invitation.intendedEmail}, siteAccessNote: 'Synthetic company access only.'});
  }
  if (key === 'POST /api/collaboration/invitations/accept') {
    fixture.acceptPosts.push(request.postDataJSON());
    return json({ok: true, membership: {companyId: fixture.invitation.companyId, role: fixture.invitation.role, expiresAt: fixture.invitation.expiresAt}});
  }
  unexpectedRequests.push({key, reason: 'No collaboration fixture route is authorized for this operation'});
  return json({ok: false, error: 'This UI gate does not execute this operation.'}, 501);
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
    if (url.pathname.startsWith('/api/collaboration/')) return collaborationApiFixture(request, url, state, json);
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
async function settleUi(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function assertToolbarLane(page, host, label) {
  const boxes = await page.locator(host).evaluate(element => {
    const toolbar = element.querySelector('.ff-controls')?.getBoundingClientRect();
    const canvas = element.querySelector('.ff-canvas-host')?.getBoundingClientRect();
    return toolbar && canvas ? {toolbarBottom: toolbar.bottom, canvasTop: canvas.top, canvasHeight: canvas.height} : null;
  });
  assert.ok(boxes && boxes.canvasHeight > 0, `${label}: measured canvas and camera toolbar must exist`);
  assert.ok(boxes.toolbarBottom <= boxes.canvasTop + 1, `${label}: camera toolbar must occupy its own lane, never cover canvas content: ${JSON.stringify(boxes)}`);
  checks.push(`${label}: camera toolbar is outside the measured canvas viewport`);
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
}
async function checkOwnerCanvasEntries(page, base, state, viewport) {
  const discarded = 'synthetic-navigation-token';
  const routes = [
    {route: `/?company=fixture-company&token=${discarded}`, surface: null},
    {route: `/?companyId=fixture-company&token=${discarded}#devices`, surface: 'connections', path: '/', anchor: '#devices'},
    {route: `/applications?company=fixture-company&token=${discarded}#design-connections`, surface: 'applications', path: '/applications', anchor: '#design-connections'},
    {route: `/access?company=fixture-company&token=${discarded}#invite=${discarded}`, surface: 'access', path: '/access', anchor: ''},
  ];
  for (const entry of routes) {
    stage = `owner-canvas-entry-${entry.surface || 'home'}-${viewport.width}`;
    const start = state.calls.length;
    await page.goto(base + entry.route, {waitUntil: 'networkidle'});
    await page.waitForURL(url => ['/workspace/chrome.html', '/workspace/chrome'].includes(url.pathname));
    await page.locator('#freeflow-host .ff-world').waitFor({state: 'attached'});
    await page.waitForFunction(() => document.querySelector('#office-company-select')?.value === 'fixture-company');
    // A website surface can be far from the company scene. Its correctly framed
    // viewport may cull every scene card; loaded scope and the live world are the
    // readiness contract here. Plain home must still render actual scene nodes.
    if (!entry.surface) await page.locator('#freeflow-host .ff-node').first().waitFor({state: 'attached'});
    await settleCanvas(page);
    await assertEndlessShell(page, `Owner ${entry.surface || 'home'} entry ${viewport.width}`);
    const url = new URL(page.url());
    assert.equal(state.calls[start], 'GET /api/session', 'Owner entry checks its session before opening protected content');
    assert.equal(url.searchParams.get('company'), 'fixture-company', 'Owner redirect retains the selected company');
    assert.equal(url.searchParams.get('surface'), entry.surface);
    assert.equal(url.hash, '#office');
    assert.equal(url.searchParams.has('token'), false, 'Unrelated navigation data must not propagate into the canvas');
    assert.equal(url.searchParams.has('canvas'), false, 'The top level remains the full canvas');
    if (!entry.surface) continue;
    const panel = await openCanvasSurface(page, entry.surface);
    const iframe = panel.locator('iframe');
    await iframe.waitFor({state: 'visible'});
    const childUrl = new URL(await iframe.getAttribute('src'), base);
    assert.equal(childUrl.origin, base);
    assert.equal(childUrl.pathname, entry.path);
    assert.equal(childUrl.searchParams.get('canvas'), '1');
    assert.equal(childUrl.searchParams.get('company'), 'fixture-company', 'Selected company reaches the actual child document');
    assert.equal(childUrl.hash, entry.anchor, 'Only the relevant public section anchor reaches the child');
    assert.equal(childUrl.href.includes(discarded), false, 'Invitation/auth-like navigation data does not enter an unrelated iframe');
    const handle = await iframe.elementHandle();
    const frame = await handle.contentFrame();
    assert.ok(frame, 'The canvas surface owns a real browser frame');
    await frame.locator(`.canvas-surface[data-canvas-surface="${entry.surface}"]`).waitFor({state: 'visible'});
    assert.equal(await frame.evaluate(() => typeof window.desktopBridge), 'undefined', 'Embedded cloud forms do not acquire the owner runtime bridge');
    if (entry.surface === 'access') await frame.getByRole('heading', {name: 'A seat in Fixture Engineering', exact: true}).waitFor({state: 'visible'});
    if (entry.surface === 'connections') await frame.getByLabel('Device name', {exact: true}).waitFor({state: 'visible'});
    if (entry.surface === 'applications') await frame.locator('#company-fixture-company').waitFor({state: 'visible'});
    assert.equal(page.frames().filter(frame => frame !== page.mainFrame() && /\/workspace\/chrome(?:\.html)?(?:[?#]|$)/.test(frame.url())).length, 0, 'A canvas surface must not recursively embed another full renderer');
    await handle.dispose();
  }
  checks.push(`Owner entries ${viewport.width}: home/access/applications lead to one canvas; iframe company and allowlisted anchors survive; tokens are discarded`);

  // The owner canvas may display a visitor surface, but that iframe still uses
  // its own collaboration session and receives only a member projection.
  const collaboration = state.collaboration;
  collaboration.isOwner = false; collaboration.sessionSeen = false;
  const memberReads = [];
  const observe = request => {
    if (!new URL(request.url()).pathname.startsWith('/api/')) return;
    let frame; try { frame = request.frame(); } catch { return; }
    if (frame !== page.mainFrame() && new URL(frame.url()).pathname === '/visit') memberReads.push(`${request.method()} ${new URL(request.url()).pathname}`);
  };
  page.on('request', observe);
  try {
    const panel = await openCanvasSurface(page, 'visit');
    const handle = await panel.locator('iframe').elementHandle();
    const frame = await handle.contentFrame();
    assert.ok(frame);
    await frame.locator('.collab-member-canvas .ff-studio').waitFor({state: 'visible'});
    // A newly opened phone panel can also give its child a narrow viewport.
    const canvasView = frame.getByRole('button', {name: 'Canvas view', exact: true});
    if (await canvasView.isVisible()) await canvasView.click();
    const restricted = frame.locator('.collab-member-canvas .ff-node--restricted');
    await restricted.waitFor({state: 'visible'});
    assert.equal(await restricted.getAttribute('aria-disabled'), 'true');
    assert.equal(await frame.evaluate(() => typeof window.desktopBridge), 'undefined');
    assert.equal(await frame.getByText('Fixture Sketchbook', {exact: true}).count(), 0);
    assert.equal(await frame.getByRole('button', {name: 'Post note', exact: true}).count(), 0);
    assert.equal(await frame.getByRole('button', {name: 'Submit proposal', exact: true}).count(), 0);
    assert.equal(memberReads[0], 'GET /api/collaboration/session');
    assert.ok(memberReads.length >= 2 && memberReads.every(key => key.startsWith('GET /api/collaboration/')), 'In-canvas visitor reads remain within the collaboration API');
    await capture(page, 'fixture-canvas-visiting-boundary', viewport, false);
    await handle.dispose();
  } finally {
    page.off('request', observe);
    collaboration.isOwner = true; collaboration.sessionSeen = false;
  }
  checks.push(`In-canvas visitor ${viewport.width}: member-only records, restricted region, no runtime bridge, no write controls and collaboration-only reads`);
  // Close through the real controls so later isolated authentication checks do
  // not reopen previously requested websites from the persisted local layout.
  for (const id of ['connections', 'applications', 'access', 'visit']) {
    const panel = await openCanvasSurface(page, id);
    await panel.locator('.canvas-panel-close').click();
  }
}

async function checkCollaborationRoutes(page, base, state, viewport) {
  const fixture = state.collaboration;
  stage = `collaboration-owner-${viewport.width}`;
  const start = state.calls.length;
  await page.goto(base + '/access?canvas=1&company=fixture-company', {waitUntil: 'networkidle'});
  await page.getByRole('heading', {name: 'A seat in Fixture Engineering', exact: true}).waitFor({state: 'visible'});
  assert.equal(state.calls[start], 'GET /api/collaboration/session', 'Access must check its collaboration session first');
  const hold = {companyId: 'fixture-company', started: deferred(), release: deferred(), response: structuredClone(fixture.access['fixture-company'])};
  hold.response.memberships[0].displayName = 'Fixture stale prior-scope member';
  fixture.holdAccess = hold;
  // A manual refresh has no navigation AbortSignal. Deliver it after switching
  // company so this catches stale results even if cancellation works elsewhere.
  await page.getByRole('button', {name: 'Refresh', exact: true}).click();
  let heldTimer;
  try { await Promise.race([hold.started.promise, new Promise((_, reject) => { heldTimer = setTimeout(() => reject(new Error('Prior-company refresh did not reach its synthetic fixture')), 15000); })]); }
  finally { clearTimeout(heldTimer); }
  await page.locator('.collab-company-list button').filter({hasText: 'Fixture Sketchbook'}).click();
  await page.getByRole('heading', {name: 'A seat in Fixture Sketchbook', exact: true}).waitFor({state: 'visible'});
  const late = page.waitForResponse(response => new URL(response.url()).pathname === '/api/collaboration/companies/fixture-company/access');
  hold.release.resolve(); await (await late).finished(); await settleUi(page);
  assert.equal(await page.getByRole('heading', {name: 'A seat in Fixture Sketchbook', exact: true}).count(), 1);
  assert.equal(await page.getByText('Fixture stale prior-scope member', {exact: true}).count(), 0, 'A late prior-company refresh must not repaint access records');
  assert.equal(await page.getByRole('heading', {name: 'A seat in Fixture Engineering', exact: true}).count(), 0);
  checks.push(`Access ${viewport.width}: delivered prior-company response cannot repaint the selected company`);

  const expiry = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 16);
  const expiryIso = await page.evaluate(value => new Date(value).toISOString(), expiry);
  await page.getByLabel('Account email', {exact: true}).fill('fixture-guest@example.invalid');
  await page.locator('#invite-email').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'invite-role');
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'invite-expiry');
  await page.locator('#invite-role').selectOption('contributor'); await page.locator('#invite-expiry').fill(expiry);
  assert.match(await page.locator('.collab-review').innerText(), /Fixture Sketchbook.*Contributor/);
  assert.equal(fixture.invitationPosts.length, 0, 'Editing an invitation must not create it');
  await page.getByRole('button', {name: 'Create invitation', exact: true}).click();
  await page.getByRole('heading', {name: 'Your invitation link is ready', exact: true}).waitFor({state: 'visible'});
  await page.getByRole('button', {name: 'Create invitation', exact: true}).waitFor({state: 'visible'});
  assert.deepEqual(fixture.invitationPosts, [{companyId: 'fixture-sketchbook', body: {intendedEmail: 'fixture-guest@example.invalid', role: 'contributor', expiresAt: expiryIso}}]);
  assert.equal(await page.locator('#created-invitation-link').inputValue(), `${base}/join#invite=${fixture.token}`);
  await capture(page, 'fixture-owner-access', viewport);
  checks.push(`Access ${viewport.width}: labelled keyboard path and one exact company/email/role/expiry POST; no invitation is sent`);

  stage = `collaboration-visitor-${viewport.width}`;
  fixture.isOwner = false; fixture.sessionSeen = false;
  const visitorStart = state.calls.length;
  await page.goto(base + '/visit?company=fixture-company', {waitUntil: 'networkidle'});
  await page.locator('.collab-member-canvas .ff-studio').waitFor({state: 'visible'});
  if (viewport.width === 390) {
    const canvas = page.locator('.collab-member-canvas').getByRole('button', {name: 'Canvas view', exact: true});
    await canvas.focus(); await page.keyboard.press('Enter');
  }
  await page.locator('.collab-member-canvas .ff-node--restricted').waitFor({state: 'visible'});
  assert.equal(await page.locator('.collab-member-canvas .ff-node--restricted').getAttribute('aria-disabled'), 'true');
  await page.getByRole('region', {name: 'Private workspace boundary', exact: true}).waitFor({state: 'visible'});
  assert.equal(await page.getByRole('button', {name: 'Post note', exact: true}).count(), 0);
  assert.equal(await page.getByRole('button', {name: 'Submit proposal', exact: true}).count(), 0);
  assert.equal(await page.getByText('Fixture Sketchbook', {exact: true}).count(), 0, 'The member route must not render other owner companies');
  assert.equal(state.calls[visitorStart], 'GET /api/collaboration/session');
  assert.ok(state.calls.slice(visitorStart).every(key => key.startsWith('GET /api/collaboration/')), 'The member surface must never request the owner workspace API or dispatch mutations');
  assert.equal(await page.evaluate(() => typeof window.desktopBridge), 'undefined', 'The member canvas must not receive the owner desktop bridge');
  await assertToolbarLane(page, '.collab-member-canvas', `Visitor ${viewport.width}`);
  await capture(page, 'fixture-visiting-office', viewport);
  checks.push(`Visitor ${viewport.width}: actual member canvas, grey restricted region, viewer controls and no owner API or bridge`);

  fixture.deniedCompany = true;
  await page.getByRole('button', {name: 'Refresh company', exact: true}).click();
  await page.getByRole('alert').filter({hasText: 'Fixture company membership has expired.'}).waitFor({state: 'visible'});
  assert.equal(await page.locator('.collab-member-canvas .ff-studio').count(), 0);
  assert.equal(await page.locator('.collab-visit-scope, .collab-role-list, .collab-messages, .collab-proposals').count(), 0, 'Lost membership must unmount all previously visible company records');
  assert.equal(await page.getByText('Fixture member note', {exact: true}).count(), 0);
  assert.equal(await page.getByText('Fixture member proposal', {exact: true}).count(), 0);
  checks.push(`Visitor ${viewport.width}: expired membership clears the canvas, people, notes and proposals`);
  fixture.deniedCompany = false;

  stage = `collaboration-join-${viewport.width}`;
  await page.goto(`${base}/join#invite=${fixture.token}`, {waitUntil: 'networkidle'});
  await page.locator('.collab-grant-review').waitFor({state: 'visible'});
  assert.equal(new URL(page.url()).hash, '', 'Invitation fragments must be removed from the live URL before subsequent navigation');
  assert.equal(new URL(page.url()).search, '');
  assert.deepEqual(fixture.inspectPosts, [{token: fixture.token}]);
  assert.deepEqual(fixture.acceptPosts, [], 'Inspection must never accept membership automatically');
  assert.match(await page.locator('.collab-grant-review').innerText(), /fixture-guest@example.invalid/);
  assert.match(await page.locator('.collab-grant-review').innerText(), /Fixture Sketchbook/);
  assert.match(await page.locator('.collab-grant-review').innerText(), /Contributor/);
  assert.equal(await page.locator('.collab-grant-review time').getAttribute('datetime'), expiryIso);
  const storage = await page.evaluate(() => JSON.stringify({local: {...localStorage}, session: {...sessionStorage}}));
  assert.ok(!storage.includes(fixture.token), 'The invitation token must not be persisted in browser storage');
  await capture(page, 'fixture-invitation-review', viewport, false);
  const join = page.getByRole('button', {name: 'Join as Contributor', exact: true});
  await join.focus(); await page.keyboard.press('Enter');
  await page.getByRole('link', {name: 'Open company workspace', exact: true}).waitFor({state: 'visible'});
  assert.deepEqual(fixture.acceptPosts, [{token: fixture.token}], 'Only the explicit reviewed acceptance may create a membership');
  assert.equal(await page.getByRole('link', {name: 'Open company workspace', exact: true}).getAttribute('href'), '/visit?company=fixture-sketchbook');
  checks.push(`Join ${viewport.width}: company/account/role/expiry review precedes one explicit acceptance; token leaves URL and never enters storage`);

  stage = `collaboration-signin-${viewport.width}`;
  fixture.authenticated = false; fixture.sessionSeen = false;
  for (const [route, heading] of [['/access?canvas=1', 'Sign in to manage access'], ['/visit', 'Sign in to your visiting office'], [`/join#invite=${fixture.token}`, 'Sign in before joining']]) {
    const before = state.calls.length;
    await page.goto(base + route, {waitUntil: 'networkidle'});
    await page.getByRole('heading', {name: heading, exact: true}).waitFor({state: 'visible'});
    assert.deepEqual(state.calls.slice(before), ['GET /api/collaboration/session'], `${route.split('#')[0]}: a rejected session must not request company or invitation records`);
    assert.equal(await page.locator('.collab-access-layout, .collab-member-canvas, .collab-grant-review').count(), 0);
    assert.equal(new URL(page.url()).hash, '');
    await assertLayout(page, `Collaboration signed-out ${viewport.width} ${route.split('#')[0]}`);
  }
  checks.push(`Collaboration ${viewport.width}: all three routes clear protected content and stop after a rejected session`);
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

async function checkCloudRuntimeLimits(page, state, viewport) {
  await openCanvasSurface(page, 'crew');
  const runtime = await page.locator('#canvas-crew-runtime').innerText();
  const before = state.calls.length;
  await page.locator('#canvas-dispatch-toggle').click();
  await page.locator('#global-status').filter({hasText: 'This operation runs in the connected desktop application.'}).waitFor({state: 'visible'});
  assert.equal(await page.locator('#canvas-crew-runtime').innerText(), runtime, 'An unavailable dispatcher leaves the known runtime state unchanged');
  assert.equal(await page.locator('#canvas-dispatch-toggle').innerText(), 'Enable dispatch');
  assert.doesNotMatch(await page.locator('#worker-result').innerText(), /Dispatcher enabled/, 'A rejected runtime response cannot become a success status');
  assert.deepEqual(state.calls.slice(before).filter(call => !call.startsWith('GET ')), [], 'Unsupported cloud runtime action never queues a native command or provider request');
  await openCanvasSurface(page, 'source-review');
  await page.getByText('Connect the desktop or VPS runtime to receive source-review reports.', {exact: true}).waitFor({state: 'visible'});
  await page.locator('.canvas-source-policy > summary').click();
  assert.match(await page.locator('.canvas-source-policy').innerText(), /General website crawling is not connected/);
  await capture(page, 'fixture-canvas-runtime-limits', viewport, false);
  checks.push(`Runtime ${viewport.width}: unsupported dispatch displays its real error with no write request or false success; source review reports its actual connected state`);
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

  await openCanvasSurface(page, 'scope');
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

  await openCanvasSurface(page, 'workspace-softboard');
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

  await openCanvasSurface(page, 'workspace-timeline');
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

  const panelChecks = await checkEndlessPanelInteractions(page, `Connected studio ${viewport.width}`);
  assert.ok(Object.values(panelChecks).every(Boolean));
  await assertScope();
  await capture(page, 'fixture-connected-live-panels', viewport, false);
  checks.push(`Canvas ${viewport.width}: simultaneous live surfaces, two retained drafts, stable conversation DOM, pinned movement, resize, Escape rollback and reduced motion`);

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

    await checkOwnerCanvasEntries(page, base, state, viewport);
    const beforeConnections = state.calls.length;
    await page.goto(base + '/?canvas=1', {waitUntil: 'networkidle'});
    await page.getByText('Your saved office is ready.', {exact: false}).waitFor({state: 'visible'});
    assert.equal(state.calls[beforeConnections], 'GET /api/session', 'Embedded connections must load its session before private records');
    assert.equal(await page.locator('.canvas-surface[data-canvas-surface=connections]').count(), 1);
    assert.equal(await page.getByRole('navigation', {name: 'Daftar workspace'}).count(), 0, 'An embedded form does not introduce another screen navigation');
    await page.getByLabel('Device name', {exact: true}).fill('Fixture laptop');
    await capture(page, 'fixture-home', viewport);
    checks.push(`Connections ${viewport.width}: embedded session state, saved-state summary and labelled device form`);
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'blueprint');
    const darkCanvas = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim());
    assert.ok(darkCanvas, 'The built homepage must load the shared studio palette');
    await page.locator('#cloud-studio-theme').selectOption('drafting');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'drafting');
    assert.equal(await page.evaluate(() => localStorage.getItem('daftar-studio-theme')), 'drafting');
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim()), darkCanvas, 'Changing the appearance must apply a different canvas palette');
    if (viewport.width === 1440) await capture(page, 'fixture-home-drafting', viewport);

    const beforeDirectory = state.calls.length;
    await page.goto(base + '/applications?canvas=1', {waitUntil: 'networkidle'});
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
    await assertEndlessShell(page, `Freeflow ${viewport.width}`);
    checks.push(`Freeflow ${viewport.width}: fresh default cloud navigation shows the mounted Freeflow host first`);
    await page.goto(base + '/applications?canvas=1', {waitUntil: 'networkidle'});
    await page.waitForFunction(() => document.querySelectorAll('.directory-company').length === 3);
    await page.locator('#company-fixture-company').getByRole('link', {name: 'Blueprint', exact: true}).click();
    // Workers assets canonicalizes this existing HTML asset with a 307 to the
    // extensionless path. Both forms must retain the exact company/tab query.
    await page.waitForURL(url => ['/workspace/chrome.html', '/workspace/chrome'].includes(url.pathname)
      && url.searchParams.get('company') === 'fixture-company' && url.searchParams.get('workspace') === 'blueprint');
    await page.locator('.canvas-panel[data-panel-id="workspace-blueprint"][data-open="true"]').waitFor({state: 'visible'});
    await page.locator('#workspace-panel-blueprint').waitFor({state: 'visible'});
    await assertEndlessShell(page, `Blueprint deep link ${viewport.width}`);
    assert.equal(new URL(page.url()).searchParams.get('company'), 'fixture-company');
    assert.ok(await page.locator('#office-blueprint .blueprint-room').count() > 0, 'Connected blueprint should show the synthetic saved room');
    await checkConnectedStudio(page, viewport);
    await checkCloudRuntimeLimits(page, state, viewport);
    // Also exercise the reverse shared-renderer → cloud boundary, then reload
    // the React page. This is a local preference, not a production save claim.
    await openCanvasSurface(page, 'scope');
    await page.locator('#workspace-theme').selectOption('blueprint');
    assert.equal(await page.evaluate(() => localStorage.getItem('daftar-studio-theme')), 'blueprint');
    await page.goto(base + '/applications?canvas=1', {waitUntil: 'networkidle'});
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'blueprint' && document.querySelectorAll('.directory-company').length === 3);
    assert.equal(await page.locator('#cloud-studio-theme').inputValue(), 'blueprint');
    await page.reload({waitUntil: 'networkidle'});
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'blueprint' && document.querySelectorAll('.directory-company').length === 3);
    assert.equal(await page.locator('#cloud-studio-theme').inputValue(), 'blueprint');
    await checkScopedLinks(page, base);
    checks.push(`Theme ${viewport.width}: cloud → shared renderer → cloud, distinct palettes and persistence across both reloads`);

    await checkCollaborationRoutes(page, base, state, viewport);

    if (viewport.width === 390) {
      state.authenticated = false; state.sessionSeen = false;
      const previousCalls = state.calls.length;
      await page.goto(base + '/applications?canvas=1', {waitUntil: 'networkidle'});
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
      assert.deepEqual(state.calls.slice(beforeWelcome), ['GET /api/session', 'GET /api/session'], 'Unframed welcome checks entry and form sessions without requesting private records');
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
