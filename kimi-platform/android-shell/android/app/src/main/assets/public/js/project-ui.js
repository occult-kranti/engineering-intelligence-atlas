/**
 * Project mode UI wiring.
 *
 * - API keys: password inputs pass straight to the native setSecret() and are
 *   cleared immediately afterwards; the UI only ever sees configured booleans.
 * - Projects/runs: orchestrated by project-mode.js with the NATIVE provider as
 *   the only model caller, so saved Keystore keys are what actually calls
 *   api.openai.com / api.anthropic.com.
 * - All dynamic content is rendered via textContent (no HTML injection).
 */
import {
  createPreferencesStorage,
  createLocalStorageAdapter,
} from './runtime-store.js';
import { createProjectStore } from './project-store.js';
import { createProjectEngine, DEFAULT_SQUAD, redactError } from './project-mode.js';
import * as secure from './secure-provider.js';

const PROVIDERS = ['openai', 'anthropic'];

function $(sel, root = document) {
  return root.querySelector(sel);
}

function setStatus(el, message, tone) {
  el.textContent = message;
  if (tone) el.dataset.tone = tone;
  else el.removeAttribute('data-tone');
}

async function resolveStorage() {
  try {
    const core = await import('@capacitor/core');
    const { Preferences } = await import('@capacitor/preferences');
    if (core.Capacitor?.isNativePlatform?.()) {
      return createPreferencesStorage(Preferences);
    }
  } catch {
    /* fall through */
  }
  return createLocalStorageAdapter();
}

