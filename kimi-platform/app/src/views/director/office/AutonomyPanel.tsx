import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { TERMINAL_RUN_STATES } from "@contracts/run";
import {
  AUTONOMY_GRANT_TTL,
  AUTONOMY_RUN_EVENT_TYPES,
  NEVER_BYPASSABLE_APPROVAL_KINDS,
  type AutonomyMode,
} from "@contracts/office";
import { BUDGET_CEILINGS } from "@contracts/dag";
import { newIdempotencyKey, type RunLike } from "../workspace/adapter";
import { useNow } from "../workspace/useNow";
import {
  emergencyStopConfirmable,
  grantLifecycle,
  grantRequestBlockers,
} from "./officeAdapter";

const MODE_LABELS: Record<AutonomyMode, string> = {
  all: "all — every gate is human-decided (default)",
  risk_based: "risk_based — low-risk gates may auto-approve within ceilings",
  none: "none — preauthorized autonomy within hard ceilings",
};

/**
 * Autonomy grant controls + status (stage 01). Grants are explicit,
 * expiring, budget-capped rows — never ambient. The form mirrors the
 * server validator: ineligible combinations are disabled with the reason
 * shown, and the server answer (success or rejection) is rendered
 * verbatim. Emergency stop is always available, requires a typed reason +
 * explicit confirmation, and never asks for provider approval.
 */
