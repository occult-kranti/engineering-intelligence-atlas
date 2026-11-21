import { useState } from "react";
import { STRATEGY_IDS } from "@contracts/prompting";
import { SLA_TIERS } from "@contracts/evaluation";
import type { RoutingDecision, RoutingRequest, StrategyId } from "./evalTypes";

/**
 * Task-aware strategy router explorer. The form declares the *measured*
 * shape of a task; the server-side router applies the research routing rules
 * and explains its decision, including every rejection. Nothing is routed
 * around a gate: a requested strategy that violates its precondition is
 * rejected with a recorded reason and the rule-based default is shown.
 */

const BOOL_FIELDS: {
  key:
    | "symbolic"
    | "compositional"
    | "requiresToolWorkflow"
    | "hasExternalVerifier"
    | "votable"
    | "multiAgentRequested"
    | "singleAgentBaselineFailed";
  label: string;
  hint: string;
}[] = [
  { key: "symbolic", label: "Symbolic / exact answer", hint: "arithmetic, symbolic math, exact-match answers" },
  { key: "compositional", label: "Compositional", hint: "later sub-answers depend on earlier ones" },
  { key: "requiresToolWorkflow", label: "Tool / action workflow", hint: "agentic tool use required" },
  { key: "hasExternalVerifier", label: "External verifier exists", hint: "an independent checker, not another LLM" },
  { key: "votable", label: "Votable answer space", hint: "small space where majority agreement is well-defined" },
  { key: "multiAgentRequested", label: "Multi-agent requested", hint: "permitted only after a measured single-agent failure" },
  { key: "singleAgentBaselineFailed", label: "Single-agent baseline failed", hint: "a measured failure, not a hunch" },
];

export function RouteForm({
  onRoute,
  disabled,
}: {
  onRoute(request: RoutingRequest): void;
  disabled?: boolean;
}) {
  const [flags, setFlags] = useState<Record<(typeof BOOL_FIELDS)[number]["key"], boolean>>({
    symbolic: false,
    compositional: false,
    requiresToolWorkflow: false,
    hasExternalVerifier: false,
    votable: false,
    multiAgentRequested: false,
    singleAgentBaselineFailed: false,
  });
  const [slaTier, setSlaTier] = useState<(typeof SLA_TIERS)[number]>("standard");
  const [requested, setRequested] = useState<StrategyId | "">("");

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onRoute({
          ...flags,
          slaTier,
          ...(requested ? { requestedStrategy: requested } : {}),
        });
      }}
    >
      <fieldset className="grid gap-1.5 sm:grid-cols-2">
        <legend className="text-[13px] font-extrabold">
          Declared task shape (measured properties, not vibes)
        </legend>
        {BOOL_FIELDS.map((f) => (
          <label
            key={f.key}
            className="flex items-start gap-2 border border-[hsl(var(--line))] p-2 text-[13px]"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={flags[f.key]}
              onChange={(e) => setFlags((p) => ({ ...p, [f.key]: e.target.checked }))}
            />
            <span>
              <b>{f.label}</b>
              <span className="block text-[12px] text-[hsl(var(--ink-soft))]">{f.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[13px] font-bold">
          SLA tier
          <select
            className="input mt-1 block text-[13px]"
            value={slaTier}
            onChange={(e) => setSlaTier(e.target.value as typeof slaTier)}
          >
            {SLA_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-bold">
          Requested strategy (optional)
          <select
            className="input mt-1 block text-[13px]"
            value={requested}
            onChange={(e) => setRequested(e.target.value as StrategyId | "")}
          >
            <option value="">— let the router decide —</option>
            {STRATEGY_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn min-h-[36px] text-[13px]" disabled={disabled}>
          {disabled ? "Routing…" : "Explain route"}
        </button>
      </div>
    </form>
  );
}

function DecisionBlock({
  title,
  decision,
}: {
  title: string;
  decision: RoutingDecision;
}) {
  return (
    <section
      aria-label={title}
      className="grid gap-2 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <h4 className="text-[13px] font-extrabold">{title}</h4>
        <span className="chip chip-cornflower mono">{decision.strategy}</span>
        {decision.multiAgentPermitted ? (
          <span className="chip chip-mustard">multi-agent permitted (baseline failed)</span>
        ) : (
          <span className="chip">single-agent only</span>
        )}
      </div>
      <p className="prose-evidence text-[13px]">
        <b>Why:</b> {decision.reason}
      </p>
      {decision.rejected.length ? (
        <div>
          <h5 className="text-[12px] font-extrabold uppercase tracking-wide text-[hsl(var(--ink-soft))]">
            Rejected by the rules
          </h5>
          <ul className="mt-1 grid gap-1">
            {decision.rejected.map((r) => (
              <li key={r.strategy} className="text-[13px]">
                <span className="chip chip-alert mono">{r.strategy}</span>{" "}
                <span className="text-[hsl(var(--ink-soft))]">{r.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {decision.notes.length ? (
        <ul className="grid gap-0.5 text-[12px] text-[hsl(var(--ink-soft))]">
          {decision.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Router explanation: the research routing decision and the dispatch gate. */
export function RouteDecisionView({
  routing,
  dispatch,
}: {
  routing: RoutingDecision;
  dispatch: RoutingDecision;
}) {
  return (
    <div className="grid gap-3">
      <DecisionBlock title="Research routing" decision={routing} />
      <DecisionBlock title="Dispatch gate (what production may run)" decision={dispatch} />
      <p className="text-[12px] text-[hsl(var(--ink-soft))]">
        The dispatch gate never routes evaluation-only or orchestration-requiring
        strategies into production; those may only be compiled here for offline
        comparison against the direct_structured baseline.
      </p>
    </div>
  );
}
