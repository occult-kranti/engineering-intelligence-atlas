import type {
  CaseOutcome,
  EvaluationReport,
  PairedOutcome,
  ReportSummaryRow,
} from "./evalTypes";
import {
  fmtDelta,
  fmtInt,
  fmtMicros,
  fmtMs,
  fmtPassAtK,
  fmtPct,
  shortHash,
} from "./evalTypes";

/**
 * Saved evaluation reports: list (metadata) and detail (full report). Costs
 * are mock-metered usage priced at the configured rates stored on the report
 * — the stored rates are shown next to every dollar figure so nothing reads
 * as a vendor estimate or a live-billing number. Verdicts are the harness's
 * own: "measured" point estimates or an explicit "inconclusive".
 */

export function ReportListView({
  reports,
  selectedId,
  onSelect,
}: {
  reports: ReportSummaryRow[];
  selectedId: number | null;
  onSelect(id: number): void;
}) {
  if (!reports.length) {
    return (
      <p className="text-[13px] text-[hsl(var(--ink-soft))]">
        No saved reports yet — run the mock stress suite with “save report”
        enabled and it will appear here (immutable, owner-scoped).
      </p>
    );
  }
  return (
    <ul className="grid gap-2" aria-label="Saved evaluation reports">
      {reports.map((r) => {
        const provider =
          typeof r.config.provider === "string" ? r.config.provider : null;
        const model = typeof r.config.model === "string" ? r.config.model : null;
        return (
          <li key={r.id}>
            <button
              type="button"
              aria-pressed={selectedId === r.id}
              aria-current={selectedId === r.id ? "true" : undefined}
              onClick={() => onSelect(r.id)}
              className={`flex w-full flex-wrap items-center gap-1.5 border p-2 text-left text-[13px] ${
                selectedId === r.id
                  ? "border-[hsl(var(--ink))] bg-[hsl(var(--paper-raised))]"
                  : "border-[hsl(var(--line))]"
              }`}
            >
              <b className="mono text-[12px]">#{r.id}</b>
              <span className="font-bold">{r.suiteName}</span>
              <span className="chip mono">v{r.suiteVersion}</span>
              <span className="chip mono" title={`suite hash ${r.suiteHash}`}>
                suite {shortHash(r.suiteHash)}…
              </span>
              <span className="chip mono" title={`report hash ${r.reportHash}`}>
                report {shortHash(r.reportHash)}…
              </span>
              {provider ? <span className="chip">{provider}{model ? `/${model}` : ""}</span> : null}
              <span className="chip">rates: {r.rates.source}</span>
              <span className="text-[12px] text-[hsl(var(--ink-soft))]">
                {new Date(r.createdAt).toLocaleString()}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[hsl(var(--ink-soft))]">{label}</dt>
      <dd className="mono text-[12px] font-bold">{value}</dd>
    </div>
  );
}

/** One metered outcome (a baseline or a candidate) for a single case. */
export function OutcomeCard({
  label,
  tone,
  outcome,
  deltas,
}: {
  label: string;
  tone: "baseline" | "candidate";
  outcome: CaseOutcome;
  deltas?: {
    vsBaseline: { quality: { absolute: number; relative: number | null } };
    vsShortPlanBaseline: { quality: { absolute: number; relative: number | null } };
  };
}) {
  return (
    <article
      aria-label={`${label}: ${outcome.strategy}`}
      className="grid content-start gap-2 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-[hsl(var(--ink-soft))]">
          {label}
        </span>
        <b className="mono text-[12px]">{outcome.strategy}</b>
        <span className="chip mono">v{outcome.strategyVersion}</span>
        {outcome.evaluationOnly ? (
          <span className="chip chip-mustard">evaluation only</span>
        ) : null}
        {outcome.inconclusive ? (
          <span className="chip chip-mustard">inconclusive (&lt; min trials)</span>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
        <Metric label="quality (rubric mean)" value={fmtPct(outcome.quality)} />
        <Metric label="schema-valid" value={fmtPct(outcome.schemaValidityRate)} />
        <Metric
          label={`success (${outcome.successes}/${outcome.trials} trials)`}
          value={fmtPct(outcome.successRate)}
        />
        <Metric label="pass@k" value={fmtPassAtK(outcome.passAtK)} />
        <Metric label="pass^k reliability" value={fmtPct(outcome.passPowK)} />
        <Metric label="calls" value={fmtInt(outcome.calls)} />
        <Metric label="tokens (prompt+completion)" value={fmtInt(outcome.tokens.total)} />
        <Metric label="total cost (mock-metered)" value={fmtMicros(outcome.totalCostMicros)} />
        <Metric
          label="cost / accepted"
          value={
            outcome.costPerAcceptedMicros === null
              ? "n/a — nothing accepted"
              : fmtMicros(outcome.costPerAcceptedMicros)
          }
        />
        <Metric label="latency mean" value={fmtMs(outcome.latency.meanMs)} />
        <Metric label="latency p50" value={fmtMs(outcome.latency.p50Ms)} />
        <Metric label="latency p95" value={fmtMs(outcome.latency.p95Ms)} />
      </dl>
      {deltas ? (
        <p className="text-[12px] text-[hsl(var(--ink-soft))]">
          Δ quality vs direct_structured: <b className="mono">{fmtDelta(deltas.vsBaseline.quality)}</b>
          {" · "}Δ quality vs plan_execute:{" "}
          <b className="mono">{fmtDelta(deltas.vsShortPlanBaseline.quality)}</b>
          {" "}(descriptive point estimates — no significance testing)
        </p>
      ) : tone === "baseline" ? (
        <p className="text-[12px] text-[hsl(var(--ink-soft))]">
          Mandatory baseline — every candidate is paired against this outcome.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {outcome.stopReasons.map((s) => (
          <span key={s} className={`chip ${s === "completed" ? "" : "chip-mustard"}`}>
            stop: {s}
          </span>
        ))}
      </div>
      {outcome.securityEvents.length ? (
        <ul className="grid gap-1" aria-label="Security events">
          {outcome.securityEvents.map((e, i) => (
            <li key={i} className="text-[12px]">
              <span className="chip chip-alert">security: {e.kind}</span>{" "}
              <span className="text-[hsl(var(--ink-soft))]">{e.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {outcome.degradationNotes.length ? (
        <ul className="grid gap-0.5 text-[12px]" aria-label="Degradation notes">
          {outcome.degradationNotes.map((n) => (
            <li key={n}>
              <span className="chip chip-alert">degraded</span>{" "}
              <span className="text-[hsl(var(--ink-soft))]">{n}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function CaseBlock({ outcome }: { outcome: PairedOutcome }) {
  return (
    <section
      aria-label={`Case ${outcome.caseId}`}
      className="grid gap-2 border border-[hsl(var(--line))] p-3"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <b className="mono text-[13px]">{outcome.caseId}</b>
        <span className="chip">{outcome.category}</span>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <OutcomeCard label="baseline" tone="baseline" outcome={outcome.baseline} />
        <OutcomeCard
          label="short-plan baseline"
          tone="baseline"
          outcome={outcome.shortPlanBaseline}
        />
        {outcome.candidates.map((c) => (
          <OutcomeCard
            key={c.outcome.strategy}
            label="candidate"
            tone="candidate"
            outcome={c.outcome}
            deltas={{
              vsBaseline: { quality: c.vsBaseline.quality },
              vsShortPlanBaseline: { quality: c.vsShortPlanBaseline.quality },
            }}
          />
        ))}
        {!outcome.candidates.length ? (
          <p className="text-[12px] text-[hsl(var(--ink-soft))] lg:col-span-2">
            This case declares no candidates — baselines only.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function ReportDetailView({
  report,
  ratesSource,
}: {
  report: EvaluationReport;
  /** "owner" | "env" — where the pricing rates came from (when known). */
  ratesSource?: string;
}) {
  const measured = report.verdict === "measured";
  return (
    <div className="grid gap-4" data-testid="report-detail">
      <div className="flex flex-wrap items-center gap-1.5">
        <b className="text-[14px]">{report.suite.name}</b>
        <span className="chip mono">v{report.suite.version}</span>
        <span className="chip mono" title={report.suite.hash}>
          suite {shortHash(report.suite.hash)}…
        </span>
        <span className={`chip ${measured ? "chip-sage" : "chip-mustard"}`}>
          {measured ? "measured point estimates" : "inconclusive — descriptive only"}
        </span>
      </div>
      <p className="prose-evidence text-[13px] text-[hsl(var(--ink-soft))]">
        {report.verdictReason}
      </p>
      <p className="text-[12px] text-[hsl(var(--ink-soft))]">{report.disclaimer}</p>

      <section aria-label="Run configuration">
        <h4 className="text-[13px] font-extrabold">Configuration &amp; pricing honesty</h4>
        <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
          <Metric label="trials per outcome" value={fmtInt(report.config.repeats)} />
          <Metric label="k (pass@k / pass^k)" value={fmtInt(report.config.k)} />
          <Metric label="min trials for conclusion" value={fmtInt(report.config.minTrialsForConclusion)} />
          <Metric label="quality threshold" value={report.config.qualityThreshold.toFixed(2)} />
          <Metric
            label="input rate (USD / 1M tokens)"
            value={`$${report.rates.inputUsdPerMillion}`}
          />
          <Metric
            label="output rate (USD / 1M tokens)"
            value={`$${report.rates.outputUsdPerMillion}`}
          />
        </dl>
        <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">
          All dollar figures are mock-metered usage priced at these configured
          rates{ratesSource ? ` (source: ${ratesSource})` : ""} — they are not
          vendor estimates and not live billing. Strategies under test:{" "}
          {report.strategies.map((s) => (
            <span key={s.id} className="chip mono ml-1">
              {s.id} v{s.version}
              {s.evaluationOnly ? " · evaluation only" : ""}
            </span>
          ))}
        </p>
      </section>

      <section aria-label="Aggregate cost and latency">
        <h4 className="text-[13px] font-extrabold">Aggregate (all case outcomes)</h4>
        <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-5">
          <Metric label="total cost" value={fmtMicros(report.aggregate.totalCostMicros)} />
          <Metric label="median cost" value={fmtMicros(report.aggregate.medianCostMicros)} />
          <Metric label="p95 cost" value={fmtMicros(report.aggregate.p95CostMicros)} />
          <Metric label="median latency (p50 of cases)" value={fmtMs(report.aggregate.medianLatencyMs)} />
          <Metric label="p95 latency" value={fmtMs(report.aggregate.p95LatencyMs)} />
        </dl>
      </section>

      {report.securityEvents.length ? (
        <section aria-label="Security events" className="grid gap-1">
          <h4 className="text-[13px] font-extrabold">
            Security events ({report.securityEvents.length})
          </h4>
          <ul className="grid gap-1">
            {report.securityEvents.map((e, i) => (
              <li key={i} className="border border-[hsl(var(--line))] p-2 text-[13px]">
                <span className="chip chip-alert">{e.kind}</span>{" "}
                <span className="chip mono">{e.caseId}</span>{" "}
                <span className="chip mono">{e.strategy}</span>{" "}
                <span className="text-[hsl(var(--ink-soft))]">{e.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.degradationEvents.length ? (
        <section aria-label="Degradation events" className="grid gap-1">
          <h4 className="text-[13px] font-extrabold">
            Degradation events ({report.degradationEvents.length})
          </h4>
          <ul className="grid gap-0.5 text-[12px]">
            {report.degradationEvents.map((d, i) => (
              <li key={`${d.caseId}-${i}`}>
                <span className="chip mono">{d.caseId}</span>{" "}
                <span className="chip chip-alert">degraded</span>{" "}
                <span className="text-[hsl(var(--ink-soft))]">{d.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Per-case paired outcomes" className="grid gap-2">
        <h4 className="text-[13px] font-extrabold">
          Cases ({report.cases.length}) — each paired against both baselines
        </h4>
        {report.cases.map((c) => (
          <CaseBlock key={c.caseId} outcome={c} />
        ))}
      </section>
    </div>
  );
}
