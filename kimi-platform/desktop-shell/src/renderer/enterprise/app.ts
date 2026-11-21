/**
 * v0.5 CEO Portfolio surface (enterprise tab).
 *
 * Enterprise → 5 companies → 7 shared-service departments → 9 contract seats,
 * rendered as an interactive spatial graph plus canonical lists derived from
 * the same bridge snapshot (parity by construction via the shared
 * deriveEnterpriseView output). All state comes from the v5 bridge; a v4
 * bridge yields an honest "requires desktop 0.5 runtime" surface.
 *
 * Hard rules honored here:
 *  - Blueprint apply is pinned: blueprintHash + payloadHash + expectedVersion
 *    + explicit confirmation, and the renderer re-computes the blueprint hash
 *    locally (hash.ts) and says so. Replay of the same blueprint is shown as
 *    an idempotent no-op.
 *  - Program controls never advance on query/refresh: dispatch moves only via
 *    explicit Start/Pause/Resume/Stop/Pump. Recovery after a crash is the
 *    main process's job (reattach, never re-dispatch) — surfaced read-only.
 *  - Operation availability mirrors ENTERPRISE_ACTIONS; unavailable controls
 *    are omitted or disabled with the exact reason.
 *  - Ledger/memory/handoff/steward content is token-free and ref-only; this
 *    surface renders hashes + bounded extractive summaries, never bodies.
 */

import { el, clear, button, badgeForStatus, svgEl } from '../office/dom.js';
import type { OverlayHost } from '../office/overlay.js';
import type { BridgeAdapter } from '../office/bridge.js';
import { UNAVAILABLE_V5 } from '../office/bridge.js';
import type { PanzoomFactory, PanzoomInstance } from '../office/canvas.js';
import type { BudgetLimits, Project, ProjectProvider, SkillSummary } from '../office/types.js';
import type {
  ArtifactRef,
  CreateEnterpriseRequest,
  EnterpriseApprovalDto,
  EnterpriseBlueprintPreviewDto,
  EnterpriseContractDto,
  EnterpriseMemoryDto,
  EnterpriseRecordDto,
  EnterpriseSnapshotDto,
  EnterpriseSummaryDto,
  EnterpriseViewNode,
  TimelineIndexEntry,
  WorkLedgerEntry,
} from '../office/entTypes.js';
import { blueprintHash } from './hash.js';
import { partitionBudget, type PartitionResult } from './partition.js';
import {
  DISCIPLINES,
  DISCIPLINE_SKILLS,
  ENTERPRISE_ACTIONS,
  deriveActionAvailability,
  isEnterpriseKey,
  type ActionAvailability,
} from './actions.js';
import { createDonnaDrawer, type DonnaDrawer } from './donna.js';

export interface EnterpriseAppDeps {
  root: HTMLElement;
  adapter: BridgeAdapter;
  overlay: OverlayHost;
  /** Vendored panzoom factory (optional in tests — the graph stays usable). */
  panzoomFactory?: PanzoomFactory | null;
  /** Deep-link into the existing Project Office for a company project. */
  openProject: (projectId: string) => void;
  /** Polite live-region announcer (optional). */
  announce?: (message: string) => void;
}

export interface EnterpriseApp {
  show(): Promise<void>;
  hide(): void;
  /** Test hook: re-render from current state. */
  renderAll(): void;
  state(): Readonly<EntState>;
  /** v6: Donna / shared-assistant drawer controller. */
  donna: DonnaDrawer;
  destroy(): void;
}

interface EntState {
  enterprises: EnterpriseSummaryDto[];
  selectedId: string | null;
  snapshot: EnterpriseSnapshotDto | null;
  contracts: EnterpriseContractDto[];
  skills: SkillSummary[] | null;
  ledger: WorkLedgerEntry[];
  ledgerFilter: { companyKey: string; departmentKey: string; workerId: string };
  timeline: { entries: TimelineIndexEntry[]; nextIndex: number };
  preview: EnterpriseBlueprintPreviewDto | null;
  previewHashCheck: 'match' | 'mismatch' | null;
  memory: { entries: EnterpriseMemoryDto[]; query: string; includeRevoked: boolean } | null;
  inspector: { companyKey: string; project: Project | null; workerId: string | null; workerLedger: WorkLedgerEntry[] | null };
  graphSelection: string | null;
  notice: string | null;
  unavailable: boolean;
}

const BUDGET_DEFAULTS = { maxTokens: 4_000_000, maxCalls: 300, maxMinutes: 360, maxCostUsdMicros: 250_000_000 };
const PROGRAM_ACTIVE = new Set(['dispatching', 'running', 'reconciling']);
const COALESCE_MS = 200;
const LEDGER_CAP = 200;
const OFFICE_ROOM_IDS = ['executive', 'research', 'architecture', 'engineering', 'design', 'data', 'qa', 'operations'];

function usd(micros: number): string {
  return `$${(micros / 1e6).toFixed(2)}`;
}

function short(sha: string | null | undefined, n = 12): string {
  return sha ? `${sha.slice(0, n)}…` : '—';
}

function budgetSummary(budget: Partial<BudgetLimits>): string {
  const parts: string[] = [];
  if (budget.maxTokens !== undefined) parts.push(`${budget.maxTokens.toLocaleString()} tok`);
  if (budget.maxMinutes !== undefined) parts.push(`${budget.maxMinutes} min`);
  if (budget.maxUsd !== undefined) parts.push(`$${budget.maxUsd.toFixed(2)}`);
  return parts.join(' / ') || 'set';
}

