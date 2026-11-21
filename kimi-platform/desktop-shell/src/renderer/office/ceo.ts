/**
 * v0.5 CEO Portfolio view: enterprise → company → department → worker graph
 * with canonical list parity, contract approvals/leases, approval-gated
 * shared memory, program budget/concurrency/run controls, the token-free
 * work ledger + timeline index, per-employee inspector controls, and
 * deterministic steward recommendations (labeled: no provider calls).
 *
 * Everything renders from bridge data; unavailable states are honest
 * ("requires desktop 0.5 runtime") and every visible control is wired.
 */

import { el, clear, button, badgeForStatus, svgEl } from './dom.js';
import type { OverlayHost } from './overlay.js';
import type { BridgeAdapter } from './bridge.js';
import { UNAVAILABLE_V5 } from './bridge.js';
import type {
  ArtifactRef,
  CreateEnterpriseRequest,
  EnterpriseBlueprintPreviewDto,
  EnterpriseContractDto,
  EnterpriseRecordDto,
  EnterpriseSnapshotDto,
  EnterpriseSummaryDto,
  WorkLedgerEntry,
  TimelineIndexEntry,
} from './entTypes.js';
import type { Project } from './types.js';

export interface CeoAppDeps {
  root: HTMLElement;
  adapter: BridgeAdapter;
  overlay: OverlayHost;
  /** Deep-link into the existing office view for a company project. */
  openProject: (projectId: string) => void;
}

export interface CeoApp {
  show(): Promise<void>;
  hide(): void;
  /** Test hook: re-render from current state. */
  renderAll(): void;
  state(): Readonly<CeoState>;
  destroy(): void;
}

interface CeoState {
  enterprises: EnterpriseSummaryDto[];
  selectedId: string | null;
  snapshot: EnterpriseSnapshotDto | null;
  contracts: EnterpriseContractDto[];
  ledger: WorkLedgerEntry[];
  ledgerFilter: { companyKey: string; workerId: string };
  timeline: { entries: TimelineIndexEntry[]; nextIndex: number };
  preview: EnterpriseBlueprintPreviewDto | null;
  inspector: { companyKey: string; project: Project | null };
  notice: string | null;
  unavailable: boolean;
}

const BUDGET_DEFAULTS = { maxTokens: 200_000, maxCalls: 60, maxMinutes: 120, maxCostUsdMicros: 5_000_000 };

