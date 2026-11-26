/** Shared, reviewed Ollama resources. All changes are explicit owner actions. */
export interface ModelPoolSnapshot {
  companyId: string; available: boolean; enabled: boolean; endpoint: string; infrastructureCost: 'separate';
  catalog: Array<{ id: string; name: string; description: string; storageCeilingBytes: number; sourceUrl: string;
    upstreamUrl?: string; architecture?: 'dense' | 'moe'; totalParametersBillions?: number;
    activeParametersBillions?: number; quantization?: string; contextLimitTokens?: number;
    artifactApproxBytes?: number; license?: string }>;
  models: Array<{ name: string; digest: string; sizeBytes: number; loaded: boolean }>;
  requests: Array<{ id: string; companyId: string; employeeId: string; model: string; status: string; completedBytes: number; totalBytes: number | null; error: string | null }>;
  assignments: Array<{ companyId: string; employeeId: string; model: string; digest: string }>;
  error: string | null;
}
export type ModelPoolResult = { ok: boolean; snapshot?: ModelPoolSnapshot; error?: string; requestId?: string; replayed?: boolean; reused?: boolean };
export interface ModelPoolBridge {
  modelPoolSnapshot?(input: { companyId: string; employeeId?: string }): Promise<ModelPoolResult>;
  modelPoolRequest?(input: { companyId: string; employeeId: string; model: string; idempotencyKey: string; maxBytes?: number }): Promise<ModelPoolResult>;
  modelPoolCancel?(input: { companyId: string; employeeId: string; requestId: string }): Promise<ModelPoolResult>;
  modelPoolSelect?(input: { companyId: string; employeeId: string; model: string }): Promise<ModelPoolResult>;
}
export interface ModelPoolScope {
  activeCompanyId?: string | null;
  companies: Array<{ id: string; name: string; status: string }>;
  employees: Array<{ id: string; name: string; role: string; companyId: string | null; status: string }>;
}
export interface ModelPoolPanel { setActive(active: boolean): void; refreshScope(): void; destroy(): void }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; if (cls) node.className = cls; return node;
}
function bytes(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${(n / 1e6).toFixed(1)} MB` : 'Unknown size';
}

export function mountModelPool(host: HTMLElement, bridge: ModelPoolBridge | undefined, getScope: () => ModelPoolScope, readOnly: () => boolean): ModelPoolPanel {
  const panel = el('section', '', 'panel model-pool-panel'); panel.id = 'shared-model-pool';
  const head = el('div', '', 'section-heading');
  const heading = el('div'); heading.append(el('p', 'SHARED COMPUTE', 'eyebrow'), el('h2', 'One model library for your employees'));
  const refresh = el('button', 'Refresh', 'secondary small'); refresh.type = 'button'; head.append(heading, refresh);
  const copy = el('p', 'Download a reviewed model once on the connected runtime. Employees share its weights; each company keeps its conversations and artifacts separate.', 'muted');
  const endpoint = el('p', '', 'form-help');
  const form = el('form', '', 'model-pool-form');
  const company = el('select'); company.id = 'model-pool-company';
  const employeeSearch = el('input'); employeeSearch.id = 'model-pool-employee-search'; employeeSearch.type = 'search'; employeeSearch.placeholder = 'Name or role'; employeeSearch.maxLength = 120;
  const employee = el('select'); employee.id = 'model-pool-employee';
  const model = el('select'); model.id = 'model-pool-model';
  for (const [label, field] of [['Company', company], ['Find employee', employeeSearch], ['Employee', employee], ['Reviewed model', model]] as const) { const l = el('label', label, 'field'); l.append(field); form.append(l); }
  const employeeCount = el('p', '', 'form-help model-pool-employee-count'); form.append(employeeCount);
  const modelDetails = el('div', '', 'model-pool-details'); modelDetails.id = 'model-pool-details';
  modelDetails.setAttribute('aria-live', 'polite'); form.append(modelDetails);
  const request = el('button', 'Download or reuse', 'secondary'); request.type = 'submit';
  const select = el('button', 'Assign installed model', 'secondary'); select.type = 'button';
  const actions = el('div', '', 'row wrap'); actions.append(request, select); form.append(actions);
  const status = el('p', '', 'status'); status.id = 'model-pool-status'; status.setAttribute('role', 'status');
  const inventory = el('div', '', 'model-pool-inventory'), downloads = el('div', '', 'model-pool-downloads');
  panel.append(head, copy, endpoint, form, status, inventory, downloads);
  const pageHeading = host.querySelector('.page-heading'); if (pageHeading) pageHeading.after(panel); else host.prepend(panel);
  let active = false, destroyed = false, busy = false, timer = 0, revision = 0;
  let snapshot: ModelPoolSnapshot | null = null;
  const pending = new Set(['queued', 'pulling']);
  const clearTimer = () => { if (timer) window.clearTimeout(timer); timer = 0; };
  function choices(field: HTMLSelectElement, values: Array<{ id: string; name: string }>, preferred: string, empty: string): void {
    field.replaceChildren();
    if (!values.length) { const o = el('option', empty); o.value = ''; field.append(o); }
    for (const item of values) { const o = el('option', item.name); o.value = item.id; field.append(o); }
    field.value = values.some((v) => v.id === preferred) ? preferred : values[0]?.id ?? '';
  }
  function refreshEmployees(): void {
    const scope = getScope(), query = employeeSearch.value.trim().toLowerCase();
    const matches = scope.employees.filter((e) => e.companyId === company.value && e.status === 'active' && (!query || `${e.name} ${e.role} ${e.id}`.toLowerCase().includes(query)));
    const options = matches.slice(0, 500);
    choices(employee, options.map((e) => ({ id: e.id, name: `${e.name} · ${e.role}` })), employee.value, 'No active employees');
    employeeCount.textContent = matches.length > options.length ? `Showing ${options.length} of ${matches.length} matching employees. Narrow the search to find another employee.` : `${matches.length} matching active employee${matches.length === 1 ? '' : 's'}.`;
  }
  function syncButtons(): void {
    const allowed = !readOnly() && !busy && !!company.value && !!employee.value && !!model.value && snapshot?.enabled === true;
    request.disabled = !allowed || !bridge?.modelPoolRequest;
    select.disabled = !allowed || !bridge?.modelPoolSelect || !snapshot?.models.some((m) => m.name === model.value);
    refresh.disabled = busy || !bridge?.modelPoolSnapshot || !company.value;
    company.disabled = employee.disabled = employeeSearch.disabled = model.disabled = busy;
  }
  function renderModelDetails(): void {
    const entry = snapshot?.catalog.find((item) => item.id === model.value);
    modelDetails.replaceChildren(); modelDetails.hidden = !entry;
    if (!entry) return;
    modelDetails.append(el('p', entry.description, 'form-help'));
    const facts: string[] = [];
    if (entry.architecture === 'moe') facts.push('Mixture of experts');
    if (entry.totalParametersBillions) facts.push(`${entry.totalParametersBillions}B total parameters`);
    if (entry.activeParametersBillions) facts.push(`${entry.activeParametersBillions}B active per token`);
    if (entry.quantization) facts.push(entry.quantization);
    if (entry.contextLimitTokens) facts.push(`${entry.contextLimitTokens.toLocaleString('en-US')} token runtime context limit`);
    if (entry.license) facts.push(entry.license);
    if (facts.length) modelDetails.append(el('p', facts.join(' · '), 'form-help'));
    if (entry.artifactApproxBytes) modelDetails.append(el('p', `About ${bytes(entry.artifactApproxBytes)} to download. GPU memory also needs room for context and runtime buffers.`, 'form-help'));
    const links = el('p', '', 'form-help');
    for (const [label, url] of [['Model package', entry.sourceUrl], ['Upstream model card', entry.upstreamUrl]] as const) {
      if (!url) continue;
      try { if (new URL(url).protocol !== 'https:') continue; } catch { continue; }
      const link = el('a', label); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      if (links.childNodes.length) links.append(document.createTextNode(' · '));
      links.append(link);
    }
    if (links.childNodes.length) modelDetails.append(links);
  }
  function render(): void {
    endpoint.textContent = snapshot ? `${snapshot.endpoint} · VPS / GPU rental charges apply separately from model tokens.` : 'Connect the desktop or private runtime to manage shared models.';
    const selected = model.value;
    choices(model, (snapshot?.catalog ?? []).slice(0, 50).map((m) => ({ id: m.id, name: `${m.name} · up to ${bytes(m.storageCeilingBytes)}` })), selected, 'Catalog unavailable');
    renderModelDetails();
    inventory.replaceChildren(el('h3', 'Installed on the runtime'));
    for (const item of (snapshot?.models ?? []).slice(0, 100)) {
      const row = el('div', '', 'model-pool-row'); row.append(el('strong', item.name), el('span', `${bytes(item.sizeBytes)} · ${item.loaded ? 'Loaded in memory' : 'Stored on disk'}`, 'muted')); inventory.append(row);
    }
    if (!snapshot?.models.length) inventory.append(el('p', 'No installed models reported.', 'muted'));
    const assignment = snapshot?.assignments.find((a) => a.companyId === company.value && a.employeeId === employee.value);
    if (assignment) inventory.append(el('p', `Selected employee uses ${assignment.model}.`, 'form-help'));
    downloads.replaceChildren();
    const requests = (snapshot?.requests ?? []).filter((r) => r.companyId === company.value).slice(-20).reverse();
    if (requests.length) downloads.append(el('h3', 'Model requests'));
    for (const item of requests) {
      const row = el('div', '', 'model-pool-row');
      const progress = typeof item.totalBytes === 'number' && item.totalBytes > 0 ? `${bytes(item.completedBytes)} / ${bytes(item.totalBytes)}` : bytes(item.completedBytes);
      const who = getScope().employees.find((e) => e.id === item.employeeId)?.name || 'Employee';
      row.append(el('strong', `${item.model} · ${who}`), el('span', `${item.status} · ${progress}${item.error ? ` · ${String(item.error).slice(0, 240)}` : ''}`, 'muted'));
      if (pending.has(item.status) && bridge?.modelPoolCancel && !readOnly()) {
        const cancel = el('button', 'Cancel request', 'secondary small'); cancel.type = 'button'; cancel.disabled = busy;
        cancel.onclick = () => void mutate(() => bridge.modelPoolCancel!({ companyId: company.value, employeeId: item.employeeId, requestId: item.id }), 'Request cancelled. Other employees may still be using the shared download.');
        row.append(cancel);
      }
      downloads.append(row);
    }
    syncButtons();
  }
  function schedule(): void {
    clearTimer();
    if (active && !destroyed && !document.hidden && snapshot?.requests.some((r) => pending.has(r.status))) timer = window.setTimeout(() => { timer = 0; void read(); }, 3000);
  }
  async function read(): Promise<void> {
    clearTimer();
    if (!active || destroyed || busy) return;
    if (!bridge?.modelPoolSnapshot || !company.value) { snapshot = null; status.textContent = 'Shared model management is available through a connected desktop or private runtime.'; render(); return; }
    const current = ++revision, companyId = company.value; busy = true; syncButtons();
    try {
      const result = await bridge.modelPoolSnapshot({ companyId });
      if (destroyed || current !== revision || companyId !== company.value) return;
      if (!result.ok || !result.snapshot || result.snapshot.companyId !== companyId) throw new Error(result.error || 'Shared model status is unavailable.');
      snapshot = result.snapshot; status.textContent = snapshot.error || (snapshot.enabled ? 'Only an explicit download request transfers model files.' : 'Shared downloads are not enabled on this runtime.');
    } catch (error) { if (!destroyed && current === revision) { snapshot = null; status.textContent = (error as Error).message; } }
    finally { busy = false; if (!destroyed && current === revision) { render(); schedule(); } }
  }
  async function mutate(operation: () => Promise<ModelPoolResult>, message: string): Promise<void> {
    if (busy || destroyed || readOnly()) return;
    const companyId = company.value, current = ++revision; clearTimer(); busy = true; syncButtons();
    try {
      const result = await operation();
      if (destroyed || current !== revision || companyId !== company.value) return;
      if (!result.ok) throw new Error(result.error || 'The model request could not be saved.');
      if (result.snapshot?.companyId === companyId) snapshot = result.snapshot;
      status.textContent = result.reused ? 'The runtime already has this model; its installed copy is reused.' : message;
    } catch (error) { if (!destroyed && current === revision) status.textContent = (error as Error).message; }
    finally { busy = false; if (!destroyed && current === revision) { render(); schedule(); } }
  }
  function refreshScope(): void {
    if (destroyed) return;
    const scope = getScope(), old = company.value;
    choices(company, scope.companies.filter((c) => c.status === 'active').slice(0, 2000), old || scope.activeCompanyId || '', 'No active company');
    refreshEmployees();
    if (old !== company.value) { revision++; snapshot = null; render(); if (active) void read(); } else syncButtons();
  }
  company.onchange = () => { revision++; snapshot = null; refreshEmployees(); render(); void read(); };
  employeeSearch.oninput = () => { refreshEmployees(); render(); };
  employee.onchange = () => render(); model.onchange = () => { renderModelDetails(); syncButtons(); }; refresh.onclick = () => void read();
  form.onsubmit = (event) => {
    event.preventDefault(); if (request.disabled || !bridge?.modelPoolRequest) return;
    const input = { companyId: company.value, employeeId: employee.value, model: model.value, idempotencyKey: crypto.randomUUID() };
    void mutate(() => bridge.modelPoolRequest!(input), 'Shared model request saved. Download progress appears below.');
  };
  select.onclick = () => { if (!select.disabled && bridge?.modelPoolSelect) { const input = { companyId: company.value, employeeId: employee.value, model: model.value }; void mutate(() => bridge.modelPoolSelect!(input), 'Installed model assigned to the employee.'); } };
  const onVisibility = () => { if (document.hidden) clearTimer(); else if (active) void read(); };
  document.addEventListener('visibilitychange', onVisibility);
  refreshScope(); render();
  return {
    setActive(value) { if (active === value) return; active = value; if (value) { refreshScope(); void read(); } else clearTimer(); },
    refreshScope,
    destroy() { if (destroyed) return; destroyed = true; revision++; clearTimer(); document.removeEventListener('visibilitychange', onVisibility); panel.remove(); },
  };
}
