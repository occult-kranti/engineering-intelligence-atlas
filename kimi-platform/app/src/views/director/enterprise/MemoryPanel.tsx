import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { MEMORY_SCOPES } from "@contracts/enterprise";
import { ErrorNote } from "../DirectorShell";
import ConfirmDialog, { type ConfirmRequest } from "./ConfirmDialog";
import { useArtifactSearch, useEnterpriseMemory } from "./useEnterpriseData";
import { deriveMemoryControls } from "./adapter";

/**
 * Reference-only enterprise memory. Artifact search returns refs + content
 * hashes (never bodies); proposing stores the ref and the exact sha256, and
 * promote/revoke are explicit human decisions. Entries failing the live hash
 * re-verification are labeled, never silently trusted.
 */
export default function MemoryPanel({ enterpriseId }: { enterpriseId: number }) {
  const utils = trpc.useUtils();
  const memoryQ = useEnterpriseMemory(enterpriseId);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const searchQ = useArtifactSearch(enterpriseId, query, searching);
  const [scope, setScope] = useState<(typeof MEMORY_SCOPES)[number]>("enterprise");
  const [scopeKey, setScopeKey] = useState("");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const invalidate = () => {
    void utils.enterprise.listMemory.invalidate({ enterpriseId });
    void utils.enterprise.events.invalidate();
  };
  const onSettled = () => setConfirm(null);
  const proposeM = trpc.enterprise.proposeMemory.useMutation({ onSuccess: invalidate });
  const decideM = trpc.enterprise.decideMemory.useMutation({
    onSuccess: () => {
      invalidate();
      onSettled();
    },
    onError: onSettled,
  });
  const revokeM = trpc.enterprise.revokeMemory.useMutation({
    onSuccess: () => {
      invalidate();
      onSettled();
    },
    onError: onSettled,
  });
  const pending = proposeM.isPending || decideM.isPending || revokeM.isPending;

  return (
    <div className="grid gap-4">
      {/* Artifact search (refs + hashes only) */}
      <section aria-label="Artifact search" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
        <span className="kicker">Promote an artifact reference</span>
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearching(true);
          }}
        >
          <label className="min-w-56 flex-1 text-[12px] font-bold">
            Search artifacts (title / summary)
            <input
              className="input mt-1 text-[13px]"
              value={query}
              maxLength={200}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. geometry audit"
            />
          </label>
          <button type="submit" className="btn text-[13px]" disabled={searchQ.isFetching}>
            {searchQ.isFetching ? "Searching…" : "Search"}
          </button>
        </form>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[12px] font-bold">
            Scope
            <select className="input ml-1 inline-block min-h-[36px] w-auto text-[12px]" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
              {MEMORY_SCOPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-[12px] font-bold">
            Scope key (kebab-case)
            <input
              className="input mono ml-1 inline-block min-h-[36px] w-48 text-[12px]"
              value={scopeKey}
              maxLength={64}
              placeholder="program id or company/dept key"
              onChange={(e) => setScopeKey(e.target.value)}
            />
          </label>
        </div>
        {proposeM.error ? <ErrorNote message={proposeM.error.message} /> : null}
        {searching && searchQ.error ? (
          <ErrorNote message={`artifact search failed (${searchQ.error.message})`} />
        ) : null}
        {searching && searchQ.data ? (
          searchQ.data.length === 0 ? (
            <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
              No artifacts match. Only artifacts produced by this enterprise's
              runs are searchable, and only by reference.
            </p>
          ) : (
            <ol className="mt-2 grid gap-2">
              {searchQ.data.map((a) => (
                <li key={a.id} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{a.title}</span>
                    <span className="chip">{a.kind}</span>
                    <span className="chip mono">run #{a.runId}</span>
                    <span className="chip mono">node {a.nodeKey}</span>
                    <span className="chip mono" title={a.contentSha256 ?? undefined}>
                      sha {a.contentSha256 ? `${a.contentSha256.slice(0, 12)}…` : "MISSING"}
                    </span>
                  </div>
                  {a.summary ? <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">{a.summary}</p> : null}
                  <button
                    type="button"
                    className="btn mt-2 text-[12px]"
                    disabled={pending || !a.contentSha256 || !/^[a-z][a-z0-9-]*$/.test(scopeKey)}
                    title={
                      !a.contentSha256
                        ? "artifact has no content hash — it cannot be promoted by reference"
                        : !/^[a-z][a-z0-9-]*$/.test(scopeKey)
                          ? "enter a kebab-case scope key first"
                          : `Propose into ${scope}:${scopeKey}`
                    }
                    onClick={() =>
                      proposeM.mutate({ enterpriseId, scope, scopeKey, artifactId: a.id })
                    }
                  >
                    Propose to {scope}:{scopeKey || "…"}
                  </button>
                </li>
              ))}
            </ol>
          )
        ) : null}
      </section>

      {/* Memory entries with live hash verification */}
      <section aria-label="Memory entries" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
        <span className="kicker">Memory entries</span>
        {memoryQ.error ? (
          <div className="mt-2">
            <ErrorNote message={`memory could not be loaded (${memoryQ.error.message})`} />
          </div>
        ) : memoryQ.isLoading ? (
          <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]" role="status">Loading memory…</p>
        ) : (memoryQ.data ?? []).length === 0 ? (
          <p className="prose-evidence mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
            No memory entries yet. Search above and propose an artifact
            reference; a human decision promotes it into the scope.
          </p>
        ) : (
          <ol className="mt-2 grid gap-2">
            {(memoryQ.data ?? []).map((m) => (
              <li key={m.id} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2 text-[13px]" data-memory-id={m.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">{m.scope}:{m.scopeKey}</span>
                  <span className={`chip ${m.state === "promoted" ? "chip-sage" : m.state === "pending" ? "chip-mustard" : ""}`}>
                    {m.state}
                  </span>
                  {m.verified ? (
                    <span className="chip chip-sage">hash verified</span>
                  ) : (
                    <span className="chip chip-alert">hash NOT verified</span>
                  )}
                  <span className="chip mono" title={m.contentSha256}>
                    sha {m.contentSha256.slice(0, 12)}…
                  </span>
                  <span className="chip mono">artifact #{String(m.artifactRef.artifactId)}</span>
                </div>
                <p className="mt-1 text-[12px] font-bold">{m.artifactRef.title}</p>
                {m.summary ? (
                  <p className="text-[12px] text-[hsl(var(--ink-soft))]">{m.summary}</p>
                ) : null}
                {m.decidedBy ? (
                  <p className="text-[11px] text-[hsl(var(--ink-soft))]">decided by {m.decidedBy}</p>
                ) : null}
                <MemoryEntryActions
                  entry={m}
                  pending={pending}
                  onRequest={setConfirm}
                  onDecide={(memoryId, decision) => decideM.mutate({ memoryId, decision })}
                  onRevoke={(memoryId) => revokeM.mutate({ memoryId })}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
      <ConfirmDialog request={confirm} pending={pending} onClose={() => setConfirm(null)} />
    </div>
  );
}

type MemoryEntryRow = {
  id: number;
  scope: string;
  scopeKey: string;
  state: "pending" | "promoted" | "rejected" | "revoked";
  verified: boolean;
  contentSha256: string;
  artifactRef: { artifactId: string | number; title: string };
};

function MemoryEntryActions({
  entry,
  pending,
  onRequest,
  onDecide,
  onRevoke,
}: {
  entry: MemoryEntryRow;
  pending: boolean;
  onRequest(req: ConfirmRequest): void;
  onDecide(memoryId: number, decision: "promote" | "reject"): void;
  onRevoke(memoryId: number): void;
}) {
  const m = entry;
  const controls = deriveMemoryControls(m);
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {m.state === "pending" ? (
        <>
          <button
            type="button"
            className="btn text-[12px] font-bold"
            disabled={pending || !controls.promote.enabled}
            title={controls.promote.reason ?? "Promote into scope"}
            onClick={() =>
              onRequest({
                title: `Promote memory #${m.id}?`,
                body: `Promotes the reference "${m.artifactRef.title}" (sha ${m.contentSha256.slice(0, 12)}…) into ${m.scope}:${m.scopeKey}. The decision is recorded with your identity.`,
                confirmLabel: "Promote",
                run: () => onDecide(m.id, "promote"),
              })
            }
          >
            Promote
          </button>
          <button
            type="button"
            className="btn text-[12px]"
            disabled={pending || !controls.reject.enabled}
            title={controls.reject.reason ?? undefined}
            onClick={() =>
              onRequest({
                title: `Reject memory #${m.id}?`,
                body: "The proposal is marked rejected and never enters the scope.",
                confirmLabel: "Reject",
                destructive: true,
                run: () => onDecide(m.id, "reject"),
              })
            }
          >
            Reject
          </button>
        </>
      ) : null}
      {m.state === "promoted" ? (
        <button
          type="button"
          className="btn text-[12px]"
          disabled={pending || !controls.revoke.enabled}
          title={controls.revoke.reason ?? undefined}
          onClick={() =>
            onRequest({
              title: `Revoke memory #${m.id}?`,
              body: "Removes the promoted reference from the scope. The artifact itself is untouched (memory is reference-only).",
              confirmLabel: "Revoke",
              destructive: true,
              run: () => onRevoke(m.id),
            })
          }
        >
          Revoke
        </button>
      ) : null}
    </div>
  );
}