function numValue(input) {
  const v = input.value.trim();
  if (v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

async function main() {
  const storage = await resolveStorage();
  const store = createProjectStore(storage);
  const engine = createProjectEngine({
    store,
    provider: { generate: (args) => secure.generate(args) },
  });

  const nativeAvailable = await secure.isSecureProviderAvailable();
  const nativeStatus = $('#native-status');
  if (!nativeAvailable) {
    setStatus(
      nativeStatus,
      'Native bridge not detected: key storage and provider calls only work inside the Android app. You can still browse saved projects.',
      'error',
    );
  }

  let currentProjectId = null;
  let refreshTimer = null;

  // ---------------------------------------------------------------
  // API keys
  // ---------------------------------------------------------------

  async function refreshKeyBadges() {
    for (const provider of PROVIDERS) {
      const row = $(`.keyrow[data-provider="${provider}"]`);
      const badge = $('[data-role="key-badge"]', row);
      if (!nativeAvailable) {
        badge.textContent = 'native app required';
        badge.dataset.tone = 'muted';
        continue;
      }
      try {
        const { configured } = await secure.hasSecret(provider);
        badge.textContent = configured ? 'key configured' : 'no key';
        badge.dataset.tone = configured ? 'ok' : 'muted';
      } catch (err) {
        badge.textContent = 'status unavailable';
        badge.dataset.tone = 'error';
      }
    }
  }

  for (const provider of PROVIDERS) {
    const row = $(`.keyrow[data-provider="${provider}"]`);
    const input = $('[data-role="key-input"]', row);
    const status = $('[data-role="key-status"]', row);

    $('[data-role="key-save"]', row).addEventListener('click', async () => {
      const key = input.value;
      if (!key.trim()) {
        setStatus(status, 'Paste the API key first.', 'error');
        return;
      }
      try {
        await secure.setSecret(provider, key);
        setStatus(status, 'Key encrypted with the Android Keystore and saved. It is never shown again.', 'ok');
      } catch (err) {
        setStatus(status, `Key was not saved: ${redactError(err?.message)}`, 'error');
      } finally {
        input.value = ''; // clear the password field immediately
      }
      await refreshKeyBadges();
    });

    $('[data-role="key-test"]', row).addEventListener('click', async () => {
      setStatus(status, 'Testing connection (live model discovery)…', 'info');
      try {
        const result = await secure.testConnection(provider);
        setStatus(status, `Connection OK — ${result.modelCount} models visible to this key.`, 'ok');
      } catch (err) {
        setStatus(status, `Connection failed: ${redactError(err?.message)}`, 'error');
      }
    });

    $('[data-role="key-delete"]', row).addEventListener('click', async () => {
      try {
        const result = await secure.deleteSecret(provider);
        setStatus(status, result.deleted ? 'Key deleted from secure storage.' : 'No key was stored.', 'ok');
      } catch (err) {
        setStatus(status, `Delete failed: ${redactError(err?.message)}`, 'error');
      }
      await refreshKeyBadges();
    });
  }

  // ---------------------------------------------------------------
  // Settings (model + price rates + run caps)
  // ---------------------------------------------------------------

  const settingsForm = $('#settings-form');
  const settingsStatus = $('#settings-status');

  async function loadSettingsIntoForm() {
    const s = await store.loadSettings();
    $('#set-provider').value = s.provider;
    $('#set-model').value = s.model;
    $('#set-price-in').value = s.priceInPerMillion || '';
    $('#set-price-out').value = s.priceOutPerMillion || '';
    $('#set-max-tokens').value = s.maxTokensPerRun || '';
    $('#set-max-minutes').value = s.maxMinutesPerRun || '';
    $('#set-max-usd').value = s.maxUsdPerRun || '';
    $('#set-max-output').value = s.maxOutputTokensPerCall || '';
  }

  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await store.saveSettings({
        provider: $('#set-provider').value,
        model: $('#set-model').value,
        priceInPerMillion: numValue($('#set-price-in')),
        priceOutPerMillion: numValue($('#set-price-out')),
        maxTokensPerRun: numValue($('#set-max-tokens')),
        maxMinutesPerRun: numValue($('#set-max-minutes')),
        maxUsdPerRun: numValue($('#set-max-usd')),
        maxOutputTokensPerCall: numValue($('#set-max-output')),
      });
      setStatus(settingsStatus, 'Settings saved on this device.', 'ok');
    } catch (err) {
      setStatus(settingsStatus, `Settings not saved: ${redactError(err?.message)}`, 'error');
    }
  });

  $('#load-models').addEventListener('click', async () => {
    const provider = $('#set-provider').value;
    if (!provider) {
      setStatus(settingsStatus, 'Pick a provider first.', 'error');
      return;
    }
    setStatus(settingsStatus, 'Loading models live from the provider…', 'info');
    try {
      const { models } = await secure.listModels(provider);
      const list = $('#model-list');
      list.textContent = '';
      for (const id of models.slice(0, 100)) {
        const option = document.createElement('option');
        option.value = id;
        list.appendChild(option);
      }
      setStatus(settingsStatus, `Loaded ${models.length} model IDs from the provider. Pick one or type your own.`, 'ok');
    } catch (err) {
      setStatus(settingsStatus, `Could not load models: ${redactError(err?.message)}`, 'error');
    }
  });

  // ---------------------------------------------------------------
  // New project form + squad editor
  // ---------------------------------------------------------------

  const squadEditor = $('#squad-editor');
  for (const node of DEFAULT_SQUAD) {
    const row = document.createElement('div');
    row.className = 'squad-row';

    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = true;
    enabled.dataset.role = 'node-enabled';
    enabled.title = 'enabled';

    const name = document.createElement('input');
    name.type = 'text';
    name.value = node.name;
    name.maxLength = 60;
    name.dataset.role = 'node-name';
    name.setAttribute('aria-label', 'node name');

    const brief = document.createElement('textarea');
    brief.rows = 2;
    brief.maxLength = 2000;
    brief.value = node.brief;
    brief.dataset.role = 'node-brief';
    brief.setAttribute('aria-label', 'node brief');

    row.append(enabled, name, brief);
    squadEditor.appendChild(row);
  }

  function readSquad() {
    return [...squadEditor.querySelectorAll('.squad-row')].map((row) => ({
      enabled: $('[data-role="node-enabled"]', row).checked,
      name: $('[data-role="node-name"]', row).value,
      brief: $('[data-role="node-brief"]', row).value,
    }));
  }

  $('#project-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('#project-status');
    const settings = await store.loadSettings();
    if (!settings.provider || !settings.model) {
      setStatus(status, 'Save a provider and model ID in settings first.', 'error');
      return;
    }
    try {
      const project = await engine.createProject({
        goal: $('#goal').value,
        squad: readSquad(),
        provider: settings.provider,
        model: settings.model,
        budget: {
          maxTokens: numValue($('#b-max-tokens')),
          maxMinutes: numValue($('#b-max-minutes')),
          maxUsd: numValue($('#b-max-usd')),
        },
      });
      $('#goal').value = '';
      setStatus(status, 'Project created.', 'ok');
      await renderProjectList();
      openProject(project.id);
    } catch (err) {
      setStatus(status, `Project not created: ${redactError(err?.message)}`, 'error');
    }
  });

  // ---------------------------------------------------------------
  // Project list + run view
  // ---------------------------------------------------------------

  async function renderProjectList() {
    const listEl = $('#project-list');
    const projects = await store.listProjects();
    listEl.textContent = '';
    if (!projects.length) {
      const p = document.createElement('p');
      p.className = 'help';
      p.textContent = 'No projects yet.';
      listEl.appendChild(p);
      return;
    }
    for (const summary of projects.slice().reverse()) {
      const item = document.createElement('div');
      item.className = 'project-item';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'btn';
      open.textContent = summary.goal || '(untitled)';
      open.addEventListener('click', () => openProject(summary.id));
      const meta = document.createElement('span');
      meta.className = 'help';
      meta.textContent = ` ${summary.provider} · ${summary.model}${summary.lastRunStatus ? ` · last run: ${summary.lastRunStatus}` : ''}`;
      item.append(open, meta);
      listEl.appendChild(item);
    }
  }

  function latestRun(project) {
    return project.runs.length ? project.runs[project.runs.length - 1] : null;
  }

  function fmtUsd(n) {
    return `$${Number(n).toFixed(4)}`;
  }

  async function renderRun() {
    if (!currentProjectId) return;
    const project = await engine.getProject(currentProjectId);
    if (!project) return;
    $('#run-goal').textContent = project.goal;
    const run = latestRun(project);

    const nodeList = $('#node-list');
    nodeList.textContent = '';
    project.squad.forEach((node, i) => {
      const li = document.createElement('li');
      const status = run ? run.nodeStatuses[i] ?? 'pending' : 'pending';
      li.textContent = `${node.name} — ${status}${node.enabled ? '' : ' (disabled)'}`;
      li.dataset.tone = status;
      nodeList.appendChild(li);
    });

    const statusEl = $('#run-status');
    const usageEl = $('#run-usage');
    if (run) {
      setStatus(statusEl, `Run ${run.id}: ${run.status}`, run.status === 'completed' ? 'ok' : run.status === 'error' ? 'error' : 'info');
      usageEl.textContent =
        `tokens: ${run.usage.totalTokens} (in ${run.usage.inputTokens} / out ${run.usage.outputTokens}) · ` +
        `cost: ${fmtUsd(run.usage.costUsd)} · caps: ${run.budget.maxTokens || '—'} tok / ` +
        `${run.budget.maxMinutes || '—'} min / ${run.budget.maxUsd ? fmtUsd(run.budget.maxUsd) : '—'}`;
    } else {
      setStatus(statusEl, 'No runs yet. Press Run to start.', 'info');
      usageEl.textContent = '';
    }

    const log = $('#event-log');
    log.textContent = run
      ? run.events.map((e) => `${e.ts}  ${e.type}${e.node ? `  [${e.node}]` : ''}${e.message ? `  ${e.message}` : ''}`).join('\n')
      : '';

    const artifactsEl = $('#artifact-list');
    artifactsEl.textContent = '';
    for (const artifact of run?.artifacts ?? []) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `${artifact.nodeName} — ${artifact.outputTokens} output tokens`;
      const pre = document.createElement('pre');
      pre.className = 'artifact';
      pre.textContent = artifact.text;
      details.append(summary, pre);
      artifactsEl.appendChild(details);
    }

    // Keep refreshing while a run is active so pause/cancel/progress show live.
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (run && (run.status === 'running' || run.status === 'paused')) {
      refreshTimer = setInterval(renderRun, 1500);
    }
  }

  function openProject(id) {
    currentProjectId = id;
    $('#run-card').hidden = false;
    renderRun();
    $('#run-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function runAction(action) {
    if (!currentProjectId) return;
    const statusEl = $('#run-status');
    if (action === 'start') {
      // startRun resolves only when the run finishes/pauses/errors; render
      // immediately so the live-refresh interval starts, then re-render at end.
      engine
        .startRun(currentProjectId)
        .catch((err) => setStatus(statusEl, redactError(err?.message), 'error'))
        .then(() => {
          renderRun();
          renderProjectList();
        });
      await renderRun();
      return;
    }
    try {
      if (action === 'pause') await engine.pauseRun(currentProjectId);
      else if (action === 'resume') {
        // Like start, resume drives the run asynchronously.
        engine
          .resumeRun(currentProjectId)
          .catch((err) => setStatus(statusEl, redactError(err?.message), 'error'))
          .then(() => {
            renderRun();
            renderProjectList();
          });
        await renderRun();
        return;
      } else if (action === 'cancel') await engine.cancelRun(currentProjectId);
    } catch (err) {
      setStatus(statusEl, redactError(err?.message), 'error');
    }
    await renderRun();
    await renderProjectList();
  }

  $('#run-start').addEventListener('click', () => runAction('start'));
  $('#run-pause').addEventListener('click', () => runAction('pause'));
  $('#run-resume').addEventListener('click', () => runAction('resume'));
  $('#run-cancel').addEventListener('click', () => runAction('cancel'));

  // ---------------------------------------------------------------

  await refreshKeyBadges();
  await loadSettingsIntoForm();
  await renderProjectList();
}

main().catch((err) => {
  const el = $('#native-status');
  if (el) setStatus(el, `Project mode failed to initialize: ${redactError(err?.message)}`, 'error');
});