export default function AutonomyPanel({
  projectId,
  riskTier,
  activeRun,
}: {
  projectId: number;
  riskTier: string;
  activeRun: RunLike | null;
}) {
  const now = useNow(1000);
  const statusQ = trpc.autonomy.status.useQuery(
    { projectId },
    { refetchInterval: 4000, retry: false },
  );
  const listQ = trpc.autonomy.list.useQuery(
    { projectId, includeInactive: true },
    { retry: false },
  );
  const runId = activeRun?.id ?? null;
  const eventsQ = trpc.events.tail.useQuery(
    { runId: runId ?? 0, limit: 200 },
    { enabled: runId != null, refetchInterval: 5000, retry: false },
  );
  const utils = trpc.useUtils();

  const grantM = trpc.autonomy.grant.useMutation({
    onSuccess: () => {
      void utils.autonomy.status.invalidate();
      void utils.autonomy.list.invalidate();
    },
  });
  const revokeM = trpc.autonomy.revoke.useMutation({
    onSuccess: () => {
      void utils.autonomy.status.invalidate();
      void utils.autonomy.list.invalidate();
    },
  });
  const stopM = trpc.autonomy.emergencyStop.useMutation({
    onSuccess: () => {
      void utils.autonomy.status.invalidate();
      void utils.autonomy.list.invalidate();
      void utils.runs.listByProject.invalidate();
    },
  });

  // ── Grant form state ──
  const [mode, setMode] = useState<AutonomyMode>("risk_based");
  const [scope, setScope] = useState<"project" | "run">("project");
  const [allowLive, setAllowLive] = useState(false);
  const [maxTokens, setMaxTokens] = useState(1_000_000);
  const [maxCalls, setMaxCalls] = useState(100);
  const [maxMinutes, setMaxMinutes] = useState(120);
  const [maxCostUsd, setMaxCostUsd] = useState(25);
  const [expiresInMinutes, setExpiresInMinutes] = useState(60);
  const [reason, setReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [stopOpen, setStopOpen] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [stopResult, setStopResult] = useState<string | null>(null);

  const runEligible = activeRun != null && !TERMINAL_RUN_STATES.has(activeRun.state);
  const noneLiveBlocked = allowLive && riskTier !== "low";
  const blockers = grantRequestBlockers({
    mode,
    allowLive,
    riskTier,
    expiresInMinutes,
    scope,
    runEligible: scope === "run" ? runEligible : true,
  });

  const grant = statusQ.data?.activeGrant ?? null;
  const usage = statusQ.data?.usage ?? null;
  const lifecycle = grantLifecycle(grant, usage, now);
  const latestInactive = useMemo(() => {
    if (grant || !listQ.data?.length) return null;
    const g = listQ.data[0]!;
    return { grant: g, lifecycle: grantLifecycle(g, null, g.expiresAtMs + 1) };
  }, [grant, listQ.data]);

  const bypassEvents = useMemo(
    () =>
      (eventsQ.data ?? []).filter((e) =>
        (AUTONOMY_RUN_EVENT_TYPES as readonly string[]).includes(e.type),
      ),
    [eventsQ.data],
  );

  const submitGrant = () => {
    grantM.mutate({
      projectId,
      scope,
      runId: scope === "run" ? (runId ?? undefined) : undefined,
      mode,
      allowLive,
      budgets: { maxTokens, maxCalls, maxMinutes, maxCostUsd },
      expiresInMinutes,
      reason,
      idempotencyKey: newIdempotencyKey("autonomy.grant"),
    });
  };

  const submitStop = () => {
    stopM.mutate(
      {
        projectId,
        reason: stopReason.trim(),
        idempotencyKey: newIdempotencyKey("autonomy.emergencyStop"),
      },
      {
        onSuccess: (res) => {
          setStopResult(
            `stopped — revoked ${res.revokedGrants.length} grant(s), stopped ${res.stoppedRuns.length} run(s)${res.stoppedRuns.length ? ` (#${res.stoppedRuns.join(", #")})` : ""}`,
          );
          setStopReason("");
        },
      },
    );
  };

  const STATE_CHIP: Record<string, string> = {
    active: "chip chip-sage",
    "over-budget": "chip chip-alert",
    expired: "chip chip-mustard",
    revoked: "chip chip-mustard",
    none: "chip",
  };

  return (
    <section aria-labelledby="dw-autonomy-heading" className="grid max-w-3xl gap-3">
      <span className="kicker">Autonomy grants</span>
      <h2 id="dw-autonomy-heading" className="text-lg font-extrabold tracking-tight">
        Delegation, ceilings &amp; emergency stop
      </h2>

      {/* ── Status ── */}
      <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        {statusQ.error ? (
          <p role="status" className="chip chip-alert">
            grant status unavailable — {statusQ.error.message}
          </p>
        ) : !statusQ.data ? (
          <p className="text-[13px] text-[hsl(var(--ink-soft))]">loading grant status…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={STATE_CHIP[lifecycle.state]}>
                {lifecycle.state === "none" ? "no active grant" : lifecycle.state}
              </span>
              {grant ? (
                <>
                  <span className="chip mono">{grant.mode}</span>
                  <span className="chip">{grant.scope}{grant.runId ? ` · run #${grant.runId}` : ""}</span>
                  <span className="chip">{grant.allowLive ? "live + mock" : "mock runs only"}</span>
                  {lifecycle.remainingMs != null ? (
                    <span className="chip mono">
                      expires in {Math.max(0, Math.round(lifecycle.remainingMs / 60000))} min
                    </span>
                  ) : null}
                </>
              ) : latestInactive ? (
                <span className="text-[13px] text-[hsl(var(--ink-soft))]">
                  last grant #{latestInactive.grant.id} ({latestInactive.grant.mode}) —{" "}
                  {latestInactive.grant.revokedAtMs != null
                    ? `revoked${latestInactive.grant.revokeReason ? `: ${latestInactive.grant.revokeReason}` : ""}`
                    : "expired"}
                </span>
              ) : (
                <span className="text-[13px] text-[hsl(var(--ink-soft))]">
                  every approval gate is human-decided
                </span>
              )}
            </div>
            {grant && lifecycle.ceilings.length ? (
              <div className="mt-2 grid gap-1">
                {lifecycle.ceilings.map((c) => (
                  <div key={c.key} className="flex items-center gap-2 text-[12px]">
                    <span className="mono w-32">{c.key}</span>
                    <span
                      className="track inline-block h-2 w-40 bg-[hsl(var(--ink)/0.1)]"
                      role="meter"
                      aria-valuenow={c.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${c.key} usage, ${c.pct}% of grant ceiling`}
                    >
                      <span
                        className={`block h-2 ${c.breached ? "bg-[hsl(var(--alert))]" : "bg-[hsl(var(--sage))]"}`}
                        style={{ width: `${c.pct}%` }}
                      />
                    </span>
                    <span className="mono">
                      {c.used} / {c.limit}
                    </span>
                    {c.breached ? (
                      <span className="chip chip-alert">over budget — run is stopped</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {grant ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="input min-h-[36px] text-[12px]"
                  placeholder="revoke reason (required)"
                  value={revokeReason}
                  maxLength={500}
                  onChange={(e) => setRevokeReason(e.target.value)}
                />
                <button
                  type="button"
                  className="btn min-h-[36px] px-3 text-[12px]"
                  disabled={revokeM.isPending || !revokeReason.trim()}
                  onClick={() =>
                    revokeM.mutate({
                      grantId: grant.id,
                      reason: revokeReason.trim(),
                      idempotencyKey: newIdempotencyKey("autonomy.revoke"),
                    })
                  }
                >
                  {revokeM.isPending ? "Revoking…" : "Revoke grant"}
                </button>
              </div>
            ) : null}
            {revokeM.error ? (
              <p role="alert" className="mt-1 text-[12px] font-bold text-[hsl(var(--alert))]">
                {revokeM.error.message}
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* ── Grant form ── */}
      <form
        className="grid gap-3 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!blockers.length) submitGrant();
        }}
      >
        <span className="kicker">New grant (supersedes any active grant)</span>
        <p
          role="note"
          className="border border-[hsl(var(--mustard)/0.5)] bg-[hsl(var(--mustard)/0.08)] px-2 py-1 text-[12px]"
        >
          <strong>Warning:</strong> a grant waives eligible approval gates without asking each
          time — within the hard ceilings below, until expiry. It never waives:{" "}
          {NEVER_BYPASSABLE_APPROVAL_KINDS.join(", ")}. The emergency stop is always available and
          never needs provider approval.
        </p>
        <fieldset>
          <legend className="text-[13px] font-bold">Mode</legend>
          <div className="mt-1 grid gap-1">
            {(Object.keys(MODE_LABELS) as AutonomyMode[]).map((m) => {
              const disabled = m === "none" && noneLiveBlocked;
              return (
                <label key={m} className="flex min-h-[36px] items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    name="autonomy-mode"
                    checked={mode === m}
                    disabled={disabled}
                    onChange={() => setMode(m)}
                  />
                  <span>{MODE_LABELS[m]}</span>
                  {disabled ? (
                    <span className="chip chip-alert">
                      disabled — live autonomy requires a low-risk project (this is {riskTier})
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[13px] font-bold">Scope</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            <label className="flex min-h-[36px] items-center gap-2 text-[13px]">
              <input
                type="radio"
                name="autonomy-scope"
                checked={scope === "project"}
                onChange={() => setScope("project")}
              />
              project
            </label>
            <label className="flex min-h-[36px] items-center gap-2 text-[13px]">
              <input
                type="radio"
                name="autonomy-scope"
                checked={scope === "run"}
                disabled={!runEligible}
                onChange={() => setScope("run")}
              />
              run {runId != null ? `#${runId}` : ""}
              {!runEligible ? (
                <span className="chip chip-mustard">disabled — no eligible (non-terminal) run</span>
              ) : null}
            </label>
          </div>
        </fieldset>
        <label className="flex min-h-[36px] items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={allowLive}
            onChange={(e) => setAllowLive(e.target.checked)}
          />
          allow live (billed) runs — unchecked means mock runs only
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["Hard token ceiling", maxTokens, setMaxTokens, BUDGET_CEILINGS.runMaxTokens, 1],
              ["Hard call ceiling", maxCalls, setMaxCalls, BUDGET_CEILINGS.runMaxCalls, 1],
              ["Hard minute ceiling", maxMinutes, setMaxMinutes, BUDGET_CEILINGS.runMaxMinutes, 1],
              ["Hard USD ceiling", maxCostUsd, setMaxCostUsd, BUDGET_CEILINGS.runMaxCostUsd, 0.01],
            ] as const
          ).map(([label, value, set, max, step]) => (
            <label key={label} className="text-[13px] font-bold">
              {label}
              <input
                type="number"
                className="input mt-1 text-[13px]"
                value={value}
                min={0}
                max={max}
                step={step}
                onChange={(e) => set(Number(e.target.value))}
              />
            </label>
          ))}
          <label className="text-[13px] font-bold">
            Expires in (minutes, {AUTONOMY_GRANT_TTL.minMinutes}–{AUTONOMY_GRANT_TTL.maxMinutes})
            <input
              type="number"
              className="input mt-1 text-[13px]"
              value={expiresInMinutes}
              min={AUTONOMY_GRANT_TTL.minMinutes}
              max={AUTONOMY_GRANT_TTL.maxMinutes}
              onChange={(e) => setExpiresInMinutes(Number(e.target.value))}
            />
          </label>
          <label className="text-[13px] font-bold">
            Reason (audit trail)
            <input
              className="input mt-1 text-[13px]"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
        {blockers.length ? (
          <ul role="note" className="grid gap-1">
            {blockers.map((b) => (
              <li key={b} className="chip chip-alert">
                {b}
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <button
            type="submit"
            className="btn min-h-[44px] px-4 text-[13px] font-bold"
            disabled={grantM.isPending || blockers.length > 0}
          >
            {grantM.isPending ? "Granting…" : "Grant autonomy (waives eligible gates)"}
          </button>
        </div>
        {grantM.error ? (
          <p role="alert" className="text-[12px] font-bold text-[hsl(var(--alert))]">
            {grantM.error.message}
          </p>
        ) : null}
        {grantM.isSuccess ? (
          <p role="status" className="text-[12px] text-[hsl(var(--ink-soft))]">
            grant #{grantM.data.grantId} active until{" "}
            {new Date(grantM.data.expiresAtMs).toLocaleString()} — superseded{" "}
            {grantM.data.superseded.length} prior grant(s)
          </p>
        ) : null}
      </form>

      {/* ── Audit: autonomy events + bypass events ── */}
      <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Audit — grants, bypasses, budget stops</span>
        <ul className="mt-1 grid gap-1 text-[12px]">
          {(statusQ.data?.recentEvents ?? []).slice(0, 8).map((e) => (
            <li key={`office-${e.seq}`} className="mono">
              #{e.seq} {e.type}
            </li>
          ))}
          {bypassEvents.slice(0, 8).map((e) => (
            <li key={`run-${e.seq}`} className="mono">
              run #{runId} · {e.type}
              {e.nodeKey ? ` · ${e.nodeKey}` : ""}
            </li>
          ))}
          {!(statusQ.data?.recentEvents?.length ?? 0) && !bypassEvents.length ? (
            <li className="text-[hsl(var(--ink-soft))]">
              no autonomy or bypass events yet — every bypass is audited here
            </li>
          ) : null}
        </ul>
      </div>

      {/* ── Emergency stop ── */}
      <div className="border-2 border-[hsl(var(--alert))] bg-[hsl(var(--paper-raised))] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="kicker">Emergency stop</span>
          <span className="text-[12px] text-[hsl(var(--ink-soft))]">
            always available — revokes every grant and stops every active run; audited; no
            provider approval is ever required
          </span>
          <button
            type="button"
            className="btn ml-auto min-h-[44px] px-4 text-[13px] font-bold text-[hsl(var(--alert))]"
            onClick={() => {
              setStopResult(null);
              setStopOpen(true);
            }}
          >
            Emergency stop
          </button>
        </div>
        {stopOpen ? (
          <div role="alertdialog" aria-modal="true" aria-label="Confirm emergency stop" className="mt-2 grid gap-2">
            <p className="text-[13px]">
              Confirm the emergency stop: every active autonomy grant is revoked and every
              active run of this project is stopped (in-flight work is fenced, not killed
              mid-write). This is audited.
            </p>
            <label className="text-[13px] font-bold">
              Reason (required)
              <input
                className="input mt-1 text-[13px]"
                value={stopReason}
                maxLength={500}
                onChange={(e) => setStopReason(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn min-h-[44px] px-4 text-[13px] font-bold text-[hsl(var(--alert))]"
                disabled={stopM.isPending || !emergencyStopConfirmable(stopReason)}
                onClick={submitStop}
              >
                {stopM.isPending ? "Stopping…" : "Confirm emergency stop"}
              </button>
              <button
                type="button"
                className="btn min-h-[44px] px-4 text-[13px]"
                onClick={() => setStopOpen(false)}
              >
                Cancel
              </button>
            </div>
            {stopM.error ? (
              <p role="alert" className="text-[12px] font-bold text-[hsl(var(--alert))]">
                {stopM.error.message}
              </p>
            ) : null}
          </div>
        ) : null}
        {stopResult ? (
          <p role="status" className="mt-2 text-[13px] font-bold">
            {stopResult}
          </p>
        ) : null}
      </div>
    </section>
  );
}
