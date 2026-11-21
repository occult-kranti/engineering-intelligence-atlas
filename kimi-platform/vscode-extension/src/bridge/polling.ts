/**
 * Conservative capped-backoff polling. Pure module (timers injected).
 */

export interface PollOptions {
  /** Initial interval in ms (default 2_000). */
  initialMs?: number;
  /** Hard cap on the interval in ms (default 30_000). */
  maxMs?: number;
  /** Multiplier applied after each consecutive failure (default 2). */
  factor?: number;
}

export interface Poller {
  /** Current interval (ms) — exposed for tests/diagnostics. */
  readonly intervalMs: number;
  stop(): void;
}

export interface TimerHandles {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

const defaultTimers: TimerHandles = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
};

/**
 * Poll `task` forever until `stop()` is called or `task` reports done.
 * Success resets the interval to initialMs; failures back off exponentially
 * up to maxMs. Errors thrown by task are treated as failures and never
 * propagate (polling must be resilient to a desktop restart).
 */
export function startPolling(
  task: () => Promise<boolean /* done */ | undefined>,
  opts: PollOptions = {},
  timers: TimerHandles = defaultTimers,
): Poller {
  const initial = opts.initialMs ?? 2_000;
  const max = opts.maxMs ?? 30_000;
  const factor = opts.factor ?? 2;

  let interval = Math.min(initial, max);
  let stopped = false;
  let handle: unknown;

  const state: { intervalMs: number } = { intervalMs: interval };

  const tick = async (): Promise<void> => {
    if (stopped) return;
    let done = false;
    let ok = true;
    try {
      done = (await task()) === true;
    } catch {
      ok = false;
    }
    if (stopped || done) return;
    interval = ok ? Math.min(initial, max) : Math.min(Math.ceil(interval * factor), max);
    state.intervalMs = interval;
    handle = timers.setTimeout(() => void tick(), interval);
  };

  handle = timers.setTimeout(() => void tick(), interval);

  return {
    get intervalMs() {
      return state.intervalMs;
    },
    stop() {
      stopped = true;
      timers.clearTimeout(handle);
    },
  };
}

/** Compute the backoff sequence (for tests and docs). */
export function backoffSequence(initialMs: number, maxMs: number, factor: number, failures: number): number[] {
  const out: number[] = [];
  let cur = initialMs;
  for (let i = 0; i < failures; i++) {
    cur = Math.min(Math.ceil(cur * factor), maxMs);
    out.push(cur);
  }
  return out;
}
