#!/usr/bin/env node
/** Bounded Linux package acceptance: real Electron, preload, Rust core and one local plan. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'site-source', 'package.json'));
const { _electron: electron } = require('playwright');
const executablePath = resolve(process.env.ATLAS_PACKAGED_BINARY || join(root, 'desktop-shell', 'release', 'linux-unpacked', 'research-director-desktop-shell'));
const screenshots = resolve(process.env.ATLAS_PACKAGED_SMOKE_OUT || join(root, 'desktop-shell', '.work', 'packaged-ui'));
const profile = mkdtempSync(join(tmpdir(), 'atlas-packaged-smoke-'));
const userData = join(profile, 'user-data');
const config = join(profile, 'config');
mkdirSync(screenshots, { recursive: true });
mkdirSync(userData, { recursive: true });
mkdirSync(config, { recursive: true });

// Credentials, NODE_OPTIONS and Electron mode overrides are intentionally not inherited.
const environment = {};
for (const key of ['PATH', 'LANG', 'LC_ALL', 'DISPLAY', 'XAUTHORITY', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR', 'LD_LIBRARY_PATH']) {
  if (process.env[key]) environment[key] = process.env[key];
}
// Electron documents XDG_CONFIG_HOME as its Linux appData root. This affects only
// the spawned test process; the caller's profile and global environment are untouched.
environment.XDG_CONFIG_HOME = config;
environment.XDG_CACHE_HOME = join(profile, 'cache');
const noOsSandbox = process.env.ATLAS_CI_NO_SANDBOX === '1';
const args = [`--user-data-dir=${userData}`, ...(noOsSandbox ? ['--no-sandbox'] : [])];
const captured = [];
const errors = [];
let application;
let page;
let receipt;

async function capture(name) {
  const file = `${name}.png`;
  await page.screenshot({ path: join(screenshots, file), fullPage: false });
  captured.push({ view: name, file });
}

try {
  if (noOsSandbox && process.env.CI !== 'true') throw new Error('The optional sandbox exception is limited to an isolated CI runner.');
  assert.equal(process.platform, 'linux', 'This package smoke targets the Linux release directory.');
  assert(existsSync(executablePath), 'Package the desktop before running this acceptance gate.');
  assert(environment.DISPLAY, 'Run this test under xvfb-run or an isolated Linux display.');
  application = await electron.launch({ executablePath, args, cwd: dirname(executablePath), env: environment, timeout: 45000 });
  const appInfo = await application.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    userData: app.getPath('userData'),
    resourcesPath: process.resourcesPath,
  }));
  assert.equal(appInfo.packaged, true, 'The acceptance gate must use the packaged application.');
  assert(resolve(appInfo.userData).startsWith(profile + sep), 'Electron did not use the isolated test profile.');
  const binary = join(appInfo.resourcesPath, 'native', 'atlas-core');
  assert(existsSync(binary), 'Packaged Rust helper is missing.');
  page = await application.firstWindow();
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
  await page.locator('#office-native-status').filter({ hasText: 'Local state loaded' }).waitFor({ state: 'visible' });
  await page.locator('[data-workspace-tab="chat"]').click();
  await page.locator('#chat-goal-mode').selectOption('manual');
  const title = 'Packaged smoke: create a local delivery plan';
  await page.locator('#chat-message').fill(title);
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
  assert.deepEqual(errors, [], 'Packaged renderer raised an unhandled error.');

  receipt = {
    schemaVersion: 1,
    status: 'passed',
    at: new Date().toISOString(),
    version: appInfo.version,
    platform: process.platform,
    arch: process.arch,
    executable: basename(executablePath),
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
    limits: 'Linux unpacked release in CI; not an owner-laptop installation, signing or OS-keychain acceptance test.',
  };
  writeFileSync(join(screenshots, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Packaged desktop acceptance passed: real Rust state, persisted local plan, ${captured.length} screenshots, no provider work.`);
} catch (error) {
  if (page) await page.screenshot({ path: join(screenshots, 'failure.png'), fullPage: false }).catch(() => {});
  writeFileSync(join(screenshots, 'receipt.json'), JSON.stringify({ schemaVersion: 1, status: 'failed', at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error), screenshots: captured, pageErrors: errors }, null, 2) + '\n');
  throw error;
} finally {
  if (application) await application.close().catch(() => {});
  rmSync(profile, { recursive: true, force: true });
}
