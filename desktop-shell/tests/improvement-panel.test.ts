import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { mountImprovementPanel, type ImprovementPanel } from '../src/renderer/improvement/panel.js';
import type { ImprovementSnapshot, StickyNote } from '../src/renderer/improvement/model.js';
import type { OwnerMutation } from '../src/renderer/improvement/mutations.js';

let dom: FreeflowDom, panel: ImprovementPanel | null;
beforeEach(() => { dom = installDom(); panel = null; });
afterEach(() => { panel?.destroy(); dom.restore(); });
const stamp = '2026-11-22T12:00:00Z';
const scope = { companyId: 'a', officeId: 'o', departmentId: null };
function note(extra: Partial<StickyNote> = {}): StickyNote { return { id: 'note', revision: 0, ...scope, kind: 'todo', color: 'yellow', text: 'Original saved note', status: 'open', ownerEmployeeId: 'primary', goalIds: ['g1', 'g2'], x: .7, y: .2, createdAt: stamp, updatedAt: stamp, ...extra }; }
function fixture(): ImprovementSnapshot { return { schemaVersion: 3,
  companies: [{ id: 'a', name: 'Product studio', status: 'active' }, { id: 'b', name: 'Other company', status: 'active' }],
  offices: [{ id: 'o', companyId: 'a', name: 'Office', status: 'active' }], departments: [{ id: 'd', companyId: 'a', officeId: 'o', name: 'Design', status: 'active' }],
  employees: ['primary', 'reviewer'].map(id => ({ id, name: id, companyId: 'a', officeId: 'o', departmentId: null, status: 'active' })),
  goals: ['g1', 'g2'].map(id => ({ id, title: id, companyId: 'a', scope: { kind: 'office', id: 'o' }, status: 'planned' })), jobs: [], stickyNotes: [note()], improvementSessions: [],
  improvementAllowance: { id: 'allowance', capUsd: 20, carriedObservedUsd: 2, carriedEstimatedUsd: 1, sourceReference: 'Reviewed checkpoint', createdAt: stamp },
  improvementBudget: { capUsd: 20, carriedObservedUsd: 2, carriedEstimatedUsd: 1, observedUsd: 1, estimatedUsd: .5, reservedUsd: 1, heldUsd: .5, committedUsd: 6, remainingUsd: 14, effectiveRemainingUsd: 4 },
  budget: { remainingUsd: 4, observedUsd: 1, estimatedUsd: .5, reservedUsd: 1, heldUsd: .5, committedUsd: 6 }, portfolio: { contracts: [] } }; }
