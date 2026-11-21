import {
  STAGES,
  type Availability,
  type LeaseStatus,
  type MeterDatum,
  type ProjectLike,
  type StageId,
  type StageStatus,
} from "./adapter";

/**
 * Zone A — goal rail: the project goal (the only serif prose on screen),
 * the 01–05 flow stepper, persistent budget mini-meters, and the director
 * lease box (honest "unavailable" until lease endpoints exist).
 */
export default function GoalRail({
  project,
  stages,
  activeStage,
  onStageSelect,
  meters,
  directorLease,
  compact = false,
}: {
  project: ProjectLike | null;
  stages: StageStatus[];
  activeStage: StageId;
  onStageSelect(id: StageId): void;
  meters: MeterDatum[] | null;
  directorLease: Availability<LeaseStatus>;
  compact?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section aria-labelledby="dw-goal-heading">
        <span className="kicker" id="dw-goal-heading">
          01 · Goal
        </span>
        <p className="prose-evidence mt-2 text-[15px] leading-relaxed">
          {project?.goal ?? "No project loaded."}
        </p>
        {project ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="chip chip-mustard">risk: {project.riskTier}</span>
            <span className="chip">{project.status}</span>
          </div>
        ) : null}
      </section>

      <nav aria-label="Director flow stages" className={compact ? "" : "mt-2"}>
        <ol className="rule">
          {stages.map((s) => {
            const meta = STAGES.find((x) => x.id === s.id)!;
            const current = s.id === activeStage;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className="dw-step"
                  data-active={current}
                  data-attention={!current && s.attention}
                  aria-current={current ? "step" : undefined}
                  onClick={() => onStageSelect(s.id)}
                >
                  <span className="dw-step-num" aria-hidden>
                    {meta.num}
                  </span>
                  <span>
                    <span className="dw-step-name block">{meta.name}</span>
                    <span className="dw-step-sub block">{s.sub}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {!compact ? (
        <div className="mt-auto pt-4">
          <span className="kicker">Run budget</span>
          {meters ? (
            meters.map((m) => (
              <div className="dw-minimeter" key={m.key} data-exhausted={m.exhausted}>
                <span className="lbl">{m.key === "usd" ? "USD" : m.label}</span>
                <span
                  className="track"
                  role="meter"
                  aria-valuenow={m.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${m.label} budget, ${m.pct}% used`}
                >
                  <span style={{ width: `${m.pct}%` }} />
                </span>
                <span className="val">{m.display}</span>
              </div>
            ))
          ) : (
            <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
              No active run — meters appear once a run starts.
            </p>
          )}
          <div className="dw-leasebox mt-3" aria-live="off">
            {directorLease.status === "live" ? (
              <>
                Director lease held by{" "}
                <span className="mono">{directorLease.data.holder}</span>
                <br />
                heartbeat {directorLease.data.heartbeatAgeSec}s ago · expires in{" "}
                {directorLease.data.expiresInSec}s
                {directorLease.data.stale ? " · stale — will be re-queued" : ""}
              </>
            ) : (
              <>
                <span className="font-bold text-[hsl(var(--ink))]">
                  Director lease: control data unavailable.
                </span>
                <br />
                {directorLease.reason}. Nothing is faked here — the run still
                executes server-side.
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