export function createCeoApp(deps: CeoAppDeps): CeoApp {
  const { root, adapter, overlay, openProject } = deps;
  const state: CeoState = {
    enterprises: [],
    selectedId: null,
    snapshot: null,
    contracts: [],
    ledger: [],
    ledgerFilter: { companyKey: '', workerId: '' },
    timeline: { entries: [], nextIndex: 0 },
    preview: null,
    inspector: { companyKey: '', project: null },
    notice: null,
    unavailable: false,
  };
  let unsubscribe: (() => void) | null = null;
  let refreshSeq = 0;

  const shell = el('div', 'ceo-shell');
  root.append(shell);

  function record(): EnterpriseRecordDto | null {
    return state.snapshot?.record ?? null;
  }

  function toastError(prefix: string, error: string): void {
    overlay.toast(`${prefix}: ${error}`, { kind: 'error' });
  }

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
    if (!state.selectedId) {
      state.snapshot = null;
      state.contracts = [];
      state.ledger = [];
      return;
    }
    const id = state.selectedId;
    const [snap, contracts] = await Promise.all([adapter.entSnapshot(id), adapter.entContracts(id)]);
    if (seq !== refreshSeq) return;
    state.snapshot = snap.ok ? snap.value : null;
    state.contracts = contracts.ok ? contracts.value : [];
    await refreshLedger();
  }

  async function refreshLedger(): Promise<void> {
    if (!state.selectedId) {
      state.ledger = [];
      return;
    }
    const res = await adapter.entLedger({
      enterpriseId: state.selectedId,
      ...(state.ledgerFilter.companyKey ? { companyKey: state.ledgerFilter.companyKey } : {}),
      ...(state.ledgerFilter.workerId ? { workerId: state.ledgerFilter.workerId } : {}),
    });
    state.ledger = res.ok ? res.value : [];
  }

  async function refresh(): Promise<void> {
    await refreshEnterprises();
    await refreshSelected();
    renderAll();
  }

  // ---------------------------------------------------------------- header

  function renderHeader(container: HTMLElement): void {
    const bar = el('div', 'ceo-header row');
    bar.append(el('h2', '', 'CEO Portfolio'));
    const rec = record();
    if (rec) {
      bar.append(el('span', 'muted', `${rec.name} · v${rec.version} · ${rec.state}`));
      if (rec.program) bar.append(badgeForStatus(rec.programPaused ? 'paused' : rec.program.state));
    }
    bar.append(
      button('secondary', 'Refresh', () => {
        void refresh();
      }),
    );
    container.append(bar);
    if (state.unavailable) {
      container.append(
        el('p', 'status warn', `CEO mode is unavailable on this runtime (${UNAVAILABLE_V5}). The rest of the shell is unaffected.`),
      );
    } else if (state.notice) {
      container.append(el('p', 'status error', state.notice));
    }
  }

  // ------------------------------------------------------- enterprise list

  function renderPortfolio(container: HTMLElement): void {
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Enterprises'));
    const list = el('div', 'ceo-ent-list');
    if (state.enterprises.length === 0) {
      list.append(el('p', 'muted', 'No enterprises yet. Create one below to preview a blueprint.'));
    }
    for (const ent of state.enterprises) {
      const row = el('div', `ceo-ent-row${ent.id === state.selectedId ? ' selected' : ''}`);
      row.tabIndex = 0;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', ent.id === state.selectedId ? 'true' : 'false');
      row.append(el('strong', '', ent.name));
      row.append(el('span', 'muted', ` ${ent.companyCount} companies · ${ent.departmentCount} departments · ${ent.contractCount} seats`));
      if (ent.programState) row.append(badgeForStatus(ent.programPaused ? 'paused' : ent.programState));
      const choose = (): void => {
        state.selectedId = ent.id;
        state.timeline = { entries: [], nextIndex: 0 };
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

    // create form
    const form = el('form', 'ceo-create-form') as HTMLFormElement;
    form.append(el('h4', '', 'New enterprise (creative_technology_group)'));
    const grid = el('div', 'ceo-form-grid');
    const nameInput = el('input', '') as HTMLInputElement;
    nameInput.placeholder = 'Enterprise name';
    nameInput.maxLength = 120;
    nameInput.required = true;
    const idInput = el('input', '') as HTMLInputElement;
    idInput.placeholder = 'program id (kebab-case, e.g. ctg-001)';
    idInput.required = true;
    const missionInput = el('input', '') as HTMLInputElement;
    missionInput.placeholder = 'Mission';
    missionInput.required = true;
    const providerSel = el('select', '') as HTMLSelectElement;
    for (const p of ['openai', 'anthropic', 'ollama']) providerSel.append(new Option(p, p));
    const modelInput = el('input', '') as HTMLInputElement;
    modelInput.placeholder = 'model (e.g. gpt-4o-mini)';
    modelInput.required = true;
    const budgetInput = el('input', '') as HTMLInputElement;
    budgetInput.type = 'number';
    budgetInput.min = '1';
    budgetInput.value = String(BUDGET_DEFAULTS.maxCostUsdMicros / 1e6);
    budgetInput.title = 'Cost envelope (USD)';
    budgetInput.setAttribute('aria-label', 'Cost envelope in USD');
    const concInput = el('input', '') as HTMLInputElement;
    concInput.type = 'number';
    concInput.min = '1';
    concInput.max = '4';
    concInput.value = '2';
    concInput.title = 'Max concurrent company runs (1-4)';
    concInput.setAttribute('aria-label', 'Max concurrent company runs');
    grid.append(
      labeled('Name', nameInput),
      labeled('Program id', idInput),
      labeled('Mission', missionInput),
      labeled('Provider', providerSel),
      labeled('Model', modelInput),
      labeled('Envelope USD', budgetInput),
      labeled('Concurrency', concInput),
    );
    form.append(grid);
    form.append(
      button('', 'Create enterprise', () => undefined), // submit handler below
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const usd = Number(budgetInput.value);
      const req: CreateEnterpriseRequest = {
        preset: 'creative_technology_group',
        programId: idInput.value.trim(),
        name: nameInput.value.trim(),
        mission: missionInput.value.trim(),
        budget: {
          maxTokens: BUDGET_DEFAULTS.maxTokens,
          maxCalls: BUDGET_DEFAULTS.maxCalls,
          maxMinutes: BUDGET_DEFAULTS.maxMinutes,
          maxCostUsdMicros: Math.max(1, Math.round(usd * 1e6)),
        },
        maxConcurrentRuns: Math.max(1, Math.min(4, Number(concInput.value) || 2)),
        provider: providerSel.value as CreateEnterpriseRequest['provider'],
        model: modelInput.value.trim(),
      };
      void adapter.entCreate(req).then(async (res) => {
        if (!res.ok) {
          toastError('Create failed', res.error);
          return;
        }
        overlay.toast(res.value.created ? 'Enterprise created.' : 'Enterprise already existed (idempotent create).', { kind: 'ok' });
        state.selectedId = res.value.record.id;
        await refresh();
      });
    });
    section.append(form);
    container.append(section);
  }

  function labeled(labelText: string, input: HTMLElement): HTMLElement {
    const wrap = el('label', 'ceo-field');
    wrap.append(el('span', 'muted', labelText));
    wrap.append(input);
    return wrap;
  }

  // --------------------------------------------------------- blueprint flow

  function renderBlueprint(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Blueprint'));
    if (rec.blueprintHash) {
      section.append(el('p', 'muted', `Applied blueprint sha256 ${rec.blueprintHash.slice(0, 16)}… · ${rec.blueprint?.companies.length ?? 0} companies, ${rec.blueprint?.departments.length ?? 0} departments, ${rec.blueprint?.contracts.length ?? 0} contracts.`));
    } else {
      section.append(el('p', 'muted', 'No blueprint applied yet. Preview → approve activation → confirm → apply.'));
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
        renderAll();
      });
    });
    section.append(previewBtn);

    if (state.preview) {
      const p = state.preview;
      const box = el('div', 'ceo-preview');
      box.append(el('p', '', `Preview pins blueprint ${p.blueprintHash.slice(0, 16)}… (payload ${p.payloadHash.slice(0, 12)}…). Materializes ${p.blueprint.companies.length} company projects + ${p.blueprint.departments.length} shared-service departments.`));
      const unstaffed = p.blueprint.contracts.filter((c) => !c.staffed);
      if (unstaffed.length > 0) {
        box.append(el('p', 'status warn', `${unstaffed.length} seat(s) are unstaffed until their skill packs land: ${unstaffed.map((c) => c.key).join(', ')}`));
      }
      const approvalRow = el('div', 'row');
      if (p.approval.status === 'pending') {
        approvalRow.append(el('span', 'muted', 'Blueprint-activation approval pending.'));
        approvalRow.append(
          button('', 'Approve activation', () => {
            const current = record();
            if (!current) return;
            void adapter
              .entApprovalDecide({ enterpriseId: current.id, approvalId: p.approval.id, decision: 'approved', payloadHash: p.payloadHash })
              .then(async (res) => {
                if (!res.ok) toastError('Approval failed', res.error);
                await refreshSelected();
                state.preview = null;
                renderAll();
              });
          }),
        );
        approvalRow.append(
          button('secondary', 'Reject', () => {
            const current = record();
            if (!current) return;
            void adapter
              .entApprovalDecide({ enterpriseId: current.id, approvalId: p.approval.id, decision: 'rejected', payloadHash: p.payloadHash })
              .then(async () => {
                await refreshSelected();
                state.preview = null;
                renderAll();
              });
          }),
        );
      } else {
        approvalRow.append(badgeForStatus(p.approval.status));
      }
      box.append(approvalRow);

      if (p.approval.status === 'approved') {
        const confirmLabel = el('label', 'row ceo-confirm');
        const confirmBox = el('input', '') as HTMLInputElement;
        confirmBox.type = 'checkbox';
        confirmLabel.append(confirmBox, el('span', '', 'I confirm materializing this exact pinned blueprint.'));
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
              else overlay.toast('Blueprint materialized: companies, departments and seats created.', { kind: 'ok' });
              state.preview = null;
              await refresh();
            });
        });
        applyBtn.disabled = !confirmBox.checked;
        confirmBox.addEventListener('change', () => {
          applyBtn.disabled = !confirmBox.checked;
        });
        box.append(applyBtn);
      }
      section.append(box);
    }
    container.append(section);
  }

  // ------------------------------------------------------------ graph+lists

  function renderGraph(container: HTMLElement): void {
    const view = state.snapshot?.view;
    if (!view) return;
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Org graph (graph ⇄ list parity)'));
    const columns: Array<[string, string]> = [
      ['company', 'Companies'],
      ['department', 'Departments'],
      ['contract', 'Contract seats'],
    ];
    const colWidth = 240;
    const rowHeight = 30;
    const positions = new Map<string, { x: number; y: number }>();
    const svg = svgEl('svg', { class: 'ceo-graph', role: 'img', 'aria-label': 'Enterprise org graph' });
    const maxRows = Math.max(...columns.map(([kind]) => view.graph.nodes.filter((n) => n.kind === kind).length), 1);
    svg.setAttribute('viewBox', `0 0 ${columns.length * colWidth} ${(maxRows + 1) * rowHeight}`);
    columns.forEach(([kind], col) => {
      view.graph.nodes
        .filter((n) => n.kind === kind)
        .forEach((n, row) => positions.set(n.key, { x: col * colWidth + 10, y: row * rowHeight + 24 }));
    });
    for (const edge of view.graph.edges) {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) continue;
      svg.append(
        svgEl('line', {
          x1: String(from.x + 8),
          y1: String(from.y + 8),
          x2: String(to.x + 8),
          y2: String(to.y + 8),
          class: `ceo-edge ceo-edge-${edge.kind}`,
        }),
      );
    }
    for (const node of view.graph.nodes) {
      const pos = positions.get(node.key);
      if (!pos) continue;
      const g = svgEl('g', { class: `ceo-node ceo-node-${node.kind}`, 'data-key': node.key });
      g.append(svgEl('rect', { x: String(pos.x), y: String(pos.y), width: '210', height: '20', rx: '4' }));
      const label = svgEl('text', { x: String(pos.x + 6), y: String(pos.y + 14) });
      label.textContent = node.label.length > 30 ? `${node.label.slice(0, 29)}…` : node.label;
      g.append(label);
      const title = svgEl('title', {});
      title.textContent = `${node.kind}: ${node.label}${node.status ? ` (${node.status})` : ''}`;
      g.append(title);
      svg.append(g);
    }
    section.append(svg);

    // canonical lists (same derivation as the graph — parity by construction)
    const lists = el('div', 'ceo-lists row');
    for (const [kind, title] of columns) {
      const col = el('div', 'ceo-list-col');
      col.append(el('h4', '', title));
      const rows =
        kind === 'company' ? view.lists.companies : kind === 'department' ? view.lists.departments : view.lists.contracts;
      const ul = el('ul', 'ceo-plain-list');
      for (const row of rows) {
        const key = 'key' in row ? row.key : '';
        const li = el('li', '', `${key}`);
        li.dataset['key'] = key;
        ul.append(li);
      }
      col.append(ul);
      lists.append(col);
    }
    section.append(lists);
    container.append(section);
  }

  // --------------------------------------------------------- company cards

  function renderCompanies(container: HTMLElement): void {
    const rec = record();
    const view = state.snapshot?.view;
    if (!rec || !view) return;
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Companies'));
    const grid = el('div', 'ceo-company-grid');
    for (const company of view.lists.companies) {
      const card = el('article', 'ceo-company-card');
      card.append(el('h4', '', company.name));
      card.append(el('p', 'muted', `${company.kind} · capacity ${company.capacityShare} · ${company.disciplines.join(', ') || 'shared'}`));
      const run = rec.program?.companyRuns.find((cr) => cr.companyKey === company.key);
      if (run) {
        card.append(badgeForStatus(run.status === 'stopped' ? 'inactive' : run.status));
        if (run.runId) card.append(el('span', 'muted', ` run ${run.runId.slice(0, 12)}…`));
      }
      const link = rec.companies[company.key];
      if (link) {
        card.append(
          button('secondary', 'Open office', () => openProject(link.projectId)),
        );
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
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Program'));
    const program = rec.program;
    if (!program) {
      section.append(el('p', 'muted', 'Apply a blueprint to create the program.'));
      container.append(section);
      return;
    }
    const info = el('p', 'muted',
      `state ${program.state}${rec.programPaused ? ' (paused)' : ''} · concurrency ${program.maxConcurrentRuns} (max 4) · ` +
        `envelope ${program.budget.maxTokens} tok / ${program.budget.maxCalls} calls / ${program.budget.maxMinutes} min / $${(program.budget.maxCostUsdMicros / 1e6).toFixed(2)}`);
    section.append(info);

    // plan approval gate
    const plan = rec.approvals.find((a) => a.kind === 'plan' && a.blueprintHash === program.blueprintHash);
    if (plan && program.state === 'awaiting_plan_approval') {
      const row = el('div', 'row');
      row.append(el('span', 'muted', `Plan approval ${plan.status}.`));
      if (plan.status === 'pending') {
        row.append(
          button('', 'Approve plan', () => {
            void adapter
              .entApprovalDecide({ enterpriseId: rec.id, approvalId: plan.id, decision: 'approved', payloadHash: plan.payloadHash })
              .then(async (res) => {
                if (!res.ok) toastError('Plan approval failed', res.error);
                await refreshSelected();
                renderAll();
              });
          }),
        );
      }
      section.append(row);
    }

    const controls = el('div', 'row ceo-program-controls');
    const startBtn = button('', 'Start', () => {
      const current = record();
      if (!current) return;
      void adapter.entProgramStart({ enterpriseId: current.id, expectedVersion: current.version }).then(async (res) => {
        if (!res.ok) toastError('Start failed', res.error);
        await refreshSelected();
        renderAll();
      });
    });
    startBtn.disabled = program.state !== 'awaiting_plan_approval' || plan?.status !== 'approved';
    if (startBtn.disabled) startBtn.title = 'Requires an approved plan approval (and awaiting_plan_approval state).';
    const pauseBtn = button('secondary', 'Pause', () => void programAction('pause'));
    pauseBtn.disabled = rec.programPaused || !['dispatching', 'running', 'reconciling'].includes(program.state);
    const resumeBtn = button('secondary', 'Resume', () => void programAction('resume'));
    resumeBtn.disabled = !rec.programPaused;
    const stopBtn = button('danger', 'Stop', () => {
      void overlay
        .confirm({ title: 'Stop program', message: 'Cancel all company runs and settle the program as stopped by you?', confirmLabel: 'Stop program', danger: true })
        .then((yes) => {
          if (yes) void programAction('cancel');
        });
    });
    stopBtn.disabled = !['dispatching', 'running', 'reconciling'].includes(program.state);
    const pumpBtn = button('secondary', 'Pump dispatch', () => {
      void adapter.entProgramPump(rec.id).then(async (res) => {
        if (!res.ok) toastError('Pump failed', res.error);
        else overlay.toast(`Dispatch pump: ${res.value.dispatched} run(s) dispatched.`, { kind: 'info' });
        await refreshSelected();
        renderAll();
      });
    });
    controls.append(startBtn, pauseBtn, resumeBtn, stopBtn, pumpBtn);
    section.append(controls);

    const enterpriseId = rec.id;
    function programAction(op: 'pause' | 'resume' | 'cancel'): Promise<void> {
      const call =
        op === 'pause' ? adapter.entProgramPause(enterpriseId) : op === 'resume' ? adapter.entProgramResume(enterpriseId) : adapter.entProgramCancel(enterpriseId);
      return call.then(async (res) => {
        if (!res.ok) toastError(`${op} failed`, res.error);
        await refreshSelected();
        renderAll();
      });
    }

    const runs = el('ul', 'ceo-plain-list');
    for (const cr of program.companyRuns) {
      const li = el('li', '');
      li.append(el('span', '', cr.companyKey));
      li.append(badgeForStatus(cr.status));
      if (cr.runId) li.append(el('span', 'muted', ` ${cr.runId.slice(0, 16)}…`));
      runs.append(li);
    }
    section.append(runs);
    container.append(section);
  }

  // ------------------------------------------------------------- contracts

  function renderContracts(container: HTMLElement): void {
    const rec = record();
    if (!rec || state.contracts.length === 0) return;
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Cross-office contracts & seat leases'));
    const table = el('table', 'ceo-table');
    table.append(
      tableRow(['Contract', 'Status', 'Staffed', 'Capacity', 'Lease (run · fence)', 'Actions'], true),
    );
    for (const c of state.contracts) {
      const cells: Array<HTMLElement | string> = [
        el('span', 'mono', c.key),
        badgeForStatus(c.status),
        c.staffed ? 'yes' : 'unstaffed',
        c.capacityShare.toFixed(2),
        c.lease ? `${c.lease.runId.slice(0, 12)}… · #${c.lease.fence} (${c.lease.status})` : '—',
      ];
      const actions = el('span', 'row');
      if (c.status === 'proposed') {
        actions.append(
          button('', 'Activate', () => void contractDecide(c.key, 'approved')),
          button('secondary', 'Reject', () => void contractDecide(c.key, 'rejected')),
        );
      }
      if (c.status === 'active' || c.status === 'draining') {
        actions.append(
          button('secondary', 'Release', () => {
            void overlay
              .confirm({
                title: 'Release contract',
                message: `Release "${c.key}"? A live seat lease drains first, then the contract is released.`,
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
                    await refreshSelected();
                    renderAll();
                  });
              });
          }),
        );
        // worker capacity + suspend/resume controls
        const capInput = el('input', 'ceo-cap-input') as HTMLInputElement;
        capInput.type = 'number';
        capInput.min = '0.05';
        capInput.max = '1';
        capInput.step = '0.05';
        capInput.value = c.capacityShare.toFixed(2);
        capInput.setAttribute('aria-label', `Capacity share for ${c.key}`);
        actions.append(
          capInput,
          button('secondary', 'Set capacity', () => {
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
                await refreshSelected();
                renderAll();
              });
          }),
        );
        if (c.status === 'active') {
          actions.append(
            button('secondary', 'Suspend', () => void workerSuspend(c.key, true)),
          );
        } else {
          actions.append(button('secondary', 'Resume seat', () => void workerSuspend(c.key, false)));
        }
      }
      cells.push(actions);
      table.append(tableRow(cells));
    }
    section.append(table);
    container.append(section);

    function contractDecide(key: string, decision: 'approved' | 'rejected'): Promise<void> {
      const current = record();
      if (!current) return Promise.resolve();
      return adapter
        .entContractDecide({ enterpriseId: current.id, contractKey: key, decision, expectedVersion: current.version })
        .then(async (res) => {
          if (!res.ok) toastError('Contract decision failed', res.error);
          await refreshSelected();
          renderAll();
        });
    }

    function workerSuspend(key: string, suspended: boolean): Promise<void> {
      const current = record();
      if (!current) return Promise.resolve();
      return adapter
        .entWorkerUpdate({ enterpriseId: current.id, expectedVersion: current.version, op: suspended ? 'suspend' : 'resume', contractKey: key })
        .then(async (res) => {
          if (!res.ok) toastError(suspended ? 'Suspend failed' : 'Resume failed', res.error);
          await refreshSelected();
          renderAll();
        });
    }
  }

  // ---------------------------------------------------------------- memory

  function renderMemory(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Shared memory (ref-only · promote is approval-gated)'));
    const searchRow = el('div', 'row');
    const searchInput = el('input', '') as HTMLInputElement;
    searchInput.placeholder = 'Search titles/summaries…';
    searchInput.setAttribute('aria-label', 'Search shared memory');
    searchRow.append(
      searchInput,
      button('secondary', 'Search', () => {
        void adapter.entMemorySearch(rec.id, searchInput.value).then(async (res) => {
          if (!res.ok) {
            toastError('Search failed', res.error);
            return;
          }
          renderMemoryList(listHost, res.value);
        });
      }),
      button('secondary', 'Show all', () => {
        void adapter.entMemory(rec.id, true).then((res) => {
          if (res.ok) renderMemoryList(listHost, res.value);
        });
      }),
    );
    section.append(searchRow);
    const listHost = el('div', 'ceo-memory-list');
    section.append(listHost);
    container.append(section);
    void adapter.entMemory(rec.id, true).then((res) => {
      if (res.ok) renderMemoryList(listHost, res.value);
    });

    function renderMemoryList(host: HTMLElement, entries: EnterpriseRecordDto['memory']): void {
      clear(host);
      if (entries.length === 0) {
        host.append(el('p', 'muted', 'No memory entries. Promote a returned artifact from the ledger below.'));
        return;
      }
      for (const m of entries) {
        const row = el('div', 'ceo-memory-row');
        row.append(el('strong', '', m.entry.artifact.title));
        row.append(badgeForStatus(m.status));
        row.append(el('span', 'muted', ` ${m.entry.scope}:${m.entry.scopeKey} · sha ${m.entry.artifact.contentSha256.slice(0, 12)}…`));
        row.append(el('p', 'muted', m.entry.artifact.summary.slice(0, 240)));
        if (m.status === 'promoted') {
          row.append(
            button('secondary', 'Revoke', () => {
              const current = record();
              if (!current) return;
              void adapter
                .entMemoryRevoke({
                  enterpriseId: current.id,
                  scope: m.entry.scope,
                  scopeKey: m.entry.scopeKey,
                  artifactId: m.entry.artifact.artifactId,
                  expectedVersion: current.version,
                })
                .then(async (res) => {
                  if (!res.ok) toastError('Revoke failed', res.error);
                  await refreshSelected();
                  renderAll();
                });
            }),
          );
        }
        host.append(row);
      }
    }
  }

  // ---------------------------------------------------------------- ledger

  function renderLedger(container: HTMLElement): void {
    const rec = record();
    const view = state.snapshot?.view;
    if (!rec || !view) return;
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Work ledger (token-free · derived from runs & artifacts)'));
    const filters = el('div', 'row ceo-ledger-filters');
    const companySel = el('select', '') as HTMLSelectElement;
    companySel.append(new Option('All companies', ''));
    for (const c of view.lists.companies) companySel.append(new Option(c.name, c.key));
    companySel.value = state.ledgerFilter.companyKey;
    companySel.setAttribute('aria-label', 'Filter ledger by company');
    const workerInput = el('input', '') as HTMLInputElement;
    workerInput.placeholder = 'worker id (e.g. node-5)';
    workerInput.value = state.ledgerFilter.workerId;
    workerInput.setAttribute('aria-label', 'Filter ledger by worker');
    filters.append(
      companySel,
      workerInput,
      button('secondary', 'Apply filters', () => {
        state.ledgerFilter = { companyKey: companySel.value, workerId: workerInput.value.trim() };
        void refreshLedger().then(renderAll);
      }),
      button('secondary', 'Export HANDOFFS + ledger', () => {
        void adapter.entExport(rec.id).then((res) => {
          if (!res.ok) toastError('Export failed', res.error);
          else overlay.toast(`Exported ${res.value.files.join(', ')} → ${res.value.dir}`, { kind: 'ok', durationMs: 8000 });
        });
      }),
    );
    section.append(filters);

    if (state.ledger.length === 0) {
      section.append(el('p', 'muted', 'No ledger entries yet. Entries appear as company runs progress — no provider summaries, ever.'));
    } else {
      const table = el('table', 'ceo-table ceo-ledger-table');
      table.append(tableRow(['#', 'Time', 'Company', 'Worker', 'Kind', 'Status', 'Intended ask', 'Prompt sha', 'Returned (extractive)', 'Usage', ''], true));
      for (const e of state.ledger.slice(-200)) {
        const usage = e.usage ? `${e.usage.inputTokens}+${e.usage.outputTokens} tok · $${(e.usage.costUsdMicros / 1e6).toFixed(4)}` : '—';
        const promoteCell = el('span', '');
        if (e.kind === 'returned' && e.artifactRef) {
          const ref: ArtifactRef = e.artifactRef;
          promoteCell.append(
            button('secondary', 'Promote', () => {
              const current = record();
              if (!current) return;
              void adapter
                .entMemoryPromote({ enterpriseId: current.id, artifact: ref, scope: 'enterprise', scopeKey: current.programId, expectedVersion: current.version })
                .then(async (res) => {
                  if (!res.ok) toastError('Promote failed', res.error);
                  else overlay.toast('Promotion requested — approve it in the Approvals panel (ref-only, hash-pinned).', { kind: 'info', durationMs: 6000 });
                  await refreshSelected();
                  renderAll();
                });
            }),
          );
        }
        table.append(
          tableRow([
            String(e.seq),
            new Date(e.ts).toLocaleTimeString(),
            e.companyKey ?? '—',
            e.workerId ?? '—',
            e.kind,
            badgeForStatus(e.status),
            el('span', 'ceo-ask', e.intendedAsk.slice(0, 140)),
            e.promptSha256 ? el('span', 'mono', `${e.promptSha256.slice(0, 12)}…`) : '—',
            el('span', 'ceo-summary', e.returnedSummary.slice(0, 160)),
            usage,
            promoteCell,
          ]),
        );
      }
      section.append(table);
    }
    container.append(section);
  }

  // --------------------------------------------------------------- timeline

  function renderTimeline(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Timeline index'));
    const list = el('ul', 'ceo-plain-list ceo-timeline');
    for (const e of state.timeline.entries) {
      list.append(
        el('li', '', `#${e.seq} ${new Date(e.ts).toLocaleTimeString()} · ${e.kind} · ${e.companyKey ?? '—'} · ${e.workerId ?? '—'}${e.artifactRef ? ` · sha ${e.artifactRef.contentSha256.slice(0, 10)}…` : ''}`),
      );
    }
    if (state.timeline.entries.length === 0) list.append(el('li', 'muted', 'Not loaded yet.'));
    section.append(list);
    const enterpriseId = rec.id;
    section.append(
      button('secondary', state.timeline.nextIndex === 0 ? 'Load timeline' : 'Load more', () => {
        void adapter
          .entTimeline({ enterpriseId, afterIndex: state.timeline.nextIndex, limit: 100 })
          .then((res) => {
            if (!res.ok) {
              toastError('Timeline failed', res.error);
              return;
            }
            state.timeline = { entries: [...state.timeline.entries, ...res.value.entries], nextIndex: res.value.nextIndex };
            renderAll();
          });
      }),
    );
    container.append(section);
  }

  // --------------------------------------------------------------- stewards

  function renderStewards(container: HTMLElement): void {
    const stewards = state.snapshot?.stewards ?? [];
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Steward recommendations'));
    section.append(el('p', 'muted', 'Deterministic system derivations — metadata only, zero provider calls, propose-only (nothing executes itself).'));
    if (stewards.length === 0) {
      section.append(el('p', 'muted', 'No recommendations right now.'));
    }
    for (const s of stewards) {
      const card = el('article', 'ceo-steward-card');
      card.append(el('strong', '', `${s.steward} · ${s.kind}`));
      card.append(badgeForStatus('deterministic'));
      card.append(el('p', '', s.summary));
      if (s.actionId) card.append(el('p', 'muted', `suggested control: ${s.actionId}`));
      section.append(card);
    }
    container.append(section);
  }

  // ---------------------------------------------------- employee inspector

  function renderInspector(container: HTMLElement): void {
    const rec = record();
    const view = state.snapshot?.view;
    if (!rec || !view) return;
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Employee inspector'));
    const sel = el('select', '') as HTMLSelectElement;
    sel.setAttribute('aria-label', 'Company for employee inspector');
    sel.append(new Option('Choose a company…', ''));
    for (const c of view.lists.companies) sel.append(new Option(c.name, c.key));
    sel.value = state.inspector.companyKey;
    sel.addEventListener('change', () => {
      state.inspector.companyKey = sel.value;
      state.inspector.project = null;
      const link = rec.companies[sel.value];
      if (link) {
        void adapter.getProject(link.projectId).then((project) => {
          state.inspector.project = project;
          renderAll();
        });
      } else {
        renderAll();
      }
    });
    section.append(sel);
    const host = el('div', 'ceo-inspector-host');
    section.append(host);
    container.append(section);

    const project = state.inspector.project;
    if (!state.inspector.companyKey) return;
    if (!project) {
      host.append(el('p', 'muted', 'Loading project…'));
      return;
    }
    const table = el('table', 'ceo-table');
    table.append(tableRow(['Worker', 'Room', 'Skill', 'Reassign room', 'Edit for next run'], true));
    for (const node of project.nodes) {
      const roomSel = el('select', '') as HTMLSelectElement;
      roomSel.setAttribute('aria-label', `Room for ${node.title}`);
      for (const room of ['executive', 'research', 'operations', 'qa', 'engineering']) {
        roomSel.append(new Option(room, room));
      }
      roomSel.value = node.roomId ?? 'research';
      const reassignBtn = button('secondary', 'Reassign', () => {
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
          })
          .then(async (res) => {
            if (!res.ok) toastError('Reassign failed', res.error);
            else overlay.toast(`${node.title} reassigned (OCC-checked).`, { kind: 'ok' });
            await refreshSelected();
            const link = record()?.companies[state.inspector.companyKey];
            if (link) state.inspector.project = await adapter.getProject(link.projectId);
            renderAll();
          });
      });
      const instrInput = el('input', '') as HTMLInputElement;
      instrInput.value = node.instructions;
      instrInput.maxLength = 4000;
      instrInput.setAttribute('aria-label', `Instructions for ${node.title} (next run)`);
      const editBtn = button('secondary', 'Save', () => {
        const current = record();
        if (!current) return;
        void adapter
          .entWorkerUpdate({
            enterpriseId: current.id,
            expectedVersion: current.version,
            op: 'edit',
            companyKey: state.inspector.companyKey,
            workerId: node.id,
            instructions: instrInput.value,
          })
          .then(async (res) => {
            if (!res.ok) toastError('Edit failed', res.error);
            else overlay.toast('Saved for the next run.', { kind: 'ok' });
            await refreshSelected();
            renderAll();
          });
      });
      table.append(
        tableRow([
          `${node.title} (${node.id})`,
          node.roomId ?? '—',
          node.skillRef ?? '—',
          el('span', 'row', ),
          instrInput,
        ]),
      );
      // attach controls into the row cells (room select + button)
      const row = table.lastElementChild as HTMLElement;
      (row.children[3] as HTMLElement).append(roomSel, reassignBtn);
      (row.children[4] as HTMLElement).append(editBtn);
    }
    host.append(table);
  }

  // -------------------------------------------------------------- approvals

  function renderApprovals(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const pending = rec.approvals.filter((a) => a.status === 'pending');
    if (pending.length === 0) return;
    const section = el('section', 'ceo-section');
    section.append(el('h3', '', 'Pending approvals'));
    for (const a of pending) {
      const row = el('div', 'row ceo-approval-row');
      row.append(el('strong', '', a.kind));
      row.append(el('span', 'muted', ` payload ${a.payloadHash.slice(0, 12)}… · requested ${new Date(a.createdAt).toLocaleString()}`));
      row.append(
        button('', 'Approve', () => {
          void adapter
            .entApprovalDecide({ enterpriseId: rec.id, approvalId: a.id, decision: 'approved', payloadHash: a.payloadHash })
            .then(async (res) => {
              if (!res.ok) toastError('Approval failed', res.error);
              await refreshSelected();
              renderAll();
            });
        }),
        button('secondary', 'Reject', () => {
          void adapter
            .entApprovalDecide({ enterpriseId: rec.id, approvalId: a.id, decision: 'rejected', payloadHash: a.payloadHash })
            .then(async (res) => {
              if (!res.ok) toastError('Rejection failed', res.error);
              await refreshSelected();
              renderAll();
            });
        }),
      );
      section.append(row);
    }
    container.append(section);
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

  // ---------------------------------------------------------------- render

  function renderAll(): void {
    clear(shell);
    renderHeader(shell);
    if (state.unavailable) return;
    renderPortfolio(shell);
    if (!record()) return;
    renderBlueprint(shell);
    renderApprovals(shell);
    renderGraph(shell);
    renderCompanies(shell);
    renderProgram(shell);
    renderContracts(shell);
    renderMemory(shell);
    renderLedger(shell);
    renderTimeline(shell);
    renderInspector(shell);
    renderStewards(shell);
  }

  return {
    async show(): Promise<void> {
      if (!unsubscribe) {
        unsubscribe = adapter.onEnterpriseEvent(() => {
          void refresh();
        });
      }
      await refresh();
    },
    hide(): void {
      // state persists for a quick return
    },
    renderAll,
    state: () => state,
    destroy(): void {
      unsubscribe?.();
      unsubscribe = null;
      shell.remove();
    },
  };
}
