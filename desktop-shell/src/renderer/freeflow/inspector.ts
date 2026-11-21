// Freeflow ownership inspector. Presentation-only: builds a DOM panel from a scene node or thread
// plus host capability data. No bridge calls. All text via textContent.

import type { FreeflowScene, SceneNode, SceneThread } from './model.js';

export type StudioActionKind =
  | 'chat' | 'jobs' | 'roadmap' | 'whiteboard' | 'ownership' | 'manage' | 'new-job'
  | 'new-company' | 'new-office' | 'new-department' | 'hire' | 'services' | 'settings';

export interface StudioActionContext {
  companyId?: string;
  officeId?: string;
  departmentId?: string;
  employeeId?: string;
  boardId?: string;
  roomId?: string;
  contractId?: string;
  nodeId?: string;
  threadId?: string;
}

export interface StudioActionState { enabled: boolean; reason?: string }

export interface InspectorActionSpec {
  action: StudioActionKind;
  label: string;
  context: StudioActionContext;
}

export interface InspectorView {
  setSelection(node: SceneNode | null, thread: SceneThread | null, scene: FreeflowScene | null): void;
  setCapabilities(fn: ((spec: InspectorActionSpec) => StudioActionState) | null): void;
  destroy(): void;
  elements: { root: HTMLElement; actions: HTMLElement };
}

export interface InspectorCallbacks {
  onAction(spec: InspectorActionSpec): void;
  onClose?(): void;
}

function ctxOf(n: SceneNode): StudioActionContext {
  const c: StudioActionContext = { companyId: n.companyId, nodeId: n.id };
  if (n.officeId) c.officeId = n.officeId;
  if (n.departmentId) c.departmentId = n.departmentId;
  if (n.employeeId) c.employeeId = n.employeeId;
  if (n.boardId) c.boardId = n.boardId;
  if (n.roomId) c.roomId = n.roomId;
  if (n.contractId) c.contractId = n.contractId;
  return c;
}

function str(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  return null;
}

