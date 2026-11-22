import { describe, expect, it, vi } from 'vitest';
import { createMutationController, type OwnerMutation } from '../src/renderer/improvement/mutations.js';
const command: OwnerMutation = { action: 'upsert_sticky_note', requestId: 'request-1', id: 'note-1', expectedRevision: 7, text: 'Original brief', goalIds: ['goal-1'] };
describe('improvement owner request identity', () => {
  it('retries only the exact captured request after an unknown result, never a changed draft', async () => {
    const send = vi.fn().mockResolvedValueOnce({ ok: false, code: 'IO_ERROR' }).mockResolvedValue({ ok: true, snapshot: { saved: true } });
    const ctl = createMutationController(send), input = structuredClone(command);
    await expect(ctl.dispatch(input)).rejects.toThrow('IO_ERROR'); input.text = 'Edited';
    await expect(ctl.dispatch({ ...input, requestId: 'new-request' })).rejects.toThrow('unconfirmed');
    expect(send).toHaveBeenCalledTimes(1);
    await expect(ctl.dispatch()).resolves.toEqual({ saved: true });
    expect(send).toHaveBeenCalledTimes(2); expect(send.mock.calls[0]?.[0]).toEqual(command); expect(send.mock.calls[1]?.[0]).toEqual(command);
    expect(ctl.pending()).toBeNull();
  });
  it('does not retry stale revisions automatically and permits explicit rebase only after a known rejection', async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, code: 'REVISION_CONFLICT', error: 'Changed elsewhere' });
    const ctl = createMutationController(send); await expect(ctl.dispatch(command)).rejects.toThrow('Changed elsewhere');
    expect(ctl.pending()).toBeNull(); expect(send).toHaveBeenCalledTimes(1);
  });
  it.each(['CLOUD_COMMAND_REJECTED', 'CLOUD_COMMAND_CANCELLED', 'NOTE_KIND_IMMUTABLE'])('unlocks the draft after definitive %s without any automatic retry', async code => {
    const send = vi.fn().mockResolvedValue({ ok: false, code });
    const ctl = createMutationController(send); await expect(ctl.dispatch(command)).rejects.toThrow(code);
    expect(ctl.pending()).toBeNull(); expect(send).toHaveBeenCalledTimes(1);
  });
  it.each(['STALE_REVISION', 'REVISION_CONFLICT', 'CLOUD_COMMAND_REJECTED', 'CLOUD_COMMAND_CANCELLED'])('recognizes a structured rejected bridge promise for %s without resubmitting', async code => {
    const error = Object.assign(new Error('Native rejection received through postMessage'), { code });
    const send = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ ok: true, snapshot: { saved: true } });
    const ctl = createMutationController(send); await expect(ctl.dispatch(command)).rejects.toBe(error);
    expect(ctl.pending()).toBeNull(); expect(send).toHaveBeenCalledTimes(1);
    const rebased = { ...command, expectedRevision: 8, requestId: 'explicit-rebase' };
    await ctl.dispatch(rebased); expect(send).toHaveBeenCalledTimes(2); expect(send.mock.calls[1]?.[0]).toEqual(rebased);
  });
  it('retains unknown rejected promises and never classifies rejection from message text', async () => {
    const errors = [new Error('STALE_REVISION appears only in arbitrary prose'),
      ...['IO_ERROR', 'deadline', 'transport', 'cancelled', 'NEW_NATIVE_FAILURE'].map(code => Object.assign(new Error(code), { code }))];
    for (const error of errors) {
      const send = vi.fn().mockRejectedValue(error), ctl = createMutationController(send);
      await expect(ctl.dispatch(command)).rejects.toBe(error);
      expect(ctl.pending()?.command).toEqual(command); expect(ctl.pending()?.state).toBe('uncertain'); expect(send).toHaveBeenCalledTimes(1);
    }
  });
  it('holds queued, malformed and unfamiliar errors until exact retry or native acknowledgement', async () => {
    for (const result of [{ ok: true, queued: true, snapshot: {} }, { ok: false, code: 'NEW_BACKEND_FAILURE' }, { ok: true, snapshot: null }]) {
      const ctl = createMutationController(async () => result); await expect(ctl.dispatch(command)).rejects.toThrow();
      expect(ctl.pending()?.command).toEqual(command); expect(ctl.pending()?.state).toBe('uncertain');
    }
  });
  it('rejects concurrent dispatch and makes retained snapshots independent of callers', async () => {
    let finish!: (value: { ok: boolean; snapshot: object }) => void;
    const send = vi.fn(() => new Promise<{ ok: boolean; snapshot: object }>(resolve => { finish = resolve; }));
    const ctl = createMutationController(send), result = ctl.dispatch(command);
    const copy = ctl.pending()!; copy.command.text = 'Mutation attempt';
    await expect(ctl.dispatch(command)).rejects.toThrow('Wait'); expect(send).toHaveBeenCalledTimes(1);
    finish({ ok: true, snapshot: {} }); await result; expect(ctl.pending()).toBeNull();
  });
  it('does not publish a late acknowledgement or accept new work after disposal', async () => {
    let finish!: (value: { ok: boolean; snapshot: object }) => void; const changed = vi.fn();
    const ctl = createMutationController(() => new Promise<{ ok: boolean; snapshot: object }>(resolve => { finish = resolve; }), changed);
    const result = ctl.dispatch(command); ctl.dispose(); finish({ ok: true, snapshot: {} });
    await expect(result).rejects.toThrow('closed'); expect(changed).toHaveBeenCalledTimes(1);
    await expect(ctl.dispatch(command)).rejects.toThrow('closed');
  });
});
