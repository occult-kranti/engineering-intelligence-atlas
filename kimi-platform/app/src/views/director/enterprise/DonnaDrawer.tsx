import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  ASSISTANT_DEFINITIONS,
  ASSISTANT_GATES,
  ASSISTANT_JOB_KINDS,
  STUDY_QUEUE_CAP,
  type AssistantGate,
  type AssistantJobSchedule,
  type AssistantScope,
  type GithubIntakeMode,
} from "@contracts/assistant";
import { ErrorNote } from "../DirectorShell";
import ConfirmDialog, { type ConfirmRequest } from "./ConfirmDialog";
import ActionConfirmDialog, { type ActionConfirmRequest } from "./ActionConfirmDialog";
import { deriveProgramControls, type ProgramRowLike, type SnapshotLike, type WorkerRowLike } from "./adapter";
import {
  EMERGENCY_STOP_COPY,
  NO_PAID_AUTO_NOTE,
  PROVIDER_CACHE_POLICY,
  buildQueueReorderInput,
  buildReorderOrder,
  describeAssistantError,
  describeCacheNamespace,
  deriveIntakeControls,
  deriveJobRow,
  deriveProposalView,
  deriveRepoApplyControl,
  deriveScopeOptions,
  parseRepoUrls,
  parseScopeValue,
  requiredGates,
  riskOfAction,
  studySkillOptions,
  summarizeStudyItems,
  useArtifactPicker,
  useAssistantCache,
  useAssistantEvents,
  useAssistantJobs,
  useAssistantProposals,
  useAssistantStatus,
  useKnowledgeTransfers,
  useNow,
  useRepositories,
  useStudyItems,
  useWorkQueue,
  validateTransferDraft,
  type CacheNamespaceLike,
  type JobRowLike,
  type ProposalRowLike,
  type QueueItemRowLike,
  type QueueRowLike,
  type RepoRowLike,
  type ScopeOption,
  type StudyItemRowLike,
  type TransferRowLike,
} from "./useAssistantData";

/**
 * Donna / shared-assistant drawer for the enterprise dashboard. Donna is the
 * CEO's executive assistant and operates ABOVE the Director runtime; the
 * company operations assistant, department coordinators, and the permanent
 * repository-integration steward report to her and run under the SAME seven
 * non-bypassable gates. Every control here dispatches a real
 * trpc.assistant.* procedure through the typed proposal pipeline — the ONLY
 * exception is emergency stop, which deliberately calls the existing direct
 * enterprise.programCancel path and is never an assistant proposal. Provider
 * text is advisory only: no model output executes anything and no raw
 * chain-of-thought is shown.
 */

export const DONNA_TABS = [
  { id: "queue", label: "Queue" },
  { id: "hiring", label: "Hiring" },
  { id: "schedules", label: "Schedules" },
  { id: "cache", label: "Cache" },
  { id: "repositories", label: "Repositories" },
  { id: "knowledge", label: "Knowledge" },
] as const;

export type DonnaTabId = (typeof DONNA_TABS)[number]["id"];

const PROVIDER_ADVISORY_NOTE =
  "Provider chat is an optional advisory surface for Donna only: model text never executes actions, proposals stay typed and human-approved, and no raw chain-of-thought is shown.";

const REPO_NO_CLONE_NOTE =
  "Confirmed metadata only — the steward never clones, never fetches code, and never creates companies, departments, or roles automatically.";

// ── Header (Donna identity + roster + emergency stop) ────────────

export function DonnaHeader({
  pendingProposals,
  program,
  emergencyEnabled,
  emergencyReason,
  onEmergencyStop,
  onClose,
}: {
  pendingProposals: number | null;
  program: ProgramRowLike | null;
  emergencyEnabled: boolean;
  emergencyReason: string | null;
  onEmergencyStop(): void;
  onClose(): void;
}) {
  const donna = ASSISTANT_DEFINITIONS.donna;
  return (
    <header className="grid gap-3" data-testid="donna-header">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-extrabold tracking-tight">{donna.title}</h2>
        <span className="chip chip-sage">above the Director runtime</span>
        <span className="chip">{donna.authority}</span>
        {pendingProposals !== null ? (
          <span className={`chip ${pendingProposals > 0 ? "chip-mustard" : ""}`} data-testid="donna-pending-count">
            {pendingProposals} pending proposal{pendingProposals === 1 ? "" : "s"}
          </span>
        ) : null}
        <button type="button" className="btn ml-auto text-[13px]" onClick={onClose} aria-label="Close Donna" autoFocus>
          Close
        </button>
      </div>
      <p className="prose-evidence text-[13px] text-[hsl(var(--ink-soft))]">
        {donna.description}
      </p>
      <p className="text-[12px] text-[hsl(var(--ink-soft))]">{PROVIDER_ADVISORY_NOTE}</p>

      <details className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3" data-testid="donna-roster">
        <summary className="cursor-pointer text-[13px] font-bold">
          Shared assistants — same seven gates, Donna above Director
        </summary>
        <ul className="mt-2 grid gap-1 text-[12px]">
          {Object.values(ASSISTANT_DEFINITIONS).map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline gap-2">
              <span className="mono font-bold">{d.id}</span>
              <span className="chip">{d.scope}</span>
              <span className="text-[hsl(var(--ink-soft))]">
                reports to {d.reportsTo ?? "no one"} · {d.authority} · gates: {d.gates.length}/{ASSISTANT_GATES.length} (non-bypassable)
              </span>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-wrap items-center gap-2 border border-[hsl(var(--alert))] bg-[hsl(var(--paper-raised))] p-3">
        <button
          type="button"
          className="btn text-[13px] font-bold border-[hsl(var(--alert))] text-[hsl(8_64%_30%)]"
          disabled={!emergencyEnabled}
          title={emergencyReason ?? undefined}
          onClick={onEmergencyStop}
          data-testid="donna-emergency-stop"
          data-direct-path="enterprise.programCancel"
        >
          Emergency stop — cancel program
        </button>
        <p className="text-[12px] text-[hsl(var(--ink-soft))]">
          {EMERGENCY_STOP_COPY}
          {!emergencyEnabled && emergencyReason ? ` (${emergencyReason})` : ""}
          {program ? "" : " No program exists for this enterprise yet."}
        </p>
      </div>
    </header>
  );
}

// ── Scope selector (snapshot-fed) ────────────────────────────────

export function ScopeSelector({
  options,
  value,
  onChange,
}: {
  options: ScopeOption[];
  value: string;
  onChange(value: string): void;
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <div className="grid gap-1" data-testid="donna-scope-selector">
      <label className="kicker" htmlFor="donna-scope">
        Assistant scope
      </label>
      <select
        id="donna-scope"
        className="input text-[13px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled} title={o.reason ?? undefined}>
            {o.label}
            {o.disabled ? " — unavailable" : ""}
          </option>
        ))}
      </select>
      {selected?.disabled && selected.reason ? (
        <p className="text-[12px] text-[hsl(var(--ink-soft))]">{selected.reason}</p>
      ) : null}
    </div>
  );
}

// ── Proposal inbox ───────────────────────────────────────────────

