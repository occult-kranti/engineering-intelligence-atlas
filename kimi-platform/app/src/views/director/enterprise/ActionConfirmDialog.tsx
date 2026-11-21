import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AssistantGate, AssistantRisk, AssistantScope } from "@contracts/assistant";
import { GATE_EXPLANATIONS, gateChecklistId, payloadDiffLines } from "./useAssistantData";

/**
 * The confirmation dialog for assistant actions that require explicit human
 * approval. It shows the typed payload diff (canonical, hash-bound), the
 * payloadHash, risk, scope, and the OCC expectedVersion when one exists, and
 * it collects an explicit checkbox confirmation for EVERY gate the action
 * policy requires — the confirm button stays disabled until all required
 * gates are confirmed. Gates are enforced in code (the server re-validates);
 * this dialog never lets a human "approve" without the full gate set.
 */

export interface ActionConfirmRequest {
  title: string;
  actionId: string;
  risk: AssistantRisk;
  scope: AssistantScope;
  scopeKey?: string;
  /** Exact payload that will be proposed (canonical-diffed for review). */
  payload: Record<string, unknown>;
  /** Server-issued hash when acting on an existing proposal (inbox). */
  payloadHash?: string | null;
  /** OCC version the action is pinned to, when applicable. */
  expectedVersion?: number | null;
  requiredGates: readonly AssistantGate[];
  confirmLabel: string;
  destructive?: boolean;
  note?: string | null;
  run(confirmedGates: AssistantGate[]): void;
}

/**
 * Presentational body (no portal) — also used by the static-render tests.
 * `confirmed` is the set of gates the human has explicitly checked.
 */
export function ActionConfirmBody({
  request,
  confirmed,
  pending,
  error,
  onToggleGate,
  onCancel,
  onConfirm,
}: {
  request: ActionConfirmRequest;
  confirmed: ReadonlySet<AssistantGate>;
  pending: boolean;
  error: string | null;
  onToggleGate(gate: AssistantGate): void;
  onCancel(): void;
  onConfirm(): void;
}) {
  const allConfirmed = request.requiredGates.every((g) => confirmed.has(g));
  const diff = payloadDiffLines(request.payload);
  return (
    <div data-testid="action-confirm-body" data-action={request.actionId}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`chip ${request.risk === "high" ? "chip-alert" : request.risk === "medium" ? "chip-mustard" : ""}`}
          data-testid="action-risk"
        >
          {request.risk} risk
        </span>
        <span className="chip mono" data-testid="action-scope">
          {request.scope}
          {request.scopeKey ? `:${request.scopeKey}` : ""}
        </span>
        {request.expectedVersion !== null && request.expectedVersion !== undefined ? (
          <span className="chip mono" data-testid="action-expected-version">
            expectedVersion v{request.expectedVersion}
          </span>
        ) : null}
      </div>

      {request.note ? (
        <p className="prose-evidence mt-2 text-[13px] text-[hsl(var(--ink-soft))]">{request.note}</p>
      ) : null}

      <div className="mt-3">
        <span className="kicker">Typed payload (exactly what is proposed)</span>
        <pre
          className="mt-1 max-h-48 overflow-auto border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2 text-[12px] leading-relaxed"
          data-testid="action-payload-diff"
        >
          {diff.length > 0 ? diff.join("\n") : "(empty payload)"}
        </pre>
        {request.payloadHash ? (
          <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">
            payloadHash{" "}
            <code className="mono" data-testid="action-payload-hash">
              {request.payloadHash}
            </code>
          </p>
        ) : null}
      </div>

      <fieldset className="mt-3 grid gap-2" data-testid="action-gates">
        <legend className="kicker">
          Required gate confirmations ({request.requiredGates.length === 0 ? "none" : `${request.requiredGates.length}`})
        </legend>
        {request.requiredGates.length === 0 ? (
          <p className="text-[13px] text-[hsl(var(--ink-soft))]">
            This action requires no gates, but it still runs only on your explicit confirm.
          </p>
        ) : (
          request.requiredGates.map((gate) => (
            <label key={gate} className="flex items-start gap-2 text-[13px]" htmlFor={gateChecklistId(request.actionId, gate)}>
              <input
                id={gateChecklistId(request.actionId, gate)}
                type="checkbox"
                className="mt-0.5"
                checked={confirmed.has(gate)}
                onChange={() => onToggleGate(gate)}
                disabled={pending}
                data-gate={gate}
              />
              <span>
                <span className="font-bold">{gate}</span> — {GATE_EXPLANATIONS[gate]}
              </span>
            </label>
          ))
        )}
      </fieldset>

      {error ? (
        <p role="alert" className="mt-3 border border-[hsl(var(--alert))] bg-[hsl(var(--paper))] p-2 text-[13px] text-[hsl(8_64%_30%)]" data-testid="action-error">
          {error}
        </p>
      ) : null}

      <DialogFooter className="mt-4">
        <button type="button" className="btn text-[13px]" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn text-[13px] font-bold ${request.destructive ? "border-[hsl(var(--alert))] text-[hsl(8_64%_30%)]" : "border-[hsl(var(--ink))]"}`}
          disabled={pending || !allConfirmed}
          aria-disabled={pending || !allConfirmed}
          title={allConfirmed ? undefined : "confirm every required gate first"}
          onClick={onConfirm}
          data-testid="action-confirm-submit"
        >
          {pending ? "Working…" : request.confirmLabel}
        </button>
      </DialogFooter>
    </div>
  );
}

/**
 * Gate-checkbox state lives in this inner body, which mounts fresh for every
 * request (the dialog renders nothing while closed), so a new request always
 * starts with zero confirmed gates — no reset effect needed.
 */
function ActionConfirmDialogBody({
  request,
  pending,
  error,
  onClose,
}: {
  request: ActionConfirmRequest;
  pending: boolean;
  error: string | null;
  onClose(): void;
}) {
  const [confirmed, setConfirmed] = useState<ReadonlySet<AssistantGate>>(new Set());
  return (
    <ActionConfirmBody
      request={request}
      confirmed={confirmed}
      pending={pending}
      error={error}
      onToggleGate={(gate) =>
        setConfirmed((prev) => {
          const next = new Set(prev);
          if (next.has(gate)) next.delete(gate);
          else next.add(gate);
          return next;
        })
      }
      onCancel={onClose}
      onConfirm={() => request.run([...confirmed])}
    />
  );
}

export default function ActionConfirmDialog({
  request,
  pending,
  error,
  onClose,
}: {
  request: ActionConfirmRequest | null;
  pending: boolean;
  error: string | null;
  onClose(): void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{request?.title ?? "Confirm assistant action"}</DialogTitle>
          <DialogDescription>
            Approval binds the exact payload below; the server re-validates every gate before executing.
          </DialogDescription>
        </DialogHeader>
        {request ? (
          <ActionConfirmDialogBody request={request} pending={pending} error={error} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
