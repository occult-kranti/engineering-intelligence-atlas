#!/usr/bin/env node
/** Bounded Linux/Windows unpacked-package acceptance: real Electron, preload, Rust core and one local plan.
 * Does not prove NSIS install/upgrade, signing, or an owner machine. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPackagedFreeflowCheck } from './freeflow-browser-checks.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'site-source', 'package.json'));
const { _electron: electron } = require('playwright');
const isWin = process.platform === 'win32';
const defaultExecutable = isWin
  ? join(root, 'desktop-shell', 'release', 'win-unpacked', 'Daftar.exe')
  : join(root, 'desktop-shell', 'release', 'linux-unpacked', 'research-director-desktop-shell');
const executablePath = resolve(process.env.ATLAS_PACKAGED_BINARY || defaultExecutable);
const helperName = isWin ? 'atlas-core.exe' : 'atlas-core';
function peMachine(file) {
  const b = readFileSync(file);
  assert(b.length > 0x40 && b.readUInt16LE(0) === 0x5a4d, `${basename(file)} is not a PE executable`);
  const off = b.readUInt32LE(0x3c);
  assert(b.toString('latin1', off, off + 4) === 'PE\0\0', `${basename(file)} has no PE header`);
  return b.readUInt16LE(off + 4);
}
const sha256File = file => crypto.createHash('sha256').update(readFileSync(file)).digest('hex');
const screenshots = resolve(process.env.ATLAS_PACKAGED_SMOKE_OUT || join(root, 'desktop-shell', '.work', 'packaged-ui'));
const profile = mkdtempSync(join(tmpdir(), 'atlas packaged smoke '));
const userData = join(profile, 'user data');
const config = join(profile, 'config');
mkdirSync(screenshots, { recursive: true });
mkdirSync(userData, { recursive: true });
mkdirSync(config, { recursive: true });

// Credentials, NODE_OPTIONS and Electron mode overrides are intentionally not inherited.
const environment = {};
const inheritKeys = isWin
  ? ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'LANG']
  : ['PATH', 'LANG', 'LC_ALL', 'DISPLAY', 'XAUTHORITY', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR', 'LD_LIBRARY_PATH'];
for (const key of inheritKeys) {
  if (process.env[key]) environment[key] = process.env[key];
}
if (isWin) {
  const tempDir = join(profile, 'temp');
  const roaming = join(profile, 'AppData Roaming');
  const local = join(profile, 'AppData Local');
  for (const dir of [tempDir, roaming, local]) mkdirSync(dir, { recursive: true });
  Object.assign(environment, { TEMP: tempDir, TMP: tempDir, APPDATA: roaming, LOCALAPPDATA: local, USERPROFILE: profile });
} else {
  // Electron documents XDG_CONFIG_HOME as its Linux appData root. This affects only
  // the spawned test process; the caller's profile and global environment are untouched.
  environment.XDG_CONFIG_HOME = config;
  environment.XDG_CACHE_HOME = join(profile, 'cache');
}
const noOsSandbox = !isWin && process.env.ATLAS_CI_NO_SANDBOX === '1';
const args = [`--user-data-dir=${userData}`, ...(noOsSandbox ? ['--no-sandbox'] : [])];
const captured = [];
const errors = [];
const childOutput = [];
const appEvents = [];
let launchDiagnostic = null;
let application;
// Redact credential-like values and the isolated profile path; bound all evidence size.
const redactText = value => String(value)
  .split(profile).join('<profile>')
  .replace(/(^|[^A-Za-z0-9_-])(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{8,}/g, '$1[redacted]')
  .replace(/(token|secret|password|authorization|api[_-]?key)(\s*[=:]\s*)\S+/gi, '$1$2[redacted]')
  .slice(0, 4000);
const pushBounded = (list, entry, max = 200) => { if (list.length < max) list.push(entry); };
// Field-wise sanitizers: bound each allowlisted scalar instead of truncating serialized JSON.
const safeStr = (v, n) => redactText(v ?? '').slice(0, n);
const safeNum = v => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
function sanitizeStartupRecord(rec) {
  const MAXS = 64, MAXL = 100;
  const r = rec && typeof rec === 'object' ? rec : {};
  const stagesIn = Array.isArray(r.stages) ? r.stages : [];
  const lifeIn = Array.isArray(r.lifecycle) ? r.lifecycle : [];
  const stages = stagesIn.slice(0, MAXS).map(s => {
    const o = { stage: safeStr(s?.stage, 64), outcome: safeStr(s?.outcome, 16), tMs: safeNum(s?.tMs) };
    if (s?.error && typeof s.error === 'object') o.error = { name: safeStr(s.error.name, 80), message: safeStr(s.error.message, 500), stack: safeStr(s.error.stack, 1200) };
    return o;
  });
  const lifecycle = lifeIn.slice(0, MAXL).map(l => {
    const o = { event: safeStr(l?.event, 48), tMs: safeNum(l?.tMs) };
    if (safeNum(l?.id) !== undefined) o.id = l.id;
    if (safeNum(l?.code) !== undefined) o.code = l.code;
    if (l?.reason !== undefined) o.reason = safeStr(l.reason, 80);
    if (l?.detail !== undefined) o.detail = safeStr(l.detail, 200);
    return o;
  });
  const id = r.identity && typeof r.identity === 'object' ? r.identity : {};
  const identity = {};
  for (const k of ['pid', 'electron', 'node', 'packaged', 'version', 'appPath']) {
    const v = id[k];
    if (typeof v === 'number' || typeof v === 'boolean') identity[k] = v;
    else if (typeof v === 'string') identity[k] = safeStr(v, 80);
  }
  return {
    stages, lifecycle, identity,
    truncated: { stages: stagesIn.length > MAXS, lifecycle: lifeIn.length > MAXL, stageTotal: stagesIn.length, lifecycleTotal: lifeIn.length },
  };
}
function writeDiagnostics(extra) {
  try {
    writeFileSync(join(screenshots, 'launch-diagnostics.json'), JSON.stringify({
      schemaVersion: 1, at: new Date().toISOString(), platform: process.platform, arch: process.arch,
      childOutput, appEvents, ...extra,
    }, null, 2) + '\n');
  } catch {}
}
// Collects the early main-process recorder plus current windows; every state is explicit and bounded.
async function collectStartupEvidence(app) {
  const work = (async () => {
    const out = { recorder: 'absent', startup: null, windows: [], isReady: null };
    try {
      const snap = await app.evaluate(({ app: electronApp, BrowserWindow }) => {
        const getter = globalThis.__atlasStartupRecord;
        let rec = null; let recErr = null;
        if (typeof getter === 'function') { try { rec = getter(); } catch (e) { recErr = String(e && e.message || e).slice(0, 300); } }
        return {
          hasGetter: typeof getter === 'function', rec, recErr,
          isReady: electronApp.isReady(),
          windows: BrowserWindow.getAllWindows().map(win => ({
            id: win.id, destroyed: win.isDestroyed(),
            visible: win.isDestroyed() ? false : win.isVisible(),
            url: win.isDestroyed() ? '' : String(win.webContents.getURL()).slice(0, 300),
            loading: win.isDestroyed() ? null : win.webContents.isLoading(),
            crashed: win.isDestroyed() ? null : win.webContents.isCrashed(),
          })),
        };
      });
      out.isReady = snap.isReady;
      out.windows = (Array.isArray(snap.windows) ? snap.windows.slice(0, 20) : []).map(w => ({ id: safeNum(w?.id), destroyed: !!w?.destroyed, visible: !!w?.visible, url: safeStr(w?.url, 300), loading: w?.loading ?? null, crashed: w?.crashed ?? null }));
      if (!snap.hasGetter) out.recorder = 'startup record unavailable / entry not observed';
      else if (snap.recErr) out.recorder = 'getter-failed: ' + safeStr(snap.recErr, 300);
      else { out.recorder = 'present'; out.startup = sanitizeStartupRecord(snap.rec); }
    } catch (inner) { out.recorder = 'collection-failed: ' + redactText(inner instanceof Error ? inner.message : inner); }
    return out;
  })();
  const timeout = new Promise(resolveTimeout => setTimeout(() => resolveTimeout({ recorder: 'collection-timed-out' }), 8000));
  return Promise.race([work, timeout]);
}
async function firstWindowWithDiagnostics(app) {
  try {
    return await app.firstWindow({ timeout: 30000 });
  } catch (error) {
    const diag = { error: redactText(error instanceof Error ? error.message : error), windows: [], isReady: null };
    Object.assign(diag, await collectStartupEvidence(app));
    launchDiagnostic = diag;
    writeDiagnostics({ firstWindowTimeout: diag });
    throw error;
  }
}
let page;
let receipt;

async function capture(name) {
  const file = `${name}.png`;
  await page.screenshot({ path: join(screenshots, file), fullPage: false });
  captured.push({ view: name, file });
}

try {
  if (noOsSandbox && process.env.CI !== 'true') throw new Error('The optional sandbox exception is limited to an isolated CI runner.');
  assert(process.platform === 'linux' || isWin, 'This package smoke supports Linux and Windows x64 only.');
  if (isWin) assert.equal(process.arch, 'x64', 'Windows smoke requires an x64 runner.');
  assert(existsSync(executablePath), 'Package the desktop before running this acceptance gate.');
  if (!isWin) assert(environment.DISPLAY, 'Run this test under xvfb-run or an isolated Linux display.');
  if (isWin) assert.equal(peMachine(executablePath), 0x8664, 'Application executable is not PE x64.');
  application = await electron.launch({ executablePath, args, cwd: dirname(executablePath), env: environment, timeout: 45000 });
  const child = application.process();
  for (const [name, stream] of [['stdout', child.stdout], ['stderr', child.stderr]]) {
    stream?.on('data', chunk => pushBounded(childOutput, { stream: name, text: redactText(chunk.toString('utf8')) }));
  }
  child.on('exit', (code, signal) => pushBounded(appEvents, { event: 'child-exit', code, signal }));
  application.evaluate(({ app: electronApp }) => {
    electronApp.on('web-contents-created', (_event, contents) => {
      const log = globalThis.__atlasSmokeEvents ??= [];
      const add = entry => { if (log.length < 100) log.push({ ...entry, at: Date.now() }); };
      contents.on('did-fail-load', (_e, code, description, url) => add({ event: 'did-fail-load', code, description: String(description).slice(0, 200), url: String(url).slice(0, 200) }));
      contents.on('render-process-gone', (_e, details) => add({ event: 'render-process-gone', reason: details?.reason, exitCode: details?.exitCode }));
      contents.on('did-finish-load', () => add({ event: 'did-finish-load' }));
    });
  }).catch(() => {});
  const appInfo = await application.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    userData: app.getPath('userData'),
    resourcesPath: process.resourcesPath,
  }));
  assert.equal(appInfo.packaged, true, 'The acceptance gate must use the packaged application.');
  assert(resolve(appInfo.userData).startsWith(profile + sep), 'Electron did not use the isolated test profile.');
  const binary = join(appInfo.resourcesPath, 'native', helperName);
  assert(existsSync(binary), 'Packaged Rust helper is missing.');
  const buildMeta = JSON.parse(readFileSync(join(appInfo.resourcesPath, 'native', 'build.json'), 'utf8'));
  assert.equal(buildMeta.platform, process.platform, 'Packaged helper metadata platform mismatch.');
  assert.equal(buildMeta.arch, process.arch, 'Packaged helper metadata arch mismatch.');
  assert.equal(buildMeta.binary, helperName, 'Packaged helper metadata binary mismatch.');
  if (isWin) assert.equal(peMachine(binary), 0x8664, 'Packaged helper is not PE x64.');
  page = await firstWindowWithDiagnostics(application);
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await application.context().route(/^https?:\/\//, route => route.abort());
  await page.waitForFunction(() => typeof window.desktopBridge?.officeSnapshot === 'function');
  assert(page.url().startsWith('file://'), 'The trusted renderer must be a local file.');

  const window = await application.browserWindow(page);
  const preferences = await window.evaluate(win => {
    const prefs = win.webContents.getLastWebPreferences();
    return { contextIsolation: prefs.contextIsolation, nodeIntegration: prefs.nodeIntegration, sandbox: prefs.sandbox };
  });
  assert.deepEqual(preferences, { contextIsolation: true, nodeIntegration: false, sandbox: true });
  const initial = await page.evaluate(async () => ({
    company: await window.desktopBridge.companySnapshot(),
    office: await window.desktopBridge.officeSnapshot(),
    worker: await window.desktopBridge.officeWorkerStatus(),
    vault: await window.desktopBridge.getVaultStatus(),
  }));
  assert.equal(initial.company.available, true, initial.company.error || 'Native company service unavailable.');
  assert.equal(initial.company.backend, 'rust');
  assert.equal(initial.office.ok, true, initial.office.error);
  assert.equal(initial.worker.enabled, false, 'A new installation must not auto-dispatch paid work.');
  assert(Object.values(initial.vault.providers).every(provider => provider.configured === false), 'The isolated profile unexpectedly contains credentials.');
  const beforeGoals = initial.office.snapshot.goals.length;
  const beforeSpend = initial.office.snapshot.budget.committedUsd;

  await page.locator('.sidebar .nav-item[data-view="office"]').click();
  // The packaged default is the Freeflow host; assert it, then use the real Operations / Manage button.
  await page.locator('#freeflow-host').waitFor({ state: 'visible' });
  assert(await page.locator('#freeflow-host').count() === 1, 'Packaged renderer is missing the Freeflow host.');
  await page.locator('#ff-nav-operations').click();
  await page.locator('#office-native-status').filter({ hasText: 'Local state loaded' }).waitFor({ state: 'visible' });
  await page.locator('[data-workspace-tab="chat"]').click();
  await page.locator('#chat-goal-mode').selectOption('manual');
  const title = 'Packaged smoke: create a local delivery plan';
  await page.locator('#chat-message').fill(title);
  // Use the browser's actual submission constraints. Dispatching a synthetic
  // submit event would bypass hidden numeric controls with invalid defaults.
  const invalidControls = await page.locator('#workspace-chat-form').evaluate(form =>
    [...form.elements].filter(control => control.willValidate && !control.checkValidity()).map(control => ({
      id: control.id,
      message: control.validationMessage,
      min: control.getAttribute('min'),
      max: control.getAttribute('max'),
      step: control.getAttribute('step'),
    }))
  );
  assert.deepEqual(invalidControls, [], 'The real composer must be valid before a local plan can be submitted.');
  await page.locator('#chat-send').click();
  await page.locator('#chat-status').filter({ hasText: 'Brief and plan saved.' }).waitFor({ state: 'visible' });
  await page.locator('#workspace-goals').getByText(title, { exact: true }).waitFor({ state: 'visible' });
  const after = await page.evaluate(() => window.desktopBridge.officeSnapshot());
  assert.equal(after.ok, true, after.error);
  assert.equal(after.snapshot.goals.length, beforeGoals + 1);
  const goal = after.snapshot.goals.find(item => item.title === title);
  assert(goal && goal.mode === 'plan' && goal.status === 'planned', 'UI action did not persist the local plan.');
  assert.equal(after.snapshot.budget.committedUsd, beforeSpend, 'A local plan must not consume provider budget.');
  assert.equal(after.snapshot.jobs.filter(job => job.status === 'running').length, 0);
  const saved = JSON.parse(readFileSync(join(appInfo.userData, 'company', 'company-state.json'), 'utf8'));
  assert(saved.office.goals.some(item => item.id === goal.id), 'Native plan was not saved in the isolated profile.');
  await capture('office');

  await page.locator('[data-workspace-tab="blueprint"]').click();
  await page.locator('#workspace-panel-blueprint').waitFor({ state: 'visible' });
  await page.locator('.blueprint-room').first().waitFor({ state: 'visible' });
  await capture('blueprint');
  await page.locator('[data-workspace-tab="decisions"]').click();
  await page.locator('#decision-create-form').waitFor({ state: 'visible' });
  await capture('decisions');
  await page.locator('.sidebar .nav-item[data-view="settings"]').click();
  await page.locator('#cloud-connection-panel').waitFor({ state: 'visible' });
  const cloud = await page.evaluate(() => window.desktopBridge.cloudStatus());
  assert.equal(cloud.configured, false);
  assert.equal(cloud.lastSyncedAt, null);
  await capture('settings');
  const freeflowReceipt = await runPackagedFreeflowCheck({ page, capture });
  assert.deepEqual(errors, [], 'Packaged renderer raised an unhandled error.');

  receipt = {
    freeflow: freeflowReceipt,
    schemaVersion: 1,
    status: 'passed',
    at: new Date().toISOString(),
    version: appInfo.version,
    platform: process.platform,
    arch: process.arch,
    executable: basename(executablePath),
    executableSha256: sha256File(executablePath),
    helperMetadata: buildMeta,
    peMachineX64: isWin ? true : undefined,
    packaged: true,
    userDataIsolated: true,
    nativeBinarySha256: crypto.createHash('sha256').update(readFileSync(binary)).digest('hex'),
    rendererPreferences: preferences,
    osSandbox: noOsSandbox ? 'disabled only for isolated CI runner' : 'default',
    nativeStateLoaded: true,
    localGoalPersisted: true,
    providerSpendChanged: false,
    providerCredentialsConfigured: false,
    cloudConnected: false,
    screenshots: captured,
    limits: `${process.platform}/${process.arch} unpacked release directory in CI. Does not prove NSIS install or upgrade, uninstall data retention, code signing/SmartScreen, an owner machine, or OS-keychain behavior.`,
  };
  writeFileSync(join(screenshots, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Packaged desktop acceptance passed: real Rust state, persisted local plan, ${captured.length} screenshots, no provider work.`);
} catch (error) {
  // Collect retained evidence even when launchDiagnostic already exists; bounded so it cannot hang.
  let lateEvidence = null;
  if (application) lateEvidence = await collectStartupEvidence(application);
  writeDiagnostics({ failure: redactText(error instanceof Error ? error.message : error), firstWindowTimeout: launchDiagnostic, startupEvidence: lateEvidence, limits: 'Static import failures precede the in-module recorder; the post-launch stdout listener can miss earlier output.' });
  if (page) await page.screenshot({ path: join(screenshots, 'failure.png'), fullPage: false }).catch(() => {});
  writeFileSync(join(screenshots, 'receipt.json'), JSON.stringify({ schemaVersion: 1, status: 'failed', at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error), screenshots: captured, pageErrors: errors }, null, 2) + '\n');
  throw error;
} finally {
  if (application) await application.close().catch(() => {});
  rmSync(profile, { recursive: true, force: true });
}
