import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { ErrorNote } from "./DirectorShell";

/** Skills registry, approvals inbox, and owner settings (pricing). */
export function SkillsPanel() {
  const utils = trpc.useUtils();
  const skillsQ = trpc.registry.skills.useQuery();
  const registerM = trpc.registry.registerSkill.useMutation({
    onSuccess: () => void utils.registry.skills.invalidate(),
  });
  const statusM = trpc.registry.setSkillStatus.useMutation({
    onSuccess: () => void utils.registry.skills.invalidate(),
  });
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});

  if (skillsQ.error) return <ErrorNote message={skillsQ.error.message} />;

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Skill registry</h1>
      <p className="prose-evidence mt-1 text-sm text-[hsl(var(--ink-soft))]">
        Seeded curated packages are vetted; pasted/uploaded SKILL.md text is
        parsed, hashed, inventoried, and <b>quarantined</b> — never executed.
        Only vetted skills can be assigned to live runs.
      </p>

      <div className="mt-4 grid gap-2">
        {(skillsQ.data ?? []).map((s) => (
          <article key={s.id} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <b>
                {s.name}@{s.version}
              </b>
              <span className={`chip ${s.status === "vetted" ? "chip-sage" : "chip-mustard"}`}>{s.status}</span>
              <span className="mono text-xs">{s.contentSha256.slice(0, 12)}</span>
              <span className="text-xs text-[hsl(var(--ink-soft))]">{s.fileCount} files</span>
            </div>
            <p className="prose-evidence mt-1 text-sm">{s.description}</p>
            {s.riskSignals.length ? (
              <p className="mt-1 text-xs">
                Risk signals: {s.riskSignals.map((r) => r.kind).join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">No risk signals detected.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                aria-label={`review note for ${s.name}`}
                placeholder="review note (required)"
                value={notes[s.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
                className="border border-[hsl(var(--line))] bg-transparent p-1 text-xs"
              />
              {s.status === "quarantined" ? (
                <button
                  type="button"
                  className="tab-control text-xs"
                  disabled={(notes[s.id] ?? "").length < 3}
                  onClick={() => statusM.mutate({ id: s.id, status: "vetted", note: notes[s.id]! })}
                >
                  Vet
                </button>
              ) : null}
              {s.status === "vetted" ? (
                <button
                  type="button"
                  className="tab-control text-xs"
                  disabled={(notes[s.id] ?? "").length < 3}
                  onClick={() => statusM.mutate({ id: s.id, status: "deprecated", note: notes[s.id]! })}
                >
                  Deprecate
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-extrabold tracking-tight">Register a skill draft</h2>
      <form
        className="mt-3 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          registerM.mutate({ content });
        }}
      >
        <textarea
          aria-label="SKILL.md content"
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste SKILL.md text here (goes to quarantine; nothing is executed)"
          className="w-full border border-[hsl(var(--line))] bg-transparent p-2 text-sm"
        />
        {registerM.error ? <ErrorNote message={registerM.error.message} /> : null}
        {registerM.data ? (
          <p className="text-sm">
            Quarantined: sha256 {registerM.data.contentSha256.slice(0, 16)}… · risk signals:{" "}
            {registerM.data.riskSignals.map((r) => r.kind).join(", ") || "none"}
          </p>
        ) : null}
        <div>
          <button type="submit" className="tab-control text-xs" disabled={registerM.isPending}>
            Register as quarantined draft
          </button>
        </div>
      </form>
    </div>
  );
}

export function ApprovalsPanel() {
  const pendingQ = trpc.approvals.listPending.useQuery({}, { refetchInterval: 3000 });
  const decideM = trpc.approvals.decide.useMutation({
    onSuccess: () => void pendingQ.refetch(),
  });
  if (pendingQ.error) return <ErrorNote message={pendingQ.error.message} />;
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Approvals</h1>
      <div className="mt-4 grid gap-2">
        {(pendingQ.data ?? []).map((a) => (
          <div key={a.id} className="border border-[hsl(var(--line))] p-3 text-sm">
            <p>
              <b>{a.kind}</b> · run #{a.runId} ({a.projectName}, {a.runState})
              {a.nodeKey ? ` · node ${a.nodeKey}` : ""}
            </p>
            <pre className="mono mt-1 max-h-28 overflow-auto bg-[hsl(var(--paper-raised))] p-2 text-xs">
              {JSON.stringify(a.payload, null, 1).slice(0, 600)}
            </pre>
            <div className="mt-2 flex gap-2">
              <button type="button" className="tab-control text-xs" onClick={() => decideM.mutate({ approvalId: a.id, decision: "approved" })}>
                Approve
              </button>
              <button type="button" className="tab-control text-xs" onClick={() => decideM.mutate({ approvalId: a.id, decision: "rejected" })}>
                Reject
              </button>
            </div>
          </div>
        ))}
        {pendingQ.data?.length === 0 ? (
          <p className="text-sm text-[hsl(var(--ink-soft))]">No pending approvals.</p>
        ) : null}
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const utils = trpc.useUtils();
  const pricingQ = trpc.ai.pricing.useQuery();
  const providersQ = trpc.ai.providers.useQuery();
  const setM = trpc.ai.setPricing.useMutation({
    onSuccess: () => void utils.ai.pricing.invalidate(),
  });
  const [form, setForm] = useState({
    provider: "gateway" as "mock" | "gateway" | "openai" | "anthropic",
    model: "",
    inputUsdPerMillion: "0",
    outputUsdPerMillion: "0",
  });
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
      <h2 className="mt-4 text-sm font-bold">Provider availability</h2>
      <ul className="mt-2 grid gap-1 text-sm">
        {(providersQ.data ?? []).map((p) => (
          <li key={p.id}>
            <span className={`chip ${p.configured ? "chip-sage" : "chip"}`}>
              {p.id}: {p.configured ? "configured" : "unconfigured"}
            </span>{" "}
            {p.reason ? <span className="text-xs text-[hsl(var(--ink-soft))]">{p.reason}</span> : null}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-sm font-bold">Owner pricing rates (USD per million tokens)</h2>
      <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
        Dollar budgets are enforced from these rates. Without pricing for a
        selected live model, cost-capped live dispatch is blocked rather than
        guessed. Mock mode uses clearly labeled deterministic simulated cents.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          setM.mutate({
            provider: form.provider,
            model: form.model,
            inputUsdPerMillion: Number(form.inputUsdPerMillion),
            outputUsdPerMillion: Number(form.outputUsdPerMillion),
          });
        }}
      >
        <label>
          Provider
          <select
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value as typeof form.provider })}
            className="ml-1 border border-[hsl(var(--line))] bg-transparent p-1"
          >
            {["gateway", "openai", "anthropic"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Model
          <input
            required
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="ml-1 border border-[hsl(var(--line))] bg-transparent p-1"
          />
        </label>
        <label>
          input $/M
          <input
            required
            type="number"
            step="any"
            min={0}
            value={form.inputUsdPerMillion}
            onChange={(e) => setForm({ ...form, inputUsdPerMillion: e.target.value })}
            className="ml-1 w-24 border border-[hsl(var(--line))] bg-transparent p-1"
          />
        </label>
        <label>
          output $/M
          <input
            required
            type="number"
            step="any"
            min={0}
            value={form.outputUsdPerMillion}
            onChange={(e) => setForm({ ...form, outputUsdPerMillion: e.target.value })}
            className="ml-1 w-24 border border-[hsl(var(--line))] bg-transparent p-1"
          />
        </label>
        <button type="submit" className="tab-control">
          Save rate
        </button>
      </form>
      {setM.error ? <ErrorNote message={setM.error.message} /> : null}
      <ul className="mt-3 grid gap-1 text-sm">
        {(pricingQ.data ?? []).map((r) => (
          <li key={`${r.provider}:${r.model}`}>
            <span className="mono text-xs">
              {r.provider}/{r.model}: in ${r.inputUsdPerMillion}/M · out ${r.outputUsdPerMillion}/M ({r.source})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