export function createEnterpriseApp(deps: EnterpriseAppDeps): EnterpriseApp {
  const { root, adapter, overlay, openProject } = deps;
  const announce = deps.announce ?? (() => undefined);
  const state: EntState = {
    enterprises: [],
    selectedId: null,
    snapshot: null,
    contracts: [],
    skills: null,
    ledger: [],
    ledgerFilter: { companyKey: '', departmentKey: '', workerId: '' },
    timeline: { entries: [], nextIndex: 0 },
    preview: null,
    previewHashCheck: null,
    memory: null,
    inspector: { companyKey: '', project: null, workerId: null, workerLedger: null },
    graphSelection: null,
    notice: null,
    unavailable: false,
  };
  let unsubscribe: (() => void) | null = null;
  let refreshSeq = 0;
  let coalesceTimer: number | null = null;
  let availability: Map<string, ActionAvailability> = new Map();

  const shell = el('div', 'ent-shell');
  root.append(shell);

  // v6: Donna / shared-assistant drawer. Hosted on root (not shell) so the
  // CEO re-render cycle never detaches it; degrades honestly on a v5 bridge.
  const donna: DonnaDrawer = createDonnaDrawer({
    host: root,
    adapter,
    overlay,
    getRecord: () => record(),
    onEnterpriseChanged: async () => {
      await refresh();
    },
    announce,
  });

  function record(): EnterpriseRecordDto | null {
    return state.snapshot?.record ?? null;
  }

  function availabilityFor(id: string): ActionAvailability {
    return availability.get(id) ?? { id, available: false, reason: 'Not registered in ENTERPRISE_ACTIONS.' };
  }

  function toastError(prefix: string, error: string): void {
    overlay.toast(`${prefix}: ${error}`, { kind: 'error' });
  }

  // ------------------------------------------------------------ data loads

  async function refreshEnterprises(keepSelection = true): Promise<void> {
    const res = await adapter.entList();
    if (!res.ok) {
      state.unavailable = res.unavailable === true || res.error.includes(UNAVAILABLE_V5);
      state.notice = res.error;
      return;
    }
    state.unavailable = false;
    state.enterprises = res.value;
    if (!keepSelection || !state.enterprises.some((e) => e.id === state.selectedId)) {
      state.selectedId = state.enterprises[0]?.id ?? null;
    }
  }

  async function refreshSelected(): Promise<void> {
    const seq = ++refreshSeq;
    state.preview = null;
    state.previewHashCheck = null;
    state.memory = null;
    if (!state.selectedId) {
      state.snapshot = null;
      state.contracts = [];
      state.ledger = [];
      return;
    }
    const id = state.selectedId;
    const [snap, contracts] = await Promise.all([adapter.entSnapshot(id), adapter.entContracts(id)]);
    if (seq !== refreshSeq) return; // a newer selection won
    state.snapshot = snap.ok ? snap.value : null;
    state.contracts = contracts.ok ? contracts.value : [];
    if (state.skills === null) {
      const skills = await adapter.listSkills();
      if (seq !== refreshSeq) return;
      state.skills = skills.ok ? skills.value : [];
    }
    await refreshLedger();
  }

  async function refreshLedger(): Promise<void> {
    if (!state.selectedId) {
      state.ledger = [];
      return;
    }
    const f = state.ledgerFilter;
    const res = await adapter.entLedger({
      enterpriseId: state.selectedId,
      ...(f.companyKey ? { companyKey: f.companyKey } : {}),
      ...(f.departmentKey ? { departmentKey: f.departmentKey } : {}),
      ...(f.workerId ? { workerId: f.workerId } : {}),
    });
    state.ledger = res.ok ? res.value : [];
  }

  async function refresh(): Promise<void> {
    await refreshEnterprises();
    await refreshSelected();
    renderAll();
  }

  /** Coalesce live enterprise events into one refetch per window (v4 pattern). */
  function scheduleRefresh(): void {
    if (coalesceTimer !== null) return;
    coalesceTimer = window.setTimeout(() => {
      coalesceTimer = null;
      void refresh();
    }, COALESCE_MS);
  }

  /** After a mutation: reload the selected enterprise and re-render. */
  async function afterMutation(): Promise<void> {
    await refreshSelected();
    renderAll();
  }

  // -------------------------------------------------------- focus retention

  /**
   * Preserve focus across full re-renders by stable data-focus-key markers —
   * the same pattern the office uses for approval cards.
   */
  function renderPreservingFocus(): void {
    const active = document.activeElement;
    const key = active instanceof HTMLElement ? (active.closest<HTMLElement>('[data-focus-key]')?.dataset['focusKey'] ?? null) : null;
    renderAll();
    if (key) {
      const target = shell.querySelector<HTMLElement>(`[data-focus-key="${key}"]`);
      target?.focus();
    }
  }

  // ------------------------------------------------------------ small builders

  function labeled(labelText: string, input: HTMLElement): HTMLElement {
    const wrap = el('label', 'ent-field');
    wrap.append(el('span', 'muted', labelText));
    wrap.append(input);
    return wrap;
  }

  function inputEl(opts: { type?: string; value?: string; placeholder?: string; ariaLabel: string; focusKey?: string; maxLength?: number }): HTMLInputElement {
    const input = el('input', '') as HTMLInputElement;
    input.type = opts.type ?? 'text';
    if (opts.value !== undefined) input.value = opts.value;
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.setAttribute('aria-label', opts.ariaLabel);
    if (opts.maxLength) input.maxLength = opts.maxLength;
    if (opts.focusKey) input.dataset['focusKey'] = opts.focusKey;
    return input;
  }

  function selectEl(ariaLabel: string, options: Array<[string, string]>, value: string, focusKey?: string): HTMLSelectElement {
    const sel = el('select', '') as HTMLSelectElement;
    sel.setAttribute('aria-label', ariaLabel);
    for (const [label, v] of options) sel.append(new Option(label, v));
    sel.value = value;
    if (focusKey) sel.dataset['focusKey'] = focusKey;
    return sel;
  }

  /** A button gated by an ENTERPRISE_ACTIONS availability entry. */
  function gatedButton(actionId: string, className: string, text: string, onClick: () => void): HTMLButtonElement {
    const av = availabilityFor(actionId);
    const action = ENTERPRISE_ACTIONS.find((a) => a.id === actionId);
    const btn = button(className, text, onClick);
    btn.dataset['focusKey'] = `action-${actionId}-${text}`;
    if (!av.available) {
      btn.disabled = true;
      btn.title = `${action?.description ?? actionId} — unavailable: ${av.reason ?? 'not applicable'}`;
      btn.setAttribute('aria-disabled', 'true');
    } else if (action?.approval) {
      btn.title = `${action.description} (gated by ${action.approval} approval)`;
    } else if (action) {
      btn.title = action.description;
    }
    return btn;
  }

  function tableRow(cells: Array<HTMLElement | string>, header = false): HTMLTableRowElement {
    const tr = el('tr', '');
    for (const cell of cells) {
      const td = el(header ? 'th' : 'td', '');
      if (typeof cell === 'string') td.textContent = cell;
      else td.append(cell);
      tr.append(td);
    }
    return tr;
  }

  // ---------------------------------------------------------------- header

  function renderHeader(container: HTMLElement): void {
    const bar = el('div', 'ent-header row');
    bar.append(el('h2', '', 'CEO Portfolio'));
    const rec = record();
    if (rec) {
      bar.append(el('span', 'muted', `${rec.name} · v${rec.version} · ${rec.state}`));
      if (rec.program) bar.append(badgeForStatus(rec.programPaused ? 'paused' : rec.program.state));
    }
    const refreshBtn = button('secondary', 'Refresh', () => {
      void refresh();
    });
    refreshBtn.dataset['focusKey'] = 'ent-refresh';
    bar.append(refreshBtn);
    const donnaBtn = button('', 'Donna', () => {
      void donna.toggle();
    });
    donnaBtn.dataset['focusKey'] = 'ent-donna';
    donnaBtn.title = adapter.capabilities.assistant
      ? 'Open the Donna assistant drawer (queue, hiring, schedules, cache, repositories, knowledge, chat).'
      : 'Donna requires desktop 0.6 runtime — opens an honest degraded panel.';
    donnaBtn.disabled = !rec;
    bar.append(donnaBtn);
    container.append(bar);
    if (state.unavailable) {
      container.append(
        el(
          'p',
          'status warn',
          `CEO mode is unavailable on this runtime (${UNAVAILABLE_V5}). Office, chat, and connections are unaffected.`,
        ),
      );
    } else if (state.notice) {
      container.append(el('p', 'status error', state.notice));
    }
  }

  // ------------------------------------------------------- enterprise list

  function renderPortfolio(container: HTMLElement): void {
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Enterprises'));
    const list = el('div', 'ent-list');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Enterprises');
    if (state.enterprises.length === 0) {
      list.append(el('p', 'muted', 'No enterprises yet. Create one below — preview → approve → apply a blueprint to materialize it.'));
    }
    for (const ent of state.enterprises) {
      const row = el('div', `ent-row${ent.id === state.selectedId ? ' selected' : ''}`);
      row.tabIndex = 0;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', ent.id === state.selectedId ? 'true' : 'false');
      row.dataset['focusKey'] = `ent-row-${ent.id}`;
      row.append(el('strong', '', ent.name));
      row.append(
        el('span', 'muted', ` ${ent.companyCount} companies · ${ent.departmentCount} departments · ${ent.contractCount} seats · v${ent.version}`),
      );
      if (ent.programState) row.append(badgeForStatus(ent.programPaused ? 'paused' : ent.programState));
      const choose = (): void => {
        state.selectedId = ent.id;
        state.timeline = { entries: [], nextIndex: 0 };
        state.graphSelection = null;
        state.inspector = { companyKey: '', project: null, workerId: null, workerLedger: null };
        void refreshSelected().then(renderAll);
      };
      row.addEventListener('click', choose);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          choose();
        }
      });
      list.append(row);
    }
    section.append(list);
    section.append(buildCreateForm());
    container.append(section);
  }

  function buildCreateForm(): HTMLElement {
    const form = el('form', 'ent-create-form') as HTMLFormElement;
    form.append(el('h4', '', 'New enterprise (creative_technology_group preset)'));
    const grid = el('div', 'ent-form-grid');
    const nameInput = inputEl({ placeholder: 'Enterprise name', ariaLabel: 'Enterprise name', maxLength: 255, focusKey: 'create-name' });
    nameInput.required = true;
    const idInput = inputEl({ placeholder: 'program id (kebab-case, e.g. ctg-2026)', ariaLabel: 'Program id', focusKey: 'create-id' });
    idInput.required = true;
    const missionInput = inputEl({ placeholder: 'Mission / goal', ariaLabel: 'Mission', maxLength: 2000, focusKey: 'create-mission' });
    missionInput.required = true;
    const providerSel = selectEl('Provider', [
      ['OpenAI', 'openai'],
      ['Anthropic', 'anthropic'],
      ['Ollama (local)', 'ollama'],
    ], 'openai', 'create-provider');
    const modelInput = inputEl({ placeholder: 'model id for company projects', ariaLabel: 'Model id', focusKey: 'create-model' });
    modelInput.required = true;
    const listModelsBtn = button('secondary', 'List models (live)', () => {
      void adapter.listProviderModels(providerSel.value as ProjectProvider).then((res) => {
        if (!res.ok) {
          toastError('Model list failed', res.error ?? 'unknown error');
          return;
        }
        modelDatalist.innerHTML = '';
        for (const m of res.models) {
          const opt = document.createElement('option');
          opt.value = m.id;
          modelDatalist.append(opt);
        }
        overlay.toast(`${res.models.length} model(s) listed — pick from the model field suggestions.`, { kind: 'info' });
      });
    });
    const modelDatalist = el('datalist', '') as HTMLDataListElement;
    modelDatalist.id = 'ent-model-suggestions';
    modelInput.setAttribute('list', 'ent-model-suggestions');
    const tokensInput = inputEl({ type: 'number', value: String(BUDGET_DEFAULTS.maxTokens), ariaLabel: 'Envelope max tokens', focusKey: 'create-tokens' });
    tokensInput.min = '1';
    const callsInput = inputEl({ type: 'number', value: String(BUDGET_DEFAULTS.maxCalls), ariaLabel: 'Envelope max calls', focusKey: 'create-calls' });
    callsInput.min = '1';
    const minutesInput = inputEl({ type: 'number', value: String(BUDGET_DEFAULTS.maxMinutes), ariaLabel: 'Envelope max minutes', focusKey: 'create-minutes' });
    minutesInput.min = '1';
    const usdInput = inputEl({ type: 'number', value: String(BUDGET_DEFAULTS.maxCostUsdMicros / 1e6), ariaLabel: 'Envelope cost in USD', focusKey: 'create-usd' });
    usdInput.min = '0.01';
    usdInput.step = '0.01';
    const concInput = inputEl({ type: 'number', value: '2', ariaLabel: 'Max concurrent company runs (default 2, max 4)', focusKey: 'create-conc' });
    concInput.min = '1';
    concInput.max = '4';
    const replansInput = inputEl({ type: 'number', value: '2', ariaLabel: 'Max replans (0-10)', focusKey: 'create-replans' });
    replansInput.min = '0';
    replansInput.max = '10';
    const rateInInput = inputEl({ type: 'number', value: '0', ariaLabel: 'Input USD per 1M tokens (your rate)', focusKey: 'create-rate-in' });
    rateInInput.min = '0';
    rateInInput.step = '0.01';
    const rateOutInput = inputEl({ type: 'number', value: '0', ariaLabel: 'Output USD per 1M tokens (your rate)', focusKey: 'create-rate-out' });
    rateOutInput.min = '0';
    rateOutInput.step = '0.01';
    grid.append(
      labeled('Name', nameInput),
      labeled('Program id', idInput),
      labeled('Mission', missionInput),
      labeled('Provider', providerSel),
      labeled('Model', modelInput),
      labeled('', listModelsBtn),
      labeled('Envelope tokens', tokensInput),
      labeled('Envelope calls', callsInput),
      labeled('Envelope minutes', minutesInput),
      labeled('Envelope USD', usdInput),
      labeled('Concurrency (≤4)', concInput),
      labeled('Max replans', replansInput),
      labeled('Rate in $/1M', rateInInput),
      labeled('Rate out $/1M', rateOutInput),
    );
    form.append(grid, modelDatalist);
    form.append(el('p', 'muted', 'Company projects use this provider/model. Budgets are hard caps; the envelope is partitioned across active companies (allocations provably sum ≤ envelope).'));
    const submit = button('', 'Create enterprise', () => undefined);
    submit.dataset['focusKey'] = 'create-submit';
    form.append(submit);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const programId = idInput.value.trim();
      if (!isEnterpriseKey(programId)) {
        overlay.toast('Program id must be lowercase kebab-case (e.g. ctg-2026).', { kind: 'error' });
        return;
      }
      const req: CreateEnterpriseRequest = {
        preset: 'creative_technology_group',
        programId,
        name: nameInput.value.trim(),
        mission: missionInput.value.trim(),
        budget: {
          maxTokens: Math.max(1, Math.round(Number(tokensInput.value) || 0)),
          maxCalls: Math.max(1, Math.round(Number(callsInput.value) || 0)),
          maxMinutes: Math.max(0.001, Number(minutesInput.value) || 0),
          maxCostUsdMicros: Math.max(1, Math.round((Number(usdInput.value) || 0) * 1e6)),
        },
        maxReplans: Math.max(0, Math.min(10, Math.round(Number(replansInput.value) || 0))),
        maxConcurrentRuns: Math.max(1, Math.min(4, Math.round(Number(concInput.value) || 2))),
        provider: providerSel.value as ProjectProvider,
        model: modelInput.value.trim(),
        priceRates: {
          inputUsdPerMillion: Math.max(0, Number(rateInInput.value) || 0),
          outputUsdPerMillion: Math.max(0, Number(rateOutInput.value) || 0),
        },
      };
      void adapter.entCreate(req).then(async (res) => {
        if (!res.ok) {
          toastError('Create failed', res.error);
          return;
        }
        overlay.toast(
          res.value.created
            ? 'Enterprise created. Preview the blueprint to continue.'
            : 'Same program id already existed — idempotent create replayed, nothing duplicated.',
          { kind: 'ok' },
        );
        state.selectedId = res.value.record.id;
        await refresh();
      });
    });
    return form;
  }

  // --------------------------------------------------------- blueprint flow

  function renderBlueprint(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Blueprint'));
    if (rec.blueprintHash && rec.blueprint) {
      const applied = el('div', 'ent-blueprint-applied');
      applied.append(
        el('p', 'muted',
          `Applied blueprint sha256 ${short(rec.blueprintHash, 16)} — ${rec.blueprint.companies.length} companies, ` +
            `${rec.blueprint.departments.length} departments, ${rec.blueprint.contracts.length} contract seats. ` +
            'Re-applying the same pinned blueprint is an idempotent replay: company projects, departments, and seats are reused, never duplicated.'),
      );
      const replayBtn = gatedButton('blueprint.apply', 'secondary', 'Replay apply (idempotent)', () => {
        void replayApply();
      });
      applied.append(replayBtn);
      section.append(applied);
    } else {
      section.append(el('p', 'muted', 'No blueprint applied yet. Flow: preview → approve activation → confirm → apply.'));
    }
    const previewBtn = button('secondary', 'Preview blueprint', () => {
      const current = record();
      if (!current) return;
      void adapter.entBlueprintPreview({ enterpriseId: current.id, expectedVersion: current.version }).then((res) => {
        if (!res.ok) {
          toastError('Preview failed', res.error);
          return;
        }
        state.preview = res.value;
        state.previewHashCheck = blueprintHash(res.value.blueprint) === res.value.blueprintHash ? 'match' : 'mismatch';
        renderPreservingFocus();
      });
    });
    previewBtn.dataset['focusKey'] = 'blueprint-preview';
    section.append(previewBtn);

    if (state.preview) section.append(buildPreviewCard(state.preview));
    container.append(section);
  }

  /** Re-apply the currently pinned blueprint (idempotent; reuses materialization). */
  async function replayApply(): Promise<void> {
    const current = record();
    if (!current) return;
    const prev = await adapter.entBlueprintPreview({ enterpriseId: current.id, expectedVersion: current.version });
    if (!prev.ok) {
      toastError('Replay preview failed', prev.error);
      return;
    }
    const ok = await overlay.confirm({
      title: 'Replay blueprint apply',
      message: `Re-apply the pinned blueprint ${short(prev.value.blueprintHash, 16)}? This is idempotent: existing company projects, departments, and seats are reused.`,
      detail: 'The blueprint-activation approval for this hash is already approved.',
      confirmLabel: 'Replay apply',
    });
    if (!ok) return;
    const res = await adapter.entBlueprintApply({
      enterpriseId: current.id,
      blueprintHash: prev.value.blueprintHash,
      payloadHash: prev.value.payloadHash,
      expectedVersion: prev.value.expectedVersion,
      confirmed: true,
    });
    if (!res.ok) toastError('Replay apply failed', res.error);
    else overlay.toast('Idempotent replay finished — no duplicate companies, departments, or seats.', { kind: 'ok' });
    await refresh();
  }

  function buildPreviewCard(p: EnterpriseBlueprintPreviewDto): HTMLElement {
    const box = el('div', 'ent-preview');
    const checkBadge =
      state.previewHashCheck === 'match'
        ? el('span', 'badge ok', 'renderer-verified hash: match')
        : state.previewHashCheck === 'mismatch'
          ? el('span', 'badge fail', 'renderer hash mismatch — do not apply')
          : el('span', 'badge neutral', 'hash not verified');
    box.append(
      el('p', '',
        `Preview pins blueprint ${short(p.blueprintHash, 16)} (payload ${short(p.payloadHash)}). Materializes ` +
          `${p.blueprint.companies.length} company projects + ${p.blueprint.departments.length} shared-service departments + ${p.blueprint.contracts.length} seats.`),
      checkBadge,
    );
    const verified = new Set((state.skills ?? []).filter((s) => s.verified).map((s) => s.id));
    const unstaffed = p.blueprint.contracts.filter((c) => !c.staffed || !verified.has(c.skillPin.skillId));
    if (unstaffed.length > 0) {
      box.append(
        el('p', 'status warn',
          `${unstaffed.length} seat(s) unstaffed until their skill packs are installed & verified: ${unstaffed.map((c) => c.key).join(', ')}`),
      );
    }
    const approvalRow = el('div', 'row');
    approvalRow.append(el('span', 'muted', `Blueprint-activation approval ${p.approval.status} (payload ${short(p.payloadHash)}).`));
    if (p.approval.status === 'pending') {
      approvalRow.append(
        decideButton(p.approval, 'approved', 'Approve activation'),
        decideButton(p.approval, 'rejected', 'Reject'),
      );
    } else {
      approvalRow.append(badgeForStatus(p.approval.status));
    }
    box.append(approvalRow);

    if (p.approval.status === 'approved' && state.previewHashCheck === 'match') {
      const confirmLabel = el('label', 'row ent-confirm');
      const confirmBox = el('input', '') as HTMLInputElement;
      confirmBox.type = 'checkbox';
      confirmBox.dataset['focusKey'] = 'blueprint-confirm';
      confirmLabel.append(confirmBox, el('span', '', 'I confirm materializing this exact pinned blueprint (hash + payload + version checked).'));
      box.append(confirmLabel);
      const applyBtn = button('', 'Apply blueprint', () => {
        const current = record();
        if (!current) return;
        void adapter
          .entBlueprintApply({
            enterpriseId: current.id,
            blueprintHash: p.blueprintHash,
            payloadHash: p.payloadHash,
            expectedVersion: p.expectedVersion,
            confirmed: confirmBox.checked,
          })
          .then(async (res) => {
            if (!res.ok) toastError('Apply failed', res.error);
            else overlay.toast('Blueprint materialized: 5 company projects, 7 departments, 9 seats.', { kind: 'ok' });
            state.preview = null;
            state.previewHashCheck = null;
            await refresh();
          });
      });
      applyBtn.dataset['focusKey'] = 'blueprint-apply';
      applyBtn.disabled = !confirmBox.checked;
      confirmBox.addEventListener('change', () => {
        applyBtn.disabled = !confirmBox.checked;
      });
      box.append(applyBtn);
    }
    return box;
  }

  function decideButton(approval: EnterpriseApprovalDto, decision: 'approved' | 'rejected', text: string): HTMLButtonElement {
    return button(decision === 'rejected' ? 'secondary' : '', text, () => {
      const current = record();
      if (!current) return;
      void adapter
        .entApprovalDecide({ enterpriseId: current.id, approvalId: approval.id, decision, payloadHash: approval.payloadHash })
        .then(async (res) => {
          if (!res.ok) toastError('Approval decision failed', res.error);
          state.preview = null;
          state.previewHashCheck = null;
          await afterMutation();
        });
    });
  }

  // -------------------------------------------------------------- approvals

  function renderApprovals(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const pending = rec.approvals.filter((a) => a.status === 'pending');
    if (pending.length === 0) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Pending approvals'));
    for (const a of pending) {
      const row = el('div', 'row ent-approval-row');
      row.append(el('strong', '', a.kind));
      row.append(el('span', 'muted', ` blueprint ${short(a.blueprintHash)} · payload ${short(a.payloadHash)} · requested ${new Date(a.createdAt).toLocaleString()}`));
      row.append(decideButton(a, 'approved', 'Approve'), decideButton(a, 'rejected', 'Reject'));
      section.append(row);
    }
    container.append(section);
  }

  // ------------------------------------------------------------ graph+lists

  interface GraphLayout {
    worldWidth: number;
    worldHeight: number;
    positions: Map<string, { x: number; y: number; w: number; h: number }>;
  }

  function layoutGraph(view: NonNullable<EnterpriseSnapshotDto['view']>): GraphLayout {
    const colW = 300;
    const worldWidth = colW * 3 + 40;
    const columns: Array<{ kind: EnterpriseViewNode['kind']; x: number }> = [
      { kind: 'company', x: 20 },
      { kind: 'department', x: colW + 20 },
      { kind: 'contract', x: colW * 2 + 20 },
    ];
    const counts = columns.map(({ kind }) => view.graph.nodes.filter((n) => n.kind === kind).length);
    const rows = Math.max(...counts, 1);
    const rowH = 52;
    const worldHeight = (rows + 1) * rowH + 20;
    const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
    columns.forEach(({ kind, x }, col) => {
      const nodes = view.graph.nodes.filter((n) => n.kind === kind);
      nodes.forEach((n, i) => {
        const span = worldHeight - 40;
        const y = nodes.length <= 1 ? span / 2 : 20 + (i * (span - 28)) / Math.max(nodes.length - 1, 1);
        positions.set(n.key, { x, y, w: colW - 40, h: 28 });
      });
      void col;
    });
    return { worldWidth, worldHeight, positions };
  }

  function renderGraph(container: HTMLElement): void {
    const view = state.snapshot?.view;
    if (!view) return;
    const section = el('section', 'ent-section ent-graph-section');
    section.append(el('h3', '', 'Org graph (graph ⇄ list parity, one shared derivation)'));

    const layout = layoutGraph(view);
    const viewport = el('div', 'ent-graph-viewport');
    viewport.tabIndex = 0;
    viewport.setAttribute(
      'aria-label',
      'Enterprise org graph. Companies on the left, shared-service departments in the middle, contract seats on the right. Use the buttons to zoom; nodes are buttons; every node is also in the list below.',
    );
    const world = el('div', 'ent-graph-world');
    world.style.width = `${layout.worldWidth}px`;
    world.style.height = `${layout.worldHeight}px`;
    const svg = svgEl('svg', {
      class: 'ent-graph',
      width: String(layout.worldWidth),
      height: String(layout.worldHeight),
      role: 'group',
      'aria-label': 'Enterprise org graph nodes and edges',
    });
    for (const edge of view.graph.edges) {
      const from = layout.positions.get(edge.from);
      const to = layout.positions.get(edge.to);
      if (!from || !to) continue;
      if (edge.kind === 'serves') {
        const path = svgEl('path', {
          d: `M ${from.x} ${from.y + 14} C ${from.x - 120} ${from.y + 14}, ${to.x + to.w + 120} ${to.y + 14}, ${to.x + to.w} ${to.y + 14}`,
          class: 'ent-edge ent-edge-serves',
          fill: 'none',
        });
        svg.append(path);
      } else {
        svg.append(
          svgEl('line', {
            x1: String(from.x + from.w),
            y1: String(from.y + 14),
            x2: String(to.x),
            y2: String(to.y + 14),
            class: 'ent-edge ent-edge-contains',
          }),
        );
      }
    }
    const nodeGroups = new Map<string, SVGGElement>();
    for (const node of view.graph.nodes) {
      const pos = layout.positions.get(node.key);
      if (!pos) continue;
      const g = svgEl('g', {
        class: `ent-node ent-node-${node.kind}${node.status ? ` ent-status-${node.status}` : ''}${node.key === state.graphSelection ? ' selected' : ''}`,
        'data-key': node.key,
        'data-focus-key': `graph-${node.key}`,
        tabindex: '0',
        role: 'button',
        'aria-label': `${node.kind} ${node.label}${node.status ? `, ${node.status}` : ''}. Activate to inspect.`,
      });
      g.append(svgEl('rect', { x: String(pos.x), y: String(pos.y), width: String(pos.w), height: String(pos.h), rx: '5' }));
      const label = svgEl('text', { x: String(pos.x + 8), y: String(pos.y + 18) });
      label.textContent = node.label.length > 34 ? `${node.label.slice(0, 33)}…` : node.label;
      g.append(label);
      const title = svgEl('title', {});
      title.textContent = `${node.kind}: ${node.label}${node.status ? ` (${node.status})` : ''}`;
      g.append(title);
      g.addEventListener('click', () => selectGraphNode(node.key));
      g.addEventListener('keydown', (e) => {
        const ke = e as unknown as KeyboardEvent;
        if (ke.key === 'Enter' || ke.key === ' ') {
          ke.preventDefault();
          selectGraphNode(node.key);
        }
      });
      nodeGroups.set(node.key, g);
      svg.append(g);
    }
    world.append(svg);
    viewport.append(world);

    const controls = el('div', 'ent-graph-controls row');
    let panzoom: PanzoomInstance | null = null;
    const fit = (): void => {
      if (!panzoom) return;
      const vw = viewport.clientWidth || layout.worldWidth;
      const vh = viewport.clientHeight || layout.worldHeight;
      const scale = Math.min(1, vw / layout.worldWidth, vh / layout.worldHeight);
      panzoom.zoomAbs?.(0, 0, Math.max(0.2, scale));
      panzoom.moveTo?.(Math.max(0, (vw - layout.worldWidth * scale) / 2), Math.max(0, (vh - layout.worldHeight * scale) / 2));
    };
    if (deps.panzoomFactory) {
      panzoom = deps.panzoomFactory(world, { smoothScroll: false, maxZoom: 2.5, minZoom: 0.2, bounds: false });
      window.setTimeout(fit, 0);
    }
    controls.append(
      button('secondary', '+', () => panzoom?.smoothZoom?.(0, 0, 1.25)),
      button('secondary', '−', () => panzoom?.smoothZoom?.(0, 0, 0.8)),
      button('secondary', 'Fit', fit),
    );
    section.append(controls, viewport);

    // canonical lists — the same rows the graph is derived from (parity)
    const lists = el('div', 'ent-lists');
    const columns: Array<[string, string, Array<{ key: string; label: string }>]> = [
      ['company', 'Companies', view.lists.companies.map((c) => ({ key: c.key, label: c.name }))],
      ['department', 'Departments', view.lists.departments.map((d) => ({ key: d.key, label: d.name }))],
      ['contract', 'Contract seats', view.lists.contracts.map((c) => ({ key: c.key, label: `${c.key} (${c.status})` }))],
    ];
    for (const [kind, title, rows] of columns) {
      const col = el('div', 'ent-list-col');
      col.append(el('h4', '', `${title} (${rows.length})`));
      const ul = el('ul', 'ent-plain-list');
      ul.setAttribute('aria-label', `${title} list (mirrors the graph)`);
      for (const row of rows) {
        const li = el('li', '');
        const itemBtn = button(`linklike ent-list-item${row.key === state.graphSelection ? ' selected' : ''}`, row.label, () =>
          selectGraphNode(row.key),
        );
        itemBtn.dataset['key'] = row.key;
        itemBtn.dataset['kind'] = kind;
        itemBtn.dataset['focusKey'] = `list-${row.key}`;
        li.append(itemBtn);
        ul.append(li);
      }
      col.append(ul);
      lists.append(col);
    }
    section.append(lists);

    const detail = el('div', 'ent-graph-detail');
    detail.id = 'ent-graph-detail';
    renderGraphDetail(detail);
    section.append(detail);
    container.append(section);
  }

  function selectGraphNode(key: string): void {
    state.graphSelection = state.graphSelection === key ? null : key;
    renderPreservingFocus();
  }

  /** Read-only detail for the selected graph node (with honest staffing data). */
  function renderGraphDetail(host: HTMLElement): void {
    const rec = record();
    const view = state.snapshot?.view;
    clear(host);
    if (!rec || !view || !state.graphSelection) {
      host.append(el('p', 'muted', 'Select a company, department, or seat (graph node or list row) to inspect it.'));
      return;
    }
    const key = state.graphSelection;
    const company = view.lists.companies.find((c) => c.key === key);
    const department = view.lists.departments.find((d) => d.key === key);
    const contractRow = view.lists.contracts.find((c) => c.key === key);
    const verified = new Set((state.skills ?? []).filter((s) => s.verified).map((s) => s.id));

    if (company) {
      host.append(el('h4', '', company.name));
      host.append(el('p', 'muted', `${company.kind} · capacity share ${company.capacityShare} · disciplines: ${company.disciplines.join(', ') || 'all (shared services)'}`));
      host.append(el('p', 'muted', `${company.departmentCount} departments · ${company.contractCount} contract seats`));
      const run = rec.program?.companyRuns.find((cr) => cr.companyKey === company.key);
      if (run) {
        const p = el('p', 'muted', `Company run: `);
        p.append(badgeForStatus(run.status), el('span', 'muted', run.runId ? ` run ${run.runId.slice(0, 16)}…` : ' (not dispatched yet)'));
        host.append(p);
      }
      const link = rec.companies[company.key];
      if (link) {
        const openBtn = button('', 'Open Project Office', () => openProject(link.projectId));
        openBtn.dataset['focusKey'] = `open-office-${company.key}`;
        host.append(openBtn);
      } else {
        host.append(el('p', 'muted', 'Not materialized yet — apply the blueprint first.'));
      }
      return;
    }
    if (department) {
      const seats = state.contracts.filter((c) => c.departmentKey === department.key);
      const staffed = seats.filter((c) => c.staffed && verified.has(c.skillId)).length;
      host.append(el('h4', '', department.name));
      host.append(el('p', 'muted', `discipline: ${department.discipline} · owner: ${department.companyKey} · ${seats.length} seat(s)`));
      const badge = el(
        'span',
        `badge ${staffed === seats.length && seats.length > 0 ? 'ok' : 'warn'}`,
        seats.length === 0 ? 'no seats' : staffed === seats.length ? 'staffed (verified skills)' : `${staffed}/${seats.length} staffed`,
      );
      host.append(badge);
      if (staffed < seats.length) {
        const missing = seats.filter((c) => !c.staffed || !verified.has(c.skillId)).map((c) => c.skillId);
        host.append(el('p', 'muted', `Skill packs not installed/verified in the live registry: ${missing.join(', ')}`));
      }
      return;
    }
    if (contractRow) {
      const rt = state.contracts.find((c) => c.key === contractRow.key);
      host.append(el('h4', '', contractRow.key));
      const p = el('p', 'muted', '');
      p.append(badgeForStatus(contractRow.status));
      p.append(el('span', 'muted', ` serves ${contractRow.companyKey} from ${contractRow.departmentKey} · discipline ${contractRow.discipline}`));
      host.append(p);
      if (rt) {
        host.append(
          el('p', 'muted',
            `skill ${rt.skillId} ${rt.staffed && verified.has(rt.skillId) ? '(verified in registry)' : '(not verified — unstaffed)'} · ` +
              `capacity ${rt.capacityShare.toFixed(2)} · contract v${rt.version} · fence #${rt.fenceCounter}` +
              (rt.lease ? ` · lease held by ${rt.lease.runId.slice(0, 16)}… (fence ${rt.lease.fence}, ${rt.lease.status}, ttl ${Math.round(rt.lease.ttlMs / 60000)}min)` : ' · no live lease')),
        );
      }
      host.append(el('p', 'muted', 'Manage this seat in the Contracts section below.'));
      return;
    }
    host.append(el('p', 'muted', 'Unknown selection.'));
  }

  // --------------------------------------------------------- company cards

  function renderCompanies(container: HTMLElement): void {
    const rec = record();
    const view = state.snapshot?.view;
    if (!rec || !view) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Companies (each is a real 1:1 Project Office)'));
    const grid = el('div', 'ent-company-grid');
    for (const company of view.lists.companies) {
      const card = el('article', 'ent-company-card');
      card.append(el('h4', '', company.name));
      card.append(el('p', 'muted', `${company.kind} · capacity ${company.capacityShare} · ${company.disciplines.join(', ') || 'shared services'}`));
      const run = rec.program?.companyRuns.find((cr) => cr.companyKey === company.key);
      if (run) {
        card.append(badgeForStatus(run.status));
        if (run.runId) card.append(el('span', 'muted', ` run ${run.runId.slice(0, 12)}…`));
      }
      const link = rec.companies[company.key];
      if (link) {
        const openBtn = button('secondary', 'Open office', () => openProject(link.projectId));
        openBtn.dataset['focusKey'] = `open-office-${company.key}`;
        card.append(openBtn);
      } else {
        card.append(el('p', 'muted', 'Not materialized yet.'));
      }
      grid.append(card);
    }
    section.append(grid);
    container.append(section);
  }

  // --------------------------------------------------------------- program

  function renderProgram(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Program'));
    const program = rec.program;
    if (!program) {
      section.append(el('p', 'muted', 'Apply a blueprint to create the program.'));
      container.append(section);
      return;
    }
    section.append(
      el('p', 'muted',
        `state ${program.state}${rec.programPaused ? ' (paused)' : ''} · concurrency ${program.maxConcurrentRuns} (default 2, max 4) · ` +
          `envelope ${program.budget.maxTokens.toLocaleString()} tok / ${program.budget.maxCalls} calls / ${program.budget.maxMinutes} min / ${usd(program.budget.maxCostUsdMicros)}`),
    );

    // plan approval gate
    const plan = rec.approvals.find((a) => a.kind === 'plan' && a.blueprintHash === program.blueprintHash);
    if (program.state === 'awaiting_plan_approval' && plan) {
      const row = el('div', 'row ent-plan-gate');
      row.append(el('span', 'muted', `Plan approval ${plan.status} (payload ${short(plan.payloadHash)}). Start is gated on it.`));
      if (plan.status === 'pending') {
        row.append(decideButton(plan, 'approved', 'Approve plan'), decideButton(plan, 'rejected', 'Reject plan'));
      }
      section.append(row);
    }

    section.append(buildPartitionMeters(rec));

    const controls = el('div', 'row ent-program-controls');
    const startBtn = gatedButton('program.start', '', 'Start', () => {
      const current = record();
      if (!current) return;
      void adapter.entProgramStart({ enterpriseId: current.id, expectedVersion: current.version }).then(async (res) => {
        if (!res.ok) toastError('Start failed', res.error);
        await afterMutation();
      });
    });
    const pauseBtn = gatedButton('program.pause', 'secondary', 'Pause', () => void programAction('pause'));
    const resumeBtn = gatedButton('program.resume', 'secondary', 'Resume', () => void programAction('resume'));
    const stopBtn = gatedButton('program.cancel', 'danger', 'Stop', () => {
      void overlay
        .confirm({
          title: 'Stop program',
          message: 'Cancel all company runs and settle the program as stopped by you?',
          detail: 'Seat leases drain first; partial artifacts are preserved.',
          confirmLabel: 'Stop program',
          danger: true,
        })
        .then((yes) => {
          if (yes) void programAction('cancel');
        });
    });
    const pumpBtn = button('secondary', 'Pump dispatch', () => {
      void adapter.entProgramPump(rec.id).then(async (res) => {
        if (!res.ok) toastError('Pump failed', res.error);
        else overlay.toast(`Dispatch pump: ${res.value.dispatched} run(s) dispatched (semaphore ${program.maxConcurrentRuns}).`, { kind: 'info' });
        await afterMutation();
      });
    });
    pumpBtn.dataset['focusKey'] = 'program-pump';
    pumpBtn.title = 'Manual dispatch step. Refreshing or querying this page never advances dispatch.';
    controls.append(startBtn, pauseBtn, resumeBtn, stopBtn, pumpBtn);
    section.append(controls);
    section.append(
      el('p', 'muted',
        'Dispatch advances only from explicit controls (Start/Resume/Pump) or run-settlement events — never from querying this page. ' +
          'After a crash the orchestrator reattaches the recorded runs and recovers interrupted ones in place; seats are never re-booked.'),
    );

    const runs = el('ul', 'ent-plain-list ent-company-runs');
    for (const cr of program.companyRuns) {
      const li = el('li', '');
      li.append(el('span', '', cr.companyKey));
      li.append(badgeForStatus(cr.status));
      if (cr.runId) li.append(el('span', 'muted', ` ${cr.runId.slice(0, 16)}…`));
      const link = rec.companies[cr.companyKey];
      if (link) {
        li.append(
          button('linklike', 'open office', () => openProject(link.projectId)),
        );
      }
      runs.append(li);
    }
    section.append(runs);
    container.append(section);

    const recId = rec.id;
    function programAction(op: 'pause' | 'resume' | 'cancel'): Promise<void> {
      const call = op === 'pause' ? adapter.entProgramPause(recId) : op === 'resume' ? adapter.entProgramResume(recId) : adapter.entProgramCancel(recId);
      return call.then(async (res) => {
        if (!res.ok) toastError(`${op} failed`, res.error);
        await afterMutation();
      });
    }
  }

  /** Budget partitions (shared largest-remainder port) + usage meters from the ledger. */
  function buildPartitionMeters(rec: EnterpriseRecordDto): HTMLElement {
    const wrap = el('div', 'ent-partitions');
    const program = rec.program;
    const blueprint = rec.blueprint;
    if (!program || !blueprint) return wrap;
    const requests = blueprint.companies
      .filter((c) => c.kind === 'line')
      .map((c) => ({
        companyKey: c.key,
        capacityShare: c.capacityShare,
        // Mirror main's requiredContracts: active = has an active+staffed seat.
        active: Object.entries(rec.contracts).some(
          ([key, rt]) => key.startsWith(`${c.key}--`) && rt.status === 'active' && rt.staffed,
        ),
      }));
    let partition: PartitionResult;
    try {
      partition = partitionBudget(program.budget, requests);
    } catch {
      wrap.append(el('p', 'status error', 'Partition derivation failed — showing the raw envelope only.'));
      return wrap;
    }
    const usedByCompany = new Map<string, number>();
    for (const e of state.ledger) {
      if (e.companyKey && e.usage) {
        usedByCompany.set(e.companyKey, (usedByCompany.get(e.companyKey) ?? 0) + e.usage.costUsdMicros);
      }
    }
    const table = el('table', 'ent-table ent-partition-table');
    table.append(tableRow(['Company', 'Active', 'Reservation (tok / calls / min / USD)', 'Used (ledger)', 'Meter'], true));
    for (const p of partition.partitions) {
      const used = usedByCompany.get(p.companyKey) ?? 0;
      const pct = p.reservation.maxCostUsdMicros > 0 ? Math.min(100, Math.round((used / p.reservation.maxCostUsdMicros) * 100)) : used > 0 ? 100 : 0;
      const meter = el('div', 'ent-meter');
      meter.setAttribute('role', 'meter');
      meter.setAttribute('aria-valuemin', '0');
      meter.setAttribute('aria-valuemax', '100');
      meter.setAttribute('aria-valuenow', String(pct));
      meter.setAttribute('aria-label', `${p.companyKey} budget used: ${pct}%`);
      const fill = el('div', `ent-meter-fill${pct >= 80 ? ' hot' : ''}`);
      fill.style.width = `${pct}%`;
      meter.append(fill);
      table.append(
        tableRow([
          p.companyKey,
          p.active ? 'yes' : 'no (zero reservation)',
          `${p.reservation.maxTokens.toLocaleString()} / ${p.reservation.maxCalls} / ${p.reservation.maxMinutes.toFixed(1)} / ${usd(p.reservation.maxCostUsdMicros)}`,
          usd(used),
          meter,
        ]),
      );
    }
    wrap.append(table);
    wrap.append(
      el('p', 'muted',
        `Active reservations total ${usd(partition.totals.maxCostUsdMicros)} — provably within the ${usd(partition.envelope.maxCostUsdMicros)} envelope ` +
          `(largest-remainder apportionment, ${partition.withinEnvelope ? 'verified' : 'VIOLATED'}). Usage is summed from the token-free ledger.`),
    );
    return wrap;
  }

  // ------------------------------------------------------------- contracts

  function renderContracts(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Cross-office contracts & capacity seat leases'));
    if (state.contracts.length === 0) {
      section.append(el('p', 'muted', rec.blueprint ? 'No contract seats yet.' : 'Apply a blueprint to create contract seats.'));
    } else {
      const table = el('table', 'ent-table ent-contracts-table');
      table.append(tableRow(['Contract', 'Status', 'Staffed', 'Capacity', 'v / fence', 'Lease (run · fence · ttl)', 'Actions'], true));
      const verified = new Set((state.skills ?? []).filter((s) => s.verified).map((s) => s.id));
      for (const c of state.contracts) {
        const actions = el('span', 'row ent-contract-actions');
        if (c.status === 'proposed') {
          actions.append(
            button('', 'Activate', () => void contractDecide(c.key, 'approved')),
            button('secondary', 'Reject', () => void contractDecide(c.key, 'rejected')),
          );
        }
        if (c.status === 'active' || c.status === 'draining') {
          const releaseBtn = gatedButton('contract.release', 'secondary', 'Release', () => {
            void overlay
              .confirm({
                title: 'Release contract',
                message: `Release "${c.key}" (v${c.version})?`,
                detail: c.lease ? `Live lease (run ${c.lease.runId.slice(0, 16)}…, fence ${c.lease.fence}) drains first, then the contract is released.` : 'No live lease — the contract releases immediately.',
                confirmLabel: 'Release',
                danger: true,
              })
              .then((yes) => {
                if (!yes) return;
                const current = record();
                if (!current) return;
                void adapter
                  .entContractRelease({ enterpriseId: current.id, contractKey: c.key, expectedVersion: current.version })
                  .then(async (res) => {
                    if (!res.ok) toastError('Release failed', res.error);
                    await afterMutation();
                  });
              });
          });
          actions.append(releaseBtn);
          const capInput = inputEl({ type: 'number', value: c.capacityShare.toFixed(2), ariaLabel: `Capacity share for ${c.key}` });
          capInput.min = '0.05';
          capInput.max = '1';
          capInput.step = '0.05';
          capInput.classList.add('ent-cap-input');
          actions.append(
            capInput,
            gatedButton('worker.capacity', 'secondary', 'Set capacity', () => {
              const current = record();
              if (!current) return;
              void adapter
                .entWorkerUpdate({
                  enterpriseId: current.id,
                  expectedVersion: current.version,
                  op: 'capacity',
                  contractKey: c.key,
                  capacityShare: Number(capInput.value),
                })
                .then(async (res) => {
                  if (!res.ok) toastError('Capacity failed', res.error);
                  await afterMutation();
                });
            }),
          );
          if (c.status === 'active') {
            actions.append(gatedButton('worker.suspend', 'secondary', 'Suspend', () => void workerSuspend(c.key, true)));
          } else {
            actions.append(button('secondary', 'Resume seat', () => void workerSuspend(c.key, false)));
          }
        }
        const staffedText = c.staffed && verified.has(c.skillId) ? 'yes (verified)' : c.staffed ? 'pinned, not in live registry' : 'unstaffed';
        table.append(
          tableRow([
            el('span', 'mono', c.key),
            badgeForStatus(c.status),
            staffedText,
            c.capacityShare.toFixed(2),
            `${c.version} / #${c.fenceCounter}`,
            c.lease ? `${c.lease.runId.slice(0, 12)}… · #${c.lease.fence} · ${c.lease.status} · ${Math.round(c.lease.ttlMs / 60000)}min` : '—',
            actions,
          ]),
        );
      }
      section.append(table);
    }
    section.append(buildProposeForm(rec));
    container.append(section);

    function contractDecide(key: string, decision: 'approved' | 'rejected'): Promise<void> {
      const current = record();
      if (!current) return Promise.resolve();
      const contract = state.contracts.find((c) => c.key === key);
      const doit = (): Promise<void> =>
        adapter
          .entContractDecide({ enterpriseId: current.id, contractKey: key, decision, expectedVersion: current.version })
          .then(async (res) => {
            if (!res.ok) toastError('Contract decision failed', res.error);
            await afterMutation();
          });
      if (decision === 'rejected') {
        void overlay
          .confirm({
            title: 'Reject contract',
            message: `Reject proposed contract "${key}"? It is revoked (never activated).`,
            confirmLabel: 'Reject contract',
            danger: true,
          })
          .then((yes) => {
            if (yes) void doit();
          });
        return Promise.resolve();
      }
      void contract; // capacity/status already rendered
      return doit();
    }

    function workerSuspend(key: string, suspended: boolean): Promise<void> {
      const current = record();
      if (!current) return Promise.resolve();
      return adapter
        .entWorkerUpdate({ enterpriseId: current.id, expectedVersion: current.version, op: suspended ? 'suspend' : 'resume', contractKey: key })
        .then(async (res) => {
          if (!res.ok) toastError(suspended ? 'Suspend failed' : 'Resume failed', res.error);
          await afterMutation();
        });
    }
  }

  function buildProposeForm(rec: EnterpriseRecordDto): HTMLElement {
    const box = el('div', 'ent-propose');
    box.append(el('h4', '', 'Propose a cross-office contract'));
    if (!rec.blueprint) {
      box.append(el('p', 'muted', 'Apply a blueprint first — proposals reference blueprint companies and departments.'));
      return box;
    }
    if (!adapter.capabilities.ceoPropose) {
      box.append(el('p', 'status warn', 'Contract proposals are unavailable on this runtime (bridge predates entContractPropose). Decisions/releases still work.'));
      return box;
    }
    const grid = el('div', 'ent-form-grid');
    const keyInput = inputEl({ placeholder: 'contract key (kebab-case)', ariaLabel: 'New contract key', focusKey: 'propose-key' });
    const companySel = selectEl(
      'Served company',
      rec.blueprint.companies.map((c) => [c.name, c.key]),
      rec.blueprint.companies[0]?.key ?? '',
      'propose-company',
    );
    const departmentSel = selectEl(
      'Providing department',
      rec.blueprint.departments.map((d) => [`${d.name} (${d.discipline})`, d.key]),
      rec.blueprint.departments[0]?.key ?? '',
      'propose-department',
    );
    const disciplineSel = selectEl('Discipline', DISCIPLINES.map((d) => [d, d]), rec.blueprint.departments[0]?.discipline ?? DISCIPLINES[0]!, 'propose-discipline');
    const skillSel = selectEl('Pinned skill', [], '', 'propose-skill');
    const syncSkills = (): void => {
      const declared = DISCIPLINE_SKILLS[disciplineSel.value] ?? [];
      const verified = new Set((state.skills ?? []).filter((s) => s.verified).map((s) => s.id));
      skillSel.innerHTML = '';
      for (const id of declared) {
        skillSel.append(new Option(`${id}${verified.has(id) ? ' (verified)' : ' (not installed)'}` , id));
      }
    };
    disciplineSel.addEventListener('change', syncSkills);
    syncSkills();
    // Default the discipline to the selected department's discipline.
    departmentSel.addEventListener('change', () => {
      const dep = rec.blueprint?.departments.find((d) => d.key === departmentSel.value);
      if (dep && DISCIPLINES.includes(dep.discipline)) {
        disciplineSel.value = dep.discipline;
        syncSkills();
      }
    });
    const capInput = inputEl({ type: 'number', value: '0.5', ariaLabel: 'Capacity share (0-1]', focusKey: 'propose-cap' });
    capInput.min = '0.05';
    capInput.max = '1';
    capInput.step = '0.05';
    const suggest = button('secondary', 'Suggest key', () => {
      keyInput.value = `${companySel.value}--${departmentSel.value}`;
    });
    grid.append(
      labeled('Contract key', keyInput),
      labeled('', suggest),
      labeled('Served company', companySel),
      labeled('Providing department', departmentSel),
      labeled('Discipline', disciplineSel),
      labeled('Pinned skill', skillSel),
      labeled('Capacity share', capInput),
    );
    box.append(grid);
    const proposeBtn = gatedButton('contract.decide', '', 'Propose contract', () => undefined);
    // Proposals are the 'propose' capability; availability of the decide gate is
    // the closest declarative signal, so re-enable explicitly and explain.
    proposeBtn.disabled = false;
    proposeBtn.title = 'Propose a new seat contract (starts as proposed — never auto-active).';
    proposeBtn.dataset['focusKey'] = 'propose-submit';
    proposeBtn.addEventListener('click', () => {
      const current = record();
      if (!current) return;
      const key = keyInput.value.trim();
      if (!isEnterpriseKey(key)) {
        overlay.toast('Contract key must be lowercase kebab-case.', { kind: 'error' });
        return;
      }
      void adapter
        .entContractPropose({
          enterpriseId: current.id,
          key,
          companyKey: companySel.value,
          departmentKey: departmentSel.value,
          discipline: disciplineSel.value,
          capacityShare: Number(capInput.value),
          skillId: skillSel.value,
          expectedVersion: current.version,
        })
        .then(async (res) => {
          if (!res.ok) toastError('Proposal failed', res.error);
          else overlay.toast(`Contract "${key}" proposed — decide it in the table above.`, { kind: 'ok' });
          await afterMutation();
        });
    });
    box.append(proposeBtn);
    return box;
  }

  // ---------------------------------------------------------------- memory

  function renderMemory(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Shared memory (reference-only: ArtifactRef + extractive summary + sha256 — never bodies)'));
    const searchRow = el('div', 'row');
    const searchInput = inputEl({ placeholder: 'Search titles/summaries/keys…', ariaLabel: 'Search shared memory', focusKey: 'memory-search' });
    if (state.memory) searchInput.value = state.memory.query;
    searchRow.append(
      searchInput,
      button('secondary', 'Search', () => {
        void adapter.entMemorySearch(rec.id, searchInput.value).then(async (res) => {
          if (!res.ok) {
            toastError('Search failed', res.error);
            return;
          }
          state.memory = { entries: res.value, query: searchInput.value, includeRevoked: false };
          renderPreservingFocus();
        });
      }),
      button('secondary', 'Show all (+revoked)', () => {
        void adapter.entMemory(rec.id, true).then((res) => {
          if (res.ok) {
            state.memory = { entries: res.value, query: '', includeRevoked: true };
            renderPreservingFocus();
          }
        });
      }),
    );
    section.append(searchRow);
    const listHost = el('div', 'ent-memory-list');
    section.append(listHost);
    container.append(section);
    if (state.memory === null) {
      void adapter.entMemory(rec.id, true).then((res) => {
        if (res.ok) {
          state.memory = { entries: res.value, query: '', includeRevoked: true };
          renderMemoryList(listHost, state.memory.entries);
        }
      });
    } else {
      renderMemoryList(listHost, state.memory.entries);
    }

    function renderMemoryList(host: HTMLElement, entries: EnterpriseMemoryDto[]): void {
      clear(host);
      if (entries.length === 0) {
        host.append(el('p', 'muted', 'No memory entries. Promote a returned artifact from the ledger below (approval-gated, ref-only).'));
        return;
      }
      for (const m of entries) {
        const row = el('div', 'ent-memory-row');
        row.append(el('strong', '', m.entry.artifact.title));
        row.append(badgeForStatus(m.status));
        row.append(el('span', 'muted', ` ${m.entry.scope}:${m.entry.scopeKey} · sha ${short(m.entry.artifact.contentSha256)}`));
        if (m.entry.artifact.summary) row.append(el('p', 'muted', m.entry.artifact.summary.slice(0, 240)));
        if (m.status === 'promoted') {
          const revokeBtn = gatedButton('memory.revoke', 'secondary', 'Revoke', () => {
            const current = record();
            if (!current) return;
            void adapter
              .entMemoryRevoke({
                enterpriseId: current.id,
                scope: m.entry.scope,
                scopeKey: m.entry.scopeKey,
                artifactId: String(m.entry.artifact.artifactId),
                expectedVersion: current.version,
              })
              .then(async (res) => {
                if (!res.ok) toastError('Revoke failed', res.error);
                state.memory = null;
                await afterMutation();
              });
          });
          row.append(revokeBtn);
        }
        host.append(row);
      }
    }
  }

  /** Promote dialog: scope + scopeKey, ref-only, approval-gated downstream. */
  function openPromoteDialog(ref: ArtifactRef): void {
    const current = record();
    if (!current) return;
    const backdrop = el('div', 'modal-backdrop hidden');
    const dialog = el('div', 'modal');
    dialog.append(el('h2', '', `Promote artifact ref to shared memory`));
    dialog.append(el('p', 'muted', `${ref.title} · sha ${short(ref.contentSha256, 16)} · run ${String(ref.runId).slice(0, 16)}…`));
    const scopeSel = selectEl('Memory scope', [
      ['Enterprise (whole program)', 'enterprise'],
      ['Company', 'company'],
      ['Department', 'department'],
      ['Office', 'office'],
    ], 'enterprise');
    const scopeKeyInput = inputEl({ ariaLabel: 'Scope key', value: current.programId });
    const syncScopeKey = (): void => {
      if (scopeSel.value === 'enterprise') scopeKeyInput.value = current.programId;
      else if (scopeSel.value === 'company') scopeKeyInput.value = String(ref.nodeKey).split('--')[0] ?? '';
      else if (scopeSel.value === 'department') scopeKeyInput.value = String(ref.nodeKey);
    };
    scopeSel.addEventListener('change', syncScopeKey);
    const form = el('div', 'stack');
    form.append(labeled('Scope', scopeSel), labeled('Scope key (kebab-case)', scopeKeyInput));
    dialog.append(form);
    dialog.append(el('p', 'muted', 'Promotion is approval-gated: a memory-promote approval pinned to this exact ref is created; the entry lands only after you approve it. Artifact bodies never cross into memory.'));
    const actions = el('div', 'row dialog-actions');
    const controller = overlay.attachDialog(backdrop);
    const cancelBtn = button('secondary', 'Cancel', () => controller.close());
    const promoteBtn = button('', 'Request promotion', () => {
      const scopeKey = scopeKeyInput.value.trim();
      if (!isEnterpriseKey(scopeKey)) {
        overlay.toast('Scope key must be lowercase kebab-case.', { kind: 'error' });
        return;
      }
      void adapter
        .entMemoryPromote({ enterpriseId: current.id, artifact: ref, scope: scopeSel.value, scopeKey, expectedVersion: current.version })
        .then(async (res) => {
          if (!res.ok) toastError('Promote failed', res.error);
          else overlay.toast('Promotion requested — approve it under Pending approvals (ref-only, hash-pinned).', { kind: 'info', durationMs: 6000 });
          controller.close();
          await afterMutation();
        });
    });
    promoteBtn.setAttribute('data-autofocus', '');
    actions.append(cancelBtn, promoteBtn);
    dialog.append(actions);
    backdrop.append(dialog);
    shell.append(backdrop);
    controller.open();
  }

  // ----------------------------------------------------------------- ledger

  function renderLedger(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Work ledger (token-free: intended ask, prompt sha256, extractive summary, usage)'));

    const view = state.snapshot?.view;
    const companyKeys = view?.lists.companies.map((c) => c.key) ?? Object.keys(rec.companies);
    const departmentKeys = view?.lists.departments.map((d) => d.key) ?? [];
    const workerIds = [...new Set(state.ledger.map((e) => e.workerId).filter((w): w is string => Boolean(w)))];
    const filters = el('div', 'row ent-ledger-filters');
    const companySel = selectEl('Filter ledger by company', [['All companies', ''], ...companyKeys.map((k): [string, string] => [k, k])], state.ledgerFilter.companyKey, 'ledger-filter-company');
    const deptSel = selectEl('Filter ledger by department', [['All departments', ''], ...departmentKeys.map((k): [string, string] => [k, k])], state.ledgerFilter.departmentKey, 'ledger-filter-department');
    const workerInput = inputEl({ placeholder: 'worker id', value: state.ledgerFilter.workerId, ariaLabel: 'Filter ledger by worker id', focusKey: 'ledger-filter-worker' });
    const applyFilters = (): void => {
      state.ledgerFilter = { companyKey: companySel.value, departmentKey: deptSel.value, workerId: workerInput.value.trim() };
      void refreshLedger().then(renderPreservingFocus);
    };
    companySel.addEventListener('change', applyFilters);
    deptSel.addEventListener('change', applyFilters);
    const filterBtn = button('secondary', 'Apply filters', applyFilters);
    filterBtn.dataset['focusKey'] = 'ledger-filter-apply';
    workerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyFilters();
    });
    const exportBtn = button('secondary', 'Export HANDOFFS + timeline + ledger', () => {
      void adapter.entExport(rec.id).then((res) => {
        if (!res.ok) {
          toastError('Export failed', res.error);
          return;
        }
        overlay.toast(`Wrote ${res.value.files.length} files to ${res.value.dir} (${res.value.files.join(', ')})`, { kind: 'ok', durationMs: 6000 });
      });
    });
    exportBtn.dataset['focusKey'] = 'ledger-export';
    filters.append(companySel, deptSel, workerInput, filterBtn, exportBtn);
    section.append(filters);

    const bullet = el('ul', 'ent-ledger-bullets');
    bullet.setAttribute('aria-label', 'Work ledger entries (bounded ask, prompt hash, summary, usage)');
    const rows = state.ledger.slice(-LEDGER_CAP).reverse();
    if (rows.length === 0) {
      bullet.append(el('li', 'muted', 'No ledger entries match. Entries are written by the control plane when runs settle.'));
    }
    for (const e of rows) {
      const li = el('li', 'ent-ledger-row');
      const head = el('div', 'row ent-ledger-head');
      head.append(el('span', 'ent-ledger-seq', `#${e.seq}`));
      head.append(badgeForStatus(e.status));
      head.append(el('span', 'muted', `${new Date(e.ts).toLocaleTimeString()} · ${e.kind}`));
      if (e.companyKey) head.append(el('span', 'muted', ` · ${e.companyKey}`));
      if (e.nodeKey) head.append(el('span', 'muted', ` · ${e.nodeKey}`));
      if (e.workerId) head.append(el('span', 'muted', ` · ${e.workerId}`));
      li.append(head);
      if (e.intendedAsk) li.append(el('p', 'ent-ledger-ask', `ask: ${e.intendedAsk}`));
      const meta = el('p', 'muted ent-ledger-meta');
      meta.textContent = `prompt sha256 ${short(e.promptSha256)}`;
      if (e.usage) meta.textContent += ` · usage ${e.usage.inputTokens}+${e.usage.outputTokens} tok, ${usd(e.usage.costUsdMicros)}`;
      li.append(meta);
      if (e.returnedSummary) li.append(el('p', 'muted ent-ledger-summary', `returned: ${e.returnedSummary.slice(0, 240)}`));
      if (e.artifactRef) {
        const art = el('p', 'muted ent-ledger-artifact');
        art.textContent = `artifact: ${e.artifactRef.title} · sha ${short(e.artifactRef.contentSha256)}`;
        li.append(art);
        if (e.kind === 'returned' || e.kind === 'artifact') {
          const promoteBtn = gatedButton('memory.promote', 'secondary', 'Promote ref to memory…', () => openPromoteDialog(e.artifactRef as ArtifactRef));
          li.append(promoteBtn);
        }
      }
      bullet.append(li);
    }
    section.append(bullet);
    if (state.ledger.length > LEDGER_CAP) {
      section.append(el('p', 'muted', `Showing latest ${LEDGER_CAP} of ${state.ledger.length} entries (server-capped); use filters to narrow.`));
    }
    container.append(section);
  }

  // ---------------------------------------------------------------- timeline

  function renderTimeline(container: HTMLElement): void {
    if (!record()) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Timeline index (incremental — derived from ledger + events, token-free)'));
    if (state.timeline.entries.length === 0) {
      section.append(el('p', 'muted', 'Not loaded yet. Load the index below; further loads fetch only entries after the last index.'));
    } else {
      const ul = el('ul', 'ent-plain-list');
      for (const e of state.timeline.entries) {
        const li = el('li', '');
        li.append(el('span', 'mono', `[${e.seq}] `));
        li.append(el('span', '', ` ${e.kind}`));
        const detail = e.artifactRef ? `${e.artifactRef.title} · sha ${short(e.artifactRef.contentSha256)}` : '';
        if (detail) li.append(el('span', 'muted', ` — ${detail}`));
        const where = [e.companyKey, e.nodeKey, e.runId ? `run ${String(e.runId).slice(0, 12)}…` : null].filter(Boolean).join(' · ');
        if (where) li.append(el('span', 'muted', ` · ${where}`));
        li.append(el('span', 'muted', ` · ${new Date(e.ts).toLocaleString()}`));
        ul.append(li);
      }
      section.append(ul);
    }
    const loadBtn = button('secondary', state.timeline.nextIndex === 0 ? 'Load timeline' : `Load more (after #${state.timeline.nextIndex})`, () => {
      const current = record();
      if (!current) return;
      void adapter.entTimeline({ enterpriseId: current.id, afterIndex: state.timeline.nextIndex }).then((res) => {
        if (!res.ok) {
          toastError('Timeline failed', res.error);
          return;
        }
        state.timeline.entries = [...state.timeline.entries, ...res.value.entries];
        state.timeline.nextIndex = res.value.nextIndex;
        renderPreservingFocus();
      });
    });
    loadBtn.dataset['focusKey'] = 'timeline-load';
    section.append(loadBtn);
    container.append(section);
  }

  // ---------------------------------------------------------------- stewards

  function renderStewards(container: HTMLElement): void {
    const stewards = state.snapshot?.stewards ?? [];
    if (!record() || stewards.length === 0) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Steward recommendations (system-derived)'));
    section.append(
      el('p', 'muted',
        'Stewards are deterministic derivations from runs, events, and artifact metadata: zero provider calls, no cached provider responses. They propose — they never act.'),
    );
    for (const s of stewards) {
      const card = el('article', 'ent-steward-card');
      card.append(el('h4', '', `${s.steward} `));
      card.append(el('span', 'badge neutral', 'system-derived · zero provider calls'));
      card.append(el('p', 'muted', `kind: ${s.kind}${s.ledgerSeq !== null ? ` · ledger #${s.ledgerSeq}` : ''}`));
      card.append(el('p', '', s.summary));
      const action = s.actionId ? ENTERPRISE_ACTIONS.find((a) => a.id === s.actionId) : null;
      if (action) {
        card.append(el('p', 'muted', `Suggested action: ${action.id} — ${action.description}${action.approval ? ` (gated by ${action.approval} approval)` : ''}`));
      } else {
        card.append(el('p', 'muted', 'Review-only recommendation.'));
      }
      section.append(card);
    }
    container.append(section);
  }

  // ---------------------------------------------------- employee inspector

  function renderInspector(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'ent-section');
    section.append(el('h3', '', 'Company employees (room/parent, capacity, next-run instructions, budgets)'));
    const companyKeys = Object.keys(rec.companies);
    if (companyKeys.length === 0) {
      section.append(el('p', 'muted', 'No companies materialized yet — apply a blueprint first.'));
      container.append(section);
      return;
    }
    if (!companyKeys.includes(state.inspector.companyKey)) {
      state.inspector.companyKey = companyKeys[0] as string;
      state.inspector.project = null;
      state.inspector.workerId = null;
      state.inspector.workerLedger = null;
    }
    const companyName = (k: string): string => rec.blueprint?.companies.find((c) => c.key === k)?.name ?? k;
    const sel = selectEl('Company', companyKeys.map((k): [string, string] => [companyName(k), k]), state.inspector.companyKey, 'inspector-company');
    sel.addEventListener('change', () => {
      state.inspector.companyKey = sel.value;
      state.inspector.project = null;
      state.inspector.workerId = null;
      state.inspector.workerLedger = null;
      void loadInspectorProject();
    });
    section.append(sel);
    const host = el('div', 'ent-inspector-host');
    section.append(host);
    container.append(section);
    if (state.inspector.project === null) {
      void loadInspectorProject();
    } else {
      renderInspectorTable(host);
    }

    const recId2 = rec.id;
    async function loadInspectorProject(): Promise<void> {
      const link = record()?.companies[state.inspector.companyKey];
      if (!link) return;
      state.inspector.project = await adapter.getProject(link.projectId);
      if (record()?.id === recId2) renderInspectorTable(host);
    }
  }

  function renderInspectorTable(host: HTMLElement): void {
    const rec = record();
    clear(host);
    const project = state.inspector.project;
    if (!rec || !project) {
      host.append(el('p', 'muted', 'Loading company office…'));
      return;
    }
    if (project.nodes.length === 0) {
      host.append(el('p', 'muted', 'No employees in this company yet — start the program to staff it.'));
      return;
    }
    const table = el('table', 'ent-table ent-worker-table');
    table.append(tableRow(['Employee', 'Depth/kind', 'Room', 'Parent', 'Seat / override', 'Controls'], true));
    for (const node of project.nodes) {
      const overrideKey = `${state.inspector.companyKey}/${node.id}`;
      const workerOverride = rec.workerOverrides[overrideKey];
      const seatKey = Object.keys(rec.contractWorkers).find((k) => rec.contractWorkers[k]?.nodeId === node.id);
      const seat = seatKey ? state.contracts.find((c) => c.key === seatKey) : null;

      const roomSel = selectEl(`Room for ${node.title}`, OFFICE_ROOM_IDS.map((r): [string, string] => [r, r]), node.roomId ?? 'engineering');
      const parentSel = selectEl(
        `Parent for ${node.title}`,
        [['(root)', ''], ...project.nodes.filter((n) => n.id !== node.id).map((n): [string, string] => [`${n.title} (${n.id})`, n.id])],
        node.parentId ?? '',
      );
      const reassignBtn = gatedButton('worker.reassign', 'secondary', 'Reassign', () => {
        const current = record();
        if (!current) return;
        void adapter
          .entWorkerUpdate({
            enterpriseId: current.id,
            expectedVersion: current.version,
            op: 'reassign',
            companyKey: state.inspector.companyKey,
            workerId: node.id,
            roomId: roomSel.value,
            parentId: parentSel.value || null,
          })
          .then(async (res) => {
            if (!res.ok) toastError('Reassign failed', res.error);
            else {
              overlay.toast('Employee reassigned.', { kind: 'ok' });
              state.inspector.project = null;
            }
            await afterMutation();
          });
      });

      const seatCell = el('td', '');
      const controlsCell = el('span', 'row');
      if (seat) {
        seatCell.append(el('span', 'muted', `seat ${seat.key} · ${seat.status} · cap ${seat.capacityShare.toFixed(2)}`));
        if (seat.status === 'active' || seat.status === 'draining') {
          controlsCell.append(gatedButton('worker.suspend', 'secondary', seat.status === 'active' ? 'Suspend seat' : 'Resume seat', () => {
            const current = record();
            if (!current) return;
            void adapter
              .entWorkerUpdate({
                enterpriseId: current.id,
                expectedVersion: current.version,
                op: seat.status === 'active' ? 'suspend' : 'resume',
                contractKey: seat.key,
              })
              .then(async (res) => {
                if (!res.ok) toastError('Seat update failed', res.error);
                await afterMutation();
              });
          }));
        }
      }
      if (workerOverride) {
        seatCell.append(
          el('p', 'muted',
            `next-run override${workerOverride.instructions ? ' · instructions set' : ''}${workerOverride.budget ? ` · budget ${budgetSummary(workerOverride.budget)}` : ''}`),
        );
      }
      controlsCell.append(reassignBtn);
      const editBtn = button('secondary', 'Edit next-run…', () => openWorkerEditDialog(node.id, node.title, workerOverride ?? null));
      editBtn.dataset['focusKey'] = `worker-edit-${node.id}`;
      controlsCell.append(editBtn);
      const ledgerBtn = button('linklike', 'Ledger', () => {
        state.inspector.workerId = node.id;
        state.inspector.workerLedger = null;
        const current = record();
        if (!current) return;
        void adapter.entLedger({ enterpriseId: current.id, workerId: node.id }).then((res) => {
          state.inspector.workerLedger = res.ok ? res.value : [];
          renderPreservingFocus();
        });
      });
      ledgerBtn.dataset['focusKey'] = `worker-ledger-${node.id}`;
      controlsCell.append(ledgerBtn);
      seatCell.append(controlsCell);

      table.append(
        tableRow([
          `${node.title} (${node.id})`,
          `${node.kind} · depth ${node.depth}`,
          roomSel,
          parentSel,
          seatCell,
        ]),
      );
    }
    host.append(table);

    if (state.inspector.workerId) {
      const ledgerBox = el('div', 'ent-worker-ledger');
      ledgerBox.append(el('h4', '', `Ledger for ${state.inspector.workerId} (filtered)`));
      const list = state.inspector.workerLedger;
      if (list === null) {
        ledgerBox.append(el('p', 'muted', 'Loading…'));
      } else if (list.length === 0) {
        ledgerBox.append(el('p', 'muted', 'No ledger entries for this employee.'));
      } else {
        const ul = el('ul', 'ent-ledger-bullets');
        for (const e of [...list].reverse()) {
          const li = el('li', 'ent-ledger-row');
          li.append(el('span', 'ent-ledger-seq', `#${e.seq} `));
          li.append(badgeForStatus(e.status));
          li.append(el('span', 'muted', ` ${e.kind} · prompt sha ${short(e.promptSha256)}`));
          if (e.intendedAsk) li.append(el('p', 'ent-ledger-ask', `ask: ${e.intendedAsk}`));
          if (e.returnedSummary) li.append(el('p', 'muted', `returned: ${e.returnedSummary.slice(0, 160)}`));
          ul.append(li);
        }
        ledgerBox.append(ul);
      }
      host.append(ledgerBox);
    }
  }

  function openWorkerEditDialog(workerId: string, title: string, currentOverride: { instructions?: string; budget?: Partial<BudgetLimits> } | null): void {
    const current = record();
    if (!current) return;
    const backdrop = el('div', 'modal-backdrop hidden');
    const dialog = el('div', 'modal');
    dialog.append(el('h2', '', `Next-run override for ${title}`));
    dialog.append(el('p', 'muted', `Employee ${workerId} in ${state.inspector.companyKey} — takes effect on the next run for this worker. Recorded under enterprise v${current.version}.`));
    const instructions = el('textarea', 'ent-instructions') as HTMLTextAreaElement;
    instructions.value = currentOverride?.instructions ?? '';
    instructions.rows = 4;
    instructions.setAttribute('aria-label', 'Next-run instructions');
    const tokInput = inputEl({ type: 'number', ariaLabel: 'Next-run max tokens', value: currentOverride?.budget?.maxTokens ? String(currentOverride.budget.maxTokens) : '' });
    const minInput = inputEl({ type: 'number', ariaLabel: 'Next-run max minutes', value: currentOverride?.budget?.maxMinutes ? String(currentOverride.budget.maxMinutes) : '' });
    const usdInput2 = inputEl({ type: 'number', ariaLabel: 'Next-run max USD', value: currentOverride?.budget?.maxUsd ? String(currentOverride.budget.maxUsd) : '' });
    usdInput2.step = '0.01';
    dialog.append(
      labeled('Instructions', instructions),
      labeled('Max tokens', tokInput),
      labeled('Max minutes', minInput),
      labeled('Max USD', usdInput2),
    );
    const actions = el('div', 'row dialog-actions');
    const controller = overlay.attachDialog(backdrop);
    actions.append(
      button('secondary', 'Cancel', () => controller.close()),
      button('', 'Save override', () => {
        const budget: Partial<BudgetLimits> = {};
        if (tokInput.value) budget.maxTokens = Math.max(1, Math.round(Number(tokInput.value)));
        if (minInput.value) budget.maxMinutes = Math.max(0.001, Number(minInput.value));
        if (usdInput2.value) budget.maxUsd = Math.max(0, Number(usdInput2.value));
        void adapter
          .entWorkerUpdate({
            enterpriseId: current.id,
            expectedVersion: current.version,
            op: 'edit',
            companyKey: state.inspector.companyKey,
            workerId,
            instructions: instructions.value,
            budget,
          })
          .then(async (res) => {
            if (!res.ok) toastError('Edit failed', res.error);
            else overlay.toast('Next-run override recorded (applies on the next run).', { kind: 'ok' });
            controller.close();
            await afterMutation();
          });
      }),
    );
    dialog.append(actions);
    backdrop.append(dialog);
    shell.append(backdrop);
    controller.open();
  }

  // ---------------------------------------------------------------- render

  function renderAll(): void {
    const rec = record();
    availability = deriveActionAvailability(rec, state.contracts);
    clear(shell);
    renderHeader(shell);
    if (state.unavailable) return;
    renderPortfolio(shell);
    if (!rec) return;
    renderBlueprint(shell);
    renderApprovals(shell);
    renderGraph(shell);
    renderCompanies(shell);
    renderProgram(shell);
    renderContracts(shell);
    renderMemory(shell);
    renderLedger(shell);
    renderTimeline(shell);
    renderStewards(shell);
    renderInspector(shell);
  }

  return {
    async show() {
      renderAll();
      await refresh();
      unsubscribe = adapter.onEnterpriseEvent(() => {
        scheduleRefresh();
      });
    },
    hide() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (coalesceTimer !== null) {
        window.clearTimeout(coalesceTimer);
        coalesceTimer = null;
      }
    },
    renderAll,
    state: () => state,
    donna,
    destroy() {
      this.hide();
      donna.destroy();
      shell.remove();
    },
  };
}
