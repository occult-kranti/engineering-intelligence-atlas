import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { ErrorNote } from "../DirectorShell";
import ConfirmDialog, { type ConfirmRequest } from "./ConfirmDialog";
import {
  deriveContractControls,
  type ContractRowLike,
  type SnapshotLike,
} from "./adapter";

/**
 * Worker contracts: the human decision IS the approval gate. Approve/reject
 * on proposed contracts (unstaffed approvals are disabled with the reason,
 * mirroring the server's UNSTAFFED rejection), and drain → release on
 * active/draining ones. Every row shows the exact version, skill pin hash,
 * and capacity group — approvals bump the version server-side.
 */
export default function ContractsPanel({ snapshot }: { snapshot: SnapshotLike }) {
  const utils = trpc.useUtils();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const invalidate = () => {
    void utils.enterprise.snapshot.invalidate({ enterpriseId: snapshot.enterprise.id });
    void utils.enterprise.workers.invalidate({ enterpriseId: snapshot.enterprise.id });
    void utils.enterprise.events.invalidate();
  };
  const onSettled = () => setConfirm(null);
  const decideM = trpc.enterprise.decideContract.useMutation({
    onSuccess: () => {
      invalidate();
      onSettled();
    },
    onError: onSettled,
  });
  const releaseM = trpc.enterprise.releaseContract.useMutation({
    onSuccess: () => {
      invalidate();
      onSettled();
    },
    onError: onSettled,
  });
  const pending = decideM.isPending || releaseM.isPending;
  const error = decideM.error ?? releaseM.error;

  const companyById = new Map(snapshot.companies.map((c) => [c.id, c]));
  const departmentById = new Map(snapshot.departments.map((d) => [d.id, d]));

  if (snapshot.contracts.length === 0) {
    return (
      <section className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-6">
        <h2 className="text-lg font-extrabold">No contracts</h2>
        <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
          Contracts are created by blueprint apply as deterministic cross-company
          proposals. Apply a blueprint from the enterprises list first.
        </p>
      </section>
    );
  }

  const requestDecision = (contract: ContractRowLike, decision: "approved" | "rejected") =>
    setConfirm({
      title: decision === "approved" ? `Approve contract ${contract.key}?` : `Reject contract ${contract.key}?`,
      body:
        decision === "approved"
          ? `Approving mints the origin pool worker and the borrowing-company secondee for "${contract.skillPin.skillId}" (one shared capacity group). The decision is recorded with your identity and bumps the contract to v${contract.version + 1}.`
          : `Rejecting revokes the proposal permanently (status revoked, v${contract.version + 1}). No workers are minted.`,
      confirmLabel: decision === "approved" ? "Approve contract" : "Reject contract",
      destructive: decision === "rejected",
      run: () => decideM.mutate({ contractId: contract.id, decision }),
    });

  const requestRelease = (contract: ContractRowLike) =>
    setConfirm({
      title: `Release contract ${contract.key}?`,
      body:
        contract.status === "draining"
          ? "Completes the release once in-flight claims have drained. If claims are still running the contract honestly stays in draining."
          : "The secondee is suspended (no new claims), in-flight claims drain, and the contract flips to released only when the pool is empty.",
      confirmLabel: contract.status === "draining" ? "Complete release" : "Release (drain first)",
      destructive: true,
      run: () => releaseM.mutate({ contractId: contract.id }),
    });

  return (
    <section aria-label="Worker contracts">
      {error ? <ErrorNote message={error.message} /> : null}
      <ol className="grid gap-2">
        {snapshot.contracts.map((w) => {
          const controls = deriveContractControls(w);
          const company = companyById.get(w.companyId);
          const department = departmentById.get(w.departmentId);
          return (
            <li key={w.key}>
              <article className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3" data-contract-key={w.key}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[13px] font-bold">{w.key}</span>
                  <span className={`chip ${w.status === "active" ? "chip-sage" : w.status === "proposed" ? "chip-mustard" : w.status === "draining" ? "chip-cornflower" : ""}`}>
                    {w.status}
                  </span>
                  <span className="chip mono">v{w.version}</span>
                  {w.staffed ? (
                    <span className="chip chip-sage">staffed</span>
                  ) : (
                    <span className="chip chip-alert">unstaffed</span>
                  )}
                  <span className="chip chip-neutral">{w.discipline}</span>
                </div>
                <dl className="mt-1 grid gap-0.5 text-[12px] text-[hsl(var(--ink-soft))]">
                  <div>
                    serves <span className="mono font-bold text-[hsl(var(--ink))]">{company?.key ?? w.companyId}</span>
                    {" "}from <span className="mono font-bold text-[hsl(var(--ink))]">{department?.key ?? w.departmentId}</span>
                    {" · "}capacity share {w.capacityShare.toFixed(3)}
                  </div>
                  <div className="mono">
                    skill {w.skillPin.skillId}@{w.skillPin.version} · sha{" "}
                    {w.skillPin.sha256 ? `${w.skillPin.sha256.slice(0, 16)}…` : "none (not yet vetted)"}
                  </div>
                  {w.capacityGroupId ? <div className="mono">pool {w.capacityGroupId}</div> : null}
                  {w.decidedBy ? <div>decided by {w.decidedBy}</div> : null}
                </dl>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn text-[12px] font-bold"
                    disabled={!controls.approve.enabled || pending}
                    title={controls.approve.reason ?? "Approve and mint workers"}
                    onClick={() => requestDecision(w, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn text-[12px]"
                    disabled={!controls.reject.enabled || pending}
                    title={controls.reject.reason ?? "Reject the proposal"}
                    onClick={() => requestDecision(w, "rejected")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn text-[12px]"
                    disabled={!controls.release.enabled || pending}
                    title={controls.release.reason ?? "Drain then release"}
                    onClick={() => requestRelease(w)}
                  >
                    {controls.release.label}
                  </button>
                </div>
                {[controls.approve, controls.reject, controls.release].some((c) => !c.enabled) ? (
                  <ul className="mt-1 grid gap-0.5 text-[11px] text-[hsl(var(--ink-soft))]">
                    {!controls.approve.enabled && w.status === "proposed" ? <li>approve: {controls.approve.reason}</li> : null}
                    {!controls.release.enabled ? <li>release: {controls.release.reason}</li> : null}
                  </ul>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
      <ConfirmDialog request={confirm} pending={pending} onClose={() => setConfirm(null)} />
    </section>
  );
}
