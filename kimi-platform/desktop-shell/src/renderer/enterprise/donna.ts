/**
 * v0.6 Donna / shared-assistant drawer for the CEO Portfolio.
 *
 * One drawer, seven tabs (Queue, Hiring, Schedules, Cache, Repositories,
 * Knowledge, Donna Chat) plus a shared typed proposal inbox and the permanent
 * assistant roster. Everything flows through the guarded v6 ast* bridge:
 * against a v5 runtime the drawer degrades to an honest "requires desktop
 * 0.6 runtime" panel and nothing is fabricated renderer-side.
 *
 * Hard rules honored here:
 *  - Proposals are typed: action/actor/scope/risk/payloadHash/OCC
 *    expectedVersion are shown verbatim, policy gates must be explicitly
 *    confirmed by the human (checkboxes) before approval, and execution only
 *    ever runs through astExecute. Donna chat text is parsed into DRAFT
 *    proposals by the backend (astDonnaParse) — never executed renderer-side.
 *  - Fire/archive carry drain+preserve semantics; the UI states it and the
 *    payload reflects it (main re-asserts in code).
 *  - Assistant jobs are deterministic and free: zero budget, no provider
 *    calls, no paid calls, missed runs skipped forward (no storm). The UI
 *    labels this next to every schedule control.
 *  - Repositories: public anonymous metadata only (cap 50), preview shows
 *    confidence/license/archived/quarantine/full SHA; private repos are
 *    directed to the web credentialed mode; only routing-confirmed
 *    "assigned" plans can be applied — never clone, never auto-create
 *    companies/departments/roles.
 *  - Emergency stop is direct (entProgramCancel + chatStop), ungated, and
 *    is NEVER a proposal.
 */

import { badgeForStatus, button, clear, el } from '../office/dom.js';
import type { OverlayHost } from '../office/overlay.js';
import { UNAVAILABLE_V6, type BridgeAdapter, type BridgeResult } from '../office/bridge.js';
import type { EnterpriseRecordDto } from '../office/entTypes.js';
import type { ChatMessage, ChatSession, SkillSummary } from '../office/types.js';
import {
  ASSISTANT_JOB_KINDS,
  ASSISTANT_SCOPES,
  CACHE_NAMESPACES,
  type AssistantActionPolicy,
  type AssistantActionProposal,
  type AssistantCacheStatusDto,
  type AssistantDefinitionsDto,
  type AssistantEventDto,
  type AssistantGate,
  type AssistantJobKind,
  type AssistantQueueItem,
  type AssistantQueueItemKind,
  type AssistantScope,
  type AssistantStateDto,
  type RepoAssignmentPlan,
  type RepositoryMetadata,
} from '../office/astTypes.js';
import { DISCIPLINES } from './actions.js';

export interface DonnaDrawerDeps {
  /** Host element the drawer is appended to (must outlive re-renders). */
  host: HTMLElement;
  adapter: BridgeAdapter;
  overlay: OverlayHost;
  /** Current enterprise record (null when nothing is selected). */
  getRecord: () => EnterpriseRecordDto | null;
  /** Reload the parent CEO surface after assistant mutations. */
  onEnterpriseChanged: () => Promise<void> | void;
  announce?: (message: string) => void;
}

export interface DonnaDrawer {
  open(): Promise<void>;
  close(): void;
  toggle(): Promise<void>;
  isOpen(): boolean;
  /** Reload assistant state + re-render (also the enterprise-event hook). */
  refresh(): Promise<void>;
  /** Test hook: one Donna chat poll cycle. */
  chatPollOnce(): Promise<void>;
  state(): Readonly<DonnaState>;
  destroy(): void;
}

export type DonnaTab = 'queue' | 'hiring' | 'schedules' | 'cache' | 'repositories' | 'knowledge' | 'chat';

export interface DonnaState {
  open: boolean;
  available: boolean;
  tab: DonnaTab;
  scope: AssistantScope;
  scopeKey: string;
  assistant: AssistantStateDto | null;
  definitions: AssistantDefinitionsDto | null;
  cacheStatus: AssistantCacheStatusDto[];
  events: AssistantEventDto[];
  skills: SkillSummary[] | null;
  repoPreview: { metadata: RepositoryMetadata; plan: RepoAssignmentPlan } | null;
  chat: {
    session: ChatSession | null;
    sending: boolean;
    pendingReply: boolean;
    parsed: number;
    dropped: number;
    promptPreview: string | null;
  };
  notice: string | null;
}

const TABS: Array<{ id: DonnaTab; label: string }> = [
  { id: 'queue', label: 'Queue' },
  { id: 'hiring', label: 'Hiring' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'cache', label: 'Cache' },
  { id: 'repositories', label: 'Repositories' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'chat', label: 'Donna Chat' },
];

const COALESCE_MS = 200;
const CHAT_POLL_MS = 900;
const PAYLOAD_PREVIEW_CHARS = 400;
const REPOSITORY_CAP = 50;
const DONNA_BUDGET = { maxTokens: 100_000, maxMinutes: 30, maxUsd: 5 };

function short(sha: string | null | undefined, n = 12): string {
  return sha ? `${sha.slice(0, n)}…` : '—';
}

function fmtTime(epochMs: number | null): string {
  if (epochMs === null) return 'never';
  return new Date(epochMs).toLocaleString();
}

