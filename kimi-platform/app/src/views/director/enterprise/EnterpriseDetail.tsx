import { lazy, Suspense, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { ErrorNote } from "../DirectorShell";
import {
  useEnterpriseActions,
  useEnterpriseSnapshot,
  useEnterpriseWorkers,
} from "./useEnterpriseData";
import {
  derivePlanStatus,
  describeSnapshotError,
  type PlanStatus,
  type SnapshotLike,
  type WorkerRowLike,
} from "./adapter";
import OverviewSection from "./OverviewSection";
import CompanyCards from "./CompanyCards";
import PoolPanel from "./PoolPanel";
import ContractsPanel from "./ContractsPanel";
import MemoryPanel from "./MemoryPanel";
import ActivityPanel from "./ActivityPanel";
import StructureLists from "./StructureLists";
import DonnaDrawer from "./DonnaDrawer";
import "./enterprise.css";

// The heavy interactive graph is its own chunk (lazy), mounted only when the
// structure section opens.
const EnterpriseGraph = lazy(() => import("./EnterpriseGraph"));

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "structure", label: "Structure" },
  { id: "companies", label: "Companies" },
  { id: "pool", label: "Departments & workers" },
  { id: "contracts", label: "Contracts" },
  { id: "memory", label: "Memory" },
  { id: "activity", label: "Activity" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * CEO enterprise dashboard for #/director/enterprises/:id. One snapshot query
 * feeds every section (content/version/event-seq invalidated server-side);
 * the graph and the canonical lists read the SAME contract-derived view, and
 * selection keys are list row keys — parity by construction. All controls
 * dispatch real trpc.enterprise mutations; unavailable data degrades to
 * honest notices, never fabricated values.
 */
export default function EnterpriseDetail({ enterpriseId }: { enterpriseId: number }) {
  const snapshotQ = useEnterpriseSnapshot(enterpriseId);
  const workersQ = useEnterpriseWorkers(enterpriseId);
  const actionsQ = useEnterpriseActions();
  const [section, setSection] = useState<SectionId>("overview");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [donnaOpen, setDonnaOpen] = useState(false);

  const companies = useMemo(() => snapshotQ.data?.companies ?? [], [snapshotQ.data]);
  // Per-company plan truth from the EXISTING dag.revisions feed (the plan
  // gate is never bypassed — drafts stay unapproved until a human approves
  // in the company project workspace).
  const revisionQueries = trpc.useQueries((t) =>
    companies.map((c) => t.dag.revisions({ projectId: c.projectId }, { retry: false })),
  );
  const planStatusByKey = useMemo(() => {
    const map = new Map<string, PlanStatus>();
    companies.forEach((c, i) => {
      const q = revisionQueries[i];
      map.set(
        c.key,
        q?.error
          ? { state: "loading", detail: `plan status unavailable (${q.error.message})` }
          : derivePlanStatus(q?.data),
      );
    });
    return map;
  }, [companies, revisionQueries]);

  if (snapshotQ.error) {
    return (
      <div className="dw">
        <ErrorNote
          message={describeSnapshotError(
            snapshotQ.error.data?.code,
            snapshotQ.error.message,
            enterpriseId,
          )}
        />
        <a className="btn text-[13px]" href="#/director/enterprises">
          Back to enterprises
        </a>
      </div>
    );
  }

  if (snapshotQ.isLoading || !snapshotQ.data) {
    return (
      <div className="dw grid gap-3" aria-label="Loading enterprise">
        <div className="h-8 w-64 animate-pulse bg-[hsl(var(--paper-raised))]" />
        <div className="h-40 animate-pulse border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))]" />
        <div className="h-64 animate-pulse border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))]" />
      </div>
    );
  }

  const snapshot = snapshotQ.data as SnapshotLike;
  const workers = (workersQ.data ?? []) as WorkerRowLike[];
  const workersError = workersQ.error?.message ?? null;

  return (
    <div className="dw ent" data-testid="enterprise-detail">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">{snapshot.enterprise.name}</h1>
        <span className="chip">{snapshot.enterprise.status}</span>
        <span className="chip mono">program {snapshot.enterprise.slug}</span>
        <span className="chip mono">v{snapshot.enterprise.version}</span>
        {snapshot.program ? (
          <span className={`chip ${snapshot.program.state === "running" ? "chip-sage" : snapshot.program.state.startsWith("stopped") || snapshot.program.state === "failed" ? "chip-alert" : "chip-mustard"}`}>
            program: {snapshot.program.state}
            {snapshot.program.pausedAt ? " (paused)" : ""}
          </span>
        ) : (
          <span className="chip chip-mustard">no program yet</span>
        )}
        <button
          type="button"
          className="btn ml-auto text-[13px] font-extrabold border-[hsl(var(--ink))]"
          onClick={() => setDonnaOpen(true)}
          aria-haspopup="dialog"
          data-testid="donna-open-button"
        >
          Donna — CEO assistant
        </button>
      </div>
      <p className="prose-evidence mt-1 max-w-3xl text-[14px] text-[hsl(var(--ink-soft))]">
        {snapshot.enterprise.goal}
      </p>

      <nav aria-label="Dashboard sections" className="mt-4 flex flex-wrap border-b border-[hsl(var(--line))]" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            className="tab-control"
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="mt-4" role="tabpanel" aria-label={SECTIONS.find((s) => s.id === section)?.label}>
        {section === "overview" ? (
          <OverviewSection
            snapshot={snapshot}
            workers={workers}
            actions={actionsQ.data ?? null}
            actionsError={actionsQ.error?.message ?? null}
            planStatusByKey={planStatusByKey}
          />
        ) : null}

        {section === "structure" ? (
          <div className="grid gap-4">
            {snapshot.view ? (
              <Suspense
                fallback={
                  <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-6 text-[13px] text-[hsl(var(--ink-soft))]" role="status">
                    Loading structure graph…
                  </div>
                }
              >
                <EnterpriseGraph
                  view={snapshot.view}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                />
              </Suspense>
            ) : (
              <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-6">
                <h2 className="text-lg font-extrabold">No blueprint applied yet</h2>
                <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
                  The structure graph appears once a blueprint has been
                  materialized for this enterprise. Apply one from the
                  enterprises list — the preview shows the exact companies,
                  departments, and contracts before anything is written.
                </p>
              </div>
            )}
            <StructureLists snapshot={snapshot} selectedKey={selectedKey} onSelect={setSelectedKey} />
          </div>
        ) : null}

        {section === "companies" ? (
          <CompanyCards
            snapshot={snapshot}
            planStatusByKey={planStatusByKey}
            workers={workers}
          />
        ) : null}

        {section === "pool" ? (
          <PoolPanel
            snapshot={snapshot}
            workers={workers}
            workersError={workersError}
            workersLoading={workersQ.isLoading}
          />
        ) : null}

        {section === "contracts" ? <ContractsPanel snapshot={snapshot} /> : null}

        {section === "memory" ? <MemoryPanel enterpriseId={enterpriseId} /> : null}

        {section === "activity" ? (
          <ActivityPanel snapshot={snapshot} workers={workers} />
        ) : null}
      </div>

      {donnaOpen ? (
        <DonnaDrawer
          enterpriseId={enterpriseId}
          snapshot={snapshot}
          workers={workers}
          workersError={workersError}
          onClose={() => setDonnaOpen(false)}
          onOpenActivity={() => {
            setDonnaOpen(false);
            setSection("activity");
          }}
        />
      ) : null}
    </div>
  );
}
