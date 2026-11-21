import { useState } from "react";
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
import { Kbd } from "@/components/ui/kbd";
import type { ApprovalView } from "./adapter";

export type Decision = "approved" | "rejected";

/**
 * Zone D top — the single approvals inbox. One component, one place; the
 * global #/director/approvals route reuses it. Every decision (click or
 * keyboard A/R) goes through a confirmation dialog — approvals are
 * billing-relevant and never fire on a bare keypress.
 *
 * Honesty notes:
 *  - The decision API is approve/reject (+ optional note). When a payload
 *    advertises escalation options (retry / reassign / decompose) they are
 *    shown as informational chips — the backend records only the decision
 *    and the note, so we do not render fake per-option buttons.
 *  - `context` (project/run state) is only set on the global route.
 */
export default function ApprovalsInbox({
  approvals,
  onDecide,
  deciding,
  focusedId,
  onFocus,
  error,
  heading = "Approvals",
  emptyHint = "Pending gates in your projects will appear here the moment a run needs you.",
}: {
  approvals: (ApprovalView & { context?: string })[];
  onDecide(id: number, decision: Decision, note: string): void;
  deciding: boolean;
  focusedId: number | null;
  onFocus(id: number | null): void;
  error?: string | null;
  heading?: string;
  emptyHint?: string;
}) {
  const [confirm, setConfirm] = useState<{ id: number; decision: Decision } | null>(null);
  const [note, setNote] = useState("");
  const confirmApproval = approvals.find((a) => a.id === confirm?.id);

  return (
    <section aria-labelledby="dw-approvals-heading" className="dw-approvals">
      <h2 id="dw-approvals-heading" className="flex items-center gap-2 text-sm font-extrabold">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: approvals.length ? "hsl(var(--mustard))" : "hsl(var(--line))" }}
        />
        {heading} — {approvals.length} pending
        {approvals.length ? (
          <span className="chip chip-mustard ml-auto">blocks run</span>
        ) : null}
      </h2>

      {error ? (
        <p className="mt-2 text-[13px]" role="alert">
          <span className="chip chip-alert">unavailable</span>{" "}
          <span className="text-[hsl(var(--ink-soft))]">{error}</span>
        </p>
      ) : null}

      {!approvals.length && !error ? (
        <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
          No pending approvals. {emptyHint}
        </p>
      ) : null}

      <ol className="mt-1 grid gap-2" aria-label="Pending approvals">
        {approvals.map((a) => (
          <li key={a.id}>
            <div
              id={`dw-approval-${a.id}`}
              className="dw-approval-card"
              data-focused={focusedId === a.id}
              tabIndex={0}
              role="group"
              aria-label={`approval ${a.id}, ${a.kind}`}
              onFocus={() => onFocus(a.id)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) onFocus(null);
              }}
            >
              <p className="text-[13px] font-bold">
                #{a.id} · {a.kind}
                {a.nodeKey ? <span className="mono font-medium"> @ {a.nodeKey}</span> : null}
                {a.context ? (
                  <span className="font-normal text-[hsl(var(--ink-soft))]"> · {a.context}</span>
                ) : null}
              </p>
              {a.options.length ? (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-[hsl(var(--ink-soft))]">
                  requested options:
                  {a.options.map((o) => (
                    <span key={o} className="chip">
                      {o}
                    </span>
                  ))}
                  <span className="italic">recorded as decision note</span>
                </p>
              ) : null}
              <pre className="mono mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-1.5 text-[12px] leading-snug text-[hsl(var(--ink-soft))]">
                {a.excerpt}
              </pre>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="btn text-[13px] font-bold"
                  data-action="approve"
                  disabled={deciding}
                  onClick={() => {
                    setNote("");
                    setConfirm({ id: a.id, decision: "approved" });
                  }}
                >
                  Approve <Kbd aria-hidden>A</Kbd>
                </button>
                <button
                  type="button"
                  className="btn text-[13px]"
                  data-action="reject"
                  disabled={deciding}
                  onClick={() => {
                    setNote("");
                    setConfirm({ id: a.id, decision: "rejected" });
                  }}
                >
                  Reject <Kbd aria-hidden>R</Kbd>
                </button>
                <span className="text-[12px] text-[hsl(var(--ink-soft))]">
                  expires with run
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <AlertDialog open={confirm != null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.decision === "approved" ? "Approve" : "Reject"} #
              {confirm?.id} — {confirmApproval?.kind}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.decision === "approved"
                ? "Approving lets the run proceed past this gate. This is recorded in the append-only event stream."
                : "Rejecting is terminal for the gated work: an artifact-accept rejection fails the node and the run. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block text-[13px] font-bold">
            Note (optional, recorded with the decision)
            <input
              className="input mt-1 text-[13px]"
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                confirmApproval?.options.length
                  ? `e.g. ${confirmApproval.options[0]}`
                  : "reason for the record"
              }
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) onDecide(confirm.id, confirm.decision, note);
                setConfirm(null);
              }}
            >
              Confirm {confirm?.decision === "approved" ? "approve" : "reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
