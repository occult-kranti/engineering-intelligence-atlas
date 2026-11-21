import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { fmt, fmtUsd } from "@/lib/format";
import { ErrorNote } from "../DirectorShell";
import ConfirmDialog, { type ConfirmRequest } from "./ConfirmDialog";
import { useKeysetPages } from "./useEnterpriseData";
import {
  deriveActionCoverage,
  deriveBudgetMeters,
  deriveProgramControls,
  deriveStewardRecommendations,
  type ActionCoverageRow,
  type PlanStatus,
  type SnapshotLike,
  type WorkerRowLike,
} from "./adapter";

/**
 * Overview: CEO program controls (start/pause/resume/cancel/pump with the
 * plan gate made visible), budget partition meters, deterministic steward
 * recommendations (system-derived, labeled "no provider calls"), and the
 * ENTERPRISE_ACTIONS coverage report proving every action maps to a real
 * procedure + surface.
 */
export default function OverviewSection({
  snapshot,
  workers,
  actions,
  actionsError,
  planStatusByKey,
}: {
  snapshot: SnapshotLike;
  workers: WorkerRowLike[];
  actions: { id: string; operation: string; approval: string | null; procedure: string | null }[] | null;
  actionsError: string | null;
  planStatusByKey: Map<string, PlanStatus>;
}) {
  return (
    <div className="grid gap-4">
      <ProgramPanel snapshot={snapshot} planStatusByKey={planStatusByKey} />
      <BudgetMetersPanel snapshot={snapshot} />
      <StewardPanel snapshot={snapshot} workers={workers} />
      <ActionRegistryPanel actions={actions} actionsError={actionsError} />
    </div>
  );
}

// ── Program controls ─────────────────────────────────────────────