function mount(initial = fixture()) {
  let snapshot = initial; const calls: OwnerMutation[] = [];
  const send = vi.fn(async (command: OwnerMutation) => {
    calls.push(structuredClone(command));
    if (command.action === 'upsert_sticky_note') {
      const previous = snapshot.stickyNotes?.find(n => n.id === command.id);
      if (previous && previous.revision !== command.expectedRevision) return { ok: false, code: 'STALE_REVISION', error: 'Changed after editing' };
      const saved = { ...command, revision: previous ? previous.revision + 1 : 0, createdAt: stamp, updatedAt: stamp } as unknown as StickyNote;
      snapshot = { ...snapshot, stickyNotes: [...(snapshot.stickyNotes ?? []).filter(n => n.id !== saved.id), saved] };
    }
    if (command.action === 'create_improvement_session') snapshot = { ...snapshot, improvementSessions: [{ ...command, revision: 0, status: 'paused', cycle: 0, stopReason: 'owner-start-required', activeGoalId: null, goalIds: [] } as any] };
    if (command.action === 'control_improvement_session') snapshot = { ...snapshot, improvementSessions: (snapshot.improvementSessions ?? []).map(s => s.id === command.sessionId ? { ...s, revision: s.revision + 1, status: command.operation === 'start' ? 'active' as const : 'paused' as const } : s) };
    return { ok: true, snapshot: structuredClone(snapshot) };
  });
  const donna = vi.fn();
  panel = mountImprovementPanel({ snapshot: () => snapshot, scope: () => scope, sampledAt: () => stamp, workerEvidence: () => undefined, readOnly: () => false,
    command: send, apply: value => { snapshot = value; }, refresh: async () => { panel?.refresh(); }, openDonna: donna }); document.body.append(panel.element);
  return { calls, send, donna, get snapshot() { return snapshot; }, set snapshot(next: ImprovementSnapshot) { snapshot = next; } };
}
const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
function change(id: string, value: string) { const control = get<HTMLInputElement>(id); control.value = value; control.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
async function submit(id: string) { get(id).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await flush(); }
function fillSession() {
  change('improvement-session-title', 'Improve keyboard flow'); change('improvement-objective', 'Inspect and improve the current company with independent review.');
  change('improvement-routes', 'anthropic owner-explicit-model\nollama owner-local-model:tag');
  get<HTMLInputElement>('improvement-authorized').checked = true;
}

describe('movable improvement surface forms', () => {
  it('preserves fractional micro-dollar carry values through browser validation and native submission', async () => {
    const m = mount({ ...fixture(), improvementAllowance: null, improvementBudget: null });
    change('improvement-carry-observed', '1.1316496'); change('improvement-carry-estimated', '0.00000003'); change('improvement-carry-source', 'Reviewed actual token ledger');
    get<HTMLInputElement>('improvement-carry-reviewed').checked = true;
    expect(get<HTMLFormElement>('improvement-allowance-form').checkValidity()).toBe(true);
    await submit('improvement-allowance-form'); expect(m.calls).toHaveLength(1);
    expect(m.calls[0]).toMatchObject({ action: 'register_improvement_allowance', capUsd: 20, carriedObservedUsd: 1.1316496, carriedEstimatedUsd: 0.00000003 });
  });
  it('edits a title without losing scope, goal arrays, original revision or real note identity', async () => {
    const m = mount(); panel!.open(scope, 'note'); change('improvement-note-text', 'Updated wording'); await submit('improvement-note-form');
    expect(m.calls).toHaveLength(1); expect(m.calls[0]).toMatchObject({ action: 'upsert_sticky_note', id: 'note', expectedRevision: 0, ...scope, goalIds: ['g1', 'g2'], ownerEmployeeId: 'primary', text: 'Updated wording' });
    expect(m.calls[0]?.requestId).toMatch(/^note-request-/); expect(get('improvement-note-form').classList.contains('board-stale')).toBe(false);
    expect(get<HTMLSelectElement>('improvement-note-kind').disabled).toBe(true);
  });
  it('allows a text-only edit of native fractional coordinates without rounding or weakening the range', async () => {
    const saved = note({ x: 1 / 3, y: .271828 }); const m = mount({ ...fixture(), stickyNotes: [saved] });
    panel!.open(scope, saved.id); change('improvement-note-text', 'Only the wording changed');
    expect(get<HTMLFormElement>('improvement-note-form').checkValidity()).toBe(true);
    await submit('improvement-note-form'); expect(m.calls).toHaveLength(1);
    expect(m.calls[0]?.x).toBe(saved.x); expect(m.calls[0]?.y).toBe(saved.y); expect(m.calls[0]?.expectedRevision).toBe(saved.revision);
    change('improvement-note-x', '100.001'); expect(get<HTMLFormElement>('improvement-note-form').checkValidity()).toBe(false);
    await submit('improvement-note-form'); expect(m.calls).toHaveLength(1); expect(get('improvement-status').textContent).toContain('between 0% and 100%');
  });

  it('preserves a stale draft through refresh and rejects without retry until explicit rebase', async () => {
    const m = mount(); panel!.open(scope, 'note'); change('improvement-note-text', 'My unsaved draft');
    m.snapshot = { ...m.snapshot, stickyNotes: [note({ revision: 1, text: 'External change' })] }; panel!.refresh();
    expect(get<HTMLTextAreaElement>('improvement-note-text').value).toBe('My unsaved draft'); expect(get('improvement-note-form').classList.contains('board-stale')).toBe(true);
    await submit('improvement-note-form'); expect(m.calls).toHaveLength(1); expect(m.calls[0]?.expectedRevision).toBe(0);
    expect(get('improvement-status').textContent).toContain('STALE_REVISION'); expect(get<HTMLTextAreaElement>('improvement-note-text').value).toBe('My unsaved draft');
    get('improvement-note-reload').click(); expect(get<HTMLTextAreaElement>('improvement-note-text').value).toBe('External change'); expect(get('improvement-note-form').classList.contains('board-stale')).toBe(false);
  });

  it('retains exact request bytes across a persisted-but-unacknowledged note save and retry', async () => {
    const m = mount(); const real = m.send.getMockImplementation()!; m.send.mockImplementationOnce(async command => { await real(command); return { ok: false, code: 'IO_ERROR' }; });
    panel!.open(scope, 'note'); change('improvement-note-text', 'Persisted once'); await submit('improvement-note-form');
    expect(get('improvement-pending')?.hidden ?? false).toBe(false); expect(get<HTMLInputElement>('improvement-note-text').disabled).toBe(true);
    m.send.mockImplementationOnce(async command => { m.calls.push(structuredClone(command)); return { ok: true, snapshot: m.snapshot }; });
    get('improvement-retry').click(); await flush(); expect(m.calls).toHaveLength(2); expect(m.calls[1]).toEqual(m.calls[0]);
    expect(m.snapshot.stickyNotes).toHaveLength(1); expect(m.snapshot.stickyNotes?.[0]?.revision).toBe(1);
  });
  it('releases a stale form after the real bridge rejection shape while keeping its draft and original revision', async () => {
    const m = mount(); panel!.open(scope, 'note'); change('improvement-note-text', 'Keep this rejected draft');
    m.snapshot = { ...m.snapshot, stickyNotes: [note({ revision: 1, text: 'External saved value' })] }; panel!.refresh();
    m.send.mockRejectedValueOnce(Object.assign(new Error('Runtime operation failed (STALE_REVISION). Inspect saved state before retrying.'), { code: 'STALE_REVISION' }));
    await submit('improvement-note-form');
    expect(m.send).toHaveBeenCalledTimes(1); expect(m.send.mock.calls[0]?.[0].expectedRevision).toBe(0);
    expect(get('improvement-pending').hidden).toBe(true); expect(get<HTMLButtonElement>('improvement-note-save').disabled).toBe(false);
    expect(get<HTMLTextAreaElement>('improvement-note-text').value).toBe('Keep this rejected draft'); expect(get('improvement-note-form').classList.contains('board-stale')).toBe(true);
    expect(m.snapshot.stickyNotes?.[0]?.text).toBe('External saved value');
    get('improvement-note-reload').click(); expect(get<HTMLTextAreaElement>('improvement-note-text').value).toBe('External saved value');
  });

  it('does not transfer a live draft when another company surface requests this popup', () => {
    mount(); panel!.open(scope, 'note'); change('improvement-note-text', 'Keep my scope'); panel!.open({ companyId: 'b', officeId: 'other', departmentId: null });
    expect(get<HTMLTextAreaElement>('improvement-note-text').value).toBe('Keep my scope'); expect(get('improvement-status').textContent).toContain('original scope');
  });

  it('creates only a paused session, with explicit candidates and no worker, policy or model call side effects', async () => {
    const m = mount(); fillSession(); await submit('improvement-session-form');
    expect(m.calls).toHaveLength(1); expect(m.calls[0]).toMatchObject({ action: 'create_improvement_session', expectedRevision: 0, ...scope, allowanceId: 'allowance', continuation: 'until-budget', maxCycles: null,
      primaryEmployeeId: 'primary', reviewerEmployeeId: 'reviewer', runSettings: { mode: 'provider', provider: 'anthropic', model: 'owner-explicit-model', priceRates: { inputUsdPerMillion: null, outputUsdPerMillion: null }, allowedTools: [], maxTokens: 32000, maxUsd: .25 } });
    expect(m.snapshot.improvementSessions?.[0]?.status).toBe('paused'); expect(get<HTMLInputElement>('improvement-authorized').checked).toBe(false);
    const start = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Start')!; start.click(); await flush();
    expect(m.calls.map(c => c.action)).toEqual(['create_improvement_session', 'control_improvement_session']); expect(m.calls[1]).toMatchObject({ operation: 'start', expectedRevision: 0 });
  });

  it('blocks self-review, missing authorization and oversized note text before any native mutation', async () => {
    const m = mount(); fillSession(); get<HTMLSelectElement>('improvement-reviewer').value = get<HTMLSelectElement>('improvement-primary').value;
    await submit('improvement-session-form'); expect(m.calls).toHaveLength(0); expect(get('improvement-status').textContent).toContain('distinct');
    change('improvement-note-text', '🙂'.repeat(1001)); await submit('improvement-note-form'); expect(m.calls).toHaveLength(0); expect(get('improvement-status').textContent).toContain('UTF-8');
  });

  it('uses native parent totals and the stricter global availability without reconstructing or resetting the cap', () => {
    mount(); expect(document.querySelector('.improvement-budget')?.textContent).toContain('$4.00 available under both ceilings');
    expect(document.querySelector('.improvement-budget')?.textContent).toContain('parent remaining $14.00');
    expect(document.querySelector('.improvement-budget')?.textContent).toContain('held $0.50');
    expect(document.querySelector('.improvement-budget')?.textContent).toContain('not a provider invoice');
  });

  it('requests only explicitly selected existing repository capabilities and surfaces an unavailable capability without retry', async () => {
    const m=mount();fillSession();get<HTMLInputElement>('improvement-publish-changes').checked=true;await submit('improvement-session-form');
    expect(m.send).not.toHaveBeenCalled();expect(get('improvement-status').textContent).toContain('also requires Read');
    get<HTMLInputElement>('improvement-read-repository').checked=true;
    m.send.mockResolvedValueOnce({ok:false,code:'CAPABILITY_UNAVAILABLE',error:'Company repository is not connected'});
    await submit('improvement-session-form');expect(m.send).toHaveBeenCalledTimes(1);
    expect((m.send.mock.calls[0]?.[0].runSettings as any).allowedTools).toEqual(['github.read_repository','github.publish_changes']);
    expect(get('improvement-status').textContent).toContain('Company repository is not connected');
    expect(get<HTMLInputElement>('improvement-read-repository').checked).toBe(true);
  });

  it('treats note text as literal data and exposes bounded charts with truthful unknown activity', () => {
    mount({ ...fixture(), stickyNotes: [note({ text: '<img src=x onerror=alert(1)>' })] });
    expect(document.querySelector('.improvement-note-preview')?.textContent).toContain('<img'); expect(document.querySelector('.improvement-note-preview img')).toBeNull();
    expect(get('improvement-evidence').textContent).toContain('current activity unknown'); expect(document.querySelectorAll('.improvement-chart-bin')).toHaveLength(24);
    expect(get('improvement-evidence').textContent).toContain('incomplete history');
  });

  it('keeps a saved but unavailable steward reference while editing unrelated note fields', async () => {
    const f = fixture(); f.employees[0]!.status = 'paused'; const m = mount(f); panel!.open(scope, 'note'); change('improvement-note-text', 'Still owned'); await submit('improvement-note-form');
    expect(m.calls[0]?.ownerEmployeeId).toBe('primary');
  });
});
