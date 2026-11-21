import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { ErrorNote } from "./DirectorShell";
import ApprovalsInbox from "./workspace/ApprovalsInbox";
import { toApprovalView } from "./workspace/adapter";

/**
 * Global approvals — reachable from every project (top-bar pill) and from
 * Director home. Uses the same inbox component as the workspace so the
 * decision flow (confirm dialog, A/R shortcuts' target) is identical.
 */
export default function GlobalApprovals() {
  const utils = trpc.useUtils();
  const pendingQ = trpc.approvals.listPending.useQuery(
    {},
    { refetchInterval: 3000, retry: false },
  );
  const decideM = trpc.approvals.decide.useMutation({
    onSuccess: () => void utils.approvals.listPending.invalidate(),
  });
  const [focusedId, setFocusedId] = useState<number | null>(null);

  if (pendingQ.error) {
    return (
      <ErrorNote
        message={`approvals could not be loaded (${pendingQ.error.message}). The Director API may be unavailable.`}
      />
    );
  }

  const approvals = (pendingQ.data ?? []).map((a) => ({
    ...toApprovalView(a),
    context: `run #${a.runId} · ${a.projectName} · ${a.runState}`,
  }));

  return (
    <div className="dw max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Approvals — all projects</h1>
      <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
        Pending human gates across your projects, polling every 3 s. Decisions
        are confirmed, recorded in the append-only event stream, and never
        retried automatically.
      </p>
      <div className="mt-4 border border-[hsl(var(--line))]">
        <ApprovalsInbox
          approvals={approvals}
          onDecide={(id, decision, note) => decideM.mutate({ approvalId: id, decision, note })}
          deciding={decideM.isPending}
          focusedId={focusedId}
          onFocus={setFocusedId}
          error={decideM.error?.message ?? null}
          heading="Approvals"
        />
      </div>
    </div>
  );
}