export function rowsForNode(n: SceneNode): Array<[string, string]> {
  const rows: Array<[string, string]> = [['Kind', n.kind === 'reference' ? 'Contracted staff reference' : n.kind], ['Status', n.status]];
  if (n.subtitle) rows.push(['Role / note', n.subtitle]);
  const m = n.metadata;
  if (n.kind === 'employee' || n.kind === 'reference') {
    const kind = str(m['employeeKind']);
    if (kind) rows.push(['Employee kind', kind]);
    const home = m['homeCompanyId'];
    rows.push(['Employment home', home === null ? 'Shared global identity (no company)' : str(home) ?? 'unknown']);
    const svc = str(m['serviceCompanyId']);
    if (svc) rows.push(['Service provider company', svc]);
    const tools = str(m['allowedTools']);
    if (tools) rows.push(['Contract capabilities', tools]);
    if (n.contractId) rows.push(['Contract', n.contractId]);
    if (n.kind === 'reference') rows.push(['Ownership', 'Reference only; staff are not owned by this company']);
  }
  if (n.kind === 'whiteboard' && n.employeeId) rows.push(['Board owner', n.employeeId]);
  if (m['fallback'] === true) rows.push(['Placement', 'Not saved in a room; shown in the fallback area']);
  if (m['sharedServices'] === true) rows.push(['Portfolio role', 'Shared services company']);
  const counts = Object.entries(n.counts).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`);
  if (counts.length) rows.push(['Counts', counts.join(' · ')]);
  if (n.kind === 'employee' || n.kind === 'reference') {
    rows.push(['Linked jobs', String(n.counts['jobs'] ?? 0)]);
    rows.push(['Running jobs', String(n.counts['running'] ?? 0)]);
  }
  const heatLabel = str(m['heatLabel']);
  rows.push(['Heat', heatLabel ?? 'No metric supplied']);
  const heatMetric = str(m['heatMetric']);
  if (heatMetric) rows.push(['Heat metric', heatMetric]);
  return rows;
}

export function actionsForNode(n: SceneNode): InspectorActionSpec[] {
  const c = ctxOf(n);
  const a = (action: StudioActionKind, label: string, context: StudioActionContext = c): InspectorActionSpec => ({ action, label, context });
  switch (n.kind) {
    case 'folio': return [a('chat', 'Open company chat'), a('jobs', 'Jobs'), a('roadmap', 'Roadmap'), a('manage', 'Manage company'), a('new-office', 'Add office'), a('hire', 'Hire')];
    case 'office': return [a('chat', 'Chat in office'), a('jobs', 'Jobs'), a('new-department', 'Add department'), a('manage', 'Manage office'), a('hire', 'Hire')];
    case 'department': return [a('chat', 'Chat in department'), a('jobs', 'Jobs'), a('new-job', 'New job'), a('manage', 'Manage department'), a('hire', 'Hire')];
    case 'room': return [a('chat', 'Chat in room scope'), a('new-job', 'New job'), a('manage', 'Manage department'), a('hire', 'Hire')];
    case 'employee': return [a('chat', 'Ask this employee'), a('jobs', 'Linked jobs'), a('new-job', 'Assign job'), a('ownership', 'Ownership'), a('manage', 'Manage employee')];
    case 'reference': return [a('ownership', 'Ownership & contract'), a('services', 'Service contracts'), a('jobs', 'Linked jobs')];
    case 'whiteboard': return [a('whiteboard', 'Open board'), a('ownership', 'Ownership'), a('roadmap', 'Roadmap')];
    default: return [a('manage', 'Manage')];
  }
}

export function rowsForThread(t: SceneThread, scene: FreeflowScene | null): Array<[string, string]> {
  const name = (id: string) => scene?.nodes.find((x) => x.id === id)?.label ?? id;
  const kind = t.kind === 'service-contract' ? 'Service contract' : t.kind === 'shared-staff' ? 'Shared staff (home company)' : 'Board ownership';
  const rows: Array<[string, string]> = [['Relationship', kind], ['From', name(t.fromId)], ['To', name(t.toId)], ['Label', t.label]];
  if (t.contractId) rows.push(['Contract', t.contractId]);
  if (t.homeCompanyId) rows.push(['Home company', t.homeCompanyId]);
  rows.push(['Authority', 'This line describes a recorded relationship; it grants nothing by itself.']);
  return rows;
}

export function mountInspector(host: HTMLElement, cb: InspectorCallbacks): InspectorView {
  const root = document.createElement('aside');
  root.className = 'ff-inspector';
  root.setAttribute('aria-label', 'Ownership inspector');
  const head = document.createElement('h2');
  head.className = 'ff-inspector-header';
  const rows = document.createElement('dl');
  rows.className = 'ff-inspector-rows';
  const actions = document.createElement('div');
  actions.className = 'ff-inspector-actions';
  const note = document.createElement('p');
  note.className = 'ff-notice';
  note.hidden = true;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close inspector';
  const onClose = () => cb.onClose?.();
  close.addEventListener('click', onClose);
  root.append(head, rows, note, actions, close);
  host.appendChild(root);

  let caps: ((s: InspectorActionSpec) => StudioActionState) | null = null;
  let cur: { node: SceneNode | null; thread: SceneThread | null; scene: FreeflowScene | null } = { node: null, thread: null, scene: null };
  let destroyed = false;

  function render(): void {
    if (destroyed) return;
    rows.replaceChildren();
    actions.replaceChildren();
    note.hidden = true;
    let pairs: Array<[string, string]> = [];
    let specs: InspectorActionSpec[] = [];
    if (cur.thread) {
      head.textContent = 'Relationship';
      pairs = rowsForThread(cur.thread, cur.scene);
      const to = cur.scene?.nodes.find((x) => x.id === cur.thread!.toId);
      if (to) specs = [{ action: 'services', label: 'Service contracts', context: { ...ctxOf(to), threadId: cur.thread.id, contractId: cur.thread.contractId ?? undefined } }];
    } else if (cur.node) {
      head.textContent = cur.node.label;
      pairs = rowsForNode(cur.node);
      specs = actionsForNode(cur.node);
    } else {
      head.textContent = 'Nothing selected';
      pairs = [['Hint', 'Select a card, room, employee or board to inspect it. Selecting alone changes nothing.']];
    }
    for (const [k, v] of pairs) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      rows.append(dt, dd);
    }
    const reasons: string[] = [];
    for (const spec of specs) {
      const st = caps ? caps(spec) : { enabled: true };
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = spec.label;
      if (!st.enabled) {
        b.disabled = true;
        b.setAttribute('aria-disabled', 'true');
        const why = st.reason ?? 'Unavailable right now.';
        b.title = why;
        reasons.push(`${spec.label}: ${why}`);
      } else {
        b.addEventListener('click', () => cb.onAction(spec));
      }
      actions.appendChild(b);
    }
    if (reasons.length) { note.hidden = false; note.textContent = reasons.join(' · '); }
  }
  render();

  return {
    elements: { root, actions },
    setSelection(node, thread, scene) { cur = { node, thread, scene }; render(); },
    setCapabilities(fn) { caps = fn; render(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      close.removeEventListener('click', onClose);
      root.remove();
    },
  };
}
