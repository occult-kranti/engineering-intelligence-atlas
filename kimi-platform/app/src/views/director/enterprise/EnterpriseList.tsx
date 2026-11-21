import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { navigate } from "@/lib/utils";
import { fmt, fmtUsd } from "@/lib/format";
import { ErrorNote } from "../DirectorShell";
import { useEnterpriseList } from "./useEnterpriseData";
import {
  buildApplyInput,
  defaultEnterpriseBudget,
  defaultProgramId,
  type BlueprintFormInput,
} from "./adapter";

/**
 * CEO enterprise list + the create → preview → confirm-apply flow.
 * The apply is hash-pinned: the human previews the deterministic blueprint,
 * explicitly confirms the exact blueprintHash + payloadHash, and only then
 * does enterprise.applyBlueprint materialize companies / departments /
 * contracts (idempotent on blueprintHash; a replay returns the existing
 * program instead of duplicating).
 */
export default function EnterpriseList() {
  const list = useEnterpriseList();
  const [createOpen, setCreateOpen] = useState(false);

  if (list.error) {
    return (
      <ErrorNote
        message={`enterprises could not be loaded (${list.error.message}). The Director API may be unavailable; the public atlas still works.`}
      />
    );
  }

  const enterprises = list.data ?? [];

  return (
    <div className="dw">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Enterprises</h1>
          <p className="prose-evidence mt-1 max-w-2xl text-[14px] text-[hsl(var(--ink-soft))]">
            CEO mode: one enterprise groups line companies and a shared-services
            company under a hard budget envelope. A blueprint materializes
            companies, departments, and cross-company worker contracts from a
            single deterministic snapshot — company plans still require human
            approval before anything runs.
          </p>
        </div>
        <button
          type="button"
          className="btn ml-auto border-[hsl(var(--ink))] text-[14px] font-bold"
          onClick={() => setCreateOpen(true)}
        >
          New enterprise
        </button>
      </div>

      {list.isLoading ? (
        <div className="mt-6 grid gap-3" aria-label="Loading enterprises">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))]"
            />
          ))}
        </div>
      ) : enterprises.length ? (
        <ol className="mt-6 grid gap-3" aria-label="Enterprises">
          {enterprises.map((e) => (
            <li key={e.id}>
              <article className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <a
                    href={`#/director/enterprises/${e.id}`}
                    className="text-[16px] font-bold underline"
                  >
                    {e.name}
                  </a>
                  <span className="chip">{e.status}</span>
                  <span className="chip mono">program {e.slug}</span>
                  <span className="chip mono">v{e.version}</span>
                </div>
                <p className="prose-evidence mt-1 text-[14px]">{e.goal}</p>
                <p className="mt-2 text-[12px] text-[hsl(var(--ink-soft))]">
                  Envelope: {fmt(e.budget.maxTokens)} tokens · {fmt(e.budget.maxCalls)} calls ·{" "}
                  {e.budget.maxMinutes} min · {fmtUsd(e.budget.maxCostUsdMicros)} · concurrency cap{" "}
                  {e.maxConcurrentRuns}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="btn text-[13px]" href={`#/director/enterprises/${e.id}`}>
                    Open CEO dashboard
                  </a>
                </div>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-8 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-8 text-center">
          <h2 className="text-lg font-extrabold">No enterprises yet</h2>
          <p className="prose-evidence mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[hsl(var(--ink-soft))]">
            Create the first enterprise from the creative_technology_group
            preset: four line companies plus shared services, seven shared
            departments, and nine deterministic contracts. Nothing runs until
            you approve the blueprint hash and then each company plan.
          </p>
          <button
            type="button"
            className="btn mt-4 border-[hsl(var(--ink))] text-[14px] font-bold"
            onClick={() => setCreateOpen(true)}
          >
            Create the first enterprise
          </button>
        </div>
      )}

      <CreateEnterpriseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

// ── Create → preview → confirmed apply ────────────────────────────

function CreateEnterpriseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const utils = trpc.useUtils();
  const defaults = useMemo(() => defaultEnterpriseBudget(), []);
  const [name, setName] = useState("Creative Technology Group");
  const [programId, setProgramId] = useState("ctg-program");
  const [programIdTouched, setProgramIdTouched] = useState(false);
  const [mission, setMission] = useState("");
  const [maxTokens, setMaxTokens] = useState(String(defaults.maxTokens));
  const [maxCalls, setMaxCalls] = useState(String(defaults.maxCalls));
  const [maxMinutes, setMaxMinutes] = useState(String(defaults.maxMinutes));
  const [maxCostUsd, setMaxCostUsd] = useState("25.00");
  const [maxReplans, setMaxReplans] = useState("2");
  const [maxConcurrentRuns, setMaxConcurrentRuns] = useState("4");
  // The confirmation binds to a specific hash — editing the form (and thus
  // the previewed blueprint) invalidates it automatically.
  const [confirmedHash, setConfirmedHash] = useState<string | null>(null);

  const formInput: BlueprintFormInput | null = useMemo(() => {
    const budget = {
      maxTokens: Number(maxTokens),
      maxCalls: Number(maxCalls),
      maxMinutes: Number(maxMinutes),
      maxCostUsdMicros: Math.round(Number(maxCostUsd) * 1_000_000),
    };
    if (
      !/^[a-z][a-z0-9-]*$/.test(programId) ||
      !name.trim() ||
      !mission.trim() ||
      !Number.isInteger(budget.maxTokens) ||
      budget.maxTokens <= 0 ||
      !Number.isInteger(budget.maxCalls) ||
      budget.maxCalls <= 0 ||
      !(budget.maxMinutes > 0) ||
      !Number.isInteger(budget.maxCostUsdMicros) ||
      budget.maxCostUsdMicros <= 0
    ) {
      return null;
    }
    return {
      preset: "creative_technology_group",
      programId,
      name: name.trim(),
      mission: mission.trim(),
      budget,
      maxReplans: Math.max(0, Math.min(10, Math.floor(Number(maxReplans) || 0))),
      maxConcurrentRuns: Math.max(1, Math.min(4, Math.floor(Number(maxConcurrentRuns) || 1))),
    };
  }, [name, programId, mission, maxTokens, maxCalls, maxMinutes, maxCostUsd, maxReplans, maxConcurrentRuns]);

  const previewQ = trpc.enterprise.preview.useQuery(formInput ?? ({} as never), {
    retry: false,
    enabled: open && formInput !== null,
  });

  const applyM = trpc.enterprise.applyBlueprint.useMutation({
    onSuccess: (result) => {
      void utils.enterprise.list.invalidate();
      onOpenChange(false);
      navigate(`#/director/enterprises/${result.enterpriseId}`);
    },
  });

  const preview = previewQ.data ?? null;
  const confirmed = preview !== null && confirmedHash === preview.blueprintHash;
  const [hashError, setHashError] = useState<string | null>(null);
  const drift =
    applyM.error && /drift|changed since preview/i.test(applyM.error.message);

  const resetConfirm = () => setConfirmedHash(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetConfirm();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New enterprise — creative_technology_group</DialogTitle>
          <DialogDescription>
            The blueprint is generated deterministically from this goal, budget,
            and the vetted skill registry (no provider calls). Review the exact
            hashes, confirm explicitly, then apply. Company plans stay
            unapproved drafts — each company run still needs human plan
            approval in its project workspace, and programs dispatch mock runs
            only (live billing is never auto-started).
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!preview || !confirmed) return;
            try {
              applyM.mutate(buildApplyInput(preview));
            } catch (err) {
              // buildApplyInput refuses on hash mismatch; surface honestly.
              applyM.reset();
              resetConfirm();
              setHashError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-bold">
              Enterprise name
              <input
                required
                maxLength={255}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!programIdTouched) setProgramId(defaultProgramId(e.target.value));
                }}
                className="input mt-1 text-[13px]"
              />
            </label>
            <label className="text-[13px] font-bold">
              Program id (kebab-case)
              <input
                required
                maxLength={64}
                pattern="[a-z][a-z0-9-]*"
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  setProgramIdTouched(true);
                }}
                className="input mono mt-1 text-[13px]"
                aria-invalid={!/^[a-z][a-z0-9-]*$/.test(programId)}
              />
            </label>
          </div>
          <label className="text-[13px] font-bold">
            Mission / goal
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              className="input mt-1 text-[13px]"
              placeholder="What this group of companies exists to deliver…"
            />
          </label>

          <fieldset className="grid gap-2 border border-[hsl(var(--line))] p-3">
            <legend className="kicker px-1">Hard budget envelope</legend>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-[12px] font-bold">
                Max tokens
                <input required type="number" min={1} step={1} value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} className="input mt-1 text-[13px]" />
              </label>
              <label className="text-[12px] font-bold">
                Max calls
                <input required type="number" min={1} step={1} value={maxCalls} onChange={(e) => setMaxCalls(e.target.value)} className="input mt-1 text-[13px]" />
              </label>
              <label className="text-[12px] font-bold">
                Max minutes
                <input required type="number" min={0.001} step="any" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value)} className="input mt-1 text-[13px]" />
              </label>
              <label className="text-[12px] font-bold">
                Max cost (USD)
                <input required type="number" min={0.01} step="0.01" value={maxCostUsd} onChange={(e) => setMaxCostUsd(e.target.value)} className="input mt-1 text-[13px]" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] font-bold">
                Max replans (0–10)
                <input required type="number" min={0} max={10} step={1} value={maxReplans} onChange={(e) => setMaxReplans(e.target.value)} className="input mt-1 text-[13px]" />
              </label>
              <label className="text-[12px] font-bold">
                Max concurrent company runs (1–4)
                <input required type="number" min={1} max={4} step={1} value={maxConcurrentRuns} onChange={(e) => setMaxConcurrentRuns(e.target.value)} className="input mt-1 text-[13px]" />
              </label>
            </div>
          </fieldset>

          {/* Preview: deterministic snapshot of what apply will create. */}
          <section aria-label="Blueprint preview" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-3">
            <span className="kicker">Preview — exact materialization</span>
            {formInput === null ? (
              <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
                Complete all fields with valid values to generate the preview.
              </p>
            ) : previewQ.isLoading ? (
              <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]" role="status">
                Generating deterministic blueprint…
              </p>
            ) : previewQ.error ? (
              <p className="mt-2 text-[13px] text-[hsl(8_64%_30%)]" role="alert">
                Preview failed: {previewQ.error.message}
              </p>
            ) : preview ? (
              <div className="mt-2 grid gap-2 text-[13px]">
                <div className="flex flex-wrap gap-1.5">
                  <span className="chip">{preview.blueprint.companies.length} companies</span>
                  <span className="chip">{preview.blueprint.departments.length} shared departments</span>
                  <span className="chip">{preview.blueprint.contracts.length} contracts</span>
                  <span className="chip chip-sage">
                    {preview.blueprint.contracts.filter((w) => w.staffed).length} staffed
                  </span>
                  <span className="chip chip-mustard">
                    {preview.blueprint.contracts.filter((w) => !w.staffed).length} unstaffed
                  </span>
                </div>
                <dl className="grid gap-1">
                  <div className="flex flex-wrap gap-2">
                    <dt className="font-bold">blueprintHash</dt>
                    <dd className="mono break-all text-[12px]">{preview.blueprintHash}</dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="font-bold">payloadHash</dt>
                    <dd className="mono break-all text-[12px]">{preview.payloadHash}</dd>
                  </div>
                </dl>
                <ul className="grid gap-1" aria-label="Company drafts">
                  {preview.plan.dagDrafts.map((d) => (
                    <li key={d.companyKey} className="text-[12px] text-[hsl(var(--ink-soft))]">
                      <span className="mono font-bold text-[hsl(var(--ink))]">{d.companyKey}</span>
                      {" — "}
                      {d.nodes.length} plan node(s), created as an UNAPPROVED draft
                      {d.unstaffedContracts.length
                        ? `; unstaffed: ${d.unstaffedContracts.join(", ")}`
                        : ""}
                    </li>
                  ))}
                </ul>
                <label className="mt-1 flex items-start gap-2 border border-[hsl(var(--mustard))] bg-[hsl(var(--paper-raised))] p-2 text-[13px] font-bold">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmed}
                    onChange={(e) =>
                      setConfirmedHash(e.target.checked && preview ? preview.blueprintHash : null)
                    }
                  />
                  <span>
                    I approve materializing exactly this blueprint — hash{" "}
                    <span className="mono">{preview.blueprintHash.slice(0, 16)}…</span> — into five
                    company projects with unapproved plan drafts. Any registry
                    drift aborts with a conflict instead of a silent re-sign.
                  </span>
                </label>
              </div>
            ) : null}
          </section>

          {hashError ? <ErrorNote message={hashError} /> : null}
          {applyM.error ? (
            <ErrorNote
              message={
                drift
                  ? `${applyM.error.message} Re-preview is required — the registry changed between preview and apply.`
                  : applyM.error.message
              }
            />
          ) : null}
          {applyM.data?.replayed ? (
            <p className="text-[12px] text-[hsl(var(--ink-soft))]">
              This blueprint hash was already applied — the existing program was returned
              (idempotent replay, nothing duplicated).
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="btn border-[hsl(var(--ink))] text-[13px] font-bold"
              disabled={!preview || !confirmed || applyM.isPending || previewQ.isFetching}
              title={
                !preview
                  ? "Preview first"
                  : !confirmed
                    ? "Confirm the exact blueprint hash first"
                    : undefined
              }
            >
              {applyM.isPending ? "Applying…" : "Apply blueprint"}
            </button>
            <button type="button" className="btn text-[13px]" onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            {previewQ.isFetching && preview ? (
              <span className="self-center text-[12px] text-[hsl(var(--ink-soft))]" role="status">
                refreshing preview…
              </span>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
