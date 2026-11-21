import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { ErrorNote } from "../../DirectorShell";
import type { RoutingRequest } from "./evalTypes";
import { StrategyCatalogView } from "./StrategyCatalogView";
import { RouteDecisionView, RouteForm } from "./RouteExplorer";
import { CompiledPromptView, PromptPreviewForm } from "./PromptPreview";
import { MockSuiteRunner } from "./MockSuiteRunner";
import { ReportDetailView, ReportListView } from "./ReportsView";

/**
 * Prompt & Evaluation panel (Director workspace, stage 05).
 *
 * Every control calls the real evaluation tRPC router:
 *   - evaluation.strategies  — versioned catalog + routing rules
 *   - evaluation.route       — task-aware router explanation (dry run)
 *   - evaluation.preview     — compiled-prompt preview (no provider call)
 *   - evaluation.runMockSuite — deterministic mock stress suite (priced at
 *     configured rates; the server refuses when no rate exists)
 *   - evaluation.reports / evaluation.report — saved report list + detail
 *
 * Live provider evaluation is deliberately NOT offered here and is labeled
 * unavailable.
 */

type EvalTab = "catalog" | "route" | "preview" | "suite" | "reports";

const TABS: { id: EvalTab; label: string }[] = [
  { id: "catalog", label: "Strategy catalog" },
  { id: "route", label: "Route a task" },
  { id: "preview", label: "Prompt preview" },
  { id: "suite", label: "Mock stress suite" },
  { id: "reports", label: "Saved reports" },
];

function LoadingNote({ what }: { what: string }) {
  return (
    <p role="status" className="text-[13px] text-[hsl(var(--ink-soft))]">
      Loading {what}…
    </p>
  );
}

export default function PromptEvaluationPanel() {
  const [tab, setTab] = useState<EvalTab>("catalog");
  const utils = trpc.useUtils();

  const catalogQ = trpc.evaluation.strategies.useQuery(undefined, {
    enabled: tab === "catalog",
    retry: false,
  });

  const [routeRequest, setRouteRequest] = useState<RoutingRequest | null>(null);
  const routeQ = trpc.evaluation.route.useQuery(routeRequest as RoutingRequest, {
    enabled: tab === "route" && routeRequest !== null,
    retry: false,
  });

  const previewM = trpc.evaluation.preview.useMutation();

  const runSuiteM = trpc.evaluation.runMockSuite.useMutation({
    onSuccess: (out) => {
      if (out.id != null) void utils.evaluation.reports.invalidate();
    },
  });

  const reportsQ = trpc.evaluation.reports.useQuery(undefined, {
    enabled: tab === "reports",
    retry: false,
  });
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const reportQ = trpc.evaluation.report.useQuery(
    { id: selectedReportId ?? 0 },
    { enabled: tab === "reports" && selectedReportId !== null, retry: false },
  );

  return (
    <section aria-labelledby="dw-prompt-eval-heading" className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="dw-prompt-eval-heading" className="text-lg font-extrabold tracking-tight">
          Prompt &amp; evaluation
        </h2>
        <span className="chip">deterministic mock harness</span>
        <span className="chip chip-mustard">live evaluation unavailable</span>
      </div>
      <p className="prose-evidence max-w-3xl text-[13px] text-[hsl(var(--ink-soft))]">
        Compile prompts, explain strategy routing, and stress-test strategies
        offline. Everything here is deterministic and priced strictly at your
        configured rates — nothing is a vendor estimate, and no strategy is
        presented as universally best: expensive strategies must beat the
        direct_structured baseline on measured quality-per-dollar. Live
        provider evaluation is not available in this workspace yet.
      </p>

      <div role="tablist" aria-label="Prompt and evaluation sections" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`dw-eval-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`dw-eval-panel-${t.id}`}
            className={`btn min-h-[36px] px-3 text-[13px] ${tab === t.id ? "font-extrabold underline" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`dw-eval-panel-${tab}`}
        aria-labelledby={`dw-eval-tab-${tab}`}
        className="min-w-0"
      >
        {tab === "catalog" ? (
          catalogQ.isPending ? (
            <LoadingNote what="strategy catalog" />
          ) : catalogQ.error ? (
            <ErrorNote message={catalogQ.error.message} />
          ) : (
            <StrategyCatalogView
              strategies={catalogQ.data.strategies}
              routingRules={catalogQ.data.routingRules}
            />
          )
        ) : null}

        {tab === "route" ? (
          <div className="grid max-w-3xl gap-4">
            <RouteForm onRoute={setRouteRequest} disabled={routeQ.isFetching} />
            {routeQ.isFetching ? <LoadingNote what="routing decision" /> : null}
            {routeQ.error ? <ErrorNote message={routeQ.error.message} /> : null}
            {routeQ.data ? (
              <RouteDecisionView routing={routeQ.data.routing} dispatch={routeQ.data.dispatch} />
            ) : !routeQ.isFetching && !routeQ.error ? (
              <p className="text-[13px] text-[hsl(var(--ink-soft))]">
                Declare the task shape above and ask the router to explain its
                route — including anything it rejects, and why.
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "preview" ? (
          <div className="grid max-w-4xl gap-4">
            <PromptPreviewForm
              pending={previewM.isPending}
              onCompile={(input) => previewM.mutate({ input })}
            />
            {previewM.error ? <ErrorNote message={previewM.error.message} /> : null}
            {previewM.data ? <CompiledPromptView compiled={previewM.data} /> : null}
          </div>
        ) : null}

        {tab === "suite" ? (
          <div className="grid max-w-3xl gap-4">
            <MockSuiteRunner
              run={(input) => runSuiteM.mutateAsync(input)}
              onSaved={(id) => setSelectedReportId(id)}
            />
          </div>
        ) : null}

        {tab === "reports" ? (
          <div className="grid gap-4">
            {reportsQ.isPending ? <LoadingNote what="saved reports" /> : null}
            {reportsQ.error ? <ErrorNote message={reportsQ.error.message} /> : null}
            {reportsQ.data ? (
              <ReportListView
                reports={reportsQ.data}
                selectedId={selectedReportId}
                onSelect={setSelectedReportId}
              />
            ) : null}
            {selectedReportId !== null ? (
              reportQ.isPending ? (
                <LoadingNote what={`report #${selectedReportId}`} />
              ) : reportQ.error ? (
                <ErrorNote message={reportQ.error.message} />
              ) : reportQ.data ? (
                <ReportDetailView
                  report={reportQ.data.report}
                  ratesSource={reportQ.data.rates.source}
                />
              ) : null
            ) : (
              reportsQ.data?.length ? (
                <p className="text-[13px] text-[hsl(var(--ink-soft))]">
                  Select a report to see paired baselines, per-case outcomes,
                  reliability, cost/latency percentiles, and security events.
                </p>
              ) : null
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