export function createDonnaDrawer(deps: DonnaDrawerDeps): DonnaDrawer {
  const { host, adapter, overlay, getRecord } = deps;
  const announce = deps.announce ?? (() => undefined);

  const state: DonnaState = {
    open: false,
    available: adapter.capabilities.assistant,
    tab: 'queue',
    scope: 'enterprise',
    scopeKey: '',
    assistant: null,
    definitions: null,
    cacheStatus: [],
    events: [],
    skills: null,
    repoPreview: null,
    chat: { session: null, sending: false, pendingReply: false, parsed: 0, dropped: 0, promptPreview: null },
    notice: null,
  };

  let unsubscribe: (() => void) | null = null;
  let coalesceTimer: number | null = null;
  let chatPollTimer: number | null = null;
  let destroyed = false;

  // ------------------------------------------------------------ static shell

  const drawer = el('aside', 'donna-drawer hidden');
  drawer.setAttribute('role', 'complementary');
  drawer.setAttribute('aria-label', 'Donna — CEO executive assistant');
  host.append(drawer);

  function record(): EnterpriseRecordDto | null {
    return getRecord();
  }

  function entId(): string | null {
    return record()?.id ?? null;
  }

  function toastError(prefix: string, error: string): void {
    overlay.toast(`${prefix}: ${error}`, { kind: 'error' });
  }

  function defaultScopeKey(scope: AssistantScope): string {
    const rec = record();
    if (!rec) return '';
    if (scope === 'enterprise') return rec.programId;
    if (scope === 'company') return rec.blueprint?.companies[0]?.key ?? '';
    if (scope === 'department') return rec.blueprint?.departments[0]?.key ?? '';
    return 'executive';
  }

  // ------------------------------------------------------------ data loads

  async function refresh(): Promise<void> {
    if (!state.available) {
      renderAll();
      return;
    }
    const id = entId();
    if (!id) {
      state.assistant = null;
      renderAll();
      return;
    }
    if (!state.definitions) {
      const defs = await adapter.astDefinitions();
      state.definitions = defs.ok ? defs.value : null;
      if (!defs.ok) state.notice = defs.error;
    }
    const [ast, cache, events] = await Promise.all([
      adapter.astGet(id),
      adapter.astCacheStatus(id),
      adapter.astEvents({ enterpriseId: id, afterIndex: 0, limit: 200 }),
    ]);
    if (destroyed) return;
    if (!ast.ok) {
      state.notice = ast.error;
    } else {
      state.notice = null;
      state.assistant = ast.value;
    }
    state.cacheStatus = cache.ok ? cache.value : [];
    state.events = events.ok ? events.value.events : [];
    if (state.skills === null) {
      const skills = await adapter.listSkills();
      if (destroyed) return;
      state.skills = skills.ok ? skills.value : [];
    }
    renderAll();
  }

  /** Coalesce assistant push events into one refetch per window (CEO pattern). */
  function scheduleRefresh(): void {
    if (coalesceTimer !== null) return;
    coalesceTimer = window.setTimeout(() => {
      coalesceTimer = null;
      void refresh();
    }, COALESCE_MS);
  }

  /** Shared mutation path: run, report, reload assistant + enterprise state. */
  async function runMutation(label: string, call: () => Promise<BridgeResult<{ summary: string }>>): Promise<void> {
    const res = await call();
    if (!res.ok) {
      toastError(label, res.error);
      return;
    }
    overlay.toast(`${label}: ${res.value.summary}`, { kind: 'ok' });
    await refresh();
    // Reload the parent CEO surface BEFORE the final render so views that
    // read the enterprise record (seats, lifecycle) see the new state.
    await deps.onEnterpriseChanged();
    renderAll();
  }

  function astVersion(): number {
    return state.assistant?.version ?? 1;
  }

  function entVersion(): number {
    return record()?.version ?? 1;
  }

  function policyFor(action: string): AssistantActionPolicy | null {
    return (state.definitions?.actions as Record<string, AssistantActionPolicy> | undefined)?.[action] ?? null;
  }

  // ------------------------------------------------------- gate confirmation

  /**
   * Inline gate confirmations: one checkbox per policy gate; the action
   * button stays disabled until every required gate is explicitly confirmed.
   */
  function gateBoxes(gates: readonly AssistantGate[], keyPrefix: string): { row: HTMLElement; boxes: HTMLInputElement[] } {
    const row = el('div', 'donna-gates row wrap');
    const boxes: HTMLInputElement[] = [];
    for (const gate of gates) {
      const label = el('label', 'donna-gate');
      const box = el('input', '') as HTMLInputElement;
      box.type = 'checkbox';
      box.dataset['gate'] = gate;
      box.dataset['focusKey'] = `gate-${keyPrefix}-${gate}`;
      label.append(box, el('span', '', gate));
      row.append(label);
      boxes.push(box);
    }
    return { row, boxes };
  }

  function confirmedGates(boxes: HTMLInputElement[]): AssistantGate[] {
    return boxes.filter((b) => b.checked).map((b) => b.dataset['gate'] as AssistantGate);
  }

  function wireGateEnable(btn: HTMLButtonElement, boxes: HTMLInputElement[]): void {
    const update = (): void => {
      btn.disabled = boxes.some((b) => !b.checked);
    };
    for (const b of boxes) b.addEventListener('change', update);
    update();
  }

  // ---------------------------------------------------------------- render

  function renderPreservingFocus(): void {
    const active = document.activeElement;
    const key = active instanceof HTMLElement ? (active.closest<HTMLElement>('[data-focus-key]')?.dataset['focusKey'] ?? null) : null;
    renderAll();
    if (key) drawer.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)?.focus();
  }

  function renderAll(): void {
    clear(drawer);
    renderHead(drawer);
    if (!state.available) {
      drawer.append(
        el(
          'p',
          'status warn',
          `Donna and the shared assistants ${UNAVAILABLE_V6} — this runtime speaks bridge v${adapter.bridgeVersion}. ` +
            'The CEO portfolio, office, and chat tabs keep working; no assistant state is fabricated.',
        ),
      );
      return;
    }
    if (!record()) {
      drawer.append(el('p', 'muted', 'Select an enterprise in the CEO Portfolio to work with Donna.'));
      return;
    }
    renderScope(drawer);
    renderAgents(drawer);
    renderTabs(drawer);
    renderInbox(drawer);
    const body = el('div', 'donna-body');
    switch (state.tab) {
      case 'queue':
        renderQueue(body);
        break;
      case 'hiring':
        renderHiring(body);
        break;
      case 'schedules':
        renderSchedules(body);
        break;
      case 'cache':
        renderCache(body);
        break;
      case 'repositories':
        renderRepositories(body);
        break;
      case 'knowledge':
        renderKnowledge(body);
        break;
      case 'chat':
        renderChat(body);
        break;
    }
    drawer.append(body);
    renderEvents(drawer);
  }

  function renderHead(container: HTMLElement): void {
    const head = el('div', 'donna-head row');
    head.append(el('h3', '', 'Donna'));
    head.append(el('span', 'muted', 'CEO executive assistant'));
    const pending = (state.assistant?.proposals ?? []).filter((p) => p.status === 'proposed').length;
    if (pending > 0) head.append(el('span', 'badge pass', `${pending} proposal(s) awaiting review`));
    const stopBtn = button('danger', 'Emergency stop', () => void emergencyStop());
    stopBtn.dataset['focusKey'] = 'donna-emergency-stop';
    stopBtn.title = 'Direct and ungated: cancels the program and any pending Donna reply. Never a proposal.';
    const closeBtn = button('secondary', 'Close', () => controller.close());
    closeBtn.dataset['focusKey'] = 'donna-close';
    head.append(stopBtn, closeBtn);
    container.append(head);
    if (state.notice) container.append(el('p', 'status error', state.notice));
  }

  /** Emergency stop: DIRECT existing cancels only — never a proposal. */
  async function emergencyStop(): Promise<void> {
    const rec = record();
    if (!rec) return;
    const ok = await overlay.confirm({
      title: 'Emergency stop',
      message:
        `Immediately cancel the "${rec.name}" program and stop any pending Donna reply. ` +
        'This is the direct, ungated stop path — it never travels the proposal pipeline and nothing is drained implicitly.',
      detail: 'In-flight company runs are cancelled through the existing program cancel; the Donna chat stop uses the existing chat stop.',
      confirmLabel: 'Stop everything now',
      danger: true,
    });
    if (!ok) return;
    const res = await adapter.entProgramCancel(rec.id);
    if (!res.ok) {
      toastError('Emergency stop failed', res.error);
      return;
    }
    if (state.chat.session) await adapter.chatStop(state.chat.session.id);
    announce('Emergency stop issued: program cancelled directly (no proposal).');
    overlay.toast('Emergency stop: program cancelled directly — never a proposal.', { kind: 'ok' });
    await refresh();
    await deps.onEnterpriseChanged();
  }

  // ------------------------------------------------------------- scope bar

  function renderScope(container: HTMLElement): void {
    const bar = el('div', 'donna-scope');
    const row = el('div', 'row wrap');
    row.append(el('span', 'muted', 'Scope'));
    const sel = el('select', '') as HTMLSelectElement;
    sel.setAttribute('aria-label', 'Assistant scope');
    sel.dataset['focusKey'] = 'donna-scope';
    for (const scope of ASSISTANT_SCOPES) sel.append(new Option(scope, scope));
    sel.value = state.scope;
    sel.addEventListener('change', () => {
      state.scope = sel.value as AssistantScope;
      state.scopeKey = defaultScopeKey(state.scope);
      renderPreservingFocus();
    });
    const keyInput = el('input', '') as HTMLInputElement;
    keyInput.value = state.scopeKey;
    keyInput.placeholder = 'scope key (programId / company / department / room)';
    keyInput.setAttribute('aria-label', 'Scope key');
    keyInput.dataset['focusKey'] = 'donna-scope-key';
    keyInput.addEventListener('change', () => {
      state.scopeKey = keyInput.value.trim();
      renderPreservingFocus();
    });
    row.append(sel, keyInput);
    bar.append(row);

    const defs = state.definitions?.definitions ?? [];
    const covering =
      defs.find((d) => d.scope === state.scope && d.id !== 'repository-integration-steward') ??
      defs.find((d) => d.id === 'donna') ??
      null;
    if (covering) {
      bar.append(
        el(
          'p',
          'muted donna-scope-meta',
          `Acting assistant: ${covering.title} (scope ${covering.scope}, authority ${covering.authority}) — reports to ${covering.reportsTo ?? '—'}. ` +
            `Shared assistant metadata: ${covering.gates.length} non-bypassable gates enforced in code; provider chat ${covering.providerChat}.`,
        ),
      );
    }
    container.append(bar);
  }

  // ------------------------------------------------------- permanent agents

  function renderAgents(container: HTMLElement): void {
    const defs = state.definitions?.definitions ?? [];
    if (defs.length === 0) return;
    const section = el('section', 'donna-agents');
    section.append(el('h4', '', 'Permanent agents under Donna'));
    const donna = defs.find((d) => d.id === 'donna');
    const list = el('ul', 'donna-agent-list');
    if (donna) {
      const item = el('li', 'donna-agent');
      item.append(el('strong', '', donna.title));
      item.append(
        el('span', 'muted', ` — permanent · authority ${donna.authority} · provider chat: ${donna.providerChat} (advisory only)`),
      );
      const children = el('ul', 'donna-agent-children');
      for (const def of defs.filter((d) => d.id !== 'donna')) {
        const child = el('li', 'donna-agent');
        const labels: string[] = ['permanent'];
        labels.push(def.providerChat === 'none' ? 'deterministic · no provider calls' : 'provider chat advisory');
        if (def.mappedRoleIds.length > 0) {
          labels.push(`digital employee · mapped existing roles: ${def.mappedRoleIds.join(', ')}`);
        }
        child.append(el('strong', '', def.title));
        child.append(el('span', 'muted', ` — ${labels.join(' · ')}`));
        children.append(child);
      }
      item.append(children);
      list.append(item);
    }
    section.append(list);
    container.append(section);
  }

  // ------------------------------------------------------------------- tabs

  function renderTabs(container: HTMLElement): void {
    const bar = el('div', 'donna-tabs row wrap');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Donna assistant tabs');
    for (const tab of TABS) {
      const btn = button('secondary', tab.label, () => {
        state.tab = tab.id;
        renderAll();
      });
      btn.classList.add('donna-tab');
      if (state.tab === tab.id) btn.classList.add('selected');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', state.tab === tab.id ? 'true' : 'false');
      btn.dataset['focusKey'] = `donna-tab-${tab.id}`;
      bar.append(btn);
    }
    container.append(bar);
  }

  // --------------------------------------------------------- proposal inbox

  function renderInbox(container: HTMLElement): void {
    const proposals = state.assistant?.proposals ?? [];
    const section = el('section', 'donna-inbox');
    section.append(el('h4', '', `Proposal inbox (${proposals.length})`));
    section.append(
      el(
        'p',
        'muted',
        'Typed proposals only: action · actor · scope · risk · payload hash · OCC version · gates. ' +
          'Approval requires explicit confirmation of every policy gate; execution re-validates the exact approved hash.',
      ),
    );
    if (proposals.length === 0) {
      section.append(el('p', 'muted', 'No proposals yet. Donna chat drafts and queue pump proposals land here.'));
    }
    for (const proposal of proposals.slice(-12).reverse()) {
      section.append(proposalCard(proposal));
    }
    container.append(section);
  }

  function proposalCard(p: AssistantActionProposal): HTMLElement {
    const card = el('div', `donna-proposal donna-proposal-${p.status}`);
    card.dataset['proposalId'] = p.id;
    const head = el('div', 'row wrap');
    head.append(el('strong', '', p.action));
    head.append(badgeForStatus(p.status));
    head.append(el('span', `badge ${p.risk === 'high' ? 'fail' : p.risk === 'medium' ? 'warn' : 'neutral'}`, `${p.risk} risk`));
    head.append(el('span', 'muted', `${p.actor} → ${p.scope}`));
    card.append(head);
    card.append(
      el('p', 'muted', `payload sha256 ${short(p.payloadHash)} · OCC v${p.expectedVersion} · proposed ${fmtTime(p.proposedAt)}`),
    );
    const payloadPreview = JSON.stringify(p.payload);
    card.append(
      el(
        'code',
        'donna-payload',
        payloadPreview.length > PAYLOAD_PREVIEW_CHARS ? `${payloadPreview.slice(0, PAYLOAD_PREVIEW_CHARS)}…` : payloadPreview,
      ),
    );
    const policy = policyFor(p.action);
    if (policy?.drainAndPreserve) {
      card.append(el('p', 'muted', 'Drain + preserve: in-flight work drains first; artifacts, ledger, and events are preserved.'));
    }
    if (policy?.structural) {
      card.append(el('p', 'status warn', 'Structural: explicit proposal only — never auto-creates companies, departments, or roles.'));
    }
    if (p.resultSummary) card.append(el('p', 'muted', `Outcome: ${p.resultSummary}`));

    if (p.status === 'proposed') {
      const actions = el('div', 'row wrap donna-proposal-actions');
      let approveBtn: HTMLButtonElement | null = null;
      if (p.requiresApproval && policy && policy.gates.length > 0) {
        const { row, boxes } = gateBoxes(policy.gates, `${p.id}`);
        card.append(row);
        approveBtn = button('', 'Approve (gates confirmed)', () => {
          void decide(p, 'approved', confirmedGates(boxes));
        });
        wireGateEnable(approveBtn, boxes);
      } else if (p.requiresApproval) {
        approveBtn = button('', 'Approve', () => void decide(p, 'approved', []));
      }
      if (approveBtn) {
        approveBtn.dataset['focusKey'] = `approve-${p.id}`;
        actions.append(approveBtn);
        actions.append(
          (() => {
            const reject = button('secondary', 'Reject', () => void decide(p, 'rejected', []));
            reject.dataset['focusKey'] = `reject-${p.id}`;
            return reject;
          })(),
        );
      } else {
        // Approval-free proposal: may execute directly from 'proposed'.
        const exec = button('', 'Execute (no approval required)', () => void execute(p));
        exec.dataset['focusKey'] = `execute-${p.id}`;
        actions.append(exec);
      }
      const cancel = button('secondary', 'Cancel proposal', () => void cancelProposal(p));
      cancel.dataset['focusKey'] = `cancel-${p.id}`;
      actions.append(cancel);
      card.append(actions);
    } else if (p.status === 'approved') {
      const exec = button('', 'Execute approved proposal', () => void execute(p));
      exec.dataset['focusKey'] = `execute-${p.id}`;
      card.append(exec);
    }
    return card;
  }

  async function decide(p: AssistantActionProposal, decision: 'approved' | 'rejected', gates: AssistantGate[]): Promise<void> {
    const id = entId();
    if (!id) return;
    const res = await adapter.astDecide({ enterpriseId: id, proposalId: p.id, decision, confirmedGates: gates });
    if (!res.ok) {
      toastError('Decision failed', res.error);
      return;
    }
    overlay.toast(`Proposal ${p.action} ${decision}${gates.length > 0 ? ` with gates [${gates.join(', ')}]` : ''}.`, { kind: 'ok' });
    await refresh();
  }

  async function execute(p: AssistantActionProposal): Promise<void> {
    const id = entId();
    if (!id) return;
    const res = await adapter.astExecute({ enterpriseId: id, proposalId: p.id });
    if (!res.ok) {
      toastError('Execution failed', res.error);
      await refresh();
      return;
    }
    overlay.toast(`Executed ${p.action}: ${res.value.resultSummary || 'ok'}`, { kind: 'ok' });
    await refresh();
    await deps.onEnterpriseChanged();
  }

  async function cancelProposal(p: AssistantActionProposal): Promise<void> {
    const id = entId();
    if (!id) return;
    const res = await adapter.astCancel({ enterpriseId: id, proposalId: p.id });
    if (!res.ok) toastError('Cancel failed', res.error);
    await refresh();
  }

  // ---------------------------------------------------------------- Queue

  function renderQueue(container: HTMLElement): void {
    const section = el('section', 'donna-section');
    section.append(el('h4', '', 'Work queues'));
    const queues = (state.assistant?.queues ?? []).slice().sort((a, b) => (a.queue.id < b.queue.id ? -1 : 1));
    const scoped = queues.filter((q) => q.queue.scope === state.scope && (state.scopeKey === '' || q.queue.scopeKey === state.scopeKey));
    const shown = scoped.length > 0 ? scoped : queues;
    if (shown.length === 0) {
      section.append(el('p', 'muted', 'No queues yet — adding an item creates the scope queue (idempotent).'));
    }
    for (const entry of shown) {
      const box = el('div', 'donna-queue');
      box.append(
        el('p', '',
          `${entry.queue.id} — ${entry.queue.scope}/${entry.queue.scopeKey} · v${entry.queue.version} · ${entry.items.length} item(s)`),
      );
      const list = el('ol', 'donna-queue-items');
      const ordered = entry.items.slice().sort((a, b) => a.position - b.position);
      ordered.forEach((item, index) => {
        const row = el('li', 'row');
        row.append(el('span', '', `${item.position}. ${item.title || item.refId}`));
        row.append(el('span', 'muted', ` ${item.itemKind}`));
        row.append(badgeForStatus(item.status));
        const move = (delta: number): void => {
          const ids = ordered.map((i) => i.id);
          const target = index + delta;
          if (target < 0 || target >= ids.length) return;
          const [moved] = ids.splice(index, 1);
          ids.splice(target, 0, moved!);
          const enterprise = entId();
          if (!enterprise) return;
          void runMutation('Queue reorder', () =>
            adapter.astQueueReorder({ enterpriseId: enterprise, queueId: entry.queue.id, orderedIds: ids, expectedVersion: astVersion() }),
          );
        };
        const up = button('secondary', '↑', () => move(-1));
        up.disabled = index === 0;
        up.setAttribute('aria-label', `Move ${item.id} up`);
        const down = button('secondary', '↓', () => move(1));
        down.disabled = index === ordered.length - 1;
        down.setAttribute('aria-label', `Move ${item.id} down`);
        row.append(up, down);
        list.append(row);
      });
      box.append(list);
      section.append(box);
    }

    // Add item form (queue.add is approval-free by policy).
    const form = el('form', 'donna-form') as HTMLFormElement;
    form.append(el('h5', '', `Add queue item at scope ${state.scope}`));
    const kindSel = el('select', '') as HTMLSelectElement;
    kindSel.setAttribute('aria-label', 'Item kind');
    for (const kind of ['company-run', 'study', 'repository-triage', 'custom'] satisfies AssistantQueueItemKind[]) {
      kindSel.append(new Option(kind, kind));
    }
    const refInput = el('input', '') as HTMLInputElement;
    refInput.placeholder = 'ref id (run id / study item id / repo url)';
    refInput.required = true;
    refInput.setAttribute('aria-label', 'Item reference id');
    const titleInput = el('input', '') as HTMLInputElement;
    titleInput.placeholder = 'title (optional)';
    titleInput.setAttribute('aria-label', 'Item title');
    const submit = button('', 'Add to queue', () => undefined);
    submit.type = 'submit'; // real form submit (button() defaults to type=button)
    form.append(kindSel, refInput, titleInput, submit);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const enterprise = entId();
      if (!enterprise) return;
      const scopeKey = state.scopeKey || defaultScopeKey(state.scope);
      void runMutation('Queue add', () =>
        adapter.astQueueAdd({
          enterpriseId: enterprise,
          scope: state.scope,
          scopeKey,
          item: {
            itemKind: kindSel.value as AssistantQueueItemKind,
            refId: refInput.value.trim(),
            ...(titleInput.value.trim() ? { title: titleInput.value.trim() } : {}),
          },
          expectedVersion: astVersion(),
        }),
      );
    });
    section.append(form);

    // Approved pump: on desktop the ONLY pump path is a gated program.pump
    // proposal (the program_pump_mock job is deliberately inert here).
    const pumpRow = el('div', 'donna-pump');
    pumpRow.append(
      el('p', 'muted',
        'Approved pump: creates a program.pump proposal (high risk, plan-approval + live-provider-confirmation gates). ' +
          'The desktop has no mock program mode, so scheduled mock pumps are inert and free; an approved proposal is the only dispatch path.'),
    );
    const pumpBtn = button('secondary', 'Propose approved pump', () => {
      const enterprise = entId();
      if (!enterprise) return;
      void adapter
        .astPropose({ enterpriseId: enterprise, scope: 'enterprise', actor: 'donna', action: 'program.pump', payload: {} })
        .then(async (res) => {
          if (!res.ok) {
            toastError('Pump proposal failed', res.error);
            return;
          }
          overlay.toast(
            res.value.created
              ? 'program.pump proposal created — review it in the inbox (gates required).'
              : 'Identical program.pump proposal already exists (idempotent).',
            { kind: 'ok' },
          );
          await refresh();
        });
    });
    pumpBtn.dataset['focusKey'] = 'donna-propose-pump';
    pumpRow.append(pumpBtn);
    section.append(pumpRow);

    renderStudy(section);
    container.append(section);
  }

  /** Study queue: skills + resources, deduped, drafts only, zero provider calls. */
  function renderStudy(section: HTMLElement): void {
    const study = el('div', 'donna-study');
    study.append(el('h5', '', 'Study queue (deterministic, deduped, draft-approved)'));
    study.append(
      el('p', 'muted',
        'Study items are skill/resource pairs deduped by resource ref. Enqueueing is free and approval-free; ' +
          'items stay draft/queued — a study run makes zero provider calls until explicitly approved elsewhere.'),
    );
    const items = state.assistant?.studyItems ?? [];
    if (items.length > 0) {
      const list = el('ul', 'donna-study-list');
      for (const item of items.slice(-8).reverse()) {
        const li = el('li', 'row');
        li.append(el('span', '', `${item.skillId}: ${item.topic}`));
        li.append(el('span', 'muted', ` ${item.resourceRef}`));
        li.append(badgeForStatus(item.status));
        list.append(li);
      }
      study.append(list);
    }
    const form = el('form', 'donna-form') as HTMLFormElement;
    const skillSel = el('select', '') as HTMLSelectElement;
    skillSel.setAttribute('aria-label', 'Study skill');
    for (const s of state.skills ?? []) skillSel.append(new Option(s.name, s.id));
    const goalInput = el('input', '') as HTMLInputElement;
    goalInput.placeholder = 'learning goal';
    goalInput.required = true;
    goalInput.setAttribute('aria-label', 'Study goal');
    const resourcesInput = el('input', '') as HTMLInputElement;
    resourcesInput.placeholder = 'resource refs, comma separated (dupes are dropped)';
    resourcesInput.required = true;
    resourcesInput.setAttribute('aria-label', 'Study resources');
    const evalInput = el('input', '') as HTMLInputElement;
    evalInput.placeholder = 'evaluation (optional)';
    evalInput.setAttribute('aria-label', 'Study evaluation');
    const enqueueBtn = button('', 'Enqueue study (free)', () => undefined);
    enqueueBtn.type = 'submit'; // real form submit (button() defaults to type=button)
    enqueueBtn.dataset['focusKey'] = 'donna-study-enqueue';
    form.append(skillSel, goalInput, resourcesInput, evalInput, enqueueBtn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const enterprise = entId();
      if (!enterprise) return;
      const resources = resourcesInput.value
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.length > 0)
        .map((ref) => ({ ref }));
      if (resources.length === 0) return;
      void runMutation('Enqueue study', () =>
        adapter.astStudyEnqueue({
          enterpriseId: enterprise,
          skillId: skillSel.value,
          goal: goalInput.value.trim(),
          resources,
          ...(evalInput.value.trim() ? { evaluation: evalInput.value.trim() } : {}),
          expectedVersion: astVersion(),
        }),
      );
    });
    study.append(form);
    section.append(study);
  }

  // ---------------------------------------------------------------- Hiring

  function renderHiring(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'donna-section');
    section.append(el('h4', '', 'Hiring & lifecycle'));
    section.append(
      el('p', 'muted',
        'Hire/pause/resume/fire map to the existing contract pipeline. Fire is high risk: it drains the seat and preserves artifacts — the UI states this and main enforces it in code.'),
    );

    // Hire form (worker.hire: plan-approval gate, new spend confirm).
    const form = el('form', 'donna-form') as HTMLFormElement;
    form.append(el('h5', '', 'Hire a worker (plan-approval gate · new spend)'));
    const keyInput = el('input', '') as HTMLInputElement;
    keyInput.placeholder = 'contract key (e.g. software--svc-backend-engineering)';
    keyInput.required = true;
    keyInput.setAttribute('aria-label', 'Contract key');
    const companySel = el('select', '') as HTMLSelectElement;
    companySel.setAttribute('aria-label', 'Company');
    for (const c of rec.blueprint?.companies ?? []) companySel.append(new Option(`${c.name} (${c.key})`, c.key));
    const deptSel = el('select', '') as HTMLSelectElement;
    deptSel.setAttribute('aria-label', 'Department');
    for (const d of rec.blueprint?.departments ?? []) deptSel.append(new Option(`${d.name} (${d.key})`, d.key));
    const discSel = el('select', '') as HTMLSelectElement;
    discSel.setAttribute('aria-label', 'Discipline');
    for (const d of DISCIPLINES) discSel.append(new Option(d, d));
    const skillSel = el('select', '') as HTMLSelectElement;
    skillSel.setAttribute('aria-label', 'Skill');
    for (const s of state.skills ?? []) skillSel.append(new Option(`${s.name}${s.verified ? '' : ' (unverified)'}`, s.id));
    const shareInput = el('input', '') as HTMLInputElement;
    shareInput.type = 'number';
    shareInput.min = '1';
    shareInput.value = '1';
    shareInput.setAttribute('aria-label', 'Capacity share');
    const hirePolicy = policyFor('worker.hire');
    const { row: hireGates, boxes: hireBoxes } = gateBoxes(hirePolicy?.gates ?? ['plan-approval'], 'hire');
    const hireBtn = button('', 'Hire (confirmed)', () => undefined);
    hireBtn.type = 'submit'; // real form submit (button() defaults to type=button)
    hireBtn.dataset['focusKey'] = 'donna-hire-submit';
    wireGateEnable(hireBtn, hireBoxes);
    form.append(keyInput, companySel, deptSel, discSel, skillSel, shareInput, hireGates, hireBtn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const enterprise = entId();
      if (!enterprise) return;
      const contractKey = keyInput.value.trim();
      const departmentKey = deptSel.value;
      const companyKey = companySel.value || (rec.blueprint?.departments.find((d) => d.key === departmentKey)?.companyKey ?? '');
      void runMutation('Hire', () =>
        adapter.astWorkerAction({
          enterpriseId: enterprise,
          action: 'worker.hire',
          payload: {
            contractKey,
            companyKey,
            departmentKey,
            discipline: discSel.value,
            capacityShare: Math.max(1, Math.round(Number(shareInput.value) || 1)),
            skillId: skillSel.value,
          },
          expectedVersion: entVersion(),
          confirmed: true,
          confirmedGates: confirmedGates(hireBoxes),
        }),
      );
    });
    section.append(form);

    // Contract seats with pause/resume/fire.
    const contracts = Object.entries(rec.contracts).map(([key, c]) => ({ key, ...c }));
    if (contracts.length > 0) section.append(el('h5', '', `Contract seats (${contracts.length})`));
    for (const c of contracts) {
      const row = el('div', 'row wrap donna-contract');
      row.append(el('strong', '', c.key));
      row.append(badgeForStatus(c.status));
      row.append(el('span', 'muted', ` ${c.skillId}`));
      const firePolicy = policyFor('worker.fire');
      const pauseBtn = button('secondary', 'Pause', () => {
        const enterprise = entId();
        if (!enterprise) return;
        void runMutation('Pause worker', () =>
          adapter.astWorkerAction({
            enterpriseId: enterprise,
            action: 'worker.pause',
            payload: { contractKey: c.key },
            expectedVersion: entVersion(),
            confirmed: true,
          }),
        );
      });
      pauseBtn.disabled = c.status !== 'active';
      const resumeBtn = button('secondary', 'Resume', () => {
        const enterprise = entId();
        if (!enterprise) return;
        void runMutation('Resume worker', () =>
          adapter.astWorkerAction({
            enterpriseId: enterprise,
            action: 'worker.resume',
            payload: { contractKey: c.key },
            expectedVersion: entVersion(),
            confirmed: true,
          }),
        );
      });
      resumeBtn.disabled = c.status !== 'draining';
      const { row: fireGates, boxes: fireBoxes } = gateBoxes(firePolicy?.gates ?? ['high-risk', 'plan-approval'], `fire-${c.key}`);
      const fireBtn = button('danger', 'Fire (drain + preserve)', () => {
        const enterprise = entId();
        if (!enterprise) return;
        void overlay
          .confirm({
            title: 'Fire worker',
            message: `Fire seat "${c.key}"? In-flight work drains first and every artifact, ledger entry, and event is preserved (drain + preserve is enforced in code).`,
            confirmLabel: 'Fire worker',
            danger: true,
          })
          .then((ok) => {
            if (!ok) return;
            void runMutation('Fire worker', () =>
              adapter.astWorkerAction({
                enterpriseId: enterprise,
                action: 'worker.fire',
                payload: { contractKey: c.key, drain: true, preserveArtifacts: true },
                expectedVersion: entVersion(),
                confirmed: true,
                confirmedGates: confirmedGates(fireBoxes),
              }),
            );
          });
      });
      fireBtn.dataset['focusKey'] = `fire-${c.key}`;
      wireGateEnable(fireBtn, fireBoxes);
      if (c.status === 'released') fireBtn.disabled = true;
      const seat = el('div', 'donna-seat');
      seat.append(row, fireGates);
      row.append(pauseBtn, resumeBtn, fireBtn);
      section.append(seat);
    }

    // Company + department lifecycle.
    renderLifecycle(section, rec, 'company');
    renderLifecycle(section, rec, 'department');
    container.append(section);
  }

  function renderLifecycle(section: HTMLElement, rec: EnterpriseRecordDto, target: 'company' | 'department'): void {
    const keys = target === 'company' ? (rec.blueprint?.companies ?? []).map((c) => c.key) : (rec.blueprint?.departments ?? []).map((d) => d.key);
    if (keys.length === 0) return;
    section.append(el('h5', '', `${target === 'company' ? 'Company' : 'Department'} lifecycle`));
    const lifecycle = target === 'company' ? state.assistant?.lifecycle.companies : state.assistant?.lifecycle.departments;
    for (const key of keys) {
      const status = lifecycle?.[key] ?? 'active';
      const row = el('div', 'row wrap donna-lifecycle');
      row.append(el('strong', '', key));
      row.append(badgeForStatus(status));
      // Lifecycle gates are the union over transitions; rendered once per row
      // and shared by every transition button (pause/resume/archive).
      const gates = new Set<AssistantGate>();
      for (const a of [`${target}.pause`, `${target}.resume`, `${target}.archive`]) {
        for (const g of policyFor(a)?.gates ?? []) gates.add(g);
      }
      const { row: gateRow, boxes: gateBoxesForRow } = gateBoxes([...gates], `lc-${target}-${key}`);
      for (const next of ['paused', 'active', 'archived'] as const) {
        const label = next === 'paused' ? 'Pause' : next === 'active' ? 'Resume' : 'Archive (drain + preserve)';
        const action = `${target}.${next === 'active' ? 'resume' : next === 'paused' ? 'pause' : 'archive'}`;
        const policy = policyFor(action);
        const btn = button(next === 'archived' ? 'danger' : 'secondary', label, () => {
          const enterprise = entId();
          if (!enterprise) return;
          const doIt = (): void => {
            void runMutation(`${target} ${label}`, () =>
              adapter.astLifecycleSet({
                enterpriseId: enterprise,
                target,
                key,
                status: next,
                expectedVersion: entVersion(),
                confirmed: true,
                confirmedGates: confirmedGates(gateBoxesForRow),
              }),
            );
          };
          if (next === 'archived') {
            void overlay
              .confirm({
                title: `Archive ${target}`,
                message: `Archive ${target} "${key}"? In-flight work drains first; artifacts, ledger, and events are preserved.`,
                confirmLabel: `Archive ${target}`,
                danger: true,
              })
              .then((ok) => {
                if (ok) doIt();
              });
          } else {
            doIt();
          }
        });
        btn.dataset['focusKey'] = `lc-${target}-${key}-${next}`;
        if (status === next || (status === 'archived' && next !== 'active')) {
          btn.disabled = true;
        } else if ((policy?.gates.length ?? 0) > 0) {
          // Gate-confirmed transitions stay disabled until the human checks
          // every policy gate (pause/resume: plan-approval; archive: + high-risk).
          const required = new Set(policy?.gates ?? []);
          const relevant = gateBoxesForRow.filter((b) => required.has(b.dataset['gate'] as AssistantGate));
          wireGateEnable(btn, relevant);
        }
        row.append(btn);
      }
      const wrap = el('div', 'donna-lifecycle-row');
      wrap.append(row);
      if (gates.size > 0) wrap.append(gateRow);
      section.append(wrap);
    }
  }

  // ------------------------------------------------------------- Schedules

  function renderSchedules(container: HTMLElement): void {
    const section = el('section', 'donna-section');
    section.append(el('h4', '', 'Assistant schedules'));
    section.append(
      el('p', 'muted',
        'Every assistant job is deterministic and free: zero budget, no provider calls, no paid calls, never executes proposals. ' +
          'Intervals are clamped (≥ 60s), missed runs are skipped forward (no catch-up storm), and maxRuns is a hard terminator.'),
    );
    const jobs = (state.assistant?.jobs ?? []).slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    if (jobs.length === 0) section.append(el('p', 'muted', 'No schedules yet.'));
    for (const job of jobs) {
      const card = el('div', 'donna-job');
      const head = el('div', 'row wrap');
      head.append(el('strong', '', job.id));
      head.append(badgeForStatus(job.enabled ? 'active' : 'paused'));
      head.append(el('span', 'muted', `${job.kind} · ${job.scope}`));
      card.append(head);
      const scheduleText =
        job.schedule.type === 'one-time'
          ? `one-time at ${fmtTime(job.schedule.runAt)}`
          : `every ${Math.round(job.schedule.intervalMs / 60000)} min (anchored ${fmtTime(job.schedule.anchorAt)})`;
      card.append(
        el('p', 'muted',
          `${scheduleText} · next run ${fmtTime(job.nextRunAt)} · runs ${job.runCount}/${job.maxRuns ?? '∞'} · ` +
            `budget ${job.budget.maxTokens} tok / ${job.budget.maxCalls} calls / $${(job.budget.maxCostUsdMicros / 1e6).toFixed(2)} (zero reservation) · v${job.version}`),
      );
      const actions = el('div', 'row wrap');
      const enterprise = entId();
      const pauseBtn = button('secondary', job.enabled ? 'Pause' : 'Resume', () => {
        if (!enterprise) return;
        void runMutation(job.enabled ? 'Pause schedule' : 'Resume schedule', () =>
          job.enabled
            ? adapter.astJobPause({ enterpriseId: enterprise, jobId: job.id, expectedVersion: astVersion() })
            : adapter.astJobResume({ enterpriseId: enterprise, jobId: job.id, expectedVersion: astVersion() }),
        );
      });
      const runNowPolicy = policyFor('schedule.run_now');
      const { row: runGates, boxes: runBoxes } = gateBoxes(runNowPolicy?.gates ?? ['plan-approval'], `runnow-${job.id}`);
      const runNowBtn = button('secondary', 'Run now (gated)', () => {
        if (!enterprise) return;
        void runMutation('Run schedule now', () =>
          adapter.astJobRunNow({
            enterpriseId: enterprise,
            jobId: job.id,
            expectedVersion: astVersion(),
            confirmed: true,
            confirmedGates: confirmedGates(runBoxes),
          }),
        );
      });
      runNowBtn.dataset['focusKey'] = `runnow-${job.id}`;
      runNowBtn.title = 'One immediate deterministic run. Never paid, never automatic.';
      wireGateEnable(runNowBtn, runBoxes);
      const deleteBtn = button('danger', 'Delete', () => {
        if (!enterprise) return;
        void overlay
          .confirm({
            title: 'Delete schedule',
            message: `Delete schedule "${job.id}" (${job.kind})? Past runs and events stay in the audit ledger.`,
            confirmLabel: 'Delete schedule',
            danger: true,
          })
          .then((ok) => {
            if (!ok) return;
            void runMutation('Delete schedule', () =>
              adapter.astJobDelete({ enterpriseId: enterprise, jobId: job.id, expectedVersion: astVersion(), confirmed: true }),
            );
          });
      });
      deleteBtn.dataset['focusKey'] = `deletejob-${job.id}`;
      actions.append(pauseBtn, runNowBtn, deleteBtn);
      card.append(actions, runGates);
      section.append(card);
    }

    // Upsert form (schedule.upsert: plan-approval gate).
    const form = el('form', 'donna-form') as HTMLFormElement;
    form.append(el('h5', '', 'Create / update a schedule (plan-approval gate)'));
    const idInput = el('input', '') as HTMLInputElement;
    idInput.placeholder = 'job id (e.g. nightly-ledger)';
    idInput.required = true;
    idInput.setAttribute('aria-label', 'Job id');
    const kindSel = el('select', '') as HTMLSelectElement;
    kindSel.setAttribute('aria-label', 'Job kind');
    for (const kind of ASSISTANT_JOB_KINDS) kindSel.append(new Option(kind, kind));
    const scopeSel = el('select', '') as HTMLSelectElement;
    scopeSel.setAttribute('aria-label', 'Job scope');
    for (const scope of ASSISTANT_SCOPES) scopeSel.append(new Option(scope, scope));
    const typeSel = el('select', '') as HTMLSelectElement;
    typeSel.setAttribute('aria-label', 'Schedule type');
    typeSel.append(new Option('interval (minutes)', 'interval'), new Option('one-time (minutes from now)', 'one-time'));
    const minutesInput = el('input', '') as HTMLInputElement;
    minutesInput.type = 'number';
    minutesInput.min = '1';
    minutesInput.value = '60';
    minutesInput.setAttribute('aria-label', 'Interval or delay in minutes');
    const maxRunsInput = el('input', '') as HTMLInputElement;
    maxRunsInput.type = 'number';
    maxRunsInput.min = '1';
    maxRunsInput.placeholder = 'max runs (blank = unbounded interval)';
    maxRunsInput.setAttribute('aria-label', 'Maximum runs');
    const upsertPolicy = policyFor('schedule.upsert');
    const { row: upsertGates, boxes: upsertBoxes } = gateBoxes(upsertPolicy?.gates ?? ['plan-approval'], 'job-upsert');
    const upsertBtn = button('', 'Save schedule (confirmed)', () => undefined);
    upsertBtn.type = 'submit'; // real form submit (button() defaults to type=button)
    upsertBtn.dataset['focusKey'] = 'donna-job-upsert';
    wireGateEnable(upsertBtn, upsertBoxes);
    form.append(idInput, kindSel, scopeSel, typeSel, minutesInput, maxRunsInput, upsertGates, upsertBtn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const enterprise = entId();
      if (!enterprise) return;
      const minutes = Math.max(1, Math.round(Number(minutesInput.value) || 60));
      const now = Date.now();
      const jobId = idInput.value.trim();
      const kind = kindSel.value as AssistantJobKind;
      const maxRuns = maxRunsInput.value.trim() === '' ? null : Math.max(1, Math.round(Number(maxRunsInput.value)));
      void runMutation('Save schedule', () =>
        adapter.astJobUpsert({
          enterpriseId: enterprise,
          job: {
            id: jobId,
            scope: scopeSel.value as AssistantScope,
            kind,
            schedule:
              typeSel.value === 'one-time'
                ? { type: 'one-time', runAt: now + minutes * 60_000 }
                : { type: 'interval', intervalMs: minutes * 60_000, anchorAt: now },
            enabled: true,
            maxRuns,
          },
          expectedVersion: astVersion(),
          confirmed: true,
          confirmedGates: confirmedGates(upsertBoxes),
        }),
      );
    });
    section.append(form);
    container.append(section);
  }

  // ----------------------------------------------------------------- Cache

  function renderCache(container: HTMLElement): void {
    const section = el('section', 'donna-section');
    section.append(el('h4', '', 'Deterministic caches'));
    section.append(
      el('p', 'muted',
        'These namespaces hold deterministic derivations only — provider responses are never cached anywhere in the shell. ' +
          'Invalidation is approval-free and reports removed key counts (never content).'),
    );
    const byNamespace = new Map(state.cacheStatus.map((c) => [c.namespace, c.keys]));
    for (const namespace of CACHE_NAMESPACES) {
      const row = el('div', 'row wrap donna-cache-row');
      row.append(el('strong', '', namespace));
      row.append(el('span', 'muted', ` ${byNamespace.get(namespace) ?? 0} key(s)`));
      if (namespace === 'snapshot') row.append(el('span', 'muted', ' (derived per call — nothing cached)'));
      const btn = button('secondary', 'Invalidate', () => {
        const enterprise = entId();
        if (!enterprise) return;
        void runMutation(`Invalidate ${namespace}`, () =>
          adapter.astCacheInvalidate({ enterpriseId: enterprise, namespace, expectedVersion: entVersion() }),
        );
      });
      btn.dataset['focusKey'] = `cache-invalidate-${namespace}`;
      row.append(btn);
      section.append(row);
    }
    container.append(section);
  }

  // ----------------------------------------------------------- Repositories

  function renderRepositories(container: HTMLElement): void {
    const section = el('section', 'donna-section');
    section.append(el('h4', '', 'Repository intake (public, anonymous, read-only)'));
    section.append(
      el('p', 'muted',
        `Desktop intake fetches public GitHub metadata anonymously (cap ${REPOSITORY_CAP} repositories). No cloning, no code reads, ` +
          'no roles or structures are created implicitly; private repositories belong to the web app credentialed mode.'),
    );

    const form = el('form', 'donna-form') as HTMLFormElement;
    const urlInput = el('input', '') as HTMLInputElement;
    urlInput.placeholder = 'https://github.com/owner/repo';
    urlInput.required = true;
    urlInput.setAttribute('aria-label', 'Repository URL');
    urlInput.dataset['focusKey'] = 'donna-repo-url';
    const previewBtn = button('secondary', 'Preview route (free, anonymous)', () => undefined);
    previewBtn.type = 'submit'; // real form submit (button() defaults to type=button)
    previewBtn.dataset['focusKey'] = 'donna-repo-preview';
    form.append(urlInput, previewBtn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void previewRepo(urlInput.value.trim());
    });
    section.append(form);

    if (state.repoPreview) section.append(repoPreviewCard(state.repoPreview.metadata, state.repoPreview.plan));

    const repos = state.assistant?.repositories ?? [];
    if (repos.length > 0) section.append(el('h5', '', `Stored repositories (${repos.length}/${REPOSITORY_CAP})`));
    for (const repo of repos) {
      const card = el('div', 'donna-repo');
      const head = el('div', 'row wrap');
      head.append(el('strong', '', `${repo.metadata.owner}/${repo.metadata.name}`));
      head.append(badgeForStatus(repo.plan.status));
      head.append(el('span', 'muted', ` confidence ${Math.round(repo.plan.confidence * 100)}% · license ${repo.metadata.license ?? 'unknown'}`));
      if (repo.metadata.archived) head.append(el('span', 'badge warn', 'archived'));
      if (repo.plan.status === 'quarantined') head.append(el('span', 'badge fail', 'quarantine review required'));
      card.append(head);
      card.append(el('p', 'muted', `${repo.metadata.url} @ ${repo.metadata.commitSha} · intake ${repo.intakeMode}`));
      card.append(el('p', 'muted', `Route: ${repo.plan.rationale}`));
      if (repo.appliedAt !== null) {
        card.append(el('p', 'muted', `Applied ${fmtTime(repo.appliedAt)}${repo.appliedBy ? ` by ${repo.appliedBy}` : ''}.`));
      } else if (repo.plan.status === 'assigned') {
        const applyPolicy = policyFor('repository.assign');
        const { row: applyGates, boxes: applyBoxes } = gateBoxes(applyPolicy?.gates ?? ['plan-approval'], `apply-${repo.metadata.name}`);
        const applyBtn = button('', 'Apply approved assignment', () => {
          const enterprise = entId();
          if (!enterprise) return;
          void runMutation('Apply repository assignment', () =>
            adapter.astRepoApply({
              enterpriseId: enterprise,
              url: repo.metadata.url,
              expectedVersion: astVersion(),
              confirmed: true,
              confirmedGates: confirmedGates(applyBoxes),
            }),
          );
        });
        applyBtn.dataset['focusKey'] = `apply-${repo.metadata.name}`;
        wireGateEnable(applyBtn, applyBoxes);
        card.append(applyGates, applyBtn);
      } else if (repo.plan.status === 'proposed_new_structure') {
        const note = el('p', 'status warn', 'Routing engine proposes a new structure. This is a structural proposal only — it never auto-creates companies, departments, or roles.');
        const proposeBtn = button('secondary', 'Propose new structure (inbox)', () => {
          const enterprise = entId();
          if (!enterprise) return;
          void adapter
            .astPropose({
              enterpriseId: enterprise,
              scope: 'enterprise',
              actor: 'repository-integration-steward',
              action: 'repository.propose_structure',
              payload: { url: repo.metadata.url },
            })
            .then(async (res) => {
              if (!res.ok) {
                toastError('Structure proposal failed', res.error);
                return;
              }
              overlay.toast('repository.propose_structure added to the inbox — approve explicitly (structural).', { kind: 'ok' });
              await refresh();
            });
        });
        proposeBtn.dataset['focusKey'] = `propose-structure-${repo.metadata.name}`;
        card.append(note, proposeBtn);
      } else {
        card.append(
          el('p', 'status warn',
            'Quarantined: assignment is BLOCKED until routing confidence ≥ 80% and licensing/archived checks pass. Web credentialed review required.'),
        );
      }
      section.append(card);
    }
    container.append(section);
  }

  async function previewRepo(url: string): Promise<void> {
    const res = await adapter.astRepoPreview({ url });
    if (!res.ok) {
      state.repoPreview = null;
      const privateLike = /private|auth/i.test(res.error);
      overlay.toast(
        privateLike
          ? `${res.error} — private repositories are not fetched on desktop; use the web app credentialed mode behind an approved repository.import proposal.`
          : `Preview failed: ${res.error}`,
        { kind: 'error' },
      );
      renderAll();
      return;
    }
    if (res.value.metadata.visibility !== 'public') {
      state.repoPreview = null;
      overlay.toast('Private repository: desktop intake is anonymous public-only. Use the web credentialed mode.', { kind: 'error' });
      renderAll();
      return;
    }
    state.repoPreview = res.value;
    renderAll();
  }

  function repoPreviewCard(meta: RepositoryMetadata, plan: RepoAssignmentPlan): HTMLElement {
    const card = el('div', 'donna-repo donna-repo-preview');
    card.append(el('h5', '', `Preview: ${meta.owner}/${meta.name}`));
    card.append(
      el('p', 'muted',
        `full SHA ${meta.commitSha} · branch ${meta.defaultBranch} · visibility ${meta.visibility} · license ${meta.license ?? 'unknown'} · ` +
          `language ${meta.language ?? 'unknown'} · archived ${meta.archived ? 'YES' : 'no'}`),
    );
    card.append(
      el('p', '',
        `Route: ${plan.status} · confidence ${Math.round(plan.confidence * 100)}% · read-only ${plan.readOnly ? 'yes' : 'no'} · redistribution ${plan.redistributionAllowed ? 'allowed' : 'BLOCKED'}`),
    );
    card.append(el('p', 'muted', plan.rationale));
    for (const note of plan.notes) card.append(el('p', 'muted', `• ${note}`));
    if (plan.status === 'assigned') {
      card.append(
        el('p', 'muted',
          `Selected route: company ${plan.companyKey} / department ${plan.departmentKey} / discipline ${plan.discipline} / skill ${plan.skillId}. ` +
            'Only this routing-confirmed assignment can be imported — no other selection is offered.'),
      );
      const fetchPolicy = policyFor('repository.import');
      const { row: fetchGates, boxes: fetchBoxes } = gateBoxes(fetchPolicy?.gates ?? ['external-writes', 'credentials', 'high-risk'], 'repo-fetch');
      const importBtn = button('', `Import selected repository (cap ${REPOSITORY_CAP})`, () => {
        const enterprise = entId();
        if (!enterprise) return;
        const current = state.assistant?.repositories.length ?? 0;
        if (current >= REPOSITORY_CAP) {
          overlay.toast(`Repository cap reached (${REPOSITORY_CAP}). Remove or archive before importing more.`, { kind: 'error' });
          return;
        }
        void adapter
          .astRepoFetch({
            enterpriseId: enterprise,
            url: meta.url,
            intakeMode: 'public-anonymous',
            expectedVersion: astVersion(),
            confirmed: true,
            confirmedGates: confirmedGates(fetchBoxes),
          })
          .then(async (res) => {
            if (!res.ok) {
              toastError('Repository import failed', res.error);
              return;
            }
            state.repoPreview = null;
            overlay.toast('Repository metadata stored (public, anonymous, read-only). Apply its approved assignment from the list below.', { kind: 'ok' });
            await refresh();
          });
      });
      importBtn.dataset['focusKey'] = 'donna-repo-import';
      wireGateEnable(importBtn, fetchBoxes);
      card.append(fetchGates, importBtn);
    } else {
      card.append(
        el('p', 'status warn',
          plan.status === 'quarantined'
            ? 'Import blocked: this repository routes to quarantine (confidence < 80%, restricted license, or archived).'
            : 'Import blocked: routing engine proposes a new structure — review it as an explicit structural proposal after a confirmed route exists.'),
      );
    }
    return card;
  }

  // -------------------------------------------------------------- Knowledge

  function renderKnowledge(container: HTMLElement): void {
    const section = el('section', 'donna-section');
    section.append(el('h4', '', 'Knowledge transfers'));
    section.append(
      el('p', 'muted',
        'Transfers are content-addressed references plus handoff notes — artifact bodies never leave the project store.'),
    );
    const transfers = state.assistant?.transfers ?? [];
    if (transfers.length === 0) section.append(el('p', 'muted', 'No transfers yet. They are created by approved program knowledge nodes.'));
    for (const t of transfers.slice(-8).reverse()) {
      const card = el('div', 'donna-transfer');
      card.append(el('p', '', `${t.handoff.from} → ${t.handoff.to}`));
      card.append(el('p', 'muted', `${t.refs.length} ref(s) · sha256 ${short(t.contentSha256)} · ${t.handoff.summary}`));
      section.append(card);
    }
    const exportBtn = button('secondary', 'Export handoff bundle (refs only)', () => {
      const enterprise = entId();
      if (!enterprise) return;
      void adapter.astKnowledgeExport(enterprise).then((res) => {
        if (!res.ok) {
          toastError('Export failed', res.error);
          return;
        }
        overlay.toast(`Exported ${res.value.files.length} handoff file(s) to ${res.value.dir}`, { kind: 'ok' });
      });
    });
    exportBtn.dataset['focusKey'] = 'donna-knowledge-export';
    exportBtn.disabled = transfers.length === 0;
    section.append(exportBtn);
    container.append(section);
  }

  // -------------------------------------------------------------- Donna chat

  function renderChat(container: HTMLElement): void {
    const rec = record();
    if (!rec) return;
    const section = el('section', 'donna-section');
    section.append(el('h4', '', 'Donna Chat (paid, confirmed, advisory)'));
    section.append(
      el('p', 'muted',
        `Paid, non-streaming chat on the enterprise provider (${rec.provider} · ${rec.model}) with a hard budget ` +
          `(${DONNA_BUDGET.maxTokens.toLocaleString()} tok / ${DONNA_BUDGET.maxMinutes} min / $${DONNA_BUDGET.maxUsd}). ` +
          'Donna proposes — she never executes. Her fenced proposals are parsed by the backend into DRAFT inbox entries; ' +
          'anything unknown or out-of-scope is dropped with an audit event.'),
    );

    const session = state.chat.session;
    if (!session) {
      const startBtn = button('', 'Start Donna session', () => void ensureChatSession());
      startBtn.dataset['focusKey'] = 'donna-chat-start';
      section.append(startBtn);
      container.append(section);
      return;
    }
    section.append(el('p', 'muted', `Session "${session.title}" · mode ${session.mode ?? 'director'} · provider ${session.provider} · ${session.model}`));

    const log = el('div', 'donna-chat-log');
    for (const msg of session.messages) {
      const row = el('div', `donna-chat-msg ${msg.role}`);
      row.append(el('span', 'muted', `${msg.role} · `));
      if (msg.status === 'pending') {
        row.append(el('span', 'donna-pending', 'pending — waiting for the provider…'));
      } else if (msg.status === 'cancelled') {
        row.append(el('span', 'muted', '(stopped before the paid call completed)'));
      } else if (msg.status === 'error') {
        row.append(el('span', 'status error', msg.error ?? 'provider error'));
      } else {
        row.append(el('span', '', msg.text.length > 1200 ? `${msg.text.slice(0, 1200)}…` : msg.text));
        if (msg.role === 'assistant' && (msg.usage || msg.provenance)) {
          const bits: string[] = [];
          if (msg.provenance) bits.push(`${msg.provenance.provider} · ${msg.provenance.model}`);
          if (msg.usage) bits.push(`in ${msg.usage.inputTokens} / out ${msg.usage.outputTokens} · $${msg.usage.costUsd.toFixed(4)}`);
          if (msg.provenance) bits.push(`sha256 ${short(msg.provenance.textSha256)}`);
          row.append(el('p', 'muted', `provenance: ${bits.join(' · ')}`));
        }
      }
      log.append(row);
    }
    section.append(log);

    const composer = el('form', 'donna-form') as HTMLFormElement;
    const input = el('textarea', '') as HTMLTextAreaElement;
    input.rows = 3;
    input.placeholder = 'Objective for Donna… (she replies with fenced proposals you still must approve)';
    input.setAttribute('aria-label', 'Donna objective');
    input.dataset['focusKey'] = 'donna-chat-input';
    const sendBtn = button('', 'Send (confirmed paid call)', () => undefined);
    sendBtn.type = 'submit'; // real form submit (button() defaults to type=button)
    sendBtn.dataset['focusKey'] = 'donna-chat-send';
    sendBtn.disabled = state.chat.sending || state.chat.pendingReply;
    const stopBtn = button('secondary', 'Stop', () => {
      if (!session) return;
      void adapter.chatStop(session.id).then(async () => {
        await pollSessionOnce();
      });
    });
    stopBtn.dataset['focusKey'] = 'donna-chat-stop';
    stopBtn.disabled = !state.chat.pendingReply;
    const briefBtn = button('secondary', 'Preview Donna brief (free)', () => void previewBrief(input.value.trim()));
    briefBtn.dataset['focusKey'] = 'donna-chat-brief';
    const chatActions = el('div', 'row');
    chatActions.append(sendBtn, stopBtn, briefBtn);
    composer.append(input, chatActions);
    composer.addEventListener('submit', (e) => {
      e.preventDefault();
      const objective = input.value.trim();
      if (!objective) return;
      void sendDonnaMessage(objective).then((sent) => {
        if (sent) input.value = '';
      });
    });
    section.append(composer);
    if (state.chat.parsed > 0 || state.chat.dropped > 0) {
      section.append(
        el('p', 'muted', `Donna replies so far: ${state.chat.parsed} draft proposal(s) into the inbox, ${state.chat.dropped} untrusted block(s) dropped.`),
      );
    }
    if (state.chat.promptPreview) {
      const details = el('details', 'donna-prompt-preview');
      details.append(el('summary', '', 'Donna advisory brief (system + user prompt sent to the provider)'));
      details.append(el('pre', '', state.chat.promptPreview));
      section.append(details);
    }
    container.append(section);
  }

  async function ensureChatSession(): Promise<void> {
    const rec = record();
    if (!rec) return;
    const list = await adapter.chatListSessions();
    const existing = list.ok ? list.value.find((s) => s.mode === 'donna' && s.provider === rec.provider && s.model === rec.model) : undefined;
    if (existing) {
      const full = await adapter.chatGetSession(existing.id);
      if (full.ok) {
        state.chat.session = full.value;
        renderAll();
        return;
      }
    }
    const res = await adapter.chatCreateSession({
      title: `Donna — ${rec.name}`,
      mode: 'donna',
      projectId: null,
      provider: rec.provider,
      model: rec.model,
      priceRates: rec.priceRates,
      budget: { ...DONNA_BUDGET },
    });
    if (!res.ok) {
      toastError('Could not start Donna session', res.error);
      return;
    }
    state.chat.session = res.value;
    renderAll();
  }

  async function sendDonnaMessage(objective: string): Promise<boolean> {
    const rec = record();
    const session = state.chat.session;
    if (!rec || !session || state.chat.sending || state.chat.pendingReply) return false;
    const ok = await overlay.confirm({
      title: 'Ask Donna (paid)',
      message:
        `Send this objective to ${rec.provider}/${rec.model}? One confirmed paid call, non-streaming, hard budget ` +
        `(${DONNA_BUDGET.maxTokens.toLocaleString()} tok / $${DONNA_BUDGET.maxUsd}). Donna can only propose — nothing executes without your gates.`,
      confirmLabel: 'Send (confirmed)',
    });
    if (!ok) return false;
    state.chat.sending = true;
    renderPreservingFocus();
    const res = await adapter.chatSendMessage({ sessionId: session.id, text: objective, confirmed: true });
    state.chat.sending = false;
    if (!res.ok) {
      toastError('Donna send failed', res.error);
      renderAll();
      return false;
    }
    const full = await adapter.chatGetSession(session.id);
    if (full.ok && full.value) {
      state.chat.session = full.value;
      state.chat.pendingReply = full.value.messages.some((m) => m.role === 'assistant' && m.status === 'pending');
    }
    startChatPoll();
    renderAll();
    return true;
  }

  function startChatPoll(): void {
    if (chatPollTimer !== null) return;
    chatPollTimer = window.setInterval(() => {
      void chatPollOnce();
    }, CHAT_POLL_MS);
  }

  function stopChatPoll(): void {
    if (chatPollTimer !== null) {
      window.clearInterval(chatPollTimer);
      chatPollTimer = null;
    }
  }

  async function pollSessionOnce(): Promise<void> {
    const session = state.chat.session;
    if (!session) return;
    const res = await adapter.chatGetSession(session.id);
    if (destroyed || !res.ok || !res.value) return;
    state.chat.session = res.value;
    renderAll();
  }

  /** One poll cycle: refresh session; on reply completion parse drafts (never execute). */
  async function chatPollOnce(): Promise<void> {
    const session = state.chat.session;
    if (!session) {
      stopChatPoll();
      return;
    }
    const res = await adapter.chatGetSession(session.id);
    if (destroyed || !res.ok || !res.value) return;
    const prev = state.chat.session;
    state.chat.session = res.value;
    const nowPending = res.value.messages.some((m) => m.role === 'assistant' && m.status === 'pending');
    const justCompleted = res.value.messages.find(
      (m) =>
        m.role === 'assistant' &&
        m.status === 'completed' &&
        !(prev?.messages ?? []).some((p) => p.id === m.id && p.status === 'completed'),
    );
    state.chat.pendingReply = nowPending;
    if (!nowPending) stopChatPoll();
    const enterprise = entId();
    if (justCompleted && enterprise && justCompleted.text.includes('```')) {
      const parsed = await adapter.astDonnaParse({
        enterpriseId: enterprise,
        text: justCompleted.text,
        scope: state.scope,
        actor: 'donna',
        persist: true,
      });
      if (destroyed) return;
      if (parsed.ok) {
        state.chat.parsed += parsed.value.proposals.length;
        state.chat.dropped += parsed.value.dropped;
        overlay.toast(
          `Donna reply parsed: ${parsed.value.proposals.length} draft proposal(s) in the inbox (${parsed.value.dropped} untrusted block(s) dropped). Nothing was executed.`,
          { kind: 'ok' },
        );
        await refresh();
        return;
      }
    }
    renderAll();
  }

  async function previewBrief(objective: string): Promise<void> {
    const enterprise = entId();
    if (!enterprise) return;
    const res = await adapter.astDonnaPrompt({ enterpriseId: enterprise, objective: objective || '(no objective yet)' });
    if (!res.ok) {
      toastError('Donna brief failed', res.error);
      return;
    }
    state.chat.promptPreview = `${res.value.system}\n\n${res.value.user}`;
    renderPreservingFocus();
  }

  // -------------------------------------------------------------- event log

  function renderEvents(container: HTMLElement): void {
    if (state.events.length === 0) return;
    const details = el('details', 'donna-events');
    details.append(el('summary', '', `Assistant ledger (${state.events.length} event(s))`));
    const list = el('ul', '');
    for (const e of state.events.slice(-8).reverse()) {
      list.append(el('li', 'muted', `#${e.seq} ${e.ts} — ${e.event}${e.detail ? ` · ${e.detail}` : ''}`));
    }
    details.append(list);
    container.append(details);
  }

  // -------------------------------------------------------------- lifecycle

  function subscribe(): void {
    if (unsubscribe || !state.available) return;
    unsubscribe = adapter.onAssistantEvent(() => {
      scheduleRefresh();
    });
  }

  const controller: DonnaDrawer = {
    async open() {
      if (destroyed || state.open) return;
      state.open = true;
      drawer.classList.remove('hidden');
      if (!state.scopeKey) state.scopeKey = defaultScopeKey(state.scope);
      subscribe();
      await refresh();
      drawer.querySelector<HTMLElement>('[data-focus-key="donna-close"]')?.focus();
    },
    close() {
      state.open = false;
      drawer.classList.add('hidden');
      stopChatPoll();
    },
    async toggle() {
      if (state.open) controller.close();
      else await controller.open();
    },
    isOpen: () => state.open,
    refresh,
    chatPollOnce,
    state: () => state,
    destroy() {
      destroyed = true;
      stopChatPoll();
      if (coalesceTimer !== null) window.clearTimeout(coalesceTimer);
      unsubscribe?.();
      drawer.remove();
    },
  };

  return controller;
}
