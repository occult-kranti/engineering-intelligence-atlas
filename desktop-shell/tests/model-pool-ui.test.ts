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

it('explains reviewed MoE capacity without claiming GPU readiness or downloading on selection', async () => {
  const h = host(), s = snapshot(); let writes = 0;
  s.catalog.push({ id: 'qwen3-coder:30b-a3b-q4_K_M', name: 'Qwen3 Coder', description: 'Text-only coding model.',
    storageCeilingBytes: 24e9, sourceUrl: 'https://ollama.com/library/qwen3-coder:30b-a3b-q4_K_M',
    upstreamUrl: 'https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct', architecture: 'moe',
    totalParametersBillions: 30.5, activeParametersBillions: 3.3, quantization: 'Q4_K_M',
    contextLimitTokens: 8192, artifactApproxBytes: 19e9, license: 'Apache-2.0' });
  panel = mountModelPool(h, { modelPoolSnapshot: async () => ({ ok: true, snapshot: s }),
    modelPoolRequest: async () => { writes++; return { ok: true }; } }, scope, () => false);
  panel.setActive(true); await flush();
  const selection = h.querySelector('#model-pool-model') as HTMLSelectElement;
  selection.value = 'qwen3-coder:30b-a3b-q4_K_M'; selection.dispatchEvent(new dom.window.Event('change'));
  const details = h.querySelector('#model-pool-details')!;
  expect(details.textContent).toContain('30.5B total parameters · 3.3B active per token');
  expect(details.textContent).toContain('8,192 token runtime context limit');
  expect(details.textContent).toContain('About 19.0 GB to download');
  expect(details.textContent).toContain('GPU memory also needs room');
  expect(details.querySelectorAll('a')).toHaveLength(2);
  expect(writes).toBe(0);
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
