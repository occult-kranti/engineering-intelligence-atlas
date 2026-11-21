import { useState } from "react";
import { WORKER_KINDS, type WorkerKind } from "@contracts/run";
import type {
  Availability,
  ControlActionResult,
  ControlError,
  PoolControls,
  PoolStatus,
  WorkerControls,
  WorkerView,
} from "./adapter";

/**
 * Pool panel — the control-plane section of the ops deck. Pure props in
 * (availability envelope + control surfaces), real mutations out; no tRPC
 * hooks live here so the panel is testable with mocked controls.
 *
 *  - pool start / pause / resume / stop (emergency, two-step) / pump / sweep
 *  - worker capacity, suspend/activate, registration
 *  - eligibility failures and staleness rendered as text, never color-only
 */

export default function PoolPanel({
  pool,
  controls,
  workerControls,
  hasRun,
  runTerminal,
  budgetExhausted,
}: {
  pool: Availability<PoolStatus>;
  controls: PoolControls | null;
  workerControls: WorkerControls | null;
  hasRun: boolean;
  runTerminal: boolean;
  budgetExhausted: boolean;
}) {
  if (pool.status !== "live") {
    return (
      <p className="mt-1.5 text-[12px] leading-relaxed text-[hsl(var(--dark-ink-soft))]">
        <span className="chip">control data unavailable</span> {pool.reason}
      </p>
    );
  }
  const { paused, activeRuns, workers } = pool.data;
  return (
    <div className="mt-1.5">
      <p className="flex flex-wrap gap-1.5">
        {paused ? <span className="chip">pool paused — dispatch halted</span> : null}
        {activeRuns.length === 0 ? <span className="chip">no active runs</span> : null}
      </p>
      {controls ? (
        <PoolControlBar
          controls={controls}
          paused={paused}
          hasRun={hasRun}
          runTerminal={runTerminal}
          budgetExhausted={budgetExhausted}
        />
      ) : null}
      <WorkerList workers={workers} workerControls={workerControls} />
      {workerControls ? <RegisterWorkerForm workerControls={workerControls} /> : null}
    </div>
  );
}

/** Shared busy/error plumbing for the small action buttons. */
function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ControlError | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const act = async <T,>(
    label: string,
    fn: () => Promise<ControlActionResult<T>>,
    ok?: (data: T) => string,
  ): Promise<T | null> => {
    setBusy(label);
    setError(null);
    setNote(null);
    const r = await fn();
    setBusy(null);
    if (r.ok) {
      if (ok) setNote(ok(r.data));
      return r.data;
    }
    setError(r.error);
    return null;
  };
  return { busy, error, note, act, setError };
}

const BTN =
  "btn min-h-[36px] border-[hsl(40_8%_35%)] bg-transparent px-2 text-[12px] text-[hsl(var(--dark-ink))]";

