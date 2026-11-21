import type { Availability, OfficeBlueprintData, SetupStepId } from "./model";
import { deriveSetupChecklist } from "./derive";

/**
 * First-run "Set up your office" checklist (Goal rail, chapter styling).
 * Every step's completion is derived from observed state (hires, seats,
 * allocations, ≥1 running task) — the checklist teaches, it never gates,
 * and it never declares work that has not happened.
 */
export default function SetupChecklist({
  blueprint,
  skipped,
  onSkip,
  onNavigate,
}: {
  blueprint: Availability<OfficeBlueprintData>;
  skipped: ReadonlySet<string>;
  onSkip?: (id: SetupStepId) => void;
  onNavigate?: (id: SetupStepId) => void;
}) {
  if (blueprint.status !== "live") {
    return (
      <section aria-labelledby="ob-setup-heading" className="border border-[hsl(var(--line))] p-3">
        <h2 id="ob-setup-heading" className="kicker">
          First run · Set up your office
        </h2>
        <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">
          setup progress unavailable — {blueprint.reason}
        </p>
      </section>
    );
  }
  const steps = deriveSetupChecklist(blueprint.data, skipped);
  const done = steps.filter((s) => s.done).length;

  return (
    <section aria-labelledby="ob-setup-heading" className="border border-[hsl(var(--line))] p-3">
      <div className="flex items-center gap-2">
        <h2 id="ob-setup-heading" className="kicker">
          First run · Set up your office
        </h2>
        <span className="chip chip-mustard ml-auto">
          {done} of {steps.length} done
        </span>
      </div>
      <p className="mt-1 text-[13px] font-bold">Office setup</p>
      <ol className="mt-1 flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2" data-step={s.id} data-done={s.done}>
            <span
              aria-hidden
              className="mono mt-0.5 text-[12px] text-[hsl(var(--ink-soft))]"
            >
              {s.num}
            </span>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="min-h-[44px] text-left text-[14px] font-bold underline-offset-2 hover:underline"
                onClick={() => onNavigate?.(s.id)}
                aria-current={!s.done && !s.skipped ? "step" : undefined}
              >
                {s.title}
              </button>
              <p className="text-[12px] text-[hsl(var(--ink-soft))]">
                {s.done ? "✓ " : ""}
                {s.detail}
              </p>
            </div>
            {s.done ? (
              <span className="chip chip-sage">done</span>
            ) : s.skipped ? (
              <span className="chip chip-neutral">skipped</span>
            ) : onSkip ? (
              <button
                type="button"
                className="btn min-h-[44px] px-2 text-[12px]"
                onClick={() => onSkip(s.id)}
                aria-label={`Skip ${s.title} for now`}
              >
                Skip for now
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12px] text-[hsl(var(--ink-soft))]">
        Completion is observed, never declared — step 04 completes only when a task is actually
        running. Setup never blocks a run.
      </p>
    </section>
  );
}
