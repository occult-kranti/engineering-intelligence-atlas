import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TERMINAL_RUN_STATES } from "@contracts/run";
import { ErrorNote } from "../DirectorShell";
import { streamHealth, type EventLike } from "./adapter";
import PoolPanel from "./PoolPanel";
import { useEventStream } from "./useEventStream";
import { useNow } from "./useNow";
import type { WorkspaceData } from "./useWorkspaceData";

/**
 * Zone E — operations deck (the only dark region, the "machine room"):
 * run control + budget meters, throttled event console with an explicit
 * announcer toggle, artifacts & evaluation rail, and node states.
 * All data is live from existing endpoints (runs, events, artifacts,
 * exports). Stop is a two-step confirm because it is irreversible for
 * billable calls.
 */
export default function OpsDeck({
  projectId,
  data,
  stopConfirmOpen,
  onStopConfirmChange,
}: {
  projectId: number;
  data: WorkspaceData;
  stopConfirmOpen: boolean;
  onStopConfirmChange(open: boolean): void;
}) {
  const { activeRun, runDetail, meters, artifacts, budgetExhausted } = data;
  const terminal = activeRun ? TERMINAL_RUN_STATES.has(activeRun.state) : true;

  const stream = useEventStream(activeRun?.id ?? null, !terminal);
  const [follow, setFollow] = useState(false);

  // Throttled live-region summary — one line per ~5s bucket, never the raw
  // stream. Pure derivation (no effect): the aria-live region only
  // announces when the text actually changes.
  const now = useNow(2000);
  const announceBucket = Math.floor(now / 5000);
  const announcement = useMemo(() => {
    void announceBucket; // re-derive at most one line per 5 s
    if (!follow || !stream.events.length) return "";
    const latest = stream.events[stream.events.length - 1]!;
    return `${stream.events.length} events, latest: ${latest.type.replaceAll("_", " ")}${latest.nodeKey ? ` at ${latest.nodeKey}` : ""}`;
  }, [follow, stream.events, announceBucket]);

  const stopM = trpc.runs.stop.useMutation({
    onSuccess: () => void data.queries.runDetailQ.refetch(),
  });
  const exportM = trpc.exports.create.useMutation();
  const downloadM = trpc.artifacts.downloadUrl.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
  });

  const health = streamHealth(
    stream.events,
    activeRun?.state ?? null,
    stream.lastEventAt,
    now,
  );
  const reviewed = artifacts?.filter((a) => a.accepted).length ?? 0;

  return (
    <section aria-labelledby="dw-deck-heading" className="dw-deck" id="dw-evidence">
      <h2 id="dw-deck-heading" className="sr-only">
        Operations deck — run control, budgets, events, artifacts
      </h2>
      <p className="sr-only" aria-live="polite">
        {follow ? announcement : ""}
      </p>
      <div className="dw-deck-inner">
        {/* Control + budgets */}
        <div className="dw-deck-col">
          <span className="dw-deck-kicker">04 · Live control</span>
          {activeRun ? (
            <>
              <p className="mt-2 text-[15px] font-extrabold">
                Run #{activeRun.id} · {activeRun.state}
              </p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                <span className="chip">
                  {activeRun.mode} · {activeRun.provider}
                  {activeRun.model ? `/${activeRun.model}` : ""}
                </span>
                {activeRun.endReason ? (
                  <span className="chip">{activeRun.endReason}</span>
                ) : null}
                {budgetExhausted ? <span className="chip">budget exhausted</span> : null}
              </p>
              <div className="mt-2 flex gap-2">
                {!terminal ? (
                  <button
                    type="button"
                    className="btn min-h-[44px] border-[hsl(40_8%_35%)] bg-transparent text-[13px] text-[hsl(var(--dark-ink))]"
                    onClick={() => onStopConfirmChange(true)}
                  >
                    Stop
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn min-h-[44px] border-[hsl(40_8%_35%)] bg-transparent text-[13px] text-[hsl(var(--dark-ink))]"
                  disabled={exportM.isPending}
                  onClick={() =>
                    exportM.mutate({ projectId, runId: activeRun.id, format: "markdown" })
                  }
                >
                  Export report
                </button>
              </div>
              {budgetExhausted ? (
                <p className="mt-2 text-[12px] text-[hsl(8_62%_65%)]" role="alert">
                  Budget exhausted. Billable calls are never retried
                  automatically — start a new run deliberately.
                </p>
              ) : null}
              {exportM.data ? (
                <p className="mt-2 text-[12px]">
                  Export #{exportM.data.id} stored.{" "}
                  <a
                    className="underline"
                    href={`/api/exports/${exportM.data.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download
                  </a>{" "}
                  (keys persisted, URLs minted fresh)
                </p>
              ) : null}
              {exportM.error ? (
                <p className="mt-2 text-[12px] text-[hsl(8_62%_65%)]" role="alert">
                  {exportM.error.message}
                </p>
              ) : null}
              {meters
                ? meters.map((m) => (
                    <div className="dw-deck-meter" key={m.key} data-exhausted={m.exhausted}>
                      <div className="lbl">
                        <span>{m.label}</span>
                        <b>{m.display}</b>
                      </div>
                      <div
                        className="track"
                        role="meter"
                        aria-valuenow={m.pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${m.label} budget, ${m.pct}% used`}
                      >
                        <div style={{ width: `${m.pct}%` }} />
                      </div>
                    </div>
                  ))
                : null}
            </>
          ) : (
            <p className="mt-2 text-[13px] text-[hsl(var(--dark-ink-soft))]">
              No run yet. Approve a plan revision and start a run from the
              Roadmap stage — controls and meters appear here.
            </p>
          )}
        </div>

        {/* Event console */}
        <div className="dw-deck-col">
          <div className="flex items-center gap-2">
            <span className="dw-deck-kicker">Event console · poll 2 s</span>
            <label className="ml-auto flex min-h-[44px] cursor-pointer items-center gap-1.5 text-[12px] text-[hsl(var(--dark-ink-soft))]">
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
              />
              announce summaries
            </label>
          </div>
          <p className="mt-1 text-[12px] text-[hsl(var(--dark-ink-soft))]" role="status">
            {health.kind === "waiting"
              ? activeRun
                ? "waiting for first event…"
                : "no run — console idle"
              : health.kind === "stale"
                ? `last event ${health.lastEventAgeSec}s ago — stream polling normally; if this persists the run may be stalled`
                : `last event ${health.lastEventAgeSec}s ago`}
            {stream.error ? ` · stream error: ${stream.error}` : ""}
          </p>
          <div className="dw-console mt-1 max-h-40 overflow-auto" aria-live="off">
            {stream.events.slice(-12).map((e) => (
              <EventLine key={e.seq} e={e} />
            ))}
          </div>
        </div>

        {/* Artifacts & evaluation */}
        <div className="dw-deck-col">
          <span className="dw-deck-kicker">05 · Artifacts &amp; evaluation</span>
          {artifacts && artifacts.length ? (
            <ul className="mt-1 grid gap-1.5">
              {artifacts.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-1.5 border-b border-[hsl(40_8%_24%)] pb-1.5 text-[13px]"
                >
                  <b className="font-bold">{a.title}</b>
                  <span className="chip">{a.kind}</span>
                  {a.storageError ? (
                    <span className="chip">storage: {a.storageError}</span>
                  ) : (
                    <span className="chip">
                      {a.accepted ? "accepted" : "unreviewed"}
                      {a.acceptance ? (a.acceptance.ok ? " · schema ok" : " · failed") : ""}
                    </span>
                  )}
                  <span className="mono text-[12px] text-[hsl(var(--dark-ink-soft))]">
                    {a.contentSha256 ? `${a.contentSha256.slice(0, 4)}…` : "—"}
                  </span>
                  {!a.storageError ? (
                    <button
                      type="button"
                      className="text-[12px] underline"
                      onClick={() => downloadM.mutate({ id: a.id })}
                    >
                      download
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-[hsl(var(--dark-ink-soft))]">
              {activeRun
                ? "No artifacts yet — accepted node outputs land here with deterministic acceptance verdicts."
                : "Artifacts appear once a run produces output."}
            </p>
          )}
          <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--dark-ink-soft))]">
            Evaluation: {reviewed} of {artifacts?.length ?? 0} artifacts
            reviewed · acceptance is deterministic (schema + rules), verifier ≠
            producer · keys persisted, URLs minted fresh (~10 min)
          </p>
          {downloadM.error ? (
            <p className="mt-1 text-[12px] text-[hsl(8_62%_65%)]" role="alert">
              {downloadM.error.message}
            </p>
          ) : null}
        </div>

        {/* Node states */}
        <div className="dw-deck-col">
          <span className="dw-deck-kicker">Node states</span>
          {runDetail?.nodes.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {runDetail.nodes.map((n) => (
                <li key={n.nodeKey}>
                  <span
                    className="chip"
                    title={`attempts ${n.attempts}`}
                  >
                    {n.nodeKey}: {n.state}
                    {n.state === "failed" ? " ✕" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-[hsl(var(--dark-ink-soft))]">
              {activeRun
                ? "No node states yet."
                : "Node states appear with the first run."}
            </p>
          )}
          {/* Worker pool (control plane: pool + workers + pump) */}
          <p className="dw-deck-kicker mt-4">Leases &amp; workers</p>
          <PoolPanel
            pool={data.controlPlane.pool}
            controls={data.controlPlane.controls}
            workerControls={data.controlPlane.workerControls}
            hasRun={activeRun != null}
            runTerminal={terminal}
            budgetExhausted={budgetExhausted}
          />
        </div>
      </div>

      <AlertDialog open={stopConfirmOpen} onOpenChange={onStopConfirmChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop run #{activeRun?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stopping is irreversible for in-flight billable calls. Billable
              calls are never retried automatically; you start a new run
              deliberately. The stop is recorded in the event stream.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep running</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activeRun && stopM.mutate({ id: activeRun.id })}
            >
              Stop the run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {stopM.error ? <ErrorNote message={stopM.error.message} /> : null}
    </section>
  );
}

function EventLine({ e }: { e: EventLike }) {
  const warn = e.type.includes("error") || e.type.includes("exceeded") || e.type.includes("blocked");
  let payload = "";
  try {
    payload = JSON.stringify(e.payload).slice(0, 160);
  } catch {
    payload = "";
  }
  return (
    <div className={warn ? "warn" : undefined}>
      <span className="seq">#{e.seq}</span> {e.type}
      {e.nodeKey ? ` @${e.nodeKey}` : ""} [{e.actor}] {payload}
    </div>
  );
}