export function PoolControlBar({
  controls,
  paused,
  hasRun,
  runTerminal,
  budgetExhausted,
}: {
  controls: PoolControls;
  paused: boolean;
  hasRun: boolean;
  runTerminal: boolean;
  budgetExhausted: boolean;
}) {
  const { busy, error, note, act } = useAction();
  const [confirmStop, setConfirmStop] = useState(false);

  const pumpDisabled = busy != null || !hasRun || runTerminal || budgetExhausted;
  const pumpTitle = !hasRun
    ? "no active run to pump"
    : budgetExhausted
      ? "budget exhausted — billable calls are never auto-retried"
      : runTerminal
        ? "run is terminal"
        : "claim one eligible node and dispatch it (fenced)";

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={BTN}
          disabled={busy != null}
          title="seed the director worker and nudge all advanceable runs"
          onClick={() =>
            void act("start", controls.startPool, (d) =>
              d.advancing > 0
                ? `pool started — director worker #${d.directorWorkerId}, ${d.advancing} run${d.advancing === 1 ? "" : "s"} advancing`
                : `director worker #${d.directorWorkerId} ready — nothing to advance yet`,
            )
          }
        >
          {busy === "start" ? "Starting…" : "Start pool"}
        </button>
        <button
          type="button"
          className={BTN}
          disabled={busy != null}
          onClick={() => {
            if (paused) {
              void act("resume", controls.resumePool, (d) =>
                `resumed ${d.resumed} run${d.resumed === 1 ? "" : "s"}`,
              );
            } else {
              void act("pause", controls.pausePool, (d) =>
                `paused ${d.paused} run${d.paused === 1 ? "" : "s"} — dispatch halted`,
              );
            }
          }}
        >
          {busy === "pause" || busy === "resume"
            ? "Working…"
            : paused
              ? "Resume pool"
              : "Pause pool"}
        </button>
        <button
          type="button"
          className={BTN}
          disabled={pumpDisabled}
          title={pumpTitle}
          onClick={() =>
            void act("pump", () => controls.pumpOnce(), (d) =>
              d.pumped
                ? `pumped ${d.pumped.nodeKey} (attempt ${d.pumped.attempt})`
                : "nothing eligible right now — check dependencies, gates, and worker eligibility",
            )
          }
        >
          {busy === "pump" ? "Pumping…" : "Pump once"}
        </button>
        <button
          type="button"
          className={BTN}
          disabled={busy != null || !hasRun}
          title={hasRun ? "recycle expired leases to ready (bounded, audited)" : "no active run to sweep"}
          onClick={() =>
            void act("sweep", controls.sweepExpiredLeases, (d) =>
              d.swept === 0
                ? "no expired leases"
                : `swept ${d.swept}: ${d.recycled.length} recycled to ready, ${d.failed.length} failed`,
            )
          }
        >
          {busy === "sweep" ? "Sweeping…" : "Sweep expired leases"}
        </button>
        {!confirmStop ? (
          <button
            type="button"
            className={BTN}
            disabled={busy != null}
            onClick={() => setConfirmStop(true)}
          >
            Stop pool…
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-1.5" role="alertdialog" aria-label="Confirm pool stop">
            <span className="text-[12px] text-[hsl(8_62%_65%)]">
              Stop every active run of this project? Irreversible for in-flight
              billable calls.
            </span>
            <button
              type="button"
              className={BTN}
              disabled={busy != null}
              onClick={() =>
                void act("stop", controls.stopPool, (d) => `stopped ${d.stopped} run${d.stopped === 1 ? "" : "s"}`).then(
                  (d) => d && setConfirmStop(false),
                )
              }
            >
              {busy === "stop" ? "Stopping…" : "Yes, stop all"}
            </button>
            <button type="button" className={BTN} onClick={() => setConfirmStop(false)}>
              Keep running
            </button>
          </span>
        )}
      </div>
      {budgetExhausted ? (
        <p className="mt-1.5 text-[12px] text-[hsl(8_62%_65%)]" role="note">
          Budget exhausted — pump is disabled. Start a new run deliberately;
          billable calls are never retried automatically.
        </p>
      ) : null}
      {note ? (
        <p className="mt-1.5 text-[12px] text-[hsl(var(--dark-ink-soft))]" role="status">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-[12px] text-[hsl(8_62%_65%)]" role="alert">
          <b>{error.recoverable ? "Recoverable: " : ""}</b>
          {error.message} <span className="text-[hsl(var(--dark-ink-soft))]">{error.hint}</span>
        </p>
      ) : null}
    </div>
  );
}

