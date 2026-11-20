import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { usdToMicros } from "@contracts/dag";
import { ErrorNote } from "./DirectorShell";
import { navigate } from "@/lib/utils";
import { fmtUsd } from "@/lib/format";

/** Run console: status graph colors, append-only event tail, budget meters,
 * approvals inbox. All updates via tRPC polling (2s). */
export default function RunConsole({
  runId,
  projectId,
}: {
  runId: number;
  projectId: number;
}) {
  const runQ = trpc.runs.get.useQuery({ id: runId }, { refetchInterval: 2000 });
  const artifactsQ = trpc.artifacts.listByRun.useQuery(
    { runId },
    { refetchInterval: 4000 },
  );
  const [afterSeq, setAfterSeq] = useState(0);
  const [events, setEvents] = useState<
    { seq: number; type: string; nodeKey: string | null; actor: string; payload: unknown }[]
  >([]);
  const tailQ = trpc.events.tail.useQuery(
    { runId, afterSeq, limit: 200 },
    { refetchInterval: 2000 },
  );
  const stopM = trpc.runs.stop.useMutation({
    onSuccess: () => void runQ.refetch(),
  });
  const resumeM = trpc.runs.resume.useMutation({
    onSuccess: () => void runQ.refetch(),
  });
  const decideM = trpc.approvals.decide.useMutation({
    onSuccess: () => {
      void runQ.refetch();
    },
  });
  const downloadM = trpc.artifacts.downloadUrl.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
  });
  const exportM = trpc.exports.create.useMutation();

  // Merge polled events into the console (adjust-during-render so the stream
  // lands without a post-render cascading effect). Dedupe by seq.
  const [prevTail, setPrevTail] = useState<typeof tailQ.data>(undefined);
  if (tailQ.data !== prevTail) {
    setPrevTail(tailQ.data);
    if (tailQ.data?.length) {
      const batch = tailQ.data;
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.seq));
        return [...prev, ...batch.filter((e) => !seen.has(e.seq))].sort(
          (a, b) => a.seq - b.seq,
        );
      });
      setAfterSeq(batch[batch.length - 1]!.seq);
    }
  }

  if (runQ.error) return <ErrorNote message={runQ.error.message} />;
  const data = runQ.data;
  if (!data) return <p className="text-sm">Loading run…</p>;
  const { run, nodes, usage, pendingApprovals } = data;
  const b = run.budget;
  const terminal = ["completed", "failed", "failed_validation", "stopped_budget", "stopped_human", "terminated_policy"].includes(run.state);

  const STATE_COLOR: Record<string, string> = {
    pending: "chip",
    ready: "chip chip-cornflower",
    running: "chip chip-mustard",
    verifying: "chip chip-mustard",
    accepted: "chip chip-sage",
    failed: "chip",
    skipped: "chip",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="tab-control text-xs" onClick={() => navigate(`#/director/projects/${projectId}`)}>
          ← Project
        </button>
        <h1 className="text-xl font-extrabold tracking-tight">
          Run #{run.id} — {run.state}
        </h1>
        <span className="chip">
          {run.mode} · {run.provider}
          {run.model ? `/${run.model}` : ""}
        </span>
        {run.endReason ? (
          <span className="chip chip-mustard">{run.endReason}</span>
        ) : null}
        {!terminal ? (
          <>
            <button type="button" className="tab-control text-xs" onClick={() => stopM.mutate({ id: run.id })}>
              Stop
            </button>
            {run.state === "awaiting_approval" && pendingApprovals.length === 0 ? (
              <button type="button" className="tab-control text-xs" onClick={() => resumeM.mutate({ id: run.id })}>
                Resume
              </button>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          className="tab-control text-xs"
          onClick={() => exportM.mutate({ projectId, runId, format: "markdown" })}
        >
          Export report (Markdown)
        </button>
      </div>
      {exportM.error ? <ErrorNote message={exportM.error.message} /> : null}
      {exportM.data ? (
        <p className="mt-1 text-xs">
          Export #{exportM.data.id} stored.{" "}
          <a
            className="font-bold underline"
            href={`/api/exports/${exportM.data.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>{" "}
          (owner-checked REST route → fresh presigned URL; keys are persisted, URLs never are)
        </p>
      ) : null}
      {run.state === "failed" || run.state === "stopped_budget" ? (
        <ErrorNote
          message={`run ended: ${run.endReason ?? run.state}. Billable calls are never retried automatically; review events and start a new run deliberately.`}
        />
      ) : null}

      {/* Budget meters */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Meter label="tokens" used={usage.promptTokens + usage.completionTokens} max={b.maxTokens} />
        <Meter label="calls" used={usage.calls} max={b.maxCalls} />
        <Meter label="minutes" used={usage.elapsedMinutes} max={b.maxMinutes} />
        <Meter
          label={`USD${run.mode === "mock" ? " (simulated)" : ""}`}
          used={usage.costUsdMicros}
          max={usdToMicros(b.maxCostUsd)}
          fmt={(v) => fmtUsd(v)}
        />
      </div>

      {/* Node states */}
      <h2 className="mt-6 text-sm font-bold">Nodes</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {nodes.map((n) => (
          <span key={n.nodeKey} className={STATE_COLOR[n.state] ?? "chip"} title={`attempts ${n.attempts}`}>
            {n.nodeKey}: {n.state}
            {n.state === "failed" ? " ✕" : ""}
          </span>
        ))}
      </div>

      {/* Approvals inbox */}
      {pendingApprovals.length ? (
        <div className="mt-4 border border-[hsl(var(--mustard))] p-3">
          <h2 className="text-sm font-bold">Approvals required</h2>
          {pendingApprovals.map((a) => (
            <div key={a.id} className="mt-2 text-sm">
              <p>
                <b>{a.kind}</b> {a.nodeKey ? `@ ${a.nodeKey}` : ""}
              </p>
              <pre className="mono mt-1 max-h-32 overflow-auto bg-[hsl(var(--paper-raised))] p-2 text-xs">
                {JSON.stringify(a.payload, null, 1).slice(0, 800)}
              </pre>
              <div className="mt-1 flex gap-2">
                <button type="button" className="tab-control text-xs" onClick={() => decideM.mutate({ approvalId: a.id, decision: "approved" })}>
                  Approve
                </button>
                <button type="button" className="tab-control text-xs" onClick={() => decideM.mutate({ approvalId: a.id, decision: "rejected" })}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Artifacts */}
      <h2 className="mt-6 text-sm font-bold">Artifacts</h2>
      <ul className="mt-2 grid gap-2">
        {(artifactsQ.data ?? []).map((a) => (
          <li key={a.id} className="border border-[hsl(var(--line))] p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b>{a.title}</b>
              <span className="chip">{a.kind}</span>
              <span className="chip">{a.accepted ? "accepted" : "unreviewed"}</span>
              {a.storageError ? (
                <span className="chip chip-mustard">storage: {a.storageError}</span>
              ) : (
                <button type="button" className="tab-control text-xs" onClick={() => downloadM.mutate({ id: a.id })}>
                  Download
                </button>
              )}
            </div>
            {a.summary ? <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">{a.summary}</p> : null}
            <p className="mono mt-1 text-xs text-[hsl(var(--ink-soft))]">
              sha256 {a.contentSha256 ?? "n/a"} · node {a.nodeKey}
              {a.acceptance ? ` · acceptance ${a.acceptance.ok ? "ok" : "failed"}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {downloadM.error ? <ErrorNote message={downloadM.error.message} /> : null}

      {/* Event console */}
      <h2 className="mt-6 text-sm font-bold">Event console</h2>
      <div className="mono mt-2 max-h-96 overflow-auto border border-[hsl(var(--line))] bg-[hsl(40_14%_9%)] p-3 text-xs text-[hsl(48_14%_80%)]">
        {events.map((e) => (
          <div key={e.seq}>
            <span className="text-[hsl(42_78%_55%)]">#{e.seq}</span>{" "}
            {e.type}
            {e.nodeKey ? ` @${e.nodeKey}` : ""} [{e.actor}]{" "}
            {JSON.stringify(e.payload).slice(0, 220)}
          </div>
        ))}
        {events.length === 0 ? <div>waiting for events…</div> : null}
      </div>
    </div>
  );
}

function Meter({
  label,
  used,
  max,
  fmt = (v) => `${Math.round(v)}`,
}: {
  label: string;
  used: number;
  max: number;
  fmt?: (v: number) => string;
}) {
  const pct = Math.min(100, (used / Math.max(max, 1e-9)) * 100);
  return (
    <div className="border border-[hsl(var(--line))] p-2">
      <p className="text-xs font-bold">{label}</p>
      <div className="mt-1 h-2 w-full bg-[hsl(var(--line))]" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} budget`}>
        <div className="h-2 bg-[hsl(var(--mustard))]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mono mt-1 text-xs">
        {fmt(used)} / {fmt(max)}
      </p>
    </div>
  );
}
