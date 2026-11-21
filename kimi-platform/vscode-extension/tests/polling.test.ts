import { describe, expect, it } from 'vitest';
import { backoffSequence, startPolling, type TimerHandles } from '../src/bridge/polling.js';

function fakeTimers() {
  const queue: Array<{ fn: () => void; ms: number }> = [];
  const timers: TimerHandles = {
    setTimeout: (fn, ms) => {
      queue.push({ fn, ms });
      return queue.length - 1;
    },
    clearTimeout: () => undefined,
  };
  return { queue, timers };
}

describe('capped backoff polling', () => {
  it('computes a capped exponential sequence', () => {
    expect(backoffSequence(1000, 5000, 2, 6)).toEqual([2000, 4000, 5000, 5000, 5000, 5000]);
    expect(backoffSequence(2000, 30_000, 2, 4)).toEqual([4000, 8000, 16000, 30000]);
  });

  it('backs off on failure and resets on success', async () => {
    const { queue, timers } = fakeTimers();
    let calls = 0;
    const poller = startPolling(
      async () => {
        calls++;
        if (calls === 1) throw new Error('desktop down');
        return calls >= 3; // done after third call
      },
      { initialMs: 1000, maxMs: 4000, factor: 2 },
      timers,
    );
    // first scheduled tick
    expect(queue[0]?.ms).toBe(1000);
    await queue[0]!.fn(); // throws inside -> failure, backoff to 2000
    expect(queue[1]?.ms).toBe(2000);
    expect(poller.intervalMs).toBe(2000);
    await queue[1]!.fn(); // success, not done -> reset to 1000
    expect(queue[2]?.ms).toBe(1000);
    await queue[2]!.fn(); // done -> stops scheduling
    expect(queue).toHaveLength(3);
    poller.stop();
  });

  it('stop() prevents further ticks', async () => {
    const { queue, timers } = fakeTimers();
    let calls = 0;
    const poller = startPolling(
      async () => {
        calls++;
        return false;
      },
      { initialMs: 500 },
      timers,
    );
    poller.stop();
    await queue[0]!.fn();
    expect(calls).toBe(0);
    expect(queue).toHaveLength(1);
  });
});
