import { useState } from "react";
import type {
  AgentCard,
  ReassignError,
  ReassignInput,
  ReassignResult,
  RoomState,
} from "./model";
import { evaluateEligibility } from "./derive";

/**
 * Room picker for reassignment (keyboard path: M on a focused agent). Every
 * option announces its live eligibility verdict; blocked options are
 * disabled with the reason. A worker holding claims must choose an explicit
 * claims policy — there is no silent move and no fake success: the result
 * banner is the server's answer, verbatim.
 */
export default function ReassignMenu({
  agent,
  rooms,
  onReassign,
  onClose,
}: {
  agent: AgentCard;
  rooms: RoomState[];
  onReassign: (input: ReassignInput) => Promise<ReassignResult>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [policy, setPolicy] = useState<"drain" | "release-requeue" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReassignError | null>(null);
  const needsPolicy = agent.workload.activeClaims > 0;
  const options = [
    ...rooms.map((room) => ({
      key: room.roomKey,
      name: room.name,
      verdict: evaluateEligibility(agent, room),
    })),
    {
      key: "__bench__",
      name: "Bench (release seat)",
      verdict: {
        ok: agent.roomKey != null,
        reasons: agent.roomKey != null ? [] : ["already on the bench"],
        message:
          agent.roomKey != null ? "eligible — releases the seat" : "blocked — already on the bench",
      },
    },
  ];

  const chosen = options.find((o) => o.key === target) ?? null;
  const canSubmit =
    !pending && chosen != null && chosen.verdict.ok && (!needsPolicy || policy != null);

  const submit = async () => {
    if (!chosen || !canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const result = await onReassign({
        workerId: agent.workerId,
        toRoomKey: chosen.key === "__bench__" ? null : chosen.key,
        expectedVersion: agent.version,
        claimsPolicy: needsPolicy ? (policy ?? undefined) : undefined,
      });
      if (result.ok) {
        // No local mutation: the office re-renders from server truth.
        onClose();
      } else {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reassign ${agent.name}`}
      className="border border-[hsl(var(--ink))] bg-[hsl(var(--paper-raised))] p-3"
    >
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-extrabold">Reassign {agent.name}</h3>
        <span className="chip mono">{agent.role}</span>
        {needsPolicy ? (
          <span className="chip chip-mustard">
            holds {agent.workload.activeClaims} active claim{agent.workload.activeClaims === 1 ? "" : "s"}
          </span>
        ) : null}
        <button
          type="button"
          className="btn ml-auto min-h-[44px] px-3 text-[13px]"
          onClick={onClose}
        >
          Cancel <span aria-hidden>(Esc)</span>
        </button>
      </div>

      <fieldset className="mt-2">
        <legend className="kicker">Destination — eligibility checked live, re-checked on the server</legend>
        <ul className="mt-1 flex flex-col gap-1">
          {options.map((o) => (
            <li key={o.key}>
              <label
                className={`flex min-h-[44px] flex-wrap items-center gap-2 border px-2 py-1 text-[13px] ${
                  o.verdict.ok
                    ? "border-[hsl(var(--ink)/0.2)]"
                    : "border-[hsl(var(--ink)/0.12)] text-[hsl(var(--ink-soft))]"
                }`}
              >
                <input
                  type="radio"
                  name={`reassign-${agent.workerId}`}
                  disabled={!o.verdict.ok}
                  checked={target === o.key}
                  onChange={() => setTarget(o.key)}
                />
                <span className="font-bold">{o.name}</span>
                <span
                  className={o.verdict.ok ? "chip chip-cornflower" : "chip chip-alert"}
                  data-verdict={o.verdict.ok ? "eligible" : "blocked"}
                >
                  {o.verdict.message}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {needsPolicy ? (
        <fieldset className="mt-2">
          <legend className="kicker">
            Claims policy — required; claims are never silently dropped
          </legend>
          <div className="mt-1 flex flex-col gap-1">
            <label className="flex min-h-[44px] items-center gap-2 text-[13px]">
              <input
                type="radio"
                name={`policy-${agent.workerId}`}
                checked={policy === "drain"}
                onChange={() => setPolicy("drain")}
              />
              <span>
                <strong>drain</strong> — claims finish; the seat transfers on last completion
              </span>
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-[13px]">
              <input
                type="radio"
                name={`policy-${agent.workerId}`}
                checked={policy === "release-requeue"}
                onChange={() => setPolicy("release-requeue")}
              />
              <span>
                <strong>release-requeue</strong> — claims return to ready (audited; billable calls are
                never auto-retried)
              </span>
            </label>
          </div>
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="chip chip-alert mt-2" data-cause={error.cause}>
          {error.cause}: {error.message}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="btn min-h-[44px] px-4 text-[13px] font-bold"
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {pending ? "Reassigning…" : "Confirm reassignment"}
        </button>
        <span className="text-[12px] text-[hsl(var(--ink-soft))]">
          version {agent.version} · state-guarded; a capacity race loses cleanly with 409
        </span>
      </div>
    </div>
  );
}
