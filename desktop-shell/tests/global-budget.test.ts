import { describe, expect, it, vi } from 'vitest';
import { GlobalBudgetPause, withGlobalBudget } from '../src/main/globalBudget';
import type { GenerateFn, RunnerGenerateRequest } from '../src/main/projects';
import type { OfficeCommand, OfficeResult, OfficeSnapshot } from '../src/shared/office';

function request(overrides: Partial<RunnerGenerateRequest> = {}): RunnerGenerateRequest {
  return { provider: 'openai', model: 'fixture-model', system: 'Reviewed instructions', prompt: 'A task', maxOutputTokens: 100, abortSignal: new AbortController().signal, billing: { inputUsdPerMillion: 2, outputUsdPerMillion: 10, source: 'project:fixture' }, ...overrides };
}
const result = { text: 'Preserve this deliverable.', inputTokens: 20, outputTokens: 30, usageObserved: true };
const success = (lastAction: Record<string, unknown>): OfficeResult => ({ ok: true, snapshot: { lastAction } as OfficeSnapshot });
function fixture(response?: (request: OfficeCommand) => Promise<OfficeResult>) {
  const chronology: string[] = [];
  const command = vi.fn(async (req: OfficeCommand): Promise<OfficeResult> => {
    chronology.push(req.action);
    return response ? response(req) : success({ attemptId: req.attemptId, ...(req.action === 'reserve_external' ? { reserved: true } : { settled: true }) });
  });
  const generate = vi.fn<GenerateFn>(async () => { chronology.push('generate'); return result; });
  return { command, generate, chronology, wrapped: withGlobalBudget(generate, command) };
}

describe('global budget admission', () => {
  it('requires billing context before admission or inference', async () => {
    const f = fixture();
    await expect(f.wrapped(request({ billing: undefined }))).rejects.toThrow(/billing context/);
    expect(f.command).not.toHaveBeenCalled();
    expect(f.generate).not.toHaveBeenCalled();
  });
  it('reserves before the provider and settles the same unique attempt exactly once', async () => {
    const f = fixture();
    expect(await f.wrapped(request())).toEqual(result);
    expect(f.chronology).toEqual(['reserve_external', 'generate', 'settle_external']);
    const reserved = f.command.mock.calls[0]![0];
    const settled = f.command.mock.calls[1]![0];
    expect(reserved).toMatchObject({ source: 'project:fixture', action: 'reserve_external' });
    expect(Number(reserved.reservedUsd)).toBeGreaterThan(0);
    expect(Number(reserved.maxTokens)).toBeGreaterThan(100);
    expect(settled).toMatchObject({ attemptId: reserved.attemptId, costStatus: 'observed', inputTokens: 20, outputTokens: 30 });
    expect(Number(settled.costUsd)).toBeCloseTo(0.00034, 10);
  });
  it('does not call a provider when the global cap pauses admission', async () => {
    const f = fixture(async req => success({ attemptId: req.attemptId, reserved: false }));
    await expect(f.wrapped(request())).rejects.toBeInstanceOf(GlobalBudgetPause);
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.command).toHaveBeenCalledTimes(1);
  });
  it('fails closed when the admission operation fails', async () => {
    const f = fixture(async () => ({ ok: false, snapshot: null, error: 'Ledger unavailable' }));
    await expect(f.wrapped(request())).rejects.toThrow(/Ledger unavailable/);
    expect(f.generate).not.toHaveBeenCalled();
  });
  it.each([
    { ok: true, snapshot: null },
    success({}),
    success({ attemptId: 'another-attempt', reserved: true }),
  ] as OfficeResult[])('requires explicit reservation evidence for this attempt', async admission => {
    const f = fixture(async () => admission);
    await expect(f.wrapped(request())).rejects.toThrow();
    expect(f.generate).not.toHaveBeenCalled();
  });
  it.each([
    { inputUsdPerMillion: -1, outputUsdPerMillion: 10, source: 'test' },
    { inputUsdPerMillion: 2, outputUsdPerMillion: Number.NaN, source: 'test' },
    { inputUsdPerMillion: 2, outputUsdPerMillion: Infinity, source: 'test' },
  ])('rejects invalid individual prices before admission', async billing => {
    const f = fixture();
    await expect(f.wrapped(request({ billing }))).rejects.toThrow();
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.command).not.toHaveBeenCalled();
  });
  it('accounts local Ollama tokens through admission without charging provider USD', async () => {
    const f = fixture();
    await f.wrapped(request({ provider: 'ollama', billing: { inputUsdPerMillion: 0, outputUsdPerMillion: 0, source: 'local' } }));
    expect(f.command.mock.calls[0]![0].reservedUsd).toBe(0);
    expect(f.command.mock.calls[1]![0].costUsd).toBe(0);
    expect(f.command.mock.calls[1]![0].inputTokens).toBe(20);
  });
});

describe('global budget recovery preserves returned work', () => {
  it('keeps the full allocation as an estimate after provider failure and never retries', async () => {
    const f = fixture();
    f.generate.mockRejectedValueOnce(new Error('Ambiguous timeout'));
    await expect(f.wrapped(request())).rejects.toThrow(/Ambiguous timeout/);
    expect(f.generate).toHaveBeenCalledTimes(1);
    const reservation = f.command.mock.calls[0]![0];
    const settlement = f.command.mock.calls[1]![0];
    expect(settlement).toMatchObject({ attemptId: reservation.attemptId, costStatus: 'estimated', costUsd: reservation.reservedUsd });
  });
  it('preserves the artifact when settlement reports failure', async () => {
    const f = fixture(async req => req.action === 'reserve_external' ? success({ attemptId: req.attemptId, reserved: true }) : { ok: false, snapshot: null, error: 'Write failed' });
    expect(await f.wrapped(request())).toMatchObject({ text: result.text, usageObserved: false });
    expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it('preserves the artifact when settlement throws', async () => {
    const f = fixture(async req => { if (req.action === 'reserve_external') return success({ attemptId: req.attemptId, reserved: true }); throw new Error('Lost ledger connection'); });
    expect(await f.wrapped(request())).toMatchObject({ text: result.text, usageObserved: false });
  });
  it('does not convert unreported usage into a zero-cost successful call', async () => {
    const f = fixture();
    f.generate.mockResolvedValueOnce({ text: result.text, inputTokens: 0, outputTokens: 0, usageObserved: false });
    const saved = await f.wrapped(request());
    expect(saved).toMatchObject({ text: result.text, usageObserved: false });
    const reserved = f.command.mock.calls[0]![0];
    expect(f.command.mock.calls[1]![0]).toMatchObject({ costStatus: 'estimated', costUsd: reserved.reservedUsd });
  });
  it('marks invalid numeric usage unobserved while preserving the result', async () => {
    const f = fixture();
    f.generate.mockResolvedValueOnce({ text: result.text, inputTokens: NaN, outputTokens: 20 });
    expect(await f.wrapped(request())).toMatchObject({ text: result.text, usageObserved: false });
    expect(f.command.mock.calls[1]![0].costStatus).toBe('estimated');
  });
});
