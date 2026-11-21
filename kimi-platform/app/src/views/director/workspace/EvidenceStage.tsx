import { trpc } from "@/lib/trpc-client";
import { ErrorNote } from "../DirectorShell";
import { fmtUsd } from "@/lib/format";
import PromptEvaluationPanel from "./evaluation/PromptEvaluationPanel";
import type { WorkspaceData } from "./useWorkspaceData";

/**
 * Stage 05 — evidence: full artifact list for the active run, project
 * exports (with storage honesty), and the budget ledger tail. Read-only;
 * downloads mint fresh presigned URLs via the owner-checked route.
 */
export default function EvidenceStage({
  projectId,
  data,
}: {
  projectId: number;
  data: WorkspaceData;
}) {
  const { activeRun, artifacts } = data;
  const exportsQ = trpc.exports.list.useQuery({ projectId }, { retry: false });
  const exportNow = trpc.exports.create.useMutation({
    onSuccess: () => void exportsQ.refetch(),
  });
  const exportUrl = trpc.exports.downloadUrl.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
  });
  const ledgerQ = trpc.ledger.byRun.useQuery(
    { runId: activeRun?.id ?? 0 },
    { enabled: activeRun != null, retry: false },
  );
  const downloadM = trpc.artifacts.downloadUrl.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
  });

  return (
    <section aria-labelledby="dw-evidence-heading" className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 id="dw-evidence-heading" className="text-xl font-extrabold tracking-tight">
          Artifacts &amp; evaluation
        </h1>
        {activeRun ? <span className="chip">run #{activeRun.id}</span> : null}
      </div>

      {artifacts && artifacts.length ? (
        <ul className="grid gap-2">
          {artifacts.map((a) => (
            <li key={a.id} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-[14px]">{a.title}</b>
                <span className="chip">{a.kind}</span>
                <span className={`chip ${a.accepted ? "chip-sage" : ""}`}>
                  {a.accepted ? "accepted" : "unreviewed"}
                </span>
                {a.acceptance ? (
                  <span className={`chip ${a.acceptance.ok ? "chip-sage" : "chip-alert"}`}>
                    {a.acceptance.ok ? "schema ok" : "acceptance failed"}
                  </span>
                ) : null}
                {a.storageError ? (
                  <span className="chip chip-alert">storage: {a.storageError}</span>
                ) : (
                  <button
                    type="button"
                    className="btn min-h-[36px] px-2 text-[12px]"
                    onClick={() => downloadM.mutate({ id: a.id })}
                  >
                    Download (fresh URL)
                  </button>
                )}
              </div>
              {a.summary ? (
                <p className="prose-evidence mt-1 text-[13px] text-[hsl(var(--ink-soft))]">
                  {a.summary}
                </p>
              ) : null}
              <p className="mono mt-1 text-[12px] text-[hsl(var(--ink-soft))]">
                sha256 {a.contentSha256 ?? "n/a"} · node {a.nodeKey}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-5">
          <h2 className="text-[15px] font-extrabold">No artifacts yet</h2>
          <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
            {activeRun
              ? "This run has not produced artifacts. Accepted node outputs appear here with their deterministic acceptance verdicts."
              : "Start a run from the Roadmap stage; its outputs will be listed here for review."}
          </p>
        </div>
      )}
      {downloadM.error ? <ErrorNote message={downloadM.error.message} /> : null}

      <section aria-labelledby="dw-exports-heading">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="dw-exports-heading" className="text-lg font-extrabold tracking-tight">
            Exports
          </h2>
          <button
            type="button"
            className="btn text-[13px]"
            disabled={exportNow.isPending}
            onClick={() =>
              exportNow.mutate({
                projectId,
                runId: activeRun?.id,
                format: "markdown",
              })
            }
          >
            Export project report (Markdown → storage)
          </button>
        </div>
        {exportNow.error ? <ErrorNote message={exportNow.error.message} /> : null}
        {exportsQ.error ? <ErrorNote message={exportsQ.error.message} /> : null}
        <ul className="mt-2 grid gap-2">
          {(exportsQ.data ?? []).map((x) => (
            <li
              key={x.id}
              className="flex flex-wrap items-center gap-2 border border-[hsl(var(--line))] p-3 text-[13px]"
            >
              <span className="mono">#{x.id}</span>
              <span className="chip">{x.format}</span>
              {x.storageError ? (
                <span className="chip chip-alert">storage error {x.storageError}</span>
              ) : (
                <span className="chip chip-sage">stored</span>
              )}
              {x.storageKey ? (
                <button
                  type="button"
                  className="btn min-h-[36px] px-2 text-[12px]"
                  onClick={() => exportUrl.mutate({ id: x.id })}
                >
                  Download (fresh URL)
                </button>
              ) : null}
            </li>
          ))}
          {exportsQ.data && !exportsQ.data.length ? (
            <li className="text-[13px] text-[hsl(var(--ink-soft))]">
              No exports yet.
            </li>
          ) : null}
        </ul>
        <p className="mt-2 text-[12px] text-[hsl(var(--ink-soft))]">
          Only keys are persisted; download URLs are minted fresh (~10 min).
          Mock-run costs shown anywhere are simulated cents, not billing.
        </p>
      </section>

      {activeRun ? (
        <section aria-labelledby="dw-ledger-heading">
          <h2 id="dw-ledger-heading" className="text-lg font-extrabold tracking-tight">
            Budget ledger — run #{activeRun.id}
          </h2>
          {ledgerQ.error ? <ErrorNote message={ledgerQ.error.message} /> : null}
          {ledgerQ.data?.length ? (
            <table className="table-cat mt-2 text-[13px]">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Node</th>
                  <th scope="col">Tokens</th>
                  <th scope="col">Calls</th>
                  <th scope="col">Cost</th>
                </tr>
              </thead>
              <tbody>
                {ledgerQ.data.slice(-20).map((l) => (
                  <tr key={l.id}>
                    <td className="mono text-[12px]">{l.id}</td>
                    <td className="mono text-[12px]">{l.nodeKey}</td>
                    <td className="mono text-[12px]">
                      {(l.tokensPrompt + l.tokensCompletion).toLocaleString()}
                    </td>
                    <td className="mono text-[12px]">{l.calls}</td>
                    <td className="mono text-[12px]">{fmtUsd(l.costUsdMicros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">
              No ledger entries yet — budget records are appended as the run
              spends.
            </p>
          )}
        </section>
      ) : null}

      <PromptEvaluationPanel />
    </section>
  );
}