export function WorkerList({
  workers,
  workerControls,
}: {
  workers: WorkerView[];
  workerControls: WorkerControls | null;
}) {
  const { busy, error, note, act } = useAction();

  if (!workers.length) {
    return (
      <p className="mt-2 text-[12px] text-[hsl(var(--dark-ink-soft))]">
        No workers registered — Start pool seeds the director worker, or
        register one below.
      </p>
    );
  }
  return (
    <div className="mt-2">
      <ul className="grid gap-1.5">
        {workers.map((w) => (
          <li key={w.id} className="border-b border-[hsl(40_8%_24%)] pb-1.5 text-[12px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mono font-bold">{w.label}</span>
              <span className="chip">{w.kind}</span>
              <span className="text-[hsl(var(--dark-ink-soft))]">{w.role}</span>
              {w.suspended ? <span className="chip">suspended</span> : null}
              <span className="chip" title="active claims / max concurrent">
                {w.activeClaims}/{w.maxConcurrentClaims} claims
                {w.atCapacity ? " · full" : ""}
              </span>
              {w.stale ? (
                <span className="chip">
                  stale — seen {w.lastSeenAgeSec}s ago (ttl {w.leaseTtlSeconds}s)
                </span>
              ) : w.lastSeenAgeSec >= 0 ? (
                <span className="text-[hsl(var(--dark-ink-soft))]">
                  seen {w.lastSeenAgeSec}s ago
                </span>
              ) : null}
            </div>
            {w.claimedNodeKeys.length ? (
              <div className="mt-0.5 text-[hsl(var(--dark-ink-soft))]">
                claiming: {w.claimedNodeKeys.join(", ")}
              </div>
            ) : null}
            {w.eligibilityFailures.length ? (
              <ul className="mt-0.5 grid gap-0.5" aria-label={`eligibility failures for ${w.name}`}>
                {w.eligibilityFailures.map((f) => (
                  <li key={f.nodeKey} className="text-[hsl(var(--dark-ink-soft))]">
                    cannot claim <span className="mono">{f.nodeKey}</span>: {f.label}
                  </li>
                ))}
              </ul>
            ) : w.claimableNodeKeys.length ? (
              <div className="mt-0.5 text-[hsl(var(--dark-ink-soft))]">
                can claim: {w.claimableNodeKeys.join(", ")}
              </div>
            ) : null}
            {workerControls ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={BTN}
                  disabled={busy != null}
                  onClick={() =>
                    void act(`status-${w.id}`, () =>
                      workerControls.setStatus(w.id, w.suspended ? "active" : "suspended"),
                    )
                  }
                >
                  {w.suspended ? "Activate" : "Suspend"}
                </button>
                <span className="flex items-center gap-1" aria-label={`capacity for ${w.name}`}>
                  <button
                    type="button"
                    className={BTN}
                    aria-label={`decrease capacity of ${w.name}`}
                    disabled={busy != null || w.maxConcurrentClaims <= 1}
                    onClick={() =>
                      void act(`cap-${w.id}`, () =>
                        workerControls.setCapacity(w.id, w.maxConcurrentClaims - 1),
                      )
                    }
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={BTN}
                    aria-label={`increase capacity of ${w.name}`}
                    disabled={busy != null || w.maxConcurrentClaims >= 16}
                    onClick={() =>
                      void act(`cap-${w.id}`, () =>
                        workerControls.setCapacity(w.id, w.maxConcurrentClaims + 1),
                      )
                    }
                  >
                    +
                  </button>
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {note ? (
        <p className="mt-1.5 text-[12px] text-[hsl(var(--dark-ink-soft))]" role="status">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-[12px] text-[hsl(8_62%_65%)]" role="alert">
          <b>{error.recoverable ? "Recoverable: " : ""}</b>
          {error.message} <span className="text-[hsl(var(--dark-ink-soft))]">{error.hint}</span>
        </p>
      ) : null}
    </div>
  );
}

export function RegisterWorkerForm({ workerControls }: { workerControls: WorkerControls }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<WorkerKind>("subagent");
  const [role, setRole] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [maxClaims, setMaxClaims] = useState(1);
  const { busy, error, note, act } = useAction();

  if (!open) {
    return (
      <button type="button" className={`${BTN} mt-2`} onClick={() => setOpen(true)}>
        Register worker…
      </button>
    );
  }
  return (
    <form
      className="mt-2 grid gap-1.5 border border-[hsl(40_8%_24%)] p-2"
      aria-label="Register a worker"
      onSubmit={(e) => {
        e.preventDefault();
        void act(
          "register",
          () =>
            workerControls.register({
              name: name.trim(),
              kind,
              role: role.trim(),
              capabilities: capabilities
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean)
                .slice(0, 32),
              maxConcurrentClaims: maxClaims,
            }),
          (d) => `registered worker #${d.workerId} — it can claim matching ready nodes`,
        ).then((d) => {
          if (d) {
            setName("");
            setRole("");
            setCapabilities("");
            setMaxClaims(1);
          }
        });
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        <label className="text-[12px] font-bold">
          Name
          <input
            required
            maxLength={255}
            className="input mt-0.5 block text-[12px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="researcher-1"
          />
        </label>
        <label className="text-[12px] font-bold">
          Kind
          <select
            className="input mt-0.5 block text-[12px]"
            value={kind}
            onChange={(e) => setKind(e.target.value as WorkerKind)}
          >
            {WORKER_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-bold">
          Role (must match plan)
          <input
            required
            maxLength={255}
            className="input mt-0.5 block text-[12px]"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Research Scientist"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <label className="text-[12px] font-bold">
          Capabilities (comma-separated)
          <input
            className="input mt-0.5 block text-[12px]"
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            placeholder="read, summarize"
          />
        </label>
        <label className="text-[12px] font-bold">
          Max concurrent claims
          <input
            type="number"
            min={1}
            max={16}
            className="input mt-0.5 block w-20 text-[12px]"
            value={maxClaims}
            onChange={(e) => setMaxClaims(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
          />
        </label>
      </div>
      <div className="flex gap-1.5">
        <button type="submit" className={BTN} disabled={busy != null}>
          {busy === "register" ? "Registering…" : "Register"}
        </button>
        <button type="button" className={BTN} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {note ? (
        <p className="text-[12px] text-[hsl(var(--dark-ink-soft))]" role="status">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="text-[12px] text-[hsl(8_62%_65%)]" role="alert">
          <b>{error.recoverable ? "Recoverable: " : ""}</b>
          {error.message} <span className="text-[hsl(var(--dark-ink-soft))]">{error.hint}</span>
        </p>
      ) : null}
    </form>
  );
}
