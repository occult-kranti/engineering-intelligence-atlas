// @vitest-environment node
import { afterEach, beforeEach, expect, it } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { mountModelPool, type ModelPoolPanel, type ModelPoolSnapshot, type ModelPoolBridge } from '../src/renderer/model-pool.js';

let dom: FreeflowDom, panel: ModelPoolPanel | null;
beforeEach(() => { dom = installDom(); panel = null; });
afterEach(() => { panel?.destroy(); dom.restore(); });
const flush = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
const scope = () => ({ activeCompanyId: 'co', companies: [{ id: 'co', name: 'Company', status: 'active' }], employees: [
  { id: 'local', companyId: 'co', name: 'Local employee', role: 'Research', status: 'active' },
  { id: 'foreign', companyId: 'other', name: 'Unrelated employee', role: 'Private', status: 'active' },
] });
const snapshot = (): ModelPoolSnapshot => ({ companyId: 'co', available: true, enabled: true, endpoint: 'Self-hosted Ollama (loopback)', infrastructureCost: 'separate',
  catalog: [{ id: 'reviewed:small', name: 'Reviewed small', description: 'Reviewed', storageCeilingBytes: 2e9, sourceUrl: 'https://example.invalid/' }],
  models: [{ name: 'reviewed:small', digest: 'sha256:reviewed', sizeBytes: 1e9, loaded: false }], requests: [], assignments: [], error: null });
function host() { const h = document.createElement('section'); document.body.append(h); return h; }

it('downloads only on explicit submit, uses an eligible employee and reviewed catalog, then polls only while visible', async () => {
  const h = host(), calls: Array<Record<string, unknown>> = []; let s = snapshot(); let reads = 0;
  const bridge: ModelPoolBridge = {
    modelPoolSnapshot: async () => { reads++; return { ok: true, snapshot: s }; },
    modelPoolRequest: async (input) => { calls.push(input); s = { ...s, requests: [{ id: 'request', companyId: 'co', employeeId: 'local', model: 'reviewed:small', status: 'pulling', completedBytes: 1e6, totalBytes: 1e9, error: null }] }; return { ok: true, snapshot: s }; },
  };
  panel = mountModelPool(h, bridge, scope, () => false); panel.setActive(true); await flush();
  expect(calls).toHaveLength(0); expect(reads).toBe(1);
  expect([...h.querySelectorAll('#model-pool-employee option')].map((o) => (o as HTMLOptionElement).value)).toEqual(['local']);
  h.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await flush();
  expect(calls).toHaveLength(1); expect(calls[0]).toMatchObject({ companyId: 'co', employeeId: 'local', model: 'reviewed:small' });
  expect(typeof calls[0]!.idempotencyKey).toBe('string'); expect(dom.timers.pending()).toBe(1);
  panel.setActive(false); expect(dom.timers.pending()).toBe(0);
  dom.timers.advance(6000); await flush(); expect(reads).toBe(1);
});

it('disables mutation controls in the public preview and has an honest missing-bridge state', async () => {
  const h = host(); let writes = 0;
  panel = mountModelPool(h, { modelPoolSnapshot: async () => ({ ok: true, snapshot: snapshot() }), modelPoolRequest: async () => { writes++; return { ok: true }; } }, scope, () => true);
  panel.setActive(true); await flush();
  expect((h.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  h.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); await flush(); expect(writes).toBe(0);
  panel.destroy(); panel = mountModelPool(h, undefined, scope, () => false); panel.setActive(true); await flush();
  expect(h.querySelector('#model-pool-status')!.textContent).toContain('connected desktop or private runtime');
});

it('filters before the employee option limit so later employees remain discoverable', () => {
  const h = host(), large = scope();
  large.employees = Array.from({ length: 700 }, (_, i) => ({ id: `employee-${i}`, companyId: 'co', name: `Employee ${i}`, role: 'Research', status: 'active' }));
  panel = mountModelPool(h, undefined, () => large, () => false);
  expect(h.querySelectorAll('#model-pool-employee option')).toHaveLength(500);
  expect(h.querySelector('.model-pool-employee-count')!.textContent).toContain('500 of 700');
  const search = h.querySelector<HTMLInputElement>('#model-pool-employee-search')!;
  search.value = 'Employee 699'; search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  expect([...h.querySelectorAll<HTMLOptionElement>('#model-pool-employee option')].map((o) => o.value)).toEqual(['employee-699']);
});