function ProgramPanel({
  snapshot,
  planStatusByKey,
}: {
  snapshot: SnapshotLike;
  planStatusByKey: Map<string, PlanStatus>;
}) {
  const utils = trpc.useUtils();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const invalidate = () => {
    void utils.enterprise.snapshot.invalidate({ enterpriseId: snapshot.enterprise.id });
    void utils.enterprise.events.invalidate();
  };
  const onError = () => setConfirm(null);
  const startM = trpc.enterprise.programStart.useMutation({ onSuccess: invalidate, onError });
  const pauseM = trpc.enterprise.programPause.useMutation({ onSuccess: invalidate, onError });
  const resumeM = trpc.enterprise.programResume.useMutation({ onSuccess: invalidate, onError });
  const cancelM = trpc.enterprise.programCancel.useMutation({ onSuccess: invalidate, onError });
  const pumpM = trpc.enterprise.programPump.useMutation({ onSuccess: invalidate, onError });
  const pending =
    startM.isPending || pauseM.isPending || resumeM.isPending || cancelM.isPending || pumpM.isPending;
  const mutationError =
    startM.error ?? pauseM.error ?? resumeM.error ?? cancelM.error ?? pumpM.error;

  const program = snapshot.program;
  const companyProjectByKey = new Map(snapshot.companies.map((c) => [c.key, c.projectId]));

  if (!program) {
    return (
      <section aria-label="Program" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
        <span className="kicker">CEO program</span>
        <p className="prose-evidence mt-2 text-[14px] text-[hsl(var(--ink-soft))]">
          No program exists for this enterprise yet. A program is created by
          applying a blueprint (idempotent on its hash).
        </p>
      </section>
    );
  }

  const controls = deriveProgramControls(program);
  const unapproved = snapshot.companies.filter(
    (c) => c.active && planStatusByKey.get(c.key)?.state === "unapproved",
  );
  const dispatch = (id: string) => {
    const input = { programId: program.id };
    if (id === "start") startM.mutate(input);
    else if (id === "pause") pauseM.mutate(input);
    else if (id === "resume") resumeM.mutate(input);
    else if (id === "pump") pumpM.mutate(input);
    else if (id === "cancel") cancelM.mutate(input);
  };

  return (
    <section aria-label="Program" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="kicker">CEO program</span>
        <span className="chip mono">v{program.version}</span>
        <span className="chip">{program.state}</span>
        {program.pausedAt ? <span className="chip chip-mustard">paused</span> : null}
        <span className="chip mono" title={program.blueprintHash}>
          blueprint {program.blueprintHash.slice(0, 12)}…
        </span>
        <span className="chip">concurrency ≤ {program.maxConcurrentRuns}</span>
        <span className="chip">replans ≤ {program.maxReplans}</span>
      </div>

      {program.state === "awaiting_plan_approval" ? (
        <p className="mt-2 border border-[hsl(var(--mustard))] bg-[hsl(var(--paper))] p-2 text-[13px]" role="note">
          <strong>Plan gate:</strong> dispatch requires every active company to
          hold a human-approved plan revision.
          {unapproved.length ? (
            <>
              {" "}Still unapproved:{" "}
              {unapproved.map((c, i) => (
                <span key={c.key}>
                  {i > 0 ? ", " : ""}
                  <a className="ext-link" href={`#/director/projects/${c.projectId}`}>
                    {c.key}
                  </a>
                </span>
              ))}
              {" — "}approve each plan in its project workspace (roadmap stage);
              this dashboard never approves on your behalf.
            </>
          ) : (
            " All active companies report approved plans; start will re-check server-side."
          )}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {controls.map((ctl) => (
          <button
            key={ctl.id}
            type="button"
            className={`btn text-[13px] ${ctl.destructive ? "border-[hsl(var(--alert))] text-[hsl(8_64%_30%)]" : ""}`}
            disabled={!ctl.enabled || pending}
            title={ctl.reason ?? undefined}
            onClick={() => {
              if (ctl.id === "cancel") {
                setConfirm({
                  title: "Cancel program?",
                  body: "All non-terminal company runs are stopped and the program moves to stopped_human. Recorded run ids are kept; nothing is redispatched.",
                  confirmLabel: "Cancel program",
                  destructive: true,
                  run: () => dispatch("cancel"),
                });
              } else if (ctl.id === "start") {
                setConfirm({
                  title: "Start dispatch?",
                  body: `The server re-checks the plan gate for every active company and dispatches up to ${program.maxConcurrentRuns} mock runs (live billing is never auto-started).`,
                  confirmLabel: "Start dispatch",
                  run: () => dispatch("start"),
                });
              } else {
                dispatch(ctl.id);
              }
            }}
          >
            {ctl.label}
          </button>
        ))}
      </div>
      {controls.some((c) => !c.enabled) ? (
        <ul className="mt-2 grid gap-0.5 text-[12px] text-[hsl(var(--ink-soft))]">
          {controls
            .filter((c) => !c.enabled)
            .map((c) => (
              <li key={c.id}>
                {c.label}: {c.reason}
              </li>
            ))}
        </ul>
      ) : null}
      {mutationError ? <ErrorNote message={mutationError.message} /> : null}

      {/* Company runs with real run links (no fabricated progress). */}
      <ol className="mt-3 grid gap-1" aria-label="Company runs">
        {program.companyRuns.map((cr) => {
          const projectId = companyProjectByKey.get(cr.companyKey);
          return (
            <li key={cr.companyKey} className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="mono font-bold">{cr.companyKey}</span>
              <span className={`chip ${cr.status === "completed" ? "chip-sage" : cr.status === "failed" || cr.status === "stopped" ? "chip-alert" : cr.status === "running" ? "chip-cornflower" : ""}`}>
                {cr.status}
              </span>
              {cr.runId !== null && projectId ? (
                <a className="ext-link text-[12px]" href={`#/director/projects/${projectId}/runs/${cr.runId}`}>
                  run #{cr.runId}
                </a>
              ) : (
                <span className="text-[12px] text-[hsl(var(--ink-soft))]">no run dispatched</span>
              )}
            </li>
          );
        })}
      </ol>

      <ConfirmDialog request={confirm} pending={pending} onClose={() => setConfirm(null)} />
    </section>
  );
}

// ── Budget partition meters ──────────────────────────────────────

function BudgetMetersPanel({ snapshot }: { snapshot: SnapshotLike }) {
  const meters = deriveBudgetMeters(snapshot.enterprise, snapshot.companies, snapshot.usage);
  const usageBars = [
    { label: "tokens", used: meters.usage.tokens.used, max: meters.usage.tokens.max, fraction: meters.usage.tokens.fraction, format: fmt },
    { label: "calls", used: meters.usage.calls.used, max: meters.usage.calls.max, fraction: meters.usage.calls.fraction, format: fmt },
    { label: "cost", used: meters.usage.costUsdMicros.used, max: meters.usage.costUsdMicros.max, fraction: meters.usage.costUsdMicros.fraction, format: fmtUsd },
  ];
  return (
    <section aria-label="Budget partitions" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="kicker">Budget partitions</span>
        <span className={`chip ${meters.withinEnvelope ? "chip-sage" : "chip-alert"}`}>
          {meters.withinEnvelope ? "within envelope" : "ENVELOPE EXCEEDED"}
        </span>
        <span className="text-[12px] text-[hsl(var(--ink-soft))]">
          deterministic largest-remainder partition (same function the server
          enforces pre-dispatch)
        </span>
      </div>
      <div className="mt-3 grid gap-2" aria-label="Enterprise usage vs envelope">
        {usageBars.map((b) => (
          <div key={b.label} className="grid gap-0.5">
            <div className="flex justify-between text-[12px]">
              <span className="font-bold">{b.label}</span>
              <span className="mono">
                {b.format(b.used)} / {b.format(b.max)} ({Math.round(b.fraction * 100)}%)
              </span>
            </div>
            <div className="ent-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(b.fraction * 100))} aria-label={`${b.label} usage`}>
              <div className={`ent-meter-fill ${b.fraction >= 1 ? "ent-meter-over" : b.fraction >= 0.85 ? "ent-meter-warn" : ""}`} style={{ width: `${Math.min(100, b.fraction * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <table className="table-cat mt-3 text-[12px]" aria-label="Per-company reservations">
        <thead>
          <tr>
            <th>company</th>
            <th>share</th>
            <th>tokens</th>
            <th>calls</th>
            <th>minutes</th>
            <th>cost</th>
          </tr>
        </thead>
        <tbody>
          {meters.rows.map((r) => (
            <tr key={r.companyKey} className={r.active ? "" : "opacity-60"}>
              <td>
                <span className="mono font-bold">{r.companyKey}</span>{" "}
                {r.active ? null : <span className="chip chip-mustard">inactive · zero</span>}
              </td>
              <td className="mono">{r.capacityShare}</td>
              <td className="mono">{fmt(r.reservation.maxTokens)}</td>
              <td className="mono">{fmt(r.reservation.maxCalls)}</td>
              <td className="mono">{r.reservation.maxMinutes}</td>
              <td className="mono">{fmtUsd(r.reservation.maxCostUsdMicros)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td>active totals</td>
            <td />
            <td className="mono">{fmt(meters.totals.maxTokens)}</td>
            <td className="mono">{fmt(meters.totals.maxCalls)}</td>
            <td className="mono">{meters.totals.maxMinutes}</td>
            <td className="mono">{fmtUsd(meters.totals.maxCostUsdMicros)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

// ── Deterministic steward recommendations ────────────────────────

function StewardPanel({ snapshot, workers }: { snapshot: SnapshotLike; workers: WorkerRowLike[] }) {
  const ledgerProbe = useKeysetPages<{ seq: number }>(snapshot.enterprise.id, "ledger", 1);
  const recs = deriveStewardRecommendations(
    snapshot,
    workers,
    ledgerProbe.error ? null : (ledgerProbe.total ?? (ledgerProbe.loading ? null : 0)),
  );
  return (
    <section aria-label="Steward recommendations" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="kicker">Steward recommendations</span>
        <span className="chip chip-neutral">system-derived · no provider calls</span>
      </div>
      {ledgerProbe.error ? (
        <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
          Ledger probe unavailable ({ledgerProbe.error}) — ledger-based
          recommendations are withheld rather than guessed.
        </p>
      ) : recs.length === 0 ? (
        <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
          No recommendations: nothing in the current snapshot warrants a system
          proposal.
        </p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {recs.map((r, i) => (
            <li key={`${r.steward}-${i}`} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">{r.steward}</span>
                <span className="chip chip-neutral">{r.kind}</span>
                <span className="chip chip-neutral">derivedBy: system</span>
                {r.actionId ? <span className="chip chip-cornflower">proposes: {r.actionId}</span> : null}
              </div>
              <p className="mt-1 text-[hsl(var(--ink-soft))]">{r.summary}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-[hsl(var(--ink-soft))]">
        Recommendations are proposals only — applying one always goes through
        the matching gated control above. Stewards hold no budget and make no
        provider calls.
      </p>
    </section>
  );
}

// ── ENTERPRISE_ACTIONS coverage ──────────────────────────────────

function ActionRegistryPanel({
  actions,
  actionsError,
}: {
  actions: { id: string; operation: string; approval: string | null; procedure: string | null }[] | null;
  actionsError: string | null;
}) {
  const coverage: ActionCoverageRow[] = deriveActionCoverage(actions ?? undefined);
  return (
    <section aria-label="Action registry" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="kicker">Action registry</span>
        <span className="chip">{coverage.filter((c) => c.covered).length}/{coverage.length} covered</span>
        {actionsError ? <span className="chip chip-alert">registry unavailable</span> : null}
      </div>
      {actionsError ? (
        <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
          The server action registry could not be loaded ({actionsError});
          coverage below reflects the shared contract registry only.
        </p>
      ) : null}
      <table className="table-cat mt-2 text-[12px]" aria-label="Enterprise action coverage">
        <thead>
          <tr>
            <th>action</th>
            <th>approval gate</th>
            <th>procedure</th>
            <th>UI surface</th>
          </tr>
        </thead>
        <tbody>
          {coverage.map((c) => (
            <tr key={c.id}>
              <td className="mono font-bold">{c.id}</td>
              <td>{c.approval ?? <span className="text-[hsl(var(--ink-soft))]">none (decision is the gate)</span>}</td>
              <td className="mono">{c.procedure ?? <span className="text-[hsl(8_64%_30%)]">unmapped</span>}</td>
              <td>{c.surface ?? <span className="text-[hsl(8_64%_30%)]">omitted — no real control</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
