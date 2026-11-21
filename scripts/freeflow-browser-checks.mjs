/**
 * Freeflow browser matrix checks. Side-effect free on import: nothing executes until a runner calls an export.
 * Cloud checks use fixture-intercepted /api/* only; packaged check uses the real Electron page and bridge.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertEndlessShell, checkEndlessPanelInteractions, openCanvasSurface } from './endless-canvas-browser-checks.mjs';

const RICH_NODE_BUDGET = 240, THREAD_BUDGET = 160, LIST_PAGE_SIZE = 50;
const FIXTURE_AT = '2026-11-20T12:00:00.000Z';

const MATRIX = [
  {n: '01', name: 'conference-chairs-perspective', w: 1024, h: 768, theme: 'blueprint'},
  {n: '02', name: 'company-top-inspector-donna-launcher', w: 1024, h: 768, theme: 'drafting'},
  {n: '03', name: 'company-perspective-donna-draft', w: 1280, h: 720, theme: 'blueprint'},
  {n: '04', name: 'department-top-heat', w: 1280, h: 720, theme: 'drafting'},
  {n: '05', name: 'department-perspective', w: 1920, h: 1080, theme: 'blueprint'},
  {n: '06', name: 'conference-top-chairs', w: 1920, h: 1080, theme: 'drafting'},
  {n: '07', name: 'conference-company-directory', w: 390, h: 844, theme: 'blueprint'},
  {n: '08', name: 'department-company-directory', w: 390, h: 844, theme: 'drafting'},
];

const IDS = {
  company: 'folio:fixture-company',
  room: 'universe:blueprint:room:fixture-company:fixture-office:fixture-room',
  employee: 'universe:blueprint:employee:fixture-company:fixture-specialist',
};

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function summarizeTimings(list) {
  const v = list.map(t => t.ms);
  return {count: v.length, p50: percentile(v, 0.5), p95: percentile(v, 0.95), max: v.length ? Math.max(...v) : null};
}

async function settle(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function assertNoOverflow(page, label) {
  const o = await page.evaluate(() => ({actual: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), expected: innerWidth}));
  assert.ok(o.actual <= o.expected + 1, `${label}: horizontal overflow ${JSON.stringify(o)}`);
}

async function assertTheme(page, theme, label) {
  const got = await page.evaluate(() => ({root: document.documentElement.dataset.theme, select: document.getElementById('workspace-theme')?.value, canvas: getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim()}));
  assert.equal(got.root, theme, `${label}: document theme`);
  assert.equal(got.select, theme, `${label}: theme select`);
  return got;
}

async function waitStudio(page) {
  await page.locator('#freeflow-host .ff-studio').waitFor({state: 'visible'});
  await page.locator('#freeflow-host .ff-title').waitFor({state: 'visible'});
  await page.locator('#freeflow-host .ff-node').first().waitFor({state: 'attached'});
  await settle(page);
}

async function canvasStats(page) {
  return page.evaluate(() => {
    const dup = sel => { const ids = [...document.querySelectorAll(sel)].map(e => e.dataset.nodeId || e.dataset.threadId || e.id); return ids.length - new Set(ids).size; };
    const canvas = document.querySelector('#freeflow-host .ff-canvas-host');
    const box = canvas ? canvas.getBoundingClientRect() : {width: 0, height: 0};
    return {
      nodes: document.querySelectorAll('#freeflow-host .ff-node').length,
      threads: document.querySelectorAll('#freeflow-host .ff-thread').length,
      listButtons: document.querySelectorAll('#freeflow-host .ff-list-button').length,
      inspectors: document.querySelectorAll('#freeflow-host .ff-inspector').length,
      donnaForms: document.querySelectorAll('#workspace-chat-form').length,
      dupNodes: dup('#freeflow-host .ff-node[data-node-id]'),
      dupThreads: dup('#freeflow-host .ff-thread[data-thread-id]'),
      dupList: dup('#freeflow-host .ff-list-button[data-node-id]'),
      descendants: document.querySelectorAll('#freeflow-host *').length,
      canvasW: Math.round(box.width), canvasH: Math.round(box.height),
      canvasHidden: !canvas || canvas.hidden || getComputedStyle(canvas).display === 'none',
      chairs: document.querySelectorAll('#freeflow-host .ff-chair').length,
      status: document.querySelector('#freeflow-host .ff-status')?.textContent || '',
      budget: document.querySelector('#freeflow-host .ff-budget')?.textContent || '',
      listCount: document.querySelector('#freeflow-host .ff-list-count')?.textContent || '',
      worldTransform: document.querySelector('#freeflow-host .ff-world')?.style.transform || '',
    };
  });
}

async function openCompany(page, companyId) {
  const node = page.locator(`#freeflow-host .ff-node[data-node-id="folio:${companyId}"]`);
  await node.waitFor({state: 'attached'});
  await node.focus();
  await page.keyboard.press('Enter');
  await page.locator('#freeflow-host .ff-breadcrumbs li').nth(1).waitFor({state: 'visible'});
  await settle(page);
}

async function openDepartment(page) {
  const room = page.locator(`#freeflow-host .ff-node[data-node-id="${IDS.room}"]`);
  await room.waitFor({state: 'attached'});
  await room.focus();
  await page.keyboard.press('Enter');
  await page.locator('#freeflow-host .ff-breadcrumbs li').last().waitFor({state: 'visible'});
  await settle(page);
}

async function directoryPanelCheck(page, label, {nodeId, query, destination}) {
  await assertEndlessShell(page, label);
  await openCanvasSurface(page, 'company-directory');
  const search = page.locator('#freeflow-host .ff-list-search');
  await search.fill(query);
  await settle(page);
  const target = page.locator(`#freeflow-host .ff-list-button[data-node-id="${nodeId}"]`);
  await target.waitFor({state: 'visible'});
  await target.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(expected => document.querySelector('#freeflow-host .ff-breadcrumbs button[aria-current="page"]')?.textContent === expected, destination);
  await settle(page);
  assert.equal(await page.locator('.canvas-panel[data-panel-id="company-directory"]').getAttribute('data-open'), 'true', `${label}: changing scope retains the live directory surface`);
  // Scope navigation frames the selected blueprint. Reframe its persistent
  // directory using the real launcher before the next input interaction.
  await openCanvasSurface(page, 'company-directory');
  assert.equal(await search.inputValue(), '', `${label}: entering a new scope resets the list filter`);
  assert.equal((await canvasStats(page)).canvasHidden, false, `${label}: directory never replaces the narrow canvas`);
}

async function cameraCheck(page, label) {
  const before = await page.locator('#freeflow-host .ff-world').evaluate(e => e.style.transform);
  const ctl = page.locator('#freeflow-host .ff-controls');
  await ctl.getByRole('button', {name: 'Top view'}).click();
  await settle(page);
  const angleTop = await page.locator('#freeflow-host .ff-controls-angle').textContent();
  assert.match(angleTop, /Tilt 0/, `${label}: top view tilt`);
  await ctl.getByRole('button', {name: 'Perspective view'}).click();
  await settle(page);
  const anglePersp = await page.locator('#freeflow-host .ff-controls-angle').textContent();
  assert.match(anglePersp, /Tilt 42/, `${label}: perspective tilt`);
  await ctl.getByRole('button', {name: 'Rotate right 15 degrees'}).click();
  await ctl.getByRole('button', {name: 'Zoom in'}).click();
  await settle(page);
  const after = await page.locator('#freeflow-host .ff-world').evaluate(e => e.style.transform);
  assert.notEqual(after, before, `${label}: camera transform must change`);
  await ctl.getByRole('button', {name: 'Fit scene to view'}).click();
  await settle(page);
}

async function setView(page, kind) {
  const btn = page.locator('#freeflow-host .ff-controls').getByRole('button', {name: kind === 'top' ? 'Top view' : 'Perspective view'});
  await btn.click();
  await settle(page);
}

function capacityState(makeState) {
  const state = makeState();
  const office = state.workspace.snapshot;
  const at = FIXTURE_AT;
  const COMPANIES = 200, DEPTS = 10, ROOMS = 100, DESKS_PER_ROOM = 10, BOARDS_PER_ROOM = 2;
  office.jobs = []; office.goals = []; office.checkpoints = [];
  office.portfolio.groups = []; office.portfolio.roadmap = []; office.portfolio.services = []; office.portfolio.contracts = []; office.portfolio.transfers = [];
  const keep = office.companies.find(c => c.id === 'fixture-company');
  keep.parentCompanyId = null;
  const others = [];
  for (let i = 1; i < COMPANIES; i++) {
    const id = `cap-company-${String(i).padStart(3, '0')}`;
    others.push({id, name: `Capacity company ${String(i).padStart(3, '0')}`, repoUrl: null, status: 'active', assistantId: 'donna', createdAt: at, source: 'ui-test-fixture', importedAt: null, githubStatus: 'unchecked', parentCompanyId: i === 1 ? 'fixture-company' : `cap-company-${String(i - 1).padStart(3, '0')}`});
  }
  office.companies = [keep, ...others];
  office.offices = [office.offices.find(o => o.id === 'fixture-office')];
  const depts = [];
  for (let d = 0; d < DEPTS; d++) depts.push({id: d === 0 ? 'fixture-department' : `cap-dept-${d}`, companyId: 'fixture-company', officeId: 'fixture-office', name: `Capacity department ${d}`, status: 'active', assistantId: 'donna', createdAt: at});
  office.departments = depts;
  const donna = office.employees.find(e => e.id === 'donna');
  const employees = [donna], rooms = [], desks = [], boards = [];
  const cols = 10, gutter = 60, rw = 700, rh = 420;
  for (let r = 0; r < ROOMS; r++) {
    const roomId = r === 0 ? 'fixture-room' : `cap-room-${r}`;
    const dept = depts[r % DEPTS];
    rooms.push({id: roomId, name: `Capacity room ${r}`, departmentId: dept.id, x: (r % cols) * (rw + gutter), y: Math.floor(r / cols) * (rh + gutter), width: rw, height: rh});
    for (let k = 0; k < DESKS_PER_ROOM; k++) {
      const eid = r === 0 && k === 0 ? 'fixture-specialist' : r === 0 && k === 1 ? 'fixture-researcher' : `cap-emp-${r}-${k}`;
      employees.push({id: eid, name: eid === 'fixture-specialist' ? 'Fixture engineer' : eid === 'fixture-researcher' ? 'Fixture researcher' : `Capacity employee ${r}-${k}`, role: 'Specialist', companyId: 'fixture-company', officeId: 'fixture-office', departmentId: dept.id, kind: 'specialist', status: 'active', skillPaths: [], createdAt: at, updatedAt: at});
      desks.push({id: `cap-desk-${r}-${k}`, employeeId: eid, roomId, x: 0.05 + (k % 5) * 0.18, y: 0.2 + Math.floor(k / 5) * 0.3, width: 0.14, height: 0.12});
    }
    for (let b = 0; b < BOARDS_PER_ROOM; b++) {
      const owner = r === 0 && b === 0 ? 'fixture-specialist' : `cap-emp-${r}-${b}`;
      boards.push({id: `cap-board-${r}-${b}`, roomId, ownerEmployeeId: r === 0 && b === 1 ? 'fixture-researcher' : owner, title: `Capacity board ${r}-${b}`, goalIds: [], jobIds: [], roadmapItemIds: [], x: 0.1 + b * 0.4, y: 0.85});
    }
  }
  office.employees = employees;
  const bp = office.blueprints[0];
  bp.rooms = rooms; bp.desks = desks; bp.whiteboards = boards;
  office.blueprints = [bp];
  Object.assign(office.budget, {observedUsd: 0, committedUsd: 0, remainingUsd: 10});
  return state;
}

async function newContext(browser, base, installApiFixture, state, viewport, init) {
  const context = await browser.newContext({viewport, reducedMotion: 'reduce', serviceWorkers: 'block'});
  if (init) await context.addInitScript(init.fn, init.arg);
  await installApiFixture(context, base, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
  return {context, page};
}

export async function runFreeflowCloudChecks({browser, base, makeState, installApiFixture, outDir}) {
  const receipt = {schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(), testedCommit: process.env.GITHUB_SHA || null, themeStorageKey: 'daftar-studio-theme', shots: [], checks: [], timings: {ready: [], interaction: []}, browserErrors: [], requestAudit: [], fixture: {}, domCounts: {}, screenshots: []};
  const file = path.join(outDir, 'freeflow-receipt.json');
  const shot = async (page, name, viewport, extra = {}) => {
    const f = `${name}.png`;
    await assertNoOverflow(page, name);
    await page.screenshot({path: path.join(outDir, f), fullPage: false, animations: 'disabled'});
    receipt.screenshots.push({file: f, viewport, ...extra});
  };
  const time = async (list, label, fn) => { const t0 = Date.now(); const r = await fn(); list.push({label, ms: Date.now() - t0}); return r; };
  let page, context;
  const audit = (state, label) => {
    const writes = state.calls.filter(c => !c.startsWith('GET '));
    receipt.requestAudit.push({label, calls: state.calls.length, nonGet: writes});
    assert.deepEqual(writes, [], `${label}: non-GET /api requests made`);
  };
  const closeCtx = async () => { try { await context?.close(); } catch {} context = null; page = null; };
  try {
    // ----- matrix -----
    const base0 = makeState();
    receipt.fixture = {companies: base0.workspace.snapshot.companies.length, jobs: base0.workspace.snapshot.jobs.length, employees: base0.workspace.snapshot.employees.length, themes: ['blueprint', 'drafting']};
    const canvasTokens = {};
    for (const row of MATRIX) {
      const state = makeState();
      const viewport = {width: row.w, height: row.h};
      const init = {fn: theme => { try { localStorage.setItem('daftar-studio-theme', theme); } catch {} }, arg: row.theme};
      ({context, page} = await newContext(browser, base, installApiFixture, state, viewport, init));
      page.on('pageerror', e => receipt.browserErrors.push({shot: row.n, message: e.message}));
      page.on('response', r => { const u = new URL(r.url()); if (u.origin === base && !u.pathname.startsWith('/api/') && r.status() >= 400) receipt.browserErrors.push({shot: row.n, message: `${r.status()} ${u.pathname}`}); });
      await time(receipt.timings.ready, `ready-${row.n}`, async () => {
        const companyScope = ['04', '05', '08'].includes(row.n);
        await page.goto(base + (companyScope ? '/?company=fixture-company' : '/'), {waitUntil: 'domcontentloaded'});
        await page.waitForURL(url => ['/workspace/chrome.html', '/workspace/chrome'].includes(url.pathname));
        await waitStudio(page);
        if (companyScope) await page.waitForFunction(() => document.querySelector('#freeflow-host .ff-breadcrumbs button[aria-current="page"]')?.textContent === 'Fixture Engineering');
        assert.equal(state.calls[0], 'GET /api/session', 'Canvas entry checks the owner session first');
      });
      const themeInfo = await assertTheme(page, row.theme, `shot ${row.n}`);
      canvasTokens[row.theme] = themeInfo.canvas;
      const interactionStarted = Date.now();
      const stage = await (async () => {
        if (row.n === '01') {
          await setView(page, 'perspective');
          const t = await page.locator('#freeflow-host .ff-world-table').boundingBox();
          assert.ok(t && t.width > 0 && t.height > 0, 'portfolio table visible');
          const s = await canvasStats(page);
          assert.equal(s.chairs, base0.workspace.snapshot.companies.length, 'one chair per folio');
          const aria = await page.locator('#freeflow-host .ff-chair svg').first().getAttribute('aria-hidden').catch(() => null);
          const wrapAria = await page.locator('#freeflow-host .ff-chair').first().getAttribute('aria-hidden');
          assert.ok(aria === 'true' || wrapAria === 'true', 'chair decorative');
          assert.ok(await page.locator(`#freeflow-host .ff-node[data-node-id="${IDS.company}"]`).count() === 1, 'real company node identity');
          return 'conference perspective';
        }
        if (row.n === '02') {
          await openCompany(page, 'fixture-company');
          await setView(page, 'top');
          const emp = page.locator(`#freeflow-host .ff-node[data-node-id="${IDS.employee}"]`);
          await emp.waitFor({state: 'attached'});
          await emp.click();
          await openCanvasSurface(page, 'object-inspector');
          await page.locator('#freeflow-host .ff-inspector[aria-label="Ownership inspector"]').waitFor({state: 'visible'});
          assert.match(await page.locator('#freeflow-host .ff-inspector').innerText(), /Fixture engineer/);
          const donna = await openCanvasSurface(page, 'donna');
          await page.setViewportSize({width: 800, height: 600});
          await settle(page);
          await openCanvasSurface(page, 'donna');
          const box = await donna.boundingBox();
          assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= 801 && box.y + box.height <= 601, `Reframed Donna surface fits the smaller viewport ${JSON.stringify(box)}`);
          await assertEndlessShell(page, 'resized Donna canvas');
          await page.setViewportSize(viewport);
          await openCanvasSurface(page, 'object-inspector');
          assert.equal(await donna.getAttribute('data-open'), 'true', 'Inspector focus preserves the live Donna panel');
          return 'company top, persistent inspector and Donna surfaces';
        }
        if (row.n === '03') {
          await openCompany(page, 'fixture-company');
          const panels = await checkEndlessPanelInteractions(page, 'matrix 03');
          assert.ok(Object.values(panels).every(Boolean));
          await setView(page, 'perspective');
          assert.equal(new URL(page.url()).searchParams.get('company'), 'fixture-company');
          return 'company perspective with persistent drafts and independently controlled panels';
        }
        if (row.n === '04') {
          await openDepartment(page);
          await setView(page, 'top');
          await openCanvasSurface(page, 'scope');
          const heat = page.locator('#workspace-heat-mode');
          assert.equal(await page.locator('#workspace-heat-mode').count(), 1, 'single heat select');
          assert.equal(await page.locator('#workspace-theme').count(), 1, 'single theme select');
          await heat.waitFor({state: 'visible'});
          for (const mode of ['workload', 'budget', 'attention']) {
            await openCanvasSurface(page, 'scope');
            await heat.selectOption(mode);
            await page.locator('#freeflow-host .ff-controls').getByRole('button', {name: 'Fit scene to view'}).click();
            await settle(page);
            const levels = await page.evaluate(() => [...document.querySelectorAll('#freeflow-host .ff-node[data-heat-level]')].map(n => ({id: n.dataset.nodeId, level: n.dataset.heatLevel, text: n.querySelector('.ff-node-heat')?.textContent || ''})));
            const emp = levels.find(l => l.id === IDS.employee);
            assert.ok(emp, `${mode}: measured employee is actually mounted`);
            assert.equal(emp.level, '1', `${mode} level 1`);
            const res = levels.find(l => l.id === 'universe:blueprint:employee:fixture-company:fixture-researcher');
            assert.ok(res, `${mode}: unknown-data employee is actually mounted`);
            assert.equal(res.level, 'unknown', 'researcher heat unknown');
          }
          await openCanvasSurface(page, 'scope');
          await heat.selectOption('workload');
          await page.locator('#freeflow-host .ff-controls').getByRole('button', {name: 'Fit scene to view'}).click();
          await settle(page);
          const txt = await page.locator('#freeflow-host').textContent();
          assert.match(txt, /1 unresolved job/, 'workload text');
          await openCanvasSurface(page, 'scope');
          await heat.selectOption('off');
          await page.locator('#freeflow-host .ff-controls').getByRole('button', {name: 'Fit scene to view'}).click();
          await settle(page);
          assert.equal(await page.locator('#freeflow-host .ff-node[data-heat-level]').count(), 0, 'heat off clears levels');
          assert.equal(await page.locator('#freeflow-host .ff-node-heat').count(), 0, 'heat off clears badges');
          await openCanvasSurface(page, 'scope');
          await heat.selectOption('workload');
          await page.locator('#freeflow-host .ff-controls').getByRole('button', {name: 'Fit scene to view'}).click();
          await settle(page);
          const labels = await page.evaluate(() => [...document.querySelectorAll('#freeflow-host .ff-segment-tag')].map(e => e.textContent));
          assert.ok(labels.length > 0, 'room/department labels visible');
          const crumbs = await page.locator('#freeflow-host .ff-breadcrumbs li').allTextContents();
          assert.ok(crumbs.length >= 3, 'department breadcrumbs');
          return 'department top heat';
        }
        if (row.n === '05') {
          await openDepartment(page);
          await setView(page, 'perspective');
          await cameraCheck(page, 'shot05');
          return 'department perspective';
        }
        if (row.n === '06') {
          await setView(page, 'top');
          const s = await canvasStats(page);
          assert.ok(s.chairs >= 1 && s.canvasW > 0 && s.canvasH > 0);
          await page.getByRole('button', {name: 'Return to the conference table', exact: true}).click();
          return 'conference top chairs';
        }
        if (row.n === '07') {
          await directoryPanelCheck(page, 'shot07', {nodeId: IDS.company, query: 'Fixture Engineering', destination: 'Fixture Engineering'});
          return 'conference directory on the continuous mobile canvas';
        }
        await directoryPanelCheck(page, 'shot08', {nodeId: IDS.room, query: 'Product studio', destination: 'Engineering'});
        return 'department directory on the continuous mobile canvas';
      })();
      await assertTheme(page, row.theme, `shot ${row.n} post-interaction`);
      const stats = await canvasStats(page);
      await assertEndlessShell(page, `shot ${row.n}`);
      assert.ok(stats.canvasW > 0 && stats.canvasH > 0 && !stats.canvasHidden, `shot ${row.n}: canvas remains visible`);
      assert.equal(await page.locator('#donna-conversation').count(), 1); assert.equal(await page.locator('#workspace-chat-form').count(), 1); assert.equal(await page.locator('#chat-message').count(), 1);
      receipt.domCounts[`shot${row.n}`] = stats;
      receipt.timings.interaction.push({label: `shot-${row.n}`, ms: Date.now() - interactionStarted});
      await shot(page, `freeflow-${row.n}-${row.name}`, viewport, {theme: row.theme, stage});
      receipt.shots.push({n: row.n, theme: row.theme, viewport, stage});
      assert.deepEqual(receipt.browserErrors, [], 'browser errors');
      audit(state, `matrix-${row.n}`);
      await closeCtx();
    }
    assert.notEqual(canvasTokens.blueprint, canvasTokens.drafting, '--canvas token must differ between themes');
    receipt.checks.push('Eight matrix shots rendered with asserted theme, one theme/heat select, no non-GET /api requests');

    // ----- mode URL transitions and CEO entry -----
    {
      const state = makeState();
      ({context, page} = await newContext(browser, base, installApiFixture, state, {width: 1280, height: 720}, {fn: t => { try { localStorage.setItem('daftar-studio-theme', t); } catch {} }, arg: 'blueprint'}));
      page.on('pageerror', e => receipt.browserErrors.push({shot: 'modes', message: e.message}));
      await page.goto(base + '/', {waitUntil: 'domcontentloaded'});
      await page.waitForURL(url => ['/workspace/chrome.html', '/workspace/chrome'].includes(url.pathname));
      await waitStudio(page);
      await page.goto(base + '/workspace/chrome.html?company=fixture-company#office', {waitUntil: 'domcontentloaded'});
      await waitStudio(page);
      await page.goto(base + '/workspace/chrome.html?company=fixture-company&workspace=chat#office', {waitUntil: 'domcontentloaded'});
      await page.locator('#workspace-chat-form').waitFor({state: 'visible'});
      const conversation = await page.locator('#donna-conversation').elementHandle();
      await page.locator('#chat-message').fill('Unsent CEO entry draft');
      await openCanvasSurface(page, 'portfolio');
      await settle(page);
      const u = new URL(page.url());
      assert.equal(u.searchParams.get('company'), 'fixture-company');
      assert.equal(await page.locator('.canvas-panel[data-panel-id=portfolio]').getAttribute('data-open'), 'true');
      assert.equal(await page.locator('.canvas-panel[data-panel-id=donna]').getAttribute('data-open'), 'true');
      assert.equal(await conversation.evaluate(node => node === document.getElementById('donna-conversation')), true);
      assert.equal(await page.locator('#chat-message').inputValue(), 'Unsent CEO entry draft');
      await assertEndlessShell(page, 'Donna and CEO surfaces');
      await conversation.dispose();
      await page.goto(base + '/workspace/chrome.html?company=fixture-company&ceo=true#office', {waitUntil: 'domcontentloaded'});
      await page.locator('.canvas-panel[data-panel-id=portfolio][data-open=true]').waitFor({state: 'visible'});
      assert.equal(new URL(page.url()).searchParams.get('ceo'), 'true');
      assert.equal(new URL(page.url()).searchParams.has('workspace'), false);
      await assertEndlessShell(page, 'CEO deep link');
      audit(state, 'modes');
      await closeCtx();
      receipt.checks.push('Owner URL opens the continuous canvas; Donna and CEO surfaces coexist without replacing forms; ceo=true deep link remains supported');
    }

    // ----- capacity -----
    for (const cap of [{name: 'freeflow-capacity-portfolio', theme: 'blueprint', scope: 'portfolio'}, {name: 'freeflow-capacity-office', theme: 'drafting', scope: 'office'}]) {
      const state = capacityState(makeState);
      const snap = state.workspace.snapshot;
      const viewport = {width: 1280, height: 720};
      ({context, page} = await newContext(browser, base, installApiFixture, state, viewport, {fn: t => { try { localStorage.setItem('daftar-studio-theme', t); } catch {} }, arg: cap.theme}));
      page.on('pageerror', e => receipt.browserErrors.push({shot: cap.name, message: e.message}));
      await page.goto(base + '/', {waitUntil: 'domcontentloaded'});
      await page.waitForURL(url => ['/workspace/chrome.html', '/workspace/chrome'].includes(url.pathname));
      await waitStudio(page);
      await page.goto(base + (cap.scope === 'portfolio' ? '/workspace/chrome.html#office' : '/workspace/chrome.html?company=fixture-company#office'), {waitUntil: 'domcontentloaded'});
      await waitStudio(page);
      await assertTheme(page, cap.theme, cap.name);
      const sourceCompanies = snap.companies.length, sourceDesks = snap.blueprints[0].desks.length, sourceBoards = snap.blueprints[0].whiteboards.length;
      assert.equal(sourceCompanies, 200); assert.equal(snap.blueprints[0].rooms.length, 100); assert.equal(sourceDesks, 1000); assert.equal(sourceBoards, 200); assert.equal(snap.departments.length, 10);
      await assertEndlessShell(page, cap.name);
      if (cap.scope === 'portfolio') {
        const initial = await canvasStats(page);
        const seats = await page.locator('#freeflow-host .ff-node--seat').count();
        assert.ok(seats > 0 && seats < sourceCompanies, 'A readable initial table window mounts part of the 200-company world');
        assert.equal(initial.chairs, seats, 'Each mounted company seat has exactly one decorative chair');
        assert.ok(initial.nodes > 0 && initial.threads > 0, 'Nonvacuous portfolio nodes and organizational threads');
        const readableSeats = await page.locator('#freeflow-host .ff-node--seat').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()).filter(box => box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight).map(box => box.width));
        assert.ok(readableSeats.length > 0 && Math.max(...readableSeats) >= 160, `Initial company seats remain readable without fitting all 200 at once: ${JSON.stringify(readableSeats)}`);
        assert.equal(snap.companies.filter(company => company.parentCompanyId).length, 199, 'Source organizational links are retained');
        await openCanvasSurface(page, 'company-directory');
        assert.match(await page.locator('#freeflow-host .ff-list-count').textContent(), /records/, 'Accessible directory includes the entire source scene');
        const listedCompanies = new Set();
        for (let index = 0; index < 20; index++) {
          const ids = await page.locator('#freeflow-host .ff-list-button').evaluateAll(buttons => buttons.map(button => button.dataset.nodeId));
          assert.ok(ids.length <= LIST_PAGE_SIZE, 'Every directory page stays bounded');
          ids.filter(id => id?.startsWith('folio:')).forEach(id => listedCompanies.add(id.slice('folio:'.length)));
          const next = page.locator('#freeflow-host .ff-list-next');
          if (await next.isDisabled()) break;
          assert.ok(index < 19, 'The capacity directory must terminate within its bounded fixture page count');
          await next.click(); await settle(page);
        }
        assert.deepEqual([...listedCompanies].sort(), snap.companies.map(company => company.id).sort(), 'All 200 real company seats remain accessible across directory pages');
        await page.locator('#freeflow-host .ff-list-search').fill('Capacity company 199');
        await settle(page);
        const hit = page.locator('#freeflow-host .ff-list-button[data-node-id="folio:cap-company-199"]');
        await hit.waitFor({state: 'visible'}); await hit.click();
        const inspector = await openCanvasSurface(page, 'object-inspector');
        assert.match(await inspector.innerText(), /Capacity company 199/);
        await inspector.locator('.canvas-panel-close').click();
      } else {
        assert.ok((await canvasStats(page)).nodes > 0, 'Company scope has real nodes');
        for (const [term, nodeId] of [
          ['Capacity employee 99-9', 'universe:blueprint:employee:fixture-company:cap-emp-99-9'],
          ['Capacity board 99-1', 'universe:blueprint:board:fixture-company:fixture-office:cap-board-99-1'],
        ]) {
          await openCanvasSurface(page, 'company-directory');
          await page.locator('#freeflow-host .ff-list-search').fill(term);
          await settle(page);
          const hit = page.locator(`#freeflow-host .ff-list-button[data-node-id="${nodeId}"]`);
          await hit.waitFor({state: 'visible'}); await hit.click();
          const inspector = await openCanvasSurface(page, 'object-inspector');
          assert.match(await inspector.innerText(), new RegExp(term));
          await inspector.locator('.canvas-panel-close').click();
        }
      }
      const directory = await openCanvasSurface(page, 'company-directory');
      await page.locator('#freeflow-host .ff-list-search').fill('');
      await directory.locator('.canvas-panel-close').click();
      // Compare the same camera/view before and after the loop; virtualization
      // may legitimately change mounted counts for different viewpoints.
      await setView(page, 'top');
      await page.locator('#freeflow-host .ff-controls').getByRole('button', {name: 'Fit scene to view'}).click();
      await settle(page);
      const baseline = await canvasStats(page);
      for (let i = 0; i < 20; i++) {
        await page.locator('#freeflow-host .ff-controls').getByRole('button', {name: i % 2 ? 'Top view' : 'Perspective view'}).click();
        await page.locator('#freeflow-host .ff-controls').getByRole('button', {name: 'Fit scene to view'}).click();
        await settle(page);
        const step = await canvasStats(page);
        assert.ok(step.nodes > 0 && step.nodes <= RICH_NODE_BUDGET && step.threads <= THREAD_BUDGET && step.listButtons <= LIST_PAGE_SIZE, `Capacity transition ${i} stays nonempty and within all render budgets`);
        assert.equal(step.dupNodes + step.dupThreads + step.dupList, 0, `Capacity transition ${i} retains unique identities`);
      }
      await settle(page);
      const final = await canvasStats(page);
      assert.ok(final.nodes <= RICH_NODE_BUDGET, `nodes ${final.nodes} <= ${RICH_NODE_BUDGET}`);
      assert.ok(final.threads <= THREAD_BUDGET, `threads ${final.threads} <= ${THREAD_BUDGET}`);
      assert.ok(final.listButtons <= LIST_PAGE_SIZE, `list ${final.listButtons} <= ${LIST_PAGE_SIZE}`);
      assert.ok(final.nodes > 0);
      assert.equal(final.dupNodes, 0); assert.equal(final.dupThreads, 0); assert.equal(final.dupList, 0);
      assert.equal(final.inspectors, baseline.inspectors, 'no accumulated inspectors');
      assert.equal(final.donnaForms, 1, 'no accumulated Donna forms');
      assert.equal(final.nodes, baseline.nodes, 'no accumulated nodes after transitions');
      receipt.domCounts[cap.name] = {...final, sourceCompanies, sourceDesks, sourceBoards, sceneDescendants: final.descendants};
      await shot(page, cap.name, viewport, {theme: cap.theme, capacity: true});
      assert.deepEqual(receipt.browserErrors, [], 'browser errors in capacity');
      audit(state, cap.name);
      await closeCtx();
    }
    receipt.checks.push('Capacity: 200 companies remain searchable, 1000 desks/200 boards retain stable identities, readable initial table, bounded DOM throughout 20 transitions and no accumulated forms');
    receipt.timingSummary = {ready: summarizeTimings(receipt.timings.ready), interaction: summarizeTimings(receipt.timings.interaction), longTasks: 'not instrumented'};
    receipt.status = 'passed';
  } catch (error) {
    receipt.status = 'failed';
    receipt.error = error instanceof Error ? error.message : String(error);
    if (page && !page.isClosed()) {
      try { receipt.finalPageUrl = page.url(); await page.screenshot({path: path.join(outDir, 'freeflow-failure.png'), fullPage: true}); receipt.screenshots.push({file: 'freeflow-failure.png', failure: true}); } catch {}
    }
    throw error;
  } finally {
    await closeCtx();
    receipt.finishedAt = new Date().toISOString();
    try { await fs.writeFile(file, JSON.stringify(receipt, null, 2) + '\n'); } catch {}
  }
  return receipt;
}

export async function runPackagedFreeflowCheck({page, capture}) {
  const timings = [];
  const t0 = Date.now();
  const snapshot = () => page.evaluate(async () => {
    const r = await window.desktopBridge.officeSnapshot();
    const s = r.snapshot;
    return {ok: r.ok, nativeSnapshot: s, activeCompanyId: s.activeCompanyId, jobs: s.jobs.length, goals: s.goals.length, schedules: s.schedules.length, committedUsd: s.budget.committedUsd, companies: s.companies.map(c => c.id), employees: s.employees.map(e => ({id: e.id, name: e.name, companyId: e.companyId, status: e.status}))};
  });
  const before = await snapshot();
  assert.equal(before.ok, true);
  // Home reframes the same native world; it does not replace mounted forms.
  await page.getByRole('button', {name: 'Return to the conference table', exact: true}).click();
  await page.locator('#freeflow-host .ff-studio').waitFor({state: 'visible'});
  await page.locator('#freeflow-host .ff-node').first().waitFor({state: 'attached'});
  await settle(page);
  // open only the already-active real company
  const activeId = before.activeCompanyId;
  assert.ok(activeId, 'active company present');
  const directory = await openCanvasSurface(page, 'company-directory');
  const node = page.locator(`#freeflow-host .ff-list-button[data-node-id="folio:${activeId}"]`);
  // Search by the exact active company label; identifiers remain the final match.
  const activeLabel = await page.evaluate(async id => (await window.desktopBridge.officeSnapshot()).snapshot.companies.find(company => company.id === id)?.name || '', activeId);
  await page.locator('#freeflow-host .ff-list-search').fill(activeLabel);
  await node.waitFor({state: 'visible'}); await node.focus(); await page.keyboard.press('Enter');
  await settle(page);
  await openCanvasSurface(page, 'company-directory');
  await directory.locator('.canvas-panel-close').click();
  await page.locator('#freeflow-host .ff-controls').getByRole('button', {name: 'Fit scene to view'}).click();
  await settle(page);
  const emp = before.employees.find(e => e.companyId === activeId && e.status !== 'fired');
  let selected = null;
  if (emp) {
    // Previously opened live panels may legitimately cover a scene card. Use
    // the same visible directory a user can reach, then verify exact identity
    // and the real inspector instead of forcing a click through another form.
    await openCanvasSurface(page, 'company-directory');
    await page.locator('#freeflow-host .ff-list-search').fill(emp.name);
    const en = page.locator(`#freeflow-host .ff-list-button[data-node-id="universe:blueprint:employee:${activeId}:${emp.id}"]`);
    await en.waitFor({state: 'visible'}); await en.focus(); await page.keyboard.press('Space');
    await settle(page);
    assert.equal(await en.getAttribute('aria-pressed'), 'true', 'The native employee is selected through its stable directory identity');
    const inspector = await openCanvasSurface(page, 'object-inspector');
    assert.equal(await inspector.locator('.ff-inspector-header').innerText(), emp.name, 'The actual native employee reaches the ownership inspector');
    await inspector.locator('.canvas-panel-close').click();
    await openCanvasSurface(page, 'company-directory');
    await directory.locator('.canvas-panel-close').click();
    await page.locator('#freeflow-host .ff-controls').getByRole('button', {name: 'Fit scene to view'}).click();
    await settle(page); selected = emp.id;
  }
  const ctl = page.locator('#freeflow-host .ff-controls');
  const worldBefore = await page.locator('#freeflow-host .ff-world').evaluate(e => e.style.transform);
  await ctl.getByRole('button', {name: 'Top view'}).click();
  await ctl.getByRole('button', {name: 'Perspective view'}).click();
  await ctl.getByRole('button', {name: 'Rotate right 15 degrees'}).click();
  await ctl.getByRole('button', {name: 'Zoom in'}).click();
  await ctl.getByRole('button', {name: 'Fit scene to view'}).click();
  await settle(page);
  const worldAfter = await page.locator('#freeflow-host .ff-world').evaluate(e => e.style.transform);
  const nodes = await page.locator('#freeflow-host .ff-node').count();
  assert.ok(nodes > 0, 'native Freeflow renders nodes');
  const canvas = await page.locator('#freeflow-host .ff-canvas-host').boundingBox();
  assert.ok(canvas && canvas.width > 0 && canvas.height > 0, 'native canvas visible');
  await assertEndlessShell(page, 'Native Freeflow');
  await capture('freeflow-native-studio');
  const after = await snapshot();
  assert.equal(after.jobs, before.jobs, 'no jobs created'); assert.equal(after.goals, before.goals, 'no goals created');
  assert.equal(after.schedules, before.schedules, 'no schedules created'); assert.equal(after.committedUsd, before.committedUsd, 'no budget change');
  assert.equal(after.activeCompanyId, before.activeCompanyId, 'company unchanged');
  assert.deepEqual(after.companies, before.companies, 'companies unchanged');
  assert.deepEqual(after.employees, before.employees, 'employee scope and status unchanged');
  assert.deepEqual(after.nativeSnapshot, before.nativeSnapshot, 'Canvas navigation, selection and camera controls leave the complete native snapshot unchanged');
  timings.push({label: 'native-freeflow', ms: Date.now() - t0});
  return {status: 'passed', activeCompanyId: activeId, selectedEmployee: selected, nodes, cameraChanged: worldBefore !== worldAfter, screenshot: 'freeflow-native-studio.png', timings, nativeRecordsUnchanged: true};
}
