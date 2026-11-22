import { createMutationController, newOwnerId, type MutationResult, type OwnerMutation } from './mutations.js';
import { STICKY_COLORS } from './notes.js';
import { buildImprovementTelemetry, type TelemetryOptions } from './telemetry.js';
import type { ImprovementSnapshot, ImprovementSession, StickyNote, StickyColor, ImprovementCoordinatorStatus } from './model.js';

export interface ImprovementScope { companyId: string; officeId: string; departmentId: string | null }
export interface ImprovementPanelOptions {
  snapshot(): ImprovementSnapshot | null;
  scope(): ImprovementScope | null;
  sampledAt(): string;
  workerEvidence(): TelemetryOptions['workerEvidence'];
  coordinatorStatus?(): ImprovementCoordinatorStatus | null | undefined;
  freshnessMs?(): number;
  readOnly(): boolean;
  command(command: OwnerMutation): Promise<MutationResult<ImprovementSnapshot>>;
  apply(snapshot: ImprovementSnapshot): void;
  refresh(): Promise<void>;
  openDonna(brief: string): void;
}
export interface ImprovementPanel { element: HTMLElement; refresh(): void; open(scope?: ImprovementScope | null, noteId?: string): void; destroy(): void }
const dollars = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(value > 0 && value < .01 ? 4 : 2)}` : 'Unknown';
const bytes = (value: string) => new TextEncoder().encode(value).length;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; }
function button(text: string, action: () => void, cls = 'secondary small'): HTMLButtonElement { const node = el('button', text, cls); node.type = 'button'; node.onclick = action; return node; }
function input(id: string, type = 'text', value = ''): HTMLInputElement { const node = document.createElement('input'); node.id = id; node.type = type; node.defaultValue = value; node.value = value; return node; }
function field(text: string, control: HTMLElement): HTMLLabelElement { const label = el('label', '', 'field'); label.append(document.createTextNode(text), control); return label; }
function select(id: string, entries: Array<[string, string]>): HTMLSelectElement { const node = document.createElement('select'); node.id = id; choices(node, entries); return node; }
function choices(node: HTMLSelectElement, entries: Array<[string, string]>, previous = node.value): void {
  node.replaceChildren(); for (const [value, text] of entries) { const option = el('option', text); option.value = value; node.append(option); }
  if (entries.some(([value]) => value === previous)) node.value = previous;
}
function sameScope(a: ImprovementScope, b: ImprovementScope): boolean { return a.companyId === b.companyId && a.officeId === b.officeId && a.departmentId === b.departmentId; }
function inScope<T extends ImprovementScope>(values: readonly T[] | undefined, scope: ImprovementScope | null): T[] { return scope ? (values ?? []).filter(value => sameScope(value, scope)) : []; }
function actors(snapshot: ImprovementSnapshot, scope: ImprovementScope): Array<{ key: string; id: string; contractId: string | null; label: string }> {
  const result: Array<{ key: string; id: string; contractId: string | null; label: string }> = [];
  for (const employee of snapshot.employees) {
    if (employee.status !== 'active') continue;
    if (employee.id === 'donna' && employee.companyId === null || employee.companyId === scope.companyId && (!employee.officeId || employee.officeId === scope.officeId) && (!employee.departmentId || employee.departmentId === scope.departmentId)) {
      result.push({ key: JSON.stringify([employee.id, null]), id: employee.id, contractId: null, label: employee.name });
    }
    for (const contract of snapshot.portfolio?.contracts ?? []) if (contract.status === 'active' && contract.recipientCompanyId === scope.companyId && (!contract.recipientOfficeId || contract.recipientOfficeId === scope.officeId) && (!contract.recipientDepartmentId || contract.recipientDepartmentId === scope.departmentId) && contract.employeeIds.includes(employee.id)) {
      result.push({ key: JSON.stringify([employee.id, contract.id]), id: employee.id, contractId: contract.id, label: `${employee.name} · shared contract` });
    }
  }
  return result.slice(0, 1000);
}

export function mountImprovementPanel(options: ImprovementPanelOptions): ImprovementPanel {
  const root = el('section', '', 'improvement-panel'); root.id = 'improvement-panel';
  let disposed = false, scope: ImprovementScope | null = options.scope(), base: StickyNote | null = null;
  let noteId = newOwnerId('note'), noteDirty = false, sessionDirty = false, page = 0;
  const heading = el('div', '', 'canvas-toolbar');
  const title = el('div'); title.append(el('p', 'NOTES · IMPROVEMENT · EVIDENCE', 'eyebrow'), el('h2', 'Small notes. Deliberate progress.'));
  const scopeLabel = el('p', '', 'improvement-scope'); title.append(scopeLabel);
  heading.append(title, button('Refresh records', () => { void options.refresh().catch(showError); })); root.append(heading);
  const status = el('p', '', 'status improvement-status'); status.id = 'improvement-status'; status.setAttribute('role', 'status'); root.append(status);
  const pendingBox = el('div', '', 'improvement-pending'); pendingBox.id = 'improvement-pending'; pendingBox.hidden = true;
  const pendingText = el('p'), retry = button('Retry exact saved request', () => { void save().catch(showError); }); retry.id = 'improvement-retry';
  pendingBox.append(pendingText, retry, el('p', 'Keep this window open. The request keeps its original scope, revision, payload and identity.', 'form-help')); root.append(pendingBox);
  const controller = createMutationController(options.command, syncPending);
  const tabs = el('div', '', 'improvement-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Notes and improvement tools');
  const panes = new Map<string, HTMLElement>(), tabButtons = new Map<string, HTMLButtonElement>();
  for (const [id, label] of [['notes', 'Notes & to-dos'], ['sessions', 'Improvement mode'], ['evidence', 'Activity & output']]) {
    const pane = el('section', '', `improvement-pane improvement-${id}`); pane.id = `improvement-${id}`; pane.setAttribute('role', 'tabpanel');
    const tab = button(label!, () => showTab(id!)); tab.id = `improvement-tab-${id}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', pane.id); pane.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const all = [...tabButtons.values()], index = all.indexOf(tab), next = event.key === 'Home' ? all[0] : event.key === 'End' ? all.at(-1) : all[(index + (event.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]; next?.click(); next?.focus(); });
    panes.set(id!, pane); tabButtons.set(id!, tab); tabs.append(tab);
  }
  root.append(tabs, ...panes.values());
  function showTab(id: string) { for (const [key, pane] of panes) { pane.hidden = key !== id; const tab = tabButtons.get(key)!; tab.setAttribute('aria-selected', String(key === id)); tab.tabIndex = key === id ? 0 : -1; } }
  const notesPane = panes.get('notes')!, notesTools = el('div', '', 'improvement-tools');
  const noteScope = select('improvement-note-scope', []), noteSearch = input('improvement-note-search', 'search'); noteSearch.placeholder = 'Find a saved note…';
  notesTools.append(field('Office / department', noteScope), field('Search', noteSearch), button('+ Note', () => resetNote())); notesPane.append(notesTools);
  const notesLayout = el('div', '', 'improvement-note-layout'), notesList = el('div', '', 'improvement-note-list'); notesList.setAttribute('aria-label', 'Saved notes in this scope');
  const pager = el('div', '', 'row wrap'), pageText = el('span');
  pager.append(button('Previous', () => { page = Math.max(0, page - 1); renderNotes(); }), pageText, button('Next', () => { page++; renderNotes(); }));
  const noteColumn = el('div'); noteColumn.append(notesList, pager);
  const form = el('form', '', 'stack improvement-note-form'); form.id = 'improvement-note-form';
  const editorTitle = el('h3', 'Add a saved note'), noteText = el('textarea'); noteText.id = 'improvement-note-text'; noteText.rows = 4; noteText.maxLength = 4000; noteText.required = true;
  const kind = select('improvement-note-kind', [['comment', 'Comment'], ['todo', 'To-do']]);
  const color = select('improvement-note-color', Object.keys(STICKY_COLORS).map(key => [key, key[0]!.toUpperCase() + key.slice(1)]));
  const noteState = select('improvement-note-state', [['open', 'Open'], ['done', 'Done (annotation only)']]), steward = select('improvement-note-owner', []);
  const x = input('improvement-note-x', 'number', '75'), y = input('improvement-note-y', 'number', '15'); for (const p of [x, y]) { p.min = '0'; p.max = '100'; p.step = 'any'; }
  const goalSelect = select('improvement-note-goals', []); goalSelect.multiple = true; goalSelect.size = 3;
  const noteGrid = el('div', '', 'form-grid'); noteGrid.append(field('Kind', kind), field('Color', color), field('State', noteState), field('Board steward', steward), field('Horizontal · %', x), field('Vertical · %', y));
  const noteSubmit = el('button', 'Save note'); noteSubmit.type = 'submit'; noteSubmit.id = 'improvement-note-save';
  const reload = button('Reload saved note', () => { const current = options.snapshot()?.stickyNotes?.find(n => n.id === base?.id); if (current) editNote(current, true); else resetNote(true); }); reload.id = 'improvement-note-reload';
  const archive = button('Archive', () => { if (!base || noteDirty) { showError(Error('Save or reload this draft before archiving.')); return; } void save({ action: 'archive_sticky_note', requestId: newOwnerId('note-archive'), noteId: base.id, expectedRevision: base.revision }).then(() => resetNote(true)).catch(showError); }); archive.id = 'improvement-note-archive';
  const noteActions = el('div', '', 'row wrap'); noteActions.append(noteSubmit, reload, archive);
  form.append(editorTitle, field('Note or to-do', noteText), noteGrid, field('Linked native goals · Ctrl/Cmd to select more', goalSelect), el('p', 'Stewardship, color and checklist state grant no execution access and do not accept a review. Position stays within its saved scope.', 'form-help'), noteActions);
  form.addEventListener('input', () => { noteDirty = true; }); form.addEventListener('change', () => { noteDirty = true; });
  form.onsubmit = event => { event.preventDefault(); void saveNote().catch(showError); };
  notesLayout.append(noteColumn, form); notesPane.append(notesLayout);
  noteSearch.oninput = () => { page = 0; renderNotes(); };
  noteScope.onchange = () => { if (noteDirty || sessionDirty || controller.pending()) { showError(Error('Save or reload the current draft before changing this surface’s scope.')); renderScope(); return; } const next = scopeOptions().find(item => item.key === noteScope.value); if (next) { scope = next.scope; base = null; resetNote(true); render(); } };

  const sessionsPane = panes.get('sessions')!, budget = el('section', '', 'improvement-budget'), sessions = el('div', '', 'improvement-sessions-list');
  sessionsPane.append(budget);
  const allowanceDetails = el('details', '', 'improvement-create'), allowanceForm = el('form', '', 'stack'); allowanceForm.id = 'improvement-allowance-form';
  allowanceDetails.append(el('summary', 'Register the one-time parent allowance'));
  const cap = input('improvement-cap', 'number', '20'), carryObserved = input('improvement-carry-observed', 'number', '0'), carryEstimated = input('improvement-carry-estimated', 'number', '0'), carrySource = input('improvement-carry-source');
  cap.min = '.001'; cap.max = '20'; cap.step = '.001'; for (const value of [carryObserved, carryEstimated]) { value.min = '0'; value.max = '20'; value.step = 'any'; } carrySource.maxLength = 200; carrySource.required = true;
  const reviewed = input('improvement-carry-reviewed', 'checkbox'); reviewed.required = true;
  const allowanceFields = el('div', '', 'form-grid'); allowanceFields.append(field('Immutable cap · USD (max 20)', cap), field('Already observed · USD', carryObserved), field('Already estimated · USD', carryEstimated));
  const register = el('button', 'Register allowance'); register.type = 'submit';
  allowanceForm.append(el('p', 'This is one immutable allowance for every session. Registration cannot raise the global cap. Review prior carry amounts to avoid counting a commitment twice; the development ledger is separate.', 'form-help'), allowanceFields, field('Reviewed carry checkpoint / source', carrySource), field('I reviewed these nonduplicated carry amounts.', reviewed), register); allowanceDetails.append(allowanceForm); sessionsPane.append(allowanceDetails);
  allowanceForm.onsubmit = event => { event.preventDefault(); void (async () => {
    const capUsd = Number(cap.value), carriedObservedUsd = Number(carryObserved.value), carriedEstimatedUsd = Number(carryEstimated.value);
    if (!reviewed.checked || !carrySource.value.trim() || ![capUsd, carriedObservedUsd, carriedEstimatedUsd].every(Number.isFinite) || capUsd <= 0 || capUsd > 20 || carriedObservedUsd < 0 || carriedEstimatedUsd < 0 || carriedObservedUsd + carriedEstimatedUsd > capUsd) throw Error('Review the carry checkpoint and use a cap of at most $20 with nonnegative carried amounts within it.');
    await save({ action: 'register_improvement_allowance', requestId: newOwnerId('allowance-request'), id: newOwnerId('allowance'), capUsd, carriedObservedUsd, carriedEstimatedUsd, sourceReference: carrySource.value.trim() }); allowanceDetails.open = false;
  })().catch(showError); };
  const createDetails = el('details', '', 'improvement-create'); createDetails.id = 'improvement-create-session'; createDetails.append(el('summary', 'Create a paused improvement session'));
  const sessionForm = el('form', '', 'stack'); sessionForm.id = 'improvement-session-form';
  const sessionTitle = input('improvement-session-title'), objective = el('textarea'); sessionTitle.maxLength = 120; sessionTitle.required = true; objective.id = 'improvement-objective'; objective.maxLength = 4000; objective.rows = 3;
  const producer = select('improvement-primary', []), reviewer = select('improvement-reviewer', []), routes = el('textarea'); routes.id = 'improvement-routes'; routes.rows = 3; routes.maxLength = 4000; routes.placeholder = 'anthropic model-id\nopenai model-id\nollama local-model:tag';
  const maxTokens = input('improvement-max-tokens', 'number', '32000'), maxUsd = input('improvement-max-usd', 'number', '.25'), maxMinutes = input('improvement-max-minutes', 'number', '10'), maxCycles = input('improvement-max-cycles', 'number');
  maxTokens.min = '1'; maxTokens.max = '200000'; maxUsd.min = '.001'; maxUsd.max = '20'; maxUsd.step = '.001'; maxMinutes.min = '.1'; maxMinutes.max = '120'; maxMinutes.step = '.1'; maxCycles.min = '1'; maxCycles.max = '1000'; maxCycles.placeholder = 'No extra cycle cap';
  const continuation = select('improvement-continuation', [['until-budget', 'Continue within remaining budget'], ['backlog', 'Only the selected to-dos']]);
  const tasks = select('improvement-todos', []); tasks.multiple = true; tasks.size = 3;
  const authorized = input('improvement-authorized', 'checkbox'); authorized.required = true;
  const readRepository = input('improvement-read-repository','checkbox'), publishChanges = input('improvement-publish-changes','checkbox');
  const capabilities=el('fieldset','','stack improvement-capabilities');capabilities.append(el('legend','Use existing repository capabilities (optional)'),field('Read repository overview and README',readRepository),field('Allow producer to publish a changeset (also requires read)',publishChanges),el('p','These choices use existing access. Publishing happens before helper review; the helper gates the next cycle. This session does not run builds or tests. Without a recorded managed action, output remains a proposal.','form-help'));
  const limits = el('div', '', 'form-grid'); limits.append(field('Primary employee', producer), field('Independent reviewer', reviewer), field('Pair token limit', maxTokens), field('Pair USD limit', maxUsd), field('Time target · minutes', maxMinutes), field('Optional cycle cap', maxCycles));
  const create = el('button', 'Create paused session'); create.type = 'submit'; create.id = 'improvement-session-save';
  const discardSession = button('Discard session draft', () => { if (controller.pending()) return; sessionForm.reset(); sessionDirty = false; renderSessionChoices(); });
  sessionForm.append(field('Session title', sessionTitle), field('Scoped improvement objective', objective), limits, field('Allowed model routes · provider then model ID, one per line', routes), el('p', 'The shipped hosted price catalog covers anthropic claude-haiku-5-5 and anthropic claude-sonnet-5-5. Models must also be connected. Other hosted models need a reviewed price entry; installed local models need both employees’ assignments and sharing access.', 'form-help'), field('Continuation', continuation), field('Selected open to-dos · Ctrl/Cmd to select more', tasks),capabilities, field('Authorize this paired work within the existing policy and all limits.', authorized), el('p', 'No model or price is guessed. Runtime selects a permitted, currently quoted route. Creation is paused; Start is a separate action. Repository changes still require existing tools and recorded results.', 'form-help'), create, discardSession);
  sessionForm.addEventListener('input', () => { sessionDirty = true; }); sessionForm.addEventListener('change', () => { sessionDirty = true; });
  sessionForm.onsubmit = event => { event.preventDefault(); void saveSession().catch(showError); }; createDetails.append(sessionForm); sessionsPane.append(createDetails, sessions);
  const evidencePane = panes.get('evidence')!;

  function showError(error: unknown) { if (disposed) return; status.textContent = `${error instanceof Error ? error.message : String(error)} Your draft is kept.`; status.className = 'status improvement-status error'; syncPending(); }
  function syncPending() {
    const pending = controller.pending(); pendingBox.hidden = !pending;
    pendingText.textContent = pending ? `${pending.command.action} · ${pending.command.requestId} · ${pending.state === 'sending' ? 'awaiting native acknowledgement' : 'outcome unconfirmed'}` : '';
    retry.disabled = !pending || pending.state === 'sending';
    for (const control of Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('form input,form select,form textarea,form button'))) control.disabled = options.readOnly() || !!pending;
    if (!pending) { archive.disabled = options.readOnly() || !base; reload.disabled = options.readOnly(); kind.disabled = options.readOnly() || !!base; }
    kind.title = base ? 'A saved note keeps its original kind. Create a new note to use the other kind.' : '';
  }
  async function save(command?: OwnerMutation): Promise<void> {
    if (options.readOnly()) throw Error('Open a writable office-3 workspace to change notes or sessions.');
    const sent = command ?? controller.pending()?.command;
    const snapshot = await controller.dispatch(command); if (disposed) return;
    options.apply(snapshot);
    if (sent?.action === 'upsert_sticky_note') { const saved = snapshot.stickyNotes?.find(n => n.id === sent.id); if (saved) editNote(saved, true); }
    if (sent?.action === 'archive_sticky_note') resetNote(true);
    if (sent?.action === 'create_improvement_session') { sessionDirty = false; sessionForm.reset(); authorized.checked = false; createDetails.open = false; }
    render(); status.textContent = sent?.action === 'create_improvement_session' ? 'Session saved paused. Start explicitly when ready. Session controls are independent of the ordinary queue; global dispatch pause applies to both.' : 'Native change acknowledged.'; status.className = 'status improvement-status ok';
  }
  function scopeOptions(): Array<{ key: string; label: string; scope: ImprovementScope }> {
    const snapshot = options.snapshot(); if (!snapshot || !scope) return [];
    return snapshot.offices.filter(o => o.companyId === scope!.companyId && o.status === 'active').flatMap(o => [
      { key: o.id, label: `${o.name} · company notes`, scope: { companyId: scope!.companyId, officeId: o.id, departmentId: null } },
      ...snapshot.departments.filter(d => d.companyId === scope!.companyId && d.officeId === o.id && d.status === 'active').map(d => ({ key: `${o.id}/${d.id}`, label: `${o.name} / ${d.name}`, scope: { companyId: scope!.companyId, officeId: o.id, departmentId: d.id } })),
    ]);
  }
  function renderScope() {
    const snapshot = options.snapshot(); scopeLabel.textContent = scope ? `${snapshot?.companies.find(c => c.id === scope!.companyId)?.name || scope.companyId} · ${snapshot?.offices.find(o => o.id === scope!.officeId)?.name || scope.officeId}${scope.departmentId ? ` / ${snapshot?.departments.find(d => d.id === scope!.departmentId)?.name || scope.departmentId}` : ''}` : 'Select a saved company and office.';
    choices(noteScope, scopeOptions().map(o => [o.key, o.label]), scope ? `${scope.officeId}${scope.departmentId ? `/${scope.departmentId}` : ''}` : '');
  }
  function renderNoteChoices() {
    const snapshot = options.snapshot(); if (!snapshot || !scope) return;
    const owners = [...new Map(actors(snapshot, scope).filter(a=>a.contractId===null).map(a => [a.id, a.label])).entries()];
    const previousOwner = base?.ownerEmployeeId ?? steward.value;
    if(previousOwner&&!owners.some(([id])=>id===previousOwner))owners.push([previousOwner,`Saved steward unavailable · ${previousOwner}`]);
    choices(steward, [['', 'No steward'], ...owners], previousOwner);
    const selected = new Set(Array.from(goalSelect.selectedOptions, o => o.value));
    if (base) for (const id of base.goalIds) selected.add(id);
    const candidates = (snapshot.goals ?? []).filter(g => g.companyId === scope!.companyId && (scope!.departmentId ? g.scope.kind === 'department' && g.scope.id === scope!.departmentId : g.scope.kind === 'company' && g.scope.id === scope!.companyId || g.scope.kind === 'office' && g.scope.id === scope!.officeId));
    choices(goalSelect, candidates.slice(0, 1000).map(g => [g.id, g.title]));
    for (const id of selected) if (!Array.from(goalSelect.options).some(o => o.value === id)) { const option = el('option', `Saved link · ${id}`); option.value = id; goalSelect.append(option); }
    for (const option of Array.from(goalSelect.options)) option.selected = selected.has(option.value);
  }
  function editNote(note: StickyNote, explicit = false) {
    if (!explicit && (noteDirty || controller.pending())) { showError(Error('Save or reload your current draft before opening another note.')); return; }
    base = structuredClone(note); scope = { companyId: note.companyId, officeId: note.officeId, departmentId: note.departmentId }; noteId = note.id; noteDirty = false;
    noteText.value = note.text; kind.value = note.kind; color.value = note.color; noteState.value = note.status === 'done' ? 'done' : 'open'; x.value = String(note.x * 100); y.value = String(note.y * 100);
    goalSelect.replaceChildren(); renderScope(); renderNoteChoices(); steward.value = note.ownerEmployeeId || '';
    editorTitle.textContent = `Edit ${note.kind === 'todo' ? 'to-do' : 'comment'} · revision ${note.revision}`; form.classList.remove('board-stale'); showTab('notes'); syncPending();
  }
  function resetNote(explicit = false) {
    if (controller.pending() || !explicit && noteDirty) { showError(Error('Reload the current draft before adding a different note.')); return; }
    base = null; noteId = newOwnerId('note'); noteDirty = false; form.reset(); noteText.value = ''; goalSelect.replaceChildren();
    const count = inScope(options.snapshot()?.stickyNotes, scope).filter(n => n.status !== 'archived').length;
    x.value = String(65 + count % 3 * 10); y.value = String(10 + Math.floor(count / 3) % 4 * 20); editorTitle.textContent = 'Add a saved note'; form.classList.remove('board-stale'); renderNoteChoices(); syncPending();
  }
  async function saveNote() {
    if (!scope) throw Error('Choose a saved company and office first.');
    const text = noteText.value.trim(), percentX = Number(x.value), percentY = Number(y.value);
    // Preserve the original native fraction on a text-only edit; multiplying
    // and dividing by 100 can otherwise introduce a floating-point delta.
    const nx = base && percentX === base.x * 100 ? base.x : percentX / 100;
    const ny = base && percentY === base.y * 100 ? base.y : percentY / 100;
    if (!text || bytes(text) > 4000 || text.includes('\0')) throw Error('Keep note text between 1 and 4,000 UTF-8 bytes without NUL characters.');
    if (![nx, ny].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) throw Error('Use a position between 0% and 100% in this scope.');
    const goalIds = Array.from(goalSelect.selectedOptions, o => o.value); if (goalIds.length > 100) throw Error('A note can link at most 100 native goals.');
    await save({ action: 'upsert_sticky_note', requestId: newOwnerId('note-request'), id: noteId, expectedRevision: base?.revision ?? 0,
      ...(base ? { companyId: base.companyId, officeId: base.officeId, departmentId: base.departmentId } : scope), kind: kind.value, color: color.value,
      text, status: noteState.value, ownerEmployeeId: steward.value || null, goalIds, x: nx, y: ny });
  }
  function renderNotes() {
    const snapshot = options.snapshot(), query = noteSearch.value.toLocaleLowerCase();
    const all = inScope(snapshot?.stickyNotes, scope).filter(n => n.status !== 'archived' && (!query || `${n.text} ${n.id}`.toLocaleLowerCase().includes(query)));
    page = Math.min(page, Math.max(0, Math.ceil(all.length / 24) - 1)); notesList.replaceChildren(); pageText.textContent = `${all.length} notes · page ${page + 1}/${Math.max(1, Math.ceil(all.length / 24))}`;
    for (const note of all.slice(page * 24, (page + 1) * 24)) {
      const item = button('', () => editNote(note), 'improvement-note-preview'); item.dataset.noteId = note.id; item.style.setProperty('--sticky-color', STICKY_COLORS[note.color] ?? STICKY_COLORS.gray);
      item.append(el('small', `${note.kind === 'todo' ? 'To-do' : 'Comment'} · ${note.status}`), el('strong', note.text.slice(0, 240)), el('span', snapshot?.employees.find(e => e.id === note.ownerEmployeeId)?.name || 'No board steward')); notesList.append(item);
    }
    if (!all.length) notesList.append(el('p', 'Add a comment or to-do. Its colored preview will appear inside this saved company or department.', 'empty-inline'));
    const current = snapshot?.stickyNotes?.find(n => n.id === base?.id);
    if (base && (!current || current.revision !== base.revision)) { form.classList.add('board-stale'); status.textContent = 'This note changed after editing began. Your draft and original revision are kept; reload explicitly to reconcile.'; status.className = 'status improvement-status error'; }
  }
  function renderSessionChoices() {
    if (sessionDirty) return;
    const snapshot = options.snapshot(); if (!snapshot || !scope) return;
    const eligible = actors(snapshot, scope), entries: Array<[string, string]> = eligible.map(a => [a.key, a.label]); choices(producer, entries); choices(reviewer, entries);
    if (eligible.find(a=>a.key===producer.value)?.id === eligible.find(a=>a.key===reviewer.value)?.id) { const different = eligible.find(a=>a.id!==eligible.find(b=>b.key===producer.value)?.id); if(different)reviewer.value=different.key; }
    choices(tasks, inScope(snapshot.stickyNotes, scope).filter(n => n.kind === 'todo' && n.status === 'open').slice(0, 128).map(n => [n.id, n.text.slice(0, 120)]));
  }
  async function saveSession() {
    const snapshot = options.snapshot(); if (!snapshot || !scope || !snapshot.improvementAllowance) throw Error('Register the immutable parent allowance and choose a scope first.');
    const eligible = actors(snapshot, scope), primary = eligible.find(a => a.key === producer.value), helper = eligible.find(a => a.key === reviewer.value);
    if (!primary || !helper || primary.id === helper.id) throw Error('Choose distinct active primary and reviewer employees eligible for this exact scope.');
    const allowedRoutes = routes.value.trim().split(/\r?\n/).filter(Boolean).map(line => { const match = /^(anthropic|openai|ollama)\s+(\S{1,200})$/.exec(line.trim()); if (!match) throw Error('Write each allowed route as provider, a space, then its exact model ID.'); return { provider: match[1] as 'anthropic' | 'openai' | 'ollama', model: match[2]! }; });
    if (!allowedRoutes.length || allowedRoutes.length > 16 || allowedRoutes.some(r=>bytes(r.model)>200||r.model.includes('\0')) || new Set(allowedRoutes.map(r => `${r.provider}/${r.model}`)).size !== allowedRoutes.length) throw Error('Use 1–16 distinct explicit allowed model routes with model IDs at most 200 UTF-8 bytes.');
    const selectedTasks = Array.from(tasks.selectedOptions, o => o.value), text = objective.value.trim(), cycles = maxCycles.value.trim() ? Number(maxCycles.value) : null;
    const limits = { maxTokens: Number(maxTokens.value), maxUsd: Number(maxUsd.value), maxMinutes: Number(maxMinutes.value) };
    if(publishChanges.checked&&!readRepository.checked)throw Error('Managed publication also requires Read company repository. Existing native grants and the connected capability will be checked.');
    const allowedTools=[...(readRepository.checked?['github.read_repository']:[]),...(publishChanges.checked?['github.publish_changes']:[])];
    if (!sessionTitle.value.trim() || bytes(sessionTitle.value.trim()) > 120 || bytes(text) > 4000 || text.includes('\0') || !text && !selectedTasks.length) throw Error('Give this session a short title and a scoped objective or selected to-dos.');
    if (!authorized.checked || !Number.isInteger(limits.maxTokens) || limits.maxTokens < 1 || limits.maxTokens > 200000 || !Number.isFinite(limits.maxUsd) || limits.maxUsd <= 0 || limits.maxUsd > 20 || !Number.isFinite(limits.maxMinutes) || limits.maxMinutes <= 0 || limits.maxMinutes > 120 || cycles !== null && (!Number.isInteger(cycles) || cycles < 1 || cycles > 1000)) throw Error('Authorize bounded paired work with valid token, USD, time and optional cycle limits.');
    await save({ action: 'create_improvement_session', requestId: newOwnerId('session-request'), id: newOwnerId('session'), expectedRevision: 0, ...scope,
      allowanceId: snapshot.improvementAllowance.id, title: sessionTitle.value.trim(), objective: text, primaryEmployeeId: primary.id, reviewerEmployeeId: helper.id,
      serviceContractId: primary.contractId, reviewerServiceContractId: helper.contractId, runSettings: { mode: 'provider', ...allowedRoutes[0]!, authorized: true, ...limits, priceRates: { inputUsdPerMillion: null, outputUsdPerMillion: null }, allowedTools },
      allowedRoutes, continuation: continuation.value, maxCycles: cycles, taskNoteIds: selectedTasks });
  }
  function renderBudget() {
    const snapshot = options.snapshot(), allowance = snapshot?.improvementAllowance, totals = snapshot?.improvementBudget; budget.replaceChildren();
    allowanceDetails.hidden = !!allowance; createDetails.hidden = !allowance;
    if (!allowance) { budget.append(el('h3', 'One allowance. Every session.'), el('p', 'No application improvement allowance is registered. Registration records a ceiling; it does not start work.', 'form-help')); return; }
    budget.append(el('h3', `${dollars(allowance.capUsd)} immutable parent ceiling`));
    if (!totals || ![totals.capUsd, totals.committedUsd, totals.effectiveRemainingUsd].every(v => Number.isFinite(v) && v >= 0)) { budget.append(el('p', 'Native parent budget totals are unavailable. Remaining spend is unknown.', 'form-help')); return; }
    const meter = document.createElement('progress'); meter.max = Math.max(.001, totals.capUsd); meter.value = Math.min(totals.capUsd, totals.committedUsd); meter.setAttribute('aria-label', 'Committed improvement allowance');
    budget.append(meter, el('p', `${dollars(totals.effectiveRemainingUsd)} available under both ceilings · parent remaining ${dollars(totals.remainingUsd)} · global remaining ${dollars(snapshot?.budget?.remainingUsd)}`, 'improvement-budget-remaining'));
    budget.append(el('p', `Observed ${dollars(totals.observedUsd)} · estimated ${dollars(totals.estimatedUsd)} · reserved ${dollars(totals.reservedUsd)} · held ${dollars(totals.heldUsd)} · carried ${dollars(totals.carriedObservedUsd + totals.carriedEstimatedUsd)}`, 'form-help'));
    budget.append(el('p', 'Observed means reported tokens at declared rates, not a provider invoice. Pending and uncertain commitments remain counted by native admission.', 'form-help'));
  }
  function control(session: ImprovementSession, operation: 'start' | 'pause' | 'resume' | 'cancel') {
    void save({ action: 'control_improvement_session', requestId: newOwnerId(`session-${operation}`), sessionId: session.id, expectedRevision: session.revision, operation }).catch(showError);
  }
  function coordinatorMessage(session: ImprovementSession): HTMLElement {
    const status = options.coordinatorStatus?.(), node = el('p', '', 'form-help improvement-coordinator-status');
    const unknown = (text = 'Coordinator status unavailable here. Active is a saved scheduling state, not proof of a running call.') => { node.dataset.state = 'unavailable'; node.textContent = text; return node; };
    if (!status) return unknown();
    const now = Date.now(), freshness = options.freshnessMs?.() ?? 15000;
    const fresh = (stamp: string) => { const age = now - Date.parse(stamp); return Number.isFinite(age) && age >= 0 && age < freshness; };
    if (!fresh(status.sampledAt)) { node.dataset.state = 'stale'; node.textContent = 'Coordinator status is stale. Current scheduling and model activity are unknown; refresh records.'; return node; }
    if (!status.enabled) { node.dataset.state = 'disabled'; node.textContent = 'The runtime improvement coordinator is stopped. This saved session is not being scheduled here.'; return node; }
    const observation = status.observation;
    if (!observation || observation.sessionId !== session.id || observation.sessionRevision !== session.revision || !sameScope(observation, session)) return unknown('No current coordinator check matches this session and revision. Model activity is unknown.');
    if (!fresh(observation.checkedAt)) { node.dataset.state = 'stale'; node.textContent = 'The last coordinator check is stale. Its earlier result does not confirm current model availability; refresh records.'; return node; }
    if (observation.outcome === 'checking' && !status.checking) return unknown('The earlier coordinator check did not provide a current result. Refresh records; model activity is unknown.');
    node.dataset.state = observation.outcome;
    if (observation.reason) node.dataset.reason = observation.reason;
    node.title = `Coordinator checked ${observation.checkedAt}${observation.reason ? ` · ${observation.reason}` : ''}`;
    if (observation.outcome === 'checking') node.textContent = 'The coordinator is checking this session. A model call is not confirmed.';
    else if (observation.reason === 'no-current-eligible-priced-route') node.textContent = 'No permitted model has both a live connection and a current price quote. Check Connections and allowed routes. No new job was created by this check.';
    else if (observation.reason === 'attempt-needs-review') node.textContent = 'The last attempt needs review. Inspect its saved evidence and native stop reason before further work.';
    else if (observation.reason === 'improvement-state-needs-review') node.textContent = 'The coordinator could not confirm this attempt. Refresh records and inspect the saved state; no automatic retry of model work is implied.';
    else if (observation.outcome === 'progress') node.textContent = 'The last coordinator check recorded progress. See Activity & output for actual calls and results.';
    else if (observation.outcome === 'idle') node.textContent = 'The last coordinator check found no new attempt to run. This is not evidence of a running model.';
    else return unknown();
    return node;
  }
  function renderSessions() {
    sessions.replaceChildren(); const snapshot = options.snapshot(), all = inScope(snapshot?.improvementSessions, scope);
    for (const session of all.slice(0, 64)) {
      const item = el('article', '', 'improvement-session'); item.dataset.sessionId = session.id;
      item.append(el('h3', session.title), el('p', `${session.status === 'active' ? 'Enabled' : session.status.replaceAll('-', ' ')} · cycle ${session.cycle}${session.maxCycles === null ? '' : ` / ${session.maxCycles}`}`, 'improvement-session-state'),
        el('p', `Primary: ${snapshot?.employees.find(e => e.id === session.primaryEmployeeId)?.name || session.primaryEmployeeId} · Independent reviewer: ${snapshot?.employees.find(e => e.id === session.reviewerEmployeeId)?.name || session.reviewerEmployeeId}`, 'form-help'));
      if (session.stopReason) item.append(el('p', session.stopReason, 'improvement-stop-reason'));
      if (['active', 'waiting-work', 'waiting-budget'].includes(session.status)) item.append(coordinatorMessage(session));
      if (session.status === 'active') item.append(el('p', 'Enabled allows scheduling. Activity & output shows actual calls; an eligible connected model and a current reviewed price are still required.', 'form-help'));
      const actions = el('div', '', 'row wrap');
      if (session.status === 'paused') actions.append(button(session.cycle ? 'Resume' : 'Start', () => control(session, session.cycle ? 'resume' : 'start')));
      if (['active', 'waiting-work', 'waiting-budget'].includes(session.status)) actions.append(button('Pause new dispatch', () => control(session, 'pause')));
      if (!['completed', 'cancelled'].includes(session.status)) actions.append(button('Cancel session', () => control(session, 'cancel'), 'text-button'));
      if (session.activeGoalId) actions.append(button('Inspect with Donna', () => options.openDonna(`Inspect improvement session ${session.id}, goal ${session.activeGoalId}. Explain recorded evidence and the stop reason before proposing any new execution.`), 'text-button'));
      for (const action of Array.from(actions.querySelectorAll<HTMLButtonElement>('button'))) action.disabled = options.readOnly() || !!controller.pending();
      item.append(actions, el('p', 'Session Pause stops new session dispatch; an already dispatched call may settle. Ordinary queue controls are separate. Global dispatch pause applies to both. Cancel does not reset the parent allowance.', 'form-help')); sessions.append(item);
    }
    if (!all.length) sessions.append(el('p', 'No saved improvement sessions in this scope.', 'empty-inline'));
    if (all.length > 64) sessions.append(el('p', `${all.length - 64} additional historical sessions are retained; narrow the department scope.`, 'form-help'));
  }
  function chart(title: string, data: Array<{ label: string; a: number; b: number }>, labels: [string, string], money = false): HTMLElement {
    const figure = el('figure', '', 'improvement-chart'); figure.append(el('figcaption', title)); const bars = el('div', '', 'improvement-chart-bars'); bars.setAttribute('role', 'img'); bars.setAttribute('aria-label', `${title}. ${data.map(d => `${d.label}: ${labels[0]} ${money ? dollars(d.a) : d.a}, ${labels[1]} ${money ? dollars(d.b) : d.b}`).join('; ')}`);
    const maximum = Math.max(1e-6, ...data.flatMap(d => [d.a, d.b]));
    for (const datum of data) { const bin = el('span', '', 'improvement-chart-bin'); bin.title = `${datum.label} · ${labels[0]} ${money ? dollars(datum.a) : datum.a} · ${labels[1]} ${money ? dollars(datum.b) : datum.b}`; for (const [index, value] of [datum.a, datum.b].entries()) { const bar = el('i', '', index ? 'series-b' : 'series-a'); bar.style.height = `${Math.max(0, value / maximum * 100)}%`; bin.append(bar); } bars.append(bin); }
    figure.append(bars, el('p', `${labels[0]} / ${labels[1]}`, 'form-help')); return figure;
  }
  function renderEvidence() {
    evidencePane.replaceChildren(); if (!scope) { evidencePane.append(el('p', 'Choose a company and office to inspect retained activity.')); return; }
    const telemetry = buildImprovementTelemetry(options.snapshot(), { scope: { companyId: scope.companyId, officeId: scope.officeId, ...(scope.departmentId ? { departmentId: scope.departmentId } : {}) }, now: new Date().toISOString(), sampledAt: options.sampledAt(), workerEvidence: options.workerEvidence(),freshnessMs:options.freshnessMs?.(), bins: 12 });
    if (!telemetry.available) { evidencePane.append(el('p', telemetry.reason || 'Native evidence is unavailable.')); return; }
    const activity = telemetry.activity!, totals = telemetry.costs!, output = telemetry.outputs!;
    evidencePane.append(el('h3', activity.summary.label), el('p', `${activity.summary.loadedEmployees} saved employee definitions · ${activity.summary.queued} queued · ${activity.summary.waitingBudget} waiting for budget. A loaded model or a saved employee is not active inference or hardware utilization.`, 'form-help'));
    const stats = el('div', '', 'improvement-evidence-stats'); stats.append(el('p', `${output.recorded} recorded outputs`), el('p', `${output.accepted} accepted paired outputs`), el('p', `${output.reviewRepair} review repairs`), el('p', `${dollars(totals.observedUsd)} observed · ${dollars(totals.estimatedUsd)} estimated · ${dollars(totals.reservedUsd)} reserved`)); evidencePane.append(stats);
    const bins = telemetry.history!.bins, label = (from: string) => `${from.slice(5, 10)} ${from.slice(11, 16)} UTC`;
    const charts = el('div', '', 'improvement-charts'); charts.append(chart('Recorded output · last 24 hours', bins.map(b => ({ label: label(b.from), a: b.recordedOutputs, b: b.acceptedOutputs })), ['Recorded', 'Accepted']), chart('Cost by completed-job finish time', bins.map(b => ({ label: label(b.from), a: b.observedUsd, b: b.estimatedUsd })), ['Observed', 'Estimated'], true)); evidencePane.append(charts);
    evidencePane.append(el('p', 'These charts use retained native timestamps. They are incomplete history, not billing-time burn or provider invoices. Reservations and holds are current commitments, not historical spend.', 'form-help'));
    for (const diagnostic of telemetry.diagnostics) evidencePane.append(el('p', diagnostic, 'form-help'));
  }
  function render() { if (disposed) return; if (!scope) scope = options.scope(); renderScope(); renderNotes(); renderBudget(); renderSessionChoices(); renderSessions(); renderEvidence(); syncPending(); }
  function open(next?: ImprovementScope | null, savedId?: string) {
    if (controller.pending() || (noteDirty || sessionDirty) && next && scope && !sameScope(next, scope)) { showError(Error('This surface keeps its unfinished draft in its original scope. Save or reload it before switching.')); return; }
    if (savedId) { const note = options.snapshot()?.stickyNotes?.find(n => n.id === savedId); if (note) editNote(note); }
    else if (next && (!scope || !sameScope(next, scope))) { scope = { ...next }; resetNote(true); }
    render();
  }
  showTab('notes'); resetNote(true); render();
  return { element: root, refresh: render, open, destroy() { disposed = true; controller.dispose(); root.remove(); } };
}
