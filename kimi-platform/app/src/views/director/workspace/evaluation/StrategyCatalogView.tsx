import type { RoutingRuleItem, StrategyCatalogEntry } from "./evalTypes";

/**
 * Versioned strategy catalog: when/when-not guidance, evaluation-only and
 * dispatch labels, and the routing rules the router actually enforces. The
 * cost multiplier is a call-count planning estimate, never a benchmark — the
 * UI says so next to every figure. No strategy is presented as universally
 * best; direct_structured is the mandatory baseline.
 */
export function StrategyCatalogView({
  strategies,
  routingRules,
}: {
  strategies: StrategyCatalogEntry[];
  routingRules: RoutingRuleItem[];
}) {
  if (!strategies.length) {
    return (
      <p className="text-[13px] text-[hsl(var(--ink-soft))]">
        The strategy catalog is empty — the evaluation API returned no entries.
      </p>
    );
  }
  return (
    <div className="grid gap-4">
      <ul className="grid gap-3 md:grid-cols-2" aria-label="Prompt strategies">
        {strategies.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <b className="mono text-[13px]">{s.id}</b>
              <span className="chip mono">v{s.version}</span>
              {s.evaluationOnly ? (
                <span className="chip chip-mustard">evaluation only</span>
              ) : null}
              {s.requiresOrchestration ? (
                <span className="chip chip-mustard">needs orchestration</span>
              ) : null}
              <span className={`chip ${s.dispatchable ? "chip-sage" : ""}`}>
                {s.dispatchable ? "dispatchable" : "offline comparison only"}
              </span>
            </div>
            <p className="prose-evidence text-[13px] text-[hsl(var(--ink-soft))]">
              {s.summary}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <h4 className="text-[12px] font-extrabold uppercase tracking-wide text-[hsl(var(--ink-soft))]">
                  When to use
                </h4>
                <ul className="mt-1 list-disc pl-4 text-[13px]">
                  {s.whenToUse.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[12px] font-extrabold uppercase tracking-wide text-[hsl(var(--ink-soft))]">
                  When not to use
                </h4>
                <ul className="mt-1 list-disc pl-4 text-[13px]">
                  {s.whenNotToUse.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-auto text-[12px] text-[hsl(var(--ink-soft))]">
              fan-out ≤ {s.maxFanout} · retries ≤ {s.maxRetries} · ≈
              {s.costMultiplier}× baseline cost{" "}
              <em>(call-count planning estimate, not a measurement)</em>
            </p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="dw-routing-rules-heading">
        <h3
          id="dw-routing-rules-heading"
          className="text-[15px] font-extrabold tracking-tight"
        >
          Routing rules enforced by the router
        </h3>
        <ol className="mt-2 grid gap-1.5">
          {routingRules.map((r) => (
            <li key={r.id} className="border border-[hsl(var(--line))] p-2 text-[13px]">
              <span className="mono text-[12px] font-bold">{r.id}</span> — {r.rule}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[12px] text-[hsl(var(--ink-soft))]">
          There is no universal best strategy: direct_structured is the default
          and the mandatory baseline; expensive strategies must earn production
          use with measured quality-per-dollar lift and pass^k reliability.
        </p>
      </section>
    </div>
  );
}
