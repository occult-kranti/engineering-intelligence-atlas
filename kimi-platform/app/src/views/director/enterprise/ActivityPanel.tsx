import { useMemo, useState } from "react";
import {
  WORK_LEDGER_KINDS,
  type TimelineIndexEntry,
  type WorkLedgerEntry,
} from "@contracts/enterprise";
import { fmt } from "@/lib/format";
import { useKeysetPages } from "./useEnterpriseData";
import {
  EMPTY_LEDGER_FILTER,
  buildLedgerMaps,
  filterLedger,
  type LedgerFilter,
  type SnapshotLike,
  type WorkerRowLike,
} from "./adapter";

interface EnterpriseEventRow {
  id: number;
  seq: number;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: Date | string;
}

/**
 * Activity: the derived worker bullet ledger (with company / department /
 * employee filters), the timeline index derived from the same ledger, and
 * the append-only enterprise audit events. All three are keyset-paginated
 * server reads — never fabricated, never advanced by viewing.
 */
export default function ActivityPanel({
  snapshot,
  workers,
}: {
  snapshot: SnapshotLike;
  workers: WorkerRowLike[];
}) {
  const [tab, setTab] = useState<"ledger" | "timeline" | "events">("ledger");
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap border-b border-[hsl(var(--line))]" role="tablist" aria-label="Activity views">
        {(
          [
            ["ledger", "Worker bullet ledger"],
            ["timeline", "Timeline"],
            ["events", "Enterprise events"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="tab-control"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "ledger" ? <LedgerView snapshot={snapshot} workers={workers} /> : null}
      {tab === "timeline" ? <TimelineView enterpriseId={snapshot.enterprise.id} /> : null}
      {tab === "events" ? <EventsView enterpriseId={snapshot.enterprise.id} /> : null}
    </div>
  );
}

function LedgerView({ snapshot, workers }: { snapshot: SnapshotLike; workers: WorkerRowLike[] }) {
  const page = useKeysetPages<WorkLedgerEntry>(snapshot.enterprise.id, "ledger", 100);
  const [filter, setFilter] = useState<LedgerFilter>(EMPTY_LEDGER_FILTER);
  const maps = useMemo(() => buildLedgerMaps(snapshot, workers), [snapshot, workers]);
  const filtered = useMemo(
    () => filterLedger(page.entries, maps, filter, snapshot.departments),
    [page.entries, maps, filter, snapshot.departments],
  );

  return (
    <section aria-label="Worker bullet ledger">
      <div className="flex flex-wrap items-end gap-2 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <FilterSelect
          label="Company"
          value={filter.companyKey ?? ""}
          onChange={(v) => setFilter((f) => ({ ...f, companyKey: v || null }))}
          options={snapshot.companies.map((c) => ({ value: c.key, label: c.name }))}
        />
        <FilterSelect
          label="Department"
          value={filter.departmentId === null ? "" : String(filter.departmentId)}
          onChange={(v) => setFilter((f) => ({ ...f, departmentId: v ? Number(v) : null }))}
          options={snapshot.departments.map((d) => ({ value: String(d.id), label: d.name }))}
        />
        <FilterSelect
          label="Employee"
          value={filter.workerId === null ? "" : String(filter.workerId)}
          onChange={(v) => setFilter((f) => ({ ...f, workerId: v ? Number(v) : null }))}
          options={workers.map((w) => ({ value: String(w.id), label: w.name }))}
        />
        <FilterSelect
          label="Kind"
          value={filter.kind ?? ""}
          onChange={(v) => setFilter((f) => ({ ...f, kind: (v || null) as LedgerFilter["kind"] }))}
          options={WORK_LEDGER_KINDS.map((k) => ({ value: k, label: k }))}
        />
        <button type="button" className="btn text-[12px]" onClick={() => setFilter(EMPTY_LEDGER_FILTER)}>
          Clear filters
        </button>
        <span className="ml-auto text-[12px] text-[hsl(var(--ink-soft))]">
          {filtered.length} of {page.total ?? "…"} bullets
        </span>
      </div>

      {page.error ? (
        <p className="mt-2 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3 text-[13px] text-[hsl(8_64%_30%)]" role="alert">
          The ledger could not be derived ({page.error}).
        </p>
      ) : page.entries.length === 0 && !page.loading ? (
        <p className="prose-evidence mt-2 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4 text-[13px] text-[hsl(var(--ink-soft))]">
          The ledger is empty: no company run has produced events yet. Bullets
          are derived from real run/node/artifact records — nothing appears
          here that did not happen.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-2 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3 text-[13px] text-[hsl(var(--ink-soft))]">
          No bullets match the current filters ({page.entries.length} loaded,{" "}
          {page.total ?? "…"} total).
        </p>
      ) : (
        <ol className="mt-2 grid gap-1.5" aria-label="Ledger bullets">
          {filtered.map((e) => (
            <LedgerBullet key={e.seq} entry={e} snapshot={snapshot} workers={workers} maps={maps} />
          ))}
        </ol>
      )}
      <LoadMoreRow page={page} label="ledger" />
    </section>
  );
}

function LedgerBullet({
  entry: e,
  snapshot,
  workers,
  maps,
}: {
  entry: WorkLedgerEntry;
  snapshot: SnapshotLike;
  workers: WorkerRowLike[];
  maps: ReturnType<typeof buildLedgerMaps>;
}) {
  const companyKey = e.companyKey ?? (e.runId !== null ? maps.companyKeyByRunId.get(String(e.runId)) : undefined) ?? null;
  const company = companyKey ? snapshot.companies.find((c) => c.key === companyKey) : undefined;
  const worker = e.workerId !== null ? workers.find((w) => String(w.id) === String(e.workerId)) : undefined;
  return (
    <li className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-2 text-[13px]" data-ledger-seq={e.seq}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[11px] text-[hsl(var(--ink-soft))]">#{e.seq}</span>
        <span className="chip">{e.kind}</span>
        <span className="chip chip-neutral">{e.status}</span>
        {company ? (
          <a className="chip mono" href={`#/director/projects/${company.projectId}`}>{company.key}</a>
        ) : null}
        {e.nodeKey ? <span className="chip mono">node {e.nodeKey}</span> : null}
        {worker ? <span className="chip mono">{worker.name}</span> : null}
        {e.runId !== null && company ? (
          <a className="chip mono" href={`#/director/projects/${company.projectId}/runs/${e.runId}`}>
            run #{String(e.runId)}
          </a>
        ) : e.runId !== null ? (
          <span className="chip mono">run #{String(e.runId)}</span>
        ) : null}
        <span className="ml-auto text-[11px] text-[hsl(var(--ink-soft))]">
          {new Date(e.ts).toISOString()}
        </span>
      </div>
      {e.intendedAsk ? (
        <p className="mt-1 text-[12px]">
          <span className="font-bold">asked:</span> {e.intendedAsk}
        </p>
      ) : null}
      {e.returnedSummary ? (
        <p className="mt-0.5 text-[12px] text-[hsl(var(--ink-soft))]">
          <span className="font-bold text-[hsl(var(--ink))]">returned:</span> {e.returnedSummary}
        </p>
      ) : null}
      <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-[hsl(var(--ink-soft))]">
        {e.promptSha256 ? <span className="mono">prompt sha {e.promptSha256.slice(0, 12)}…</span> : null}
        {e.artifactRef ? (
          <span className="mono">
            artifact #{String(e.artifactRef.artifactId)} sha {e.artifactRef.contentSha256.slice(0, 12)}…
          </span>
        ) : null}
        {e.usage ? (
          <span className="mono">
            {fmt(e.usage.inputTokens)}+{fmt(e.usage.outputTokens)} tok · ${(e.usage.costUsdMicros / 1e6).toFixed(4)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function TimelineView({ enterpriseId }: { enterpriseId: number }) {
  const page = useKeysetPages<TimelineIndexEntry>(enterpriseId, "timeline", 100);
  return (
    <section aria-label="Timeline">
      {page.error ? (
        <p className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3 text-[13px] text-[hsl(8_64%_30%)]" role="alert">
          The timeline could not be derived ({page.error}).
        </p>
      ) : page.entries.length === 0 && !page.loading ? (
        <p className="prose-evidence border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4 text-[13px] text-[hsl(var(--ink-soft))]">
          No timeline entries yet — the index is derived from the same ledger,
          so it fills in as runs produce evidence.
        </p>
      ) : (
        <ol className="grid gap-1" aria-label="Timeline entries">
          {page.entries.map((e) => (
            <li key={e.seq} className="flex flex-wrap items-center gap-2 border-b border-[hsl(var(--line))] py-1 text-[13px]">
              <span className="mono text-[11px] text-[hsl(var(--ink-soft))]">T{e.seq}</span>
              <span className="chip">{e.kind}</span>
              {e.companyKey ? <span className="chip mono">{e.companyKey}</span> : null}
              {e.nodeKey ? <span className="chip mono">node {e.nodeKey}</span> : null}
              {e.ledgerSeq !== null ? (
                <span className="text-[11px] text-[hsl(var(--ink-soft))]">ledger #{e.ledgerSeq}</span>
              ) : null}
              <span className="ml-auto text-[11px] text-[hsl(var(--ink-soft))]">
                {new Date(e.ts).toISOString()}
              </span>
            </li>
          ))}
        </ol>
      )}
      <LoadMoreRow page={page} label="timeline" />
    </section>
  );
}

function EventsView({ enterpriseId }: { enterpriseId: number }) {
  const page = useKeysetPages<EnterpriseEventRow>(enterpriseId, "events", 200);
  return (
    <section aria-label="Enterprise events">
      {page.error ? (
        <p className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3 text-[13px] text-[hsl(8_64%_30%)]" role="alert">
          The event stream could not be loaded ({page.error}).
        </p>
      ) : page.entries.length === 0 && !page.loading ? (
        <p className="prose-evidence border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4 text-[13px] text-[hsl(var(--ink-soft))]">
          No enterprise events yet. Blueprint applies, contract decisions,
          program transitions, and worker controls append here.
        </p>
      ) : (
        <ol className="grid gap-1" aria-label="Audit events">
          {page.entries.map((e) => (
            <li key={e.seq} className="border-b border-[hsl(var(--line))] py-1 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[11px] text-[hsl(var(--ink-soft))]">#{e.seq}</span>
                <span className="chip">{e.type}</span>
                <span className={`chip ${e.actor === "human" ? "chip-cornflower" : "chip-neutral"}`}>{e.actor}</span>
                <span className="ml-auto text-[11px] text-[hsl(var(--ink-soft))]">
                  {new Date(e.createdAt).toISOString()}
                </span>
              </div>
              <pre className="mono mt-0.5 overflow-x-auto text-[11px] text-[hsl(var(--ink-soft))]">
                {JSON.stringify(e.payload)}
              </pre>
            </li>
          ))}
        </ol>
      )}
      <LoadMoreRow page={page} label="events" />
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-[12px] font-bold">
      {label}
      <select
        className="input ml-1 inline-block min-h-[36px] w-auto text-[12px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">all</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function LoadMoreRow<T extends { seq: number }>({
  page,
  label,
}: {
  page: ReturnType<typeof useKeysetPages<T>>;
  label: string;
}) {
  return (
    <div className="mt-3 flex items-center gap-2 text-[12px] text-[hsl(var(--ink-soft))]">
      {page.loading ? <span role="status">Loading {label}…</span> : null}
      {page.hasMore ? (
        <button type="button" className="btn text-[12px]" onClick={page.loadMore}>
          Load more {label}
        </button>
      ) : !page.loading && !page.error ? (
        <span>End of {label}{page.total !== null ? ` (${fmt(page.total)} total)` : ""}.</span>
      ) : null}
    </div>
  );
}