export function ProposalInbox({
  proposals,
  error,
  pending,
  onApprove,
  onReject,
  onExecute,
  onCancelProposal,
}: {
  proposals: ProposalRowLike[];
  error: string | null;
  pending: boolean;
  onApprove(row: ProposalRowLike): void;
  onReject(row: ProposalRowLike): void;
  onExecute(row: ProposalRowLike): void;
  onCancelProposal(row: ProposalRowLike): void;
}) {
  const open = proposals.filter((p) => p.status === "proposed" || p.status === "approved");
  return (
    <section aria-label="Proposal inbox" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3" data-testid="donna-proposal-inbox">
      <div className="flex items-baseline gap-2">
        <span className="kicker">Proposal inbox</span>
        <span className="chip">{open.length} open</span>
      </div>
      {error ? <ErrorNote message={error} /> : null}
      {open.length === 0 ? (
        <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
          No open proposals. Assistants propose; nothing executes without your approval through the required gates.
        </p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {open.map((row) => {
            const view = deriveProposalView(row);
            return (
              <li key={row.id} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2" data-testid="donna-proposal">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="mono font-bold">{view.action}</span>
                  <span className="chip">{view.actor}</span>
                  <span className="chip mono">{view.scope}</span>
                  <span className={`chip ${view.risk === "high" ? "chip-alert" : view.risk === "medium" ? "chip-mustard" : ""}`}>
                    {view.risk}
                  </span>
                  <span className="chip">{view.status}</span>
                  <span className={`chip mono ${view.hashVerified ? "chip-sage" : "chip-alert"}`} title={view.payloadHash}>
                    hash {view.payloadHash.slice(0, 12)}… {view.hashVerified ? "verified" : "MISMATCH"}
                  </span>
                  <span className="chip mono">expectedVersion v{view.expectedVersion}</span>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-[12px] text-[hsl(var(--ink-soft))]">
                    Typed payload diff ({view.diffLines.length} field{view.diffLines.length === 1 ? "" : "s"})
                    {view.requiredGates.length > 0 ? ` · gates: ${view.requiredGates.join(", ")}` : " · no gates required"}
                  </summary>
                  <pre className="mt-1 max-h-36 overflow-auto border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-2 text-[12px]">
                    {view.diffLines.join("\n")}
                  </pre>
                </details>
                {view.resultSummary ? (
                  <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">{view.resultSummary}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {view.status === "proposed" ? (
                    <>
                      <button
                        type="button"
                        className="btn text-[12px] font-bold"
                        disabled={pending || !view.hashVerified}
                        title={view.hashVerified ? undefined : "payload hash mismatch — refusing to approve"}
                        onClick={() => onApprove(row)}
                      >
                        Approve…
                      </button>
                      <button type="button" className="btn text-[12px]" disabled={pending} onClick={() => onReject(row)}>
                        Reject
                      </button>
                    </>
                  ) : null}
                  {view.status === "approved" ? (
                    <>
                      <button
                        type="button"
                        className="btn text-[12px] font-bold"
                        disabled={pending || !view.hashVerified || view.missingGates.length > 0}
                        title={
                          !view.hashVerified
                            ? "payload hash mismatch — refusing to execute"
                            : view.missingGates.length > 0
                              ? `missing confirmed gates: ${view.missingGates.join(", ")}`
                              : undefined
                        }
                        onClick={() => onExecute(row)}
                      >
                        Execute
                      </button>
                      <button type="button" className="btn text-[12px]" disabled={pending} onClick={() => onCancelProposal(row)}>
                        Cancel proposal
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Queue tab ────────────────────────────────────────────────────

export interface QueueItemForm {
  itemKey: string;
  itemKind: QueueItemRowLike["itemKind"];
  refId: string;
  title: string;
}

export function QueuePanel({
  scope,
  scopeKey,
  queue,
  items,
  loading,
  error,
  program,
  pending,
  onAdd,
  onMove,
  onPump,
}: {
  scope: AssistantScope;
  scopeKey: string;
  queue: QueueRowLike | null;
  items: QueueItemRowLike[];
  loading: boolean;
  error: string | null;
  program: ProgramRowLike | null;
  pending: boolean;
  onAdd(form: QueueItemForm): void;
  onMove(itemKey: string, direction: -1 | 1): void;
  onPump(): void;
}) {
  const [form, setForm] = useState<QueueItemForm>({ itemKey: "", itemKind: "custom", refId: "", title: "" });
  const pumpControl = program
    ? deriveProgramControls(program).find((c) => c.id === "pump")!
    : null;
  return (
    <div className="grid gap-4" data-testid="donna-queue-panel">
      <section aria-label="Work queue" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="kicker">Work queue</span>
          <span className="chip mono">
            {scope}
            {scopeKey ? `:${scopeKey}` : ""}
          </span>
          {queue ? <span className="chip mono">OCC v{queue.version}</span> : <span className="chip">no queue yet</span>}
        </div>
        <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">
          Reorders are pinned to the exact queue version shown (expectedQueueVersion OCC); a concurrent change is a CONFLICT — reload and retry.
        </p>
        {error ? <ErrorNote message={error} /> : null}
        {loading ? <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">Loading queue…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
            This queue is empty. Add an item below — adds are idempotent on the item key.
          </p>
        ) : null}
        {items.length > 0 ? (
          <table className="table-cat mt-2 text-[12px]">
            <thead>
              <tr><th>#</th><th>key</th><th>kind</th><th>title</th><th>status</th><th>hash</th><th>order</th></tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.itemKey} data-testid="donna-queue-item">
                  <td className="mono">{item.position + 1}</td>
                  <td className="mono font-bold">{item.itemKey}</td>
                  <td>{item.itemKind}</td>
                  <td>{item.title}</td>
                  <td>
                    <span className={`chip ${item.status === "done" ? "chip-sage" : item.status === "dropped" ? "chip-alert" : ""}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="mono" title={item.payloadHash}>{item.payloadHash.slice(0, 8)}…</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn px-2 py-0 text-[12px]"
                        disabled={pending || i === 0}
                        title={i === 0 ? "already first" : "move up (OCC-pinned reorder)"}
                        aria-label={`Move ${item.itemKey} up`}
                        onClick={() => onMove(item.itemKey, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn px-2 py-0 text-[12px]"
                        disabled={pending || i === items.length - 1}
                        title={i === items.length - 1 ? "already last" : "move down (OCC-pinned reorder)"}
                        aria-label={`Move ${item.itemKey} down`}
                        onClick={() => onMove(item.itemKey, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <form
          className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd(form);
          }}
        >
          <span className="kicker">Add item</span>
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-44 text-[13px]"
              placeholder="item key (unique)"
              aria-label="item key"
              value={form.itemKey}
              onChange={(e) => setForm({ ...form, itemKey: e.target.value })}
              required
              maxLength={120}
            />
            <select
              className="input text-[13px]"
              aria-label="item kind"
              value={form.itemKind}
              onChange={(e) => setForm({ ...form, itemKind: e.target.value as QueueItemForm["itemKind"] })}
            >
              {(["company-run", "study", "repository-triage", "custom"] as const).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <input
              className="input w-40 text-[13px]"
              placeholder="ref id (optional)"
              aria-label="ref id"
              value={form.refId}
              onChange={(e) => setForm({ ...form, refId: e.target.value })}
              maxLength={255}
            />
            <input
              className="input min-w-52 flex-1 text-[13px]"
              placeholder="title"
              aria-label="item title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              maxLength={200}
            />
            <button type="submit" className="btn text-[13px] font-bold" disabled={pending || !form.itemKey.trim() || !form.title.trim()}>
              Add to queue
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Program pump" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="kicker">Approved mock pump</span>
          {program ? (
            <span className={`chip ${program.state === "running" ? "chip-sage" : "chip-mustard"}`}>
              program: {program.state}{program.pausedAt ? " (paused)" : ""}
            </span>
          ) : (
            <span className="chip">no program</span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">
          The assistant pump dispatches MOCK runs only; live/billed dispatch stays behind the existing run-level gates, which this path never reaches.
        </p>
        <button
          type="button"
          className="btn mt-2 text-[13px] font-bold"
          disabled={pending || !program || !pumpControl?.enabled}
          title={!program ? "no program exists" : (pumpControl?.reason ?? undefined)}
          onClick={onPump}
          data-testid="donna-pump"
        >
          Pump program (mock reconcile)…
        </button>
        {program && pumpControl && !pumpControl.enabled && pumpControl.reason ? (
          <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">{pumpControl.reason}</p>
        ) : null}
      </section>
    </div>
  );
}

// ── Hiring tab (workers + company/department lifecycle) ──────────

export function HiringPanel({
  snapshot,
  workers,
  workersError,
  pending,
  onHire,
  onFire,
  onWorkerSuspend,
  onCompanyStatus,
  onDepartmentStatus,
}: {
  snapshot: SnapshotLike;
  workers: WorkerRowLike[];
  workersError: string | null;
  pending: boolean;
  onHire(contractKey: string): void;
  onFire(contractKey: string): void;
  onWorkerSuspend(workerId: number, suspended: boolean): void;
  onCompanyStatus(companyKey: string, status: "active" | "paused" | "archived"): void;
  onDepartmentStatus(departmentKey: string, status: "active" | "paused" | "archived"): void;
}) {
  return (
    <div className="grid gap-4" data-testid="donna-hiring-panel">
      <section aria-label="Contracts" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Hire / fire (contracts)</span>
        <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">
          Hire approves a staffed proposed contract (plan-approval gate). Fire drains in-flight work and preserves artifacts first (high-risk gate), then releases the contract.
        </p>
        <table className="table-cat mt-2 text-[12px]">
          <thead>
            <tr><th>contract</th><th>status</th><th>staffed</th><th>skill</th><th>actions</th></tr>
          </thead>
          <tbody>
            {snapshot.contracts.map((w) => {
              const hireable = w.status === "proposed" && w.staffed;
              const fireable = w.status === "active" || w.status === "draining";
              return (
                <tr key={w.key} data-testid="donna-contract-row">
                  <td className="mono font-bold">{w.key}</td>
                  <td><span className="chip">{w.status}</span></td>
                  <td>{w.staffed ? "staffed" : "unstaffed"}</td>
                  <td className="mono">{w.skillPin.skillId}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="btn px-2 py-0 text-[12px]"
                        disabled={pending || !hireable}
                        title={
                          hireable
                            ? "approve contract (plan-approval gate)"
                            : w.status !== "proposed"
                              ? `contract is ${w.status}, not proposed`
                              : `pinned skill "${w.skillPin.skillId}" is not vetted — honestly unstaffed`
                        }
                        onClick={() => onHire(w.key)}
                      >
                        Hire…
                      </button>
                      <button
                        type="button"
                        className="btn px-2 py-0 text-[12px] border-[hsl(var(--alert))] text-[hsl(8_64%_30%)]"
                        disabled={pending || !fireable}
                        title={fireable ? "fire: drain in-flight work, preserve artifacts (high-risk gate)" : `contract is ${w.status}; only active/draining contracts can be fired`}
                        onClick={() => onFire(w.key)}
                      >
                        Fire (drain)…
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-label="Workers" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Workers (pause / resume)</span>
        {workersError ? <ErrorNote message={workersError} /> : null}
        {workers.length === 0 && !workersError ? (
          <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">No workers are pooled yet — workers are minted by approved contracts.</p>
        ) : null}
        {workers.length > 0 ? (
          <table className="table-cat mt-2 text-[12px]">
            <thead>
              <tr><th>worker</th><th>role</th><th>status</th><th>actions</th></tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} data-testid="donna-worker-row">
                  <td className="font-bold">{w.name}</td>
                  <td>{w.role}</td>
                  <td><span className={`chip ${w.status === "suspended" ? "chip-mustard" : "chip-sage"}`}>{w.status}</span></td>
                  <td>
                    {w.status === "active" ? (
                      <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending} onClick={() => onWorkerSuspend(w.id, true)}>
                        Pause
                      </button>
                    ) : (
                      <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending} onClick={() => onWorkerSuspend(w.id, false)}>
                        Resume
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section aria-label="Company lifecycle" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Companies (pause / resume / archive)</span>
        <table className="table-cat mt-2 text-[12px]">
          <thead>
            <tr><th>company</th><th>state</th><th>actions</th></tr>
          </thead>
          <tbody>
            {snapshot.companies.map((c) => {
              const archivedAt = (c as { archivedAt?: Date | string | null }).archivedAt ?? null;
              const archived = archivedAt !== null;
              return (
                <tr key={c.key} data-testid="donna-company-row">
                  <td className="mono font-bold">{c.key}</td>
                  <td>
                    <span className={`chip ${archived ? "chip-alert" : c.active ? "chip-sage" : "chip-mustard"}`}>
                      {archived ? "archived" : c.active ? "active" : "paused"}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending || !c.active || archived}
                        title={archived ? "archived is terminal" : !c.active ? "company is already paused" : "pause (plan-approval gate); zero budget reservation while paused"}
                        onClick={() => onCompanyStatus(c.key, "paused")}>
                        Pause…
                      </button>
                      <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending || c.active || archived}
                        title={archived ? "archived is terminal" : c.active ? "company is active" : "resume (plan-approval gate)"}
                        onClick={() => onCompanyStatus(c.key, "active")}>
                        Resume…
                      </button>
                      <button type="button" className="btn px-2 py-0 text-[12px] border-[hsl(var(--alert))] text-[hsl(8_64%_30%)]" disabled={pending || archived}
                        title={archived ? "already archived (terminal)" : "archive: drain borrowing contracts, preserve artifacts (high-risk gate)"}
                        onClick={() => onCompanyStatus(c.key, "archived")}>
                        Archive…
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-label="Department lifecycle" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Departments (pause / resume / archive)</span>
        <table className="table-cat mt-2 text-[12px]">
          <thead>
            <tr><th>department</th><th>state</th><th>actions</th></tr>
          </thead>
          <tbody>
            {snapshot.departments.map((d) => {
              const status = (d as { status?: "active" | "paused" | "archived" }).status ?? "active";
              return (
                <tr key={d.key} data-testid="donna-department-row">
                  <td className="mono font-bold">{d.key}</td>
                  <td>
                    <span className={`chip ${status === "archived" ? "chip-alert" : status === "paused" ? "chip-mustard" : "chip-sage"}`}>
                      {status}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending || status !== "active"}
                        title={status === "active" ? "pause (plan-approval gate); pooled workers suspend, no new claims" : `department is ${status}`}
                        onClick={() => onDepartmentStatus(d.key, "paused")}>
                        Pause…
                      </button>
                      <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending || status !== "paused"}
                        title={status === "paused" ? "resume (plan-approval gate)" : `department is ${status}`}
                        onClick={() => onDepartmentStatus(d.key, "active")}>
                        Resume…
                      </button>
                      <button type="button" className="btn px-2 py-0 text-[12px] border-[hsl(var(--alert))] text-[hsl(8_64%_30%)]" disabled={pending || status === "archived"}
                        title={status === "archived" ? "already archived (terminal)" : "archive: drain in-flight work, preserve artifacts (high-risk gate)"}
                        onClick={() => onDepartmentStatus(d.key, "archived")}>
                        Archive…
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ── Schedules tab ────────────────────────────────────────────────

export interface JobCreateForm {
  jobKey: string;
  kind: (typeof ASSISTANT_JOB_KINDS)[number];
  schedule: AssistantJobSchedule;
  enabled: boolean;
  maxRuns: number | null;
}

export function SchedulesPanel({
  jobs,
  now,
  error,
  scope,
  scopeKey,
  pending,
  onCreate,
  onPause,
  onResume,
  onDelete,
  onRunNow,
}: {
  jobs: JobRowLike[];
  now: number;
  error: string | null;
  scope: AssistantScope;
  scopeKey: string;
  pending: boolean;
  onCreate(form: JobCreateForm): void;
  onPause(jobKey: string): void;
  onResume(jobKey: string): void;
  onDelete(jobKey: string): void;
  onRunNow(jobKey: string): void;
}) {
  const [jobKey, setJobKey] = useState("");
  const [kind, setKind] = useState<(typeof ASSISTANT_JOB_KINDS)[number]>("ledger_refresh");
  const [scheduleType, setScheduleType] = useState<"one-time" | "interval">("interval");
  const [runAtLocal, setRunAtLocal] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [maxRunsText, setMaxRunsText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    let schedule: AssistantJobSchedule;
    if (scheduleType === "one-time") {
      const runAt = Date.parse(runAtLocal);
      if (!Number.isFinite(runAt)) {
        setFormError("pick a valid run-at date/time for the one-time schedule");
        return;
      }
      schedule = { type: "one-time", runAt };
    } else {
      const minutes = Number(intervalMinutes);
      if (!Number.isFinite(minutes) || minutes < 1) {
        setFormError("interval must be at least 1 minute (the server clamps to the 1-minute minimum)");
        return;
      }
      schedule = { type: "interval", intervalMs: Math.round(minutes * 60_000), anchorAt: Date.now() };
    }
    const maxRuns = maxRunsText.trim() === "" ? null : Number(maxRunsText);
    if (maxRuns !== null && (!Number.isInteger(maxRuns) || maxRuns <= 0)) {
      setFormError("maxRuns must be a positive integer (or blank for an unbounded interval job)");
      return;
    }
    onCreate({ jobKey: jobKey.trim(), kind, schedule, enabled: true, maxRuns });
  };

  return (
    <div className="grid gap-4" data-testid="donna-schedules-panel">
      <p className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3 text-[12px] text-[hsl(var(--ink-soft))]" data-testid="donna-no-paid-auto">
        {NO_PAID_AUTO_NOTE}
      </p>
      {error ? <ErrorNote message={error} /> : null}

      <section aria-label="Jobs" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Scheduled jobs</span>
        {jobs.length === 0 ? (
          <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">No assistant jobs yet. Create one below — creation requires your explicit approval (plan-approval gate).</p>
        ) : (
          <table className="table-cat mt-2 text-[12px]">
            <thead>
              <tr><th>job</th><th>kind / effect</th><th>schedule</th><th>next run</th><th>runs</th><th>budget</th><th>actions</th></tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const row = deriveJobRow(job, now);
                return (
                  <tr key={job.jobKey} data-testid="donna-job-row">
                    <td>
                      <span className="mono font-bold">{row.jobKey}</span>{" "}
                      <span className={`chip ${row.enabled ? "chip-sage" : "chip-mustard"}`}>{row.enabled ? "enabled" : "paused"}</span>
                    </td>
                    <td>
                      {row.kind} <span className="text-[hsl(var(--ink-soft))]">({row.effect})</span>
                    </td>
                    <td>{row.scheduleText}</td>
                    <td>
                      {row.nextRunAt !== null ? (
                        <>
                          <span className="mono">{new Date(row.nextRunAt).toISOString()}</span>{" "}
                          <span className="chip">{row.countdown}</span>
                        </>
                      ) : (
                        <span className="chip">{row.countdown}</span>
                      )}
                    </td>
                    <td className="mono">{row.runsLabel}</td>
                    <td className="text-[hsl(var(--ink-soft))]">{row.budgetLabel}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {row.enabled ? (
                          <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending} onClick={() => onPause(job.jobKey)}>
                            Pause
                          </button>
                        ) : (
                          <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending} onClick={() => onResume(job.jobKey)}>
                            Resume
                          </button>
                        )}
                        <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending} onClick={() => onRunNow(job.jobKey)}>
                          Run now…
                        </button>
                        <button type="button" className="btn px-2 py-0 text-[12px] border-[hsl(var(--alert))] text-[hsl(8_64%_30%)]" disabled={pending} onClick={() => onDelete(job.jobKey)}>
                          Delete…
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Create job" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">
          Create job at scope {scope}
          {scopeKey ? `:${scopeKey}` : ""}
        </span>
        <form className="mt-2 grid gap-2" onSubmit={submit}>
          <div className="flex flex-wrap gap-2">
            <input className="input w-52 text-[13px]" placeholder="job key" aria-label="job key" value={jobKey} onChange={(e) => setJobKey(e.target.value)} required maxLength={80} />
            <select className="input text-[13px]" aria-label="job kind" value={kind} onChange={(e) => setKind(e.target.value as (typeof ASSISTANT_JOB_KINDS)[number])}>
              {ASSISTANT_JOB_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <select className="input text-[13px]" aria-label="schedule type" value={scheduleType} onChange={(e) => setScheduleType(e.target.value as "one-time" | "interval")}>
              <option value="interval">interval</option>
              <option value="one-time">one-time</option>
            </select>
            {scheduleType === "interval" ? (
              <label className="flex items-center gap-1 text-[13px]">
                every
                <input className="input w-20 text-[13px]" type="number" min={1} aria-label="interval minutes" value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} />
                min
              </label>
            ) : (
              <input className="input text-[13px]" type="datetime-local" aria-label="run at" value={runAtLocal} onChange={(e) => setRunAtLocal(e.target.value)} />
            )}
            <input className="input w-28 text-[13px]" type="number" min={1} placeholder="max runs" aria-label="max runs" value={maxRunsText} onChange={(e) => setMaxRunsText(e.target.value)} />
            <button type="submit" className="btn text-[13px] font-bold" disabled={pending || !jobKey.trim()}>
              Create (approve)…
            </button>
          </div>
          {formError ? <p role="alert" className="text-[12px] text-[hsl(8_64%_30%)]">{formError}</p> : null}
          <p className="text-[12px] text-[hsl(var(--ink-soft))]">
            Missed intervals are never replayed (no catch-up storms); one-time jobs fire at most once.
          </p>
        </form>
      </section>
    </div>
  );
}

// ── Cache tab ────────────────────────────────────────────────────

export function CachePanel({
  namespaces,
  error,
  pending,
  lastResult,
  onInvalidate,
}: {
  namespaces: CacheNamespaceLike[];
  error: string | null;
  pending: boolean;
  lastResult: string | null;
  onInvalidate(namespace: CacheNamespaceLike["namespace"]): void;
}) {
  return (
    <div className="grid gap-4" data-testid="donna-cache-panel">
      <p className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3 text-[12px] text-[hsl(var(--ink-soft))]" data-testid="donna-provider-cache-policy">
        {PROVIDER_CACHE_POLICY}
      </p>
      {error ? <ErrorNote message={error} /> : null}
      {lastResult ? <p className="text-[12px] text-[hsl(var(--ink-soft))]" role="status">{lastResult}</p> : null}
      <section aria-label="Cache namespaces" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Namespaces</span>
        <table className="table-cat mt-2 text-[12px]">
          <thead>
            <tr><th>namespace</th><th>server-side</th><th>status</th><th>actions</th></tr>
          </thead>
          <tbody>
            {namespaces.map((ns) => (
              <tr key={ns.namespace} data-testid="donna-cache-row">
                <td className="mono font-bold">{ns.namespace}</td>
                <td>{ns.serverSide ? <span className="chip chip-sage">server</span> : <span className="chip">derived</span>}</td>
                <td className="text-[hsl(var(--ink-soft))]">{describeCacheNamespace(ns)}</td>
                <td>
                  <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending} onClick={() => onInvalidate(ns.namespace)}>
                    Invalidate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ── Repositories tab ─────────────────────────────────────────────

export interface RepoPreviewLike {
  metadata: {
    url: string;
    owner: string;
    name: string;
    description: string;
    language: string | null;
    topics: string[];
    license: string | null;
    archived: boolean;
    defaultBranch: string;
    commitSha: string;
    visibility: "public" | "private" | "internal";
  };
  plan: {
    status: "assigned" | "quarantined" | "proposed_new_structure";
    companyKey: string | null;
    departmentKey: string | null;
    discipline: string | null;
    skillId: string | null;
    confidence: number;
    rationale: string;
    readOnly: boolean;
    redistributionAllowed: boolean;
    notes: string[];
  };
}

export function RepoPlanBadges({ plan }: { plan: RepoPreviewLike["plan"] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]" data-testid="donna-repo-plan">
      <span
        className={`chip ${plan.status === "assigned" ? "chip-sage" : plan.status === "quarantined" ? "chip-alert" : "chip-mustard"}`}
        data-testid="donna-repo-plan-status"
      >
        {plan.status}
      </span>
      <span className="chip">confidence {(plan.confidence * 100).toFixed(0)}%</span>
      {plan.companyKey ? <span className="chip mono">{plan.companyKey}/{plan.departmentKey}</span> : <span className="chip">no route</span>}
      {plan.skillId ? <span className="chip mono">{plan.skillId}</span> : null}
      <span className={`chip ${plan.readOnly ? "chip-mustard" : ""}`}>{plan.readOnly ? "read-only" : "writable after approval"}</span>
      <span className={`chip ${plan.redistributionAllowed ? "chip-sage" : "chip-alert"}`}>
        redistribution {plan.redistributionAllowed ? "allowed (permissive license)" : "forbidden"}
      </span>
    </div>
  );
}

export function RepositoriesPanel({
  repos,
  error,
  preview,
  previewError,
  previewing,
  importResults,
  pending,
  onPreview,
  onImport,
  onApply,
}: {
  repos: RepoRowLike[];
  error: string | null;
  preview: RepoPreviewLike | null;
  previewError: string | null;
  previewing: boolean;
  importResults: { url: string; ok: boolean; summary: string }[] | null;
  pending: boolean;
  onPreview(url: string): void;
  onImport(urls: string[], mode: GithubIntakeMode, recordId: number | undefined): void;
  onApply(url: string, kind: "assign" | "propose_structure"): void;
}) {
  const [mode, setMode] = useState<GithubIntakeMode>("public-anonymous");
  const [recordIdText, setRecordIdText] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [urlsText, setUrlsText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const controls = deriveIntakeControls(mode);
  const parsed = parseRepoUrls(urlsText);

  const submitImport = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (parsed.urls.length === 0) {
      setFormError("paste at least one repository URL");
      return;
    }
    const recordId = recordIdText.trim() === "" ? undefined : Number(recordIdText);
    if (controls.requiresRecordId && (recordId === undefined || !Number.isInteger(recordId) || recordId <= 0)) {
      setFormError("credentialed-approved intake requires a positive vault record id");
      return;
    }
    onImport(parsed.urls, mode, recordId);
  };

  return (
    <div className="grid gap-4" data-testid="donna-repositories-panel">
      <p className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3 text-[12px] text-[hsl(var(--ink-soft))]" data-testid="donna-repo-no-clone">
        {REPO_NO_CLONE_NOTE}
      </p>
      {error ? <ErrorNote message={error} /> : null}

      <section aria-label="Repository intake" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Intake (confirmed metadata only)</span>
        <div className="mt-2 flex flex-wrap gap-3 text-[13px]" role="radiogroup" aria-label="intake mode">
          {(["public-anonymous", "credentialed-approved"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input type="radio" name="intake-mode" checked={mode === m} onChange={() => setMode(m)} />
              <span className="mono">{m}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">{controls.note}</p>
        {mode === "credentialed-approved" ? (
          <label className="mt-2 flex items-center gap-2 text-[13px]">
            vault record id
            <input className="input w-28 text-[13px]" type="number" min={1} aria-label="vault record id" value={recordIdText} onChange={(e) => setRecordIdText(e.target.value)} />
          </label>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="input min-w-64 flex-1 text-[13px]"
            placeholder="https://github.com/owner/repo"
            aria-label="preview url"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
          />
          <button
            type="button"
            className="btn text-[13px]"
            disabled={previewing || !previewUrl.trim() || !controls.previewEnabled}
            title={controls.previewReason ?? "read-only public preview: inspect + deterministic routing, nothing persisted"}
            onClick={() => onPreview(previewUrl.trim())}
            data-testid="donna-repo-preview-button"
          >
            {previewing ? "Inspecting…" : "Preview (public, no persistence)"}
          </button>
        </div>
        {!controls.previewEnabled && controls.previewReason ? (
          <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]" data-testid="donna-repo-preview-disabled">{controls.previewReason}</p>
        ) : null}
        {previewError ? <ErrorNote message={previewError} /> : null}
        {preview ? (
          <div className="mt-3 border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-3" data-testid="donna-repo-preview">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="mono font-bold">{preview.metadata.owner}/{preview.metadata.name}</span>
              <span className="chip">{preview.metadata.visibility}</span>
              {preview.metadata.archived ? <span className="chip chip-mustard">archived upstream</span> : null}
              <span className="chip">{preview.metadata.license ?? "no license declared"}</span>
              {preview.metadata.language ? <span className="chip">{preview.metadata.language}</span> : null}
              <span className="chip mono" title={preview.metadata.commitSha}>HEAD {preview.metadata.commitSha.slice(0, 10)}…</span>
            </div>
            <div className="mt-2">
              <RepoPlanBadges plan={preview.plan} />
            </div>
            <p className="mt-2 text-[12px] text-[hsl(var(--ink-soft))]">{preview.plan.rationale}</p>
            <ul className="mt-1 list-inside list-disc text-[12px] text-[hsl(var(--ink-soft))]">
              {preview.plan.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <form className="mt-3 grid gap-2" onSubmit={submitImport}>
          <label className="kicker" htmlFor="donna-repo-urls">Import up to 50 repositories</label>
          <textarea
            id="donna-repo-urls"
            className="input min-h-20 text-[13px]"
            placeholder="one URL per line (or whitespace-separated)"
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
          />
          <p className="text-[12px] text-[hsl(var(--ink-soft))]">
            {parsed.urls.length} selected{parsed.duplicates > 0 ? ` · ${parsed.duplicates} duplicate(s) dropped` : ""}
            {parsed.truncated > 0 ? ` · ${parsed.truncated} over the 50 limit ignored` : ""}
          </p>
          {formError ? <p role="alert" className="text-[12px] text-[hsl(8_64%_30%)]">{formError}</p> : null}
          <div>
            <button type="submit" className="btn text-[13px] font-bold" disabled={pending || parsed.urls.length === 0} data-testid="donna-repo-import">
              Import (gates: {controls.gates.join(" + ")})…
            </button>
          </div>
        </form>
        {importResults ? (
          <ul className="mt-2 grid gap-1 text-[12px]" data-testid="donna-repo-import-results">
            {importResults.map((r) => (
              <li key={r.url} className="flex flex-wrap gap-2">
                <span className={`chip ${r.ok ? "chip-sage" : "chip-alert"}`}>{r.ok ? "imported" : "failed"}</span>
                <span className="mono">{r.url}</span>
                <span className="text-[hsl(var(--ink-soft))]">{r.summary}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-label="Repositories" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Imported repositories ({repos.length})</span>
        {repos.length === 0 ? (
          <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">Nothing imported yet. Intake persists confirmed metadata and a deterministic routing plan.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {repos.map((repo) => (
              <li key={repo.id} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2" data-testid="donna-repo-row">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="mono font-bold">{repo.ownerName}/{repo.name}</span>
                  <span className="chip">{repo.visibility}</span>
                  <span className="chip">{repo.license ?? "no license"}</span>
                  {repo.archived ? <span className="chip chip-mustard">archived</span> : null}
                  <span className="chip mono">{repo.intakeMode}</span>
                  <span className="chip mono" title={repo.commitSha}>HEAD {repo.commitSha.slice(0, 10)}…</span>
                </div>
                {repo.plans.length > 0 ? (
                  <ul className="mt-2 grid gap-2">
                    {repo.plans.map((plan) => {
                      const apply = deriveRepoApplyControl(plan);
                      return (
                        <li key={plan.id} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-2">
                          <RepoPlanBadges plan={plan} />
                          <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">{plan.rationale}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="btn px-2 py-0 text-[12px]"
                              disabled={pending || !apply.enabled}
                              title={apply.reason ?? `gates: ${apply.gates.join(" + ")}`}
                              onClick={() => apply.kind && onApply(plan.url, apply.kind)}
                            >
                              {apply.label}
                            </button>
                            {apply.reason ? <span className="text-[12px] text-[hsl(var(--ink-soft))]">{apply.reason}</span> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">No routing plan recorded for this metadata yet.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Knowledge tab (study queue + refs-only transfer) ─────────────

export interface ArtifactOptionLike {
  id: number;
  title: string;
  contentSha256: string | null;
}

export function KnowledgePanel({
  snapshot,
  studyItems,
  transfers,
  artifacts,
  artifactQuery,
  artifactSearchEnabled,
  transferScopeOk,
  transferScopeReason,
  exported,
  pending,
  onArtifactQuery,
  onStudyEnqueue,
  onTransfer,
  onExport,
}: {
  snapshot: SnapshotLike;
  studyItems: StudyItemRowLike[];
  transfers: TransferRowLike[];
  artifacts: ArtifactOptionLike[];
  artifactQuery: string;
  artifactSearchEnabled: boolean;
  /** Knowledge transfers run at department scope (department-coordinator). */
  transferScopeOk: boolean;
  transferScopeReason: string | null;
  exported: string | null;
  pending: boolean;
  onArtifactQuery(query: string): void;
  onStudyEnqueue(skillId: string, goal: string, evaluation: string): void;
  onTransfer(draft: { transferKey: string; from: string; to: string; summary: string; artifactIds: number[] }): void;
  onExport(): void;
}) {
  const skills = useMemo(() => studySkillOptions(snapshot), [snapshot]);
  const [skillId, setSkillId] = useState("");
  const [goal, setGoal] = useState("");
  const [evaluation, setEvaluation] = useState("");
  const [transferKey, setTransferKey] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [transferError, setTransferError] = useState<string | null>(null);
  const studySummary = summarizeStudyItems(studyItems);
  const effectiveSkill = skillId || skills[0] || "";

  const submitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const draft = { transferKey: transferKey.trim(), from: from.trim(), to: to.trim(), summary, artifactIds: selected };
    const err = validateTransferDraft(draft);
    setTransferError(err);
    if (err === null) onTransfer(draft);
  };

  return (
    <div className="grid gap-4" data-testid="donna-knowledge-panel">
      <section aria-label="Study queue" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Study queue (drafts only)</span>
        <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">
          Enqueue builds draft study items from the seeded registry resources of the selected skill — deduped by
          content-derived id, capped at {STUDY_QUEUE_CAP}, never a paid provider call. Approving a study_plan
          schedule (Schedules tab, plan-approval gate) lets the deterministic job create drafts on a cadence.
        </p>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (effectiveSkill && goal.trim()) onStudyEnqueue(effectiveSkill, goal.trim(), evaluation.trim());
          }}
        >
          <select className="input text-[13px]" aria-label="skill" value={effectiveSkill} onChange={(e) => setSkillId(e.target.value)}>
            {skills.length === 0 ? <option value="">no skills in this enterprise</option> : null}
            {skills.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input className="input min-w-56 flex-1 text-[13px]" placeholder="goal (what should be learned)" aria-label="study goal" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={1000} required />
          <input className="input w-48 text-[13px]" placeholder="evaluation (optional)" aria-label="study evaluation" value={evaluation} onChange={(e) => setEvaluation(e.target.value)} maxLength={200} />
          <button type="submit" className="btn text-[13px] font-bold" disabled={pending || !effectiveSkill || !goal.trim()}>
            Enqueue drafts
          </button>
        </form>
        <p className="mt-2 text-[12px] text-[hsl(var(--ink-soft))]" data-testid="donna-study-summary">
          {studySummary.total} item(s): {studySummary.byStatus.draft} draft · {studySummary.byStatus.queued} queued ·{" "}
          {studySummary.byStatus["in-progress"]} in-progress · {studySummary.byStatus.completed} completed · {studySummary.byStatus.dropped} dropped
        </p>
        {studyItems.length > 0 ? (
          <table className="table-cat mt-2 text-[12px]">
            <thead>
              <tr><th>item</th><th>skill</th><th>resource ref</th><th>status</th></tr>
            </thead>
            <tbody>
              {studyItems.slice(0, 50).map((item) => (
                <tr key={item.itemKey} data-testid="donna-study-row">
                  <td className="mono font-bold">{item.itemKey}</td>
                  <td className="mono">{item.skillId}</td>
                  <td className="max-w-72 truncate" title={item.resourceRef}>{item.resourceRef}</td>
                  <td><span className="chip">{item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section aria-label="Knowledge transfer" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Knowledge transfer (refs only)</span>
        <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">
          A handoff is artifact REFERENCES plus a bounded extractive summary, integrity-bound by contentSha256 — never inline content.
        </p>
        {!transferScopeOk && transferScopeReason ? (
          <p className="mt-1 text-[12px] text-[hsl(8_64%_30%)]" data-testid="donna-transfer-scope-note">{transferScopeReason}</p>
        ) : null}
        <form className="mt-2 grid gap-2" onSubmit={submitTransfer}>
          <div className="flex flex-wrap gap-2">
            <input className="input w-44 text-[13px]" placeholder="transfer key (kebab)" aria-label="transfer key" value={transferKey} onChange={(e) => setTransferKey(e.target.value)} maxLength={80} required />
            <input className="input w-40 text-[13px]" placeholder="from (e.g. dept key)" aria-label="handoff from" value={from} onChange={(e) => setFrom(e.target.value)} maxLength={80} required list="donna-handoff-keys" />
            <input className="input w-40 text-[13px]" placeholder="to (e.g. dept key)" aria-label="handoff to" value={to} onChange={(e) => setTo(e.target.value)} maxLength={80} required list="donna-handoff-keys" />
            <datalist id="donna-handoff-keys">
              {snapshot.companies.map((c) => (
                <option key={c.key} value={c.key} />
              ))}
              {snapshot.departments.map((d) => (
                <option key={d.key} value={d.key} />
              ))}
            </datalist>
          </div>
          <textarea className="input min-h-16 text-[13px]" placeholder="bounded extractive handoff summary (≤2000 chars; never raw content)" aria-label="handoff summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />
          <div>
            <label className="kicker" htmlFor="donna-artifact-search">Artifact references ({selected.length}/16 selected)</label>
            <input
              id="donna-artifact-search"
              className="input mt-1 w-full text-[13px]"
              placeholder="search artifacts by title/summary"
              value={artifactQuery}
              onChange={(e) => onArtifactQuery(e.target.value)}
            />
            {!artifactSearchEnabled ? (
              <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">type to search enterprise artifacts</p>
            ) : null}
            {artifacts.length > 0 ? (
              <ul className="mt-1 grid max-h-40 gap-1 overflow-auto border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2 text-[12px]">
                {artifacts.map((a) => {
                  const checked = selected.includes(a.id);
                  const noHash = !a.contentSha256;
                  return (
                    <li key={a.id}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={pending || noHash || (!checked && selected.length >= 16)}
                          title={noHash ? "artifact has no content hash — cannot be referenced" : undefined}
                          onChange={() =>
                            setSelected((prev) => (checked ? prev.filter((id) => id !== a.id) : [...prev, a.id]))
                          }
                        />
                        <span className="font-bold">{a.title}</span>
                        <span className="mono text-[hsl(var(--ink-soft))]">
                          {a.contentSha256 ? `${a.contentSha256.slice(0, 12)}…` : "no hash"}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          {transferError ? <p role="alert" className="text-[12px] text-[hsl(8_64%_30%)]">{transferError}</p> : null}
          <div>
            <button
              type="submit"
              className="btn text-[13px] font-bold"
              disabled={pending || !transferScopeOk}
              title={transferScopeOk ? "create handoff (plan-approval gate)" : (transferScopeReason ?? undefined)}
              data-testid="donna-transfer-submit"
            >
              Create transfer (approve)…
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Transfers" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <div className="flex items-center gap-2">
          <span className="kicker">Transfers ({transfers.length})</span>
          <button type="button" className="btn px-2 py-0 text-[12px]" disabled={pending} onClick={onExport} data-testid="donna-knowledge-export">
            Export handoffs
          </button>
        </div>
        {transfers.length === 0 ? (
          <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">No handoffs recorded yet.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {transfers.map((t) => (
              <li key={t.transferKey} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2 text-[12px]" data-testid="donna-transfer-row">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono font-bold">{t.transferKey}</span>
                  <span className="chip mono">{t.handoff.from} → {t.handoff.to}</span>
                  <span className="chip mono" title={t.contentSha256}>sha {t.contentSha256.slice(0, 12)}…</span>
                </div>
                {t.handoff.summary ? <p className="mt-1 text-[hsl(var(--ink-soft))]">{t.handoff.summary}</p> : null}
                <ul className="mt-1 list-inside list-disc text-[hsl(var(--ink-soft))]">
                  {t.refs.map((r, i) => (
                    <li key={i}>
                      {r.title} <span className="mono">{String(r.contentSha256).slice(0, 12)}…</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {exported ? (
          <pre className="mt-2 max-h-64 overflow-auto border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2 text-[12px]" data-testid="donna-knowledge-export-json">
            {exported}
          </pre>
        ) : null}
      </section>
    </div>
  );
}

// ── Drawer container (real tRPC assistant calls only) ────────────

export default function DonnaDrawer({
  enterpriseId,
  snapshot,
  workers,
  workersError,
  onClose,
  onOpenActivity,
}: {
  enterpriseId: number;
  snapshot: SnapshotLike;
  workers: WorkerRowLike[];
  workersError: string | null;
  onClose(): void;
  onOpenActivity(): void;
}) {
  const utils = trpc.useUtils();
  const now = useNow();
  const [tab, setTab] = useState<DonnaTabId>("queue");
  const [scopeSel, setScopeSel] = useState("enterprise");
  const { scope, scopeKey } = parseScopeValue(scopeSel);
  const scopeOptions = useMemo(() => deriveScopeOptions(snapshot), [snapshot]);

  const [confirm, setConfirm] = useState<ActionConfirmRequest | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [emergency, setEmergency] = useState<ConfirmRequest | null>(null);
  const [directError, setDirectError] = useState<string | null>(null);
  const [cacheNote, setCacheNote] = useState<string | null>(null);
  const [artifactQuery, setArtifactQuery] = useState("");
  const [exported, setExported] = useState<string | null>(null);

  // Close on Escape (focus stays inside via the native tab order).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Queries (pure reads) ──
  const statusQ = useAssistantStatus(enterpriseId, true);
  const proposalsQ = useAssistantProposals(enterpriseId, true);
  const eventsQ = useAssistantEvents(enterpriseId, true);
  const queueQ = useWorkQueue(enterpriseId, scope, scopeKey, tab === "queue");
  const jobsQ = useAssistantJobs(enterpriseId, tab === "schedules");
  const cacheQ = useAssistantCache(enterpriseId, tab === "cache");
  const studyQ = useStudyItems(enterpriseId, tab === "knowledge");
  const reposQ = useRepositories(enterpriseId, tab === "repositories");
  const transfersQ = useKnowledgeTransfers(enterpriseId, tab === "knowledge");
  const artifactsQ = useArtifactPicker(enterpriseId, artifactQuery, tab === "knowledge" && artifactQuery.trim().length > 0);

  const invalidate = () => {
    void utils.assistant.invalidate();
    void utils.enterprise.snapshot.invalidate({ enterpriseId });
    void utils.enterprise.events.invalidate();
  };
  const closeConfirm = () => {
    setConfirm(null);
    setConfirmError(null);
  };
  const confirmOpts = {
    onSuccess: () => {
      invalidate();
      closeConfirm();
    },
    onError: (err: { data?: { code?: string } | null; message: string }) => setConfirmError(describeAssistantError(err)),
  };
  const directOpts = {
    onSuccess: () => {
      invalidate();
      setDirectError(null);
    },
    onError: (err: { data?: { code?: string } | null; message: string }) => setDirectError(describeAssistantError(err)),
  };

  // ── Mutations (explicit human actions through the proposal pipeline) ──
  const decideM = trpc.assistant.decideProposal.useMutation(confirmOpts);
  const executeM = trpc.assistant.executeProposal.useMutation(directOpts);
  const cancelProposalM = trpc.assistant.cancelProposal.useMutation(directOpts);
  const queueAddM = trpc.assistant.queueAdd.useMutation(directOpts);
  const queueReorderM = trpc.assistant.queueReorder.useMutation({
    ...directOpts,
    onError: (err) => {
      setDirectError(describeAssistantError(err));
      void queueQ.refetch(); // OCC conflict: reload the queue the human sees
    },
  });
  const workerHireM = trpc.assistant.workerHire.useMutation(confirmOpts);
  const workerFireM = trpc.assistant.workerFire.useMutation(confirmOpts);
  const workerPauseM = trpc.assistant.workerPause.useMutation(directOpts);
  const workerResumeM = trpc.assistant.workerResume.useMutation(directOpts);
  const setCompanyM = trpc.assistant.setCompanyStatus.useMutation(confirmOpts);
  const setDeptM = trpc.assistant.setDepartmentStatus.useMutation(confirmOpts);
  const pumpM = trpc.assistant.programPump.useMutation(confirmOpts);
  const cacheInvalidateM = trpc.assistant.cacheInvalidate.useMutation({
    onSuccess: (data) => {
      invalidate();
      setCacheNote(data.proposal.resultSummary || `namespace invalidated (proposal ${data.proposal.status})`);
    },
    onError: (err) => setCacheNote(describeAssistantError(err)),
  });
  const jobUpsertM = trpc.assistant.jobUpsert.useMutation(confirmOpts);
  const jobPauseM = trpc.assistant.jobPause.useMutation(directOpts);
  const jobResumeM = trpc.assistant.jobResume.useMutation(directOpts);
  const jobDeleteM = trpc.assistant.jobDelete.useMutation(confirmOpts);
  const jobRunNowM = trpc.assistant.jobRunNow.useMutation(confirmOpts);
  const studyEnqueueM = trpc.assistant.studyEnqueue.useMutation(directOpts);
  const repoPreviewM = trpc.assistant.repoPreview.useMutation({});
  const repoFetchM = trpc.assistant.repoFetch.useMutation(confirmOpts);
  const repoApplyM = trpc.assistant.repoApply.useMutation(confirmOpts);
  const knowledgeTransferM = trpc.assistant.knowledgeTransfer.useMutation(confirmOpts);
  // Emergency stop: the EXISTING direct program cancel path — ungated,
  // immediate, and NEVER an assistant proposal (by contract design).
  const emergencyCancelM = trpc.enterprise.programCancel.useMutation({
    onSuccess: () => {
      invalidate();
      setEmergency(null);
    },
    onError: () => setEmergency(null),
  });

  const pending =
    decideM.isPending || executeM.isPending || cancelProposalM.isPending || queueAddM.isPending ||
    queueReorderM.isPending || workerHireM.isPending || workerFireM.isPending || workerPauseM.isPending ||
    workerResumeM.isPending || setCompanyM.isPending || setDeptM.isPending || pumpM.isPending ||
    cacheInvalidateM.isPending || jobUpsertM.isPending || jobPauseM.isPending || jobResumeM.isPending ||
    jobDeleteM.isPending || jobRunNowM.isPending || studyEnqueueM.isPending || repoFetchM.isPending ||
    repoApplyM.isPending || knowledgeTransferM.isPending;

  /** Open the gate-confirm dialog for an approval-requiring action. */
  const askConfirm = (request: Omit<ActionConfirmRequest, "run"> & { run(confirmedGates: AssistantGate[]): void }) => {
    setConfirmError(null);
    setConfirm(request);
  };

  const program = snapshot.program;
  const emergencyControl = program ? deriveProgramControls(program).find((c) => c.id === "cancel")! : null;

  const proposals = (proposalsQ.data ?? []) as ProposalRowLike[];
  const queueData = queueQ.data as { queue: QueueRowLike | null; items: QueueItemRowLike[] } | undefined;
  const queue = queueData?.queue ?? null;
  const queueItems = queueData?.items ?? [];
  const jobs = (jobsQ.data ?? []) as JobRowLike[];
  const namespaces = (cacheQ.data?.namespaces ?? []) as CacheNamespaceLike[];
  const studyItems = (studyQ.data ?? []) as StudyItemRowLike[];
  const repos = (reposQ.data ?? []) as RepoRowLike[];
  const transfers = (transfersQ.data ?? []) as TransferRowLike[];
  const artifacts = (artifactsQ.data ?? []) as { id: number; title: string; contentSha256: string | null }[];
  const events = (eventsQ.data ?? []) as { seq: number; type: string; actor: string }[];

  // Knowledge transfers execute as the department-coordinator: they need a
  // department (or narrower) scope selected.
  const transferScopeOk = scope === "department" || scope === "office";
  const transferScopeReason = transferScopeOk
    ? null
    : "knowledge transfers run at department scope (the department-coordinator actor) — select a department in the scope selector above";

  return (
    <div data-testid="donna-drawer-root">
      <div className="donna-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="donna-drawer" role="dialog" aria-modal="true" aria-label="Donna — CEO executive assistant" data-testid="donna-drawer">
        <DonnaHeader
          pendingProposals={statusQ.data ? statusQ.data.pendingProposals : null}
          program={program}
          emergencyEnabled={program !== null && (emergencyControl?.enabled ?? false)}
          emergencyReason={program === null ? "no program exists" : (emergencyControl?.reason ?? null)}
          onEmergencyStop={() =>
            program &&
            setEmergency({
              title: "Emergency stop — cancel program",
              body: `This cancels program ${program.id} immediately through the existing direct enterprise.programCancel path (ungated, never an assistant proposal). In-flight runs stop; artifacts and the ledger are preserved.`,
              confirmLabel: "Cancel program now",
              destructive: true,
              run: () => emergencyCancelM.mutate({ programId: program.id }),
            })
          }
          onClose={onClose}
        />

        <div className="mt-3">
          <ScopeSelector options={scopeOptions} value={scopeSel} onChange={setScopeSel} />
        </div>

        <div className="mt-3">
          <ProposalInbox
            proposals={proposals}
            error={describeAssistantError(proposalsQ.error)}
            pending={pending}
            onApprove={(row) =>
              askConfirm({
                title: `Approve ${row.action}`,
                actionId: row.action,
                risk: row.risk,
                scope: row.scope,
                payload: row.payload,
                payloadHash: row.payloadHash,
                expectedVersion: row.expectedVersion,
                requiredGates: requiredGates(row.action),
                confirmLabel: "Approve proposal",
                destructive: row.risk === "high",
                run: (gates) => decideM.mutate({ proposalId: row.id, decision: "approved", confirmedGates: gates }),
              })
            }
            onReject={(row) => decideM.mutate({ proposalId: row.id, decision: "rejected", confirmedGates: [] })}
            onExecute={(row) => executeM.mutate({ proposalId: row.id })}
            onCancelProposal={(row) => cancelProposalM.mutate({ proposalId: row.id })}
          />
        </div>

        {directError ? (
          <div className="mt-3">
            <ErrorNote message={directError} />
          </div>
        ) : null}

        <nav aria-label="Assistant sections" className="mt-4 flex flex-wrap border-b border-[hsl(var(--line))]" role="tablist">
          {DONNA_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="tab-control"
              onClick={() => setTab(t.id)}
              data-testid={`donna-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-4" role="tabpanel" aria-label={DONNA_TABS.find((t) => t.id === tab)?.label}>
          {tab === "queue" ? (
            <QueuePanel
              scope={scope}
              scopeKey={scopeKey}
              queue={queue}
              items={queueItems}
              loading={queueQ.isLoading}
              error={describeAssistantError(queueQ.error)}
              program={program}
              pending={pending}
              onAdd={(form) =>
                queueAddM.mutate({
                  enterpriseId,
                  scope,
                  scopeKey,
                  item: { itemKey: form.itemKey.trim(), itemKind: form.itemKind, refId: form.refId.trim(), title: form.title.trim() },
                })
              }
              onMove={(itemKey, direction) => {
                if (!queue) return;
                const order = buildReorderOrder(queueItems, itemKey, direction);
                if (!order) return;
                queueReorderM.mutate({ enterpriseId, ...buildQueueReorderInput(scope, scopeKey, order, queue.version) });
              }}
              onPump={() =>
                program &&
                askConfirm({
                  title: "Pump program (mock reconcile)",
                  actionId: "program.pump",
                  risk: riskOfAction("program.pump"),
                  scope: "enterprise",
                  payload: { programId: program.id },
                  expectedVersion: program.version,
                  requiredGates: requiredGates("program.pump"),
                  confirmLabel: "Pump (mock only)",
                  note: "The assistant pump dispatches MOCK runs only; live/billed dispatch stays behind the existing run-level gates, which this path never reaches.",
                  run: (gates) =>
                    pumpM.mutate({ enterpriseId, programId: program.id, confirmation: { approved: true, confirmedGates: gates } }),
                })
              }
            />
          ) : null}

          {tab === "hiring" ? (
            <HiringPanel
              snapshot={snapshot}
              workers={workers}
              workersError={workersError}
              pending={pending}
              onHire={(contractKey) =>
                askConfirm({
                  title: `Hire via contract ${contractKey}`,
                  actionId: "worker.hire",
                  risk: riskOfAction("worker.hire"),
                  scope: "enterprise",
                  payload: { contractKey },
                  expectedVersion: snapshot.enterprise.version,
                  requiredGates: requiredGates("worker.hire"),
                  confirmLabel: "Approve hire",
                  run: (gates) => workerHireM.mutate({ enterpriseId, contractKey, confirmation: { approved: true, confirmedGates: gates } }),
                })
              }
              onFire={(contractKey) =>
                askConfirm({
                  title: `Fire via contract ${contractKey}`,
                  actionId: "worker.fire",
                  risk: riskOfAction("worker.fire"),
                  scope: "enterprise",
                  payload: { contractKey, drain: true, preserveArtifacts: true },
                  expectedVersion: snapshot.enterprise.version,
                  requiredGates: requiredGates("worker.fire"),
                  confirmLabel: "Fire (drain + preserve)",
                  destructive: true,
                  note: "In-flight work drains first and artifacts are preserved; the contract is then released.",
                  run: (gates) => workerFireM.mutate({ enterpriseId, contractKey, confirmation: { approved: true, confirmedGates: gates } }),
                })
              }
              onWorkerSuspend={(workerId, suspended) =>
                suspended ? workerPauseM.mutate({ workerId, enterpriseId }) : workerResumeM.mutate({ workerId, enterpriseId })
              }
              onCompanyStatus={(companyKey, status) =>
                askConfirm({
                  title: `Company ${companyKey} → ${status}`,
                  actionId: status === "archived" ? "company.archive" : status === "paused" ? "company.pause" : "company.resume",
                  risk: riskOfAction(status === "archived" ? "company.archive" : status === "paused" ? "company.pause" : "company.resume"),
                  scope: "company",
                  scopeKey: companyKey,
                  payload:
                    status === "archived"
                      ? { companyKey, drain: true, preserveArtifacts: true }
                      : { companyKey },
                  expectedVersion: snapshot.enterprise.version,
                  requiredGates: requiredGates(status === "archived" ? "company.archive" : status === "paused" ? "company.pause" : "company.resume"),
                  confirmLabel: `Confirm ${status}`,
                  destructive: status === "archived",
                  note: status === "archived" ? "Archive drains borrowing contracts and preserves artifacts; archived is terminal." : null,
                  run: (gates) => setCompanyM.mutate({ enterpriseId, companyKey, status, confirmation: { approved: true, confirmedGates: gates } }),
                })
              }
              onDepartmentStatus={(departmentKey, status) =>
                askConfirm({
                  title: `Department ${departmentKey} → ${status}`,
                  actionId: status === "archived" ? "department.archive" : status === "paused" ? "department.pause" : "department.resume",
                  risk: riskOfAction(status === "archived" ? "department.archive" : status === "paused" ? "department.pause" : "department.resume"),
                  scope: "department",
                  scopeKey: departmentKey,
                  payload:
                    status === "archived"
                      ? { departmentKey, drain: true, preserveArtifacts: true }
                      : { departmentKey },
                  expectedVersion: snapshot.enterprise.version,
                  requiredGates: requiredGates(status === "archived" ? "department.archive" : status === "paused" ? "department.pause" : "department.resume"),
                  confirmLabel: `Confirm ${status}`,
                  destructive: status === "archived",
                  note: status === "archived" ? "Archive drains in-flight work and preserves artifacts; archived is terminal." : null,
                  run: (gates) => setDeptM.mutate({ enterpriseId, departmentKey, status, confirmation: { approved: true, confirmedGates: gates } }),
                })
              }
            />
          ) : null}

          {tab === "schedules" ? (
            <SchedulesPanel
              jobs={jobs}
              now={now}
              error={describeAssistantError(jobsQ.error)}
              scope={scope}
              scopeKey={scopeKey}
              pending={pending}
              onCreate={(form) =>
                askConfirm({
                  title: `Create job ${form.jobKey}`,
                  actionId: "schedule.upsert",
                  risk: riskOfAction("schedule.upsert"),
                  scope,
                  scopeKey,
                  payload: { jobKey: form.jobKey, scopeKey, kind: form.kind, schedule: form.schedule, enabled: form.enabled, maxRuns: form.maxRuns },
                  expectedVersion: snapshot.enterprise.version,
                  requiredGates: requiredGates("schedule.upsert"),
                  confirmLabel: "Approve schedule",
                  note: NO_PAID_AUTO_NOTE,
                  run: (gates) =>
                    jobUpsertM.mutate({
                      enterpriseId,
                      scope,
                      scopeKey,
                      jobKey: form.jobKey,
                      kind: form.kind,
                      schedule: form.schedule,
                      enabled: form.enabled,
                      maxRuns: form.maxRuns,
                      confirmation: { approved: true, confirmedGates: gates },
                    }),
                })
              }
              onPause={(jobKey) => jobPauseM.mutate({ enterpriseId, jobKey })}
              onResume={(jobKey) => jobResumeM.mutate({ enterpriseId, jobKey })}
              onDelete={(jobKey) =>
                askConfirm({
                  title: `Delete job ${jobKey}`,
                  actionId: "schedule.delete",
                  risk: riskOfAction("schedule.delete"),
                  scope,
                  scopeKey,
                  payload: { jobKey },
                  requiredGates: requiredGates("schedule.delete"),
                  confirmLabel: "Delete schedule",
                  destructive: true,
                  run: () => jobDeleteM.mutate({ enterpriseId, jobKey }),
                })
              }
              onRunNow={(jobKey) =>
                askConfirm({
                  title: `Run job ${jobKey} now`,
                  actionId: "schedule.run_now",
                  risk: riskOfAction("schedule.run_now"),
                  scope,
                  scopeKey,
                  payload: { jobKey },
                  requiredGates: requiredGates("schedule.run_now"),
                  confirmLabel: "Run once now",
                  note: NO_PAID_AUTO_NOTE,
                  run: (gates) => jobRunNowM.mutate({ enterpriseId, jobKey, confirmation: { approved: true, confirmedGates: gates } }),
                })
              }
            />
          ) : null}

          {tab === "cache" ? (
            <CachePanel
              namespaces={namespaces}
              error={describeAssistantError(cacheQ.error)}
              pending={pending}
              lastResult={cacheNote}
              onInvalidate={(namespace) => cacheInvalidateM.mutate({ enterpriseId, namespace })}
            />
          ) : null}

          {tab === "repositories" ? (
            <RepositoriesPanel
              repos={repos}
              error={describeAssistantError(reposQ.error)}
              preview={(repoPreviewM.data as RepoPreviewLike | undefined) ?? null}
              previewError={describeAssistantError(repoPreviewM.error)}
              previewing={repoPreviewM.isPending}
              importResults={(repoFetchM.data as { results: { url: string; ok: boolean; summary: string }[] } | undefined)?.results ?? null}
              pending={pending}
              onPreview={(url) => repoPreviewM.mutate({ repoUrl: url })}
              onImport={(urls, mode, recordId) =>
                askConfirm({
                  title: `Import ${urls.length} repositor${urls.length === 1 ? "y" : "ies"} (${mode})`,
                  actionId: "repository.import",
                  risk: riskOfAction("repository.import"),
                  scope: "enterprise",
                  payload: { urls, intakeMode: mode, ...(recordId !== undefined ? { recordId } : {}) },
                  expectedVersion: snapshot.enterprise.version,
                  requiredGates: requiredGates("repository.import"),
                  confirmLabel: "Import metadata",
                  note: REPO_NO_CLONE_NOTE,
                  run: (gates) =>
                    repoFetchM.mutate({
                      enterpriseId,
                      urls,
                      intakeMode: mode,
                      ...(recordId !== undefined ? { recordId } : {}),
                      confirmation: { approved: true, confirmedGates: gates },
                    }),
                })
              }
              onApply={(url, kind) =>
                askConfirm({
                  title: `${kind === "assign" ? "Apply assignment" : "Approve new structure"} for ${url}`,
                  actionId: kind === "assign" ? "repository.assign" : "repository.propose_structure",
                  risk: riskOfAction(kind === "assign" ? "repository.assign" : "repository.propose_structure"),
                  scope: "enterprise",
                  payload: { url },
                  expectedVersion: snapshot.enterprise.version,
                  requiredGates: requiredGates(kind === "assign" ? "repository.assign" : "repository.propose_structure"),
                  confirmLabel: kind === "assign" ? "Apply assignment" : "Approve new structure",
                  destructive: kind === "propose_structure",
                  note:
                    kind === "propose_structure"
                      ? "Explicit low-confidence proposal only — approving never auto-creates companies, departments, or roles."
                      : null,
                  run: (gates) => repoApplyM.mutate({ enterpriseId, url, kind, confirmation: { approved: true, confirmedGates: gates } }),
                })
              }
            />
          ) : null}

          {tab === "knowledge" ? (
            <KnowledgePanel
              snapshot={snapshot}
              studyItems={studyItems}
              transfers={transfers}
              artifacts={artifacts}
              artifactQuery={artifactQuery}
              artifactSearchEnabled={artifactQuery.trim().length > 0}
              transferScopeOk={transferScopeOk}
              transferScopeReason={transferScopeReason}
              exported={exported}
              pending={pending}
              onArtifactQuery={setArtifactQuery}
              onStudyEnqueue={(skillId, goal, evaluation) =>
                studyEnqueueM.mutate({ enterpriseId, skillId, goal, ...(evaluation ? { evaluation } : {}) })
              }
              onTransfer={(draft) =>
                askConfirm({
                  title: `Knowledge transfer ${draft.transferKey}`,
                  actionId: "knowledge.transfer",
                  risk: riskOfAction("knowledge.transfer"),
                  scope,
                  scopeKey,
                  payload: { ...draft, scopeKey },
                  expectedVersion: snapshot.enterprise.version,
                  requiredGates: requiredGates("knowledge.transfer"),
                  confirmLabel: "Approve handoff",
                  note: "Refs only: artifact references plus a bounded extractive summary, integrity-bound by contentSha256.",
                  run: (gates) =>
                    knowledgeTransferM.mutate({
                      enterpriseId,
                      scope,
                      scopeKey,
                      transferKey: draft.transferKey,
                      artifactIds: draft.artifactIds,
                      from: draft.from,
                      to: draft.to,
                      summary: draft.summary,
                      confirmation: { approved: true, confirmedGates: gates },
                    }),
                })
              }
              onExport={async () => {
                const rows = await utils.assistant.knowledgeExport.fetch({ enterpriseId });
                setExported(JSON.stringify(rows, null, 2));
              }}
            />
          ) : null}
        </div>

        <footer className="mt-4 grid gap-2 border-t border-[hsl(var(--line))] pt-3" data-testid="donna-footer">
          <div className="flex flex-wrap items-center gap-2">
            <span className="kicker">Assistant events</span>
            <button type="button" className="btn px-2 py-0 text-[12px]" onClick={onOpenActivity} data-testid="donna-open-activity">
              Open ledger &amp; audit (Activity section)
            </button>
            <a className="btn px-2 py-0 text-[12px]" href="#/director/approvals" data-testid="donna-approvals-link">
              Global approvals
            </a>
          </div>
          {events.length === 0 ? (
            <p className="text-[12px] text-[hsl(var(--ink-soft))]">No assistant events yet — proposals, executions, and lifecycle changes append here (and to the audit log).</p>
          ) : (
            <ul className="grid gap-1 text-[12px]">
              {events.slice(-8).map((e) => (
                <li key={e.seq} className="flex flex-wrap gap-2">
                  <span className="mono text-[hsl(var(--ink-soft))]">#{e.seq}</span>
                  <span className="mono font-bold">{e.type}</span>
                  <span className="text-[hsl(var(--ink-soft))]">by {e.actor}</span>
                </li>
              ))}
            </ul>
          )}
        </footer>
      </aside>

      <ActionConfirmDialog request={confirm} pending={pending} error={confirmError} onClose={closeConfirm} />
      <ConfirmDialog request={emergency} pending={emergencyCancelM.isPending} onClose={() => setEmergency(null)} />
    </div>
  );
}
