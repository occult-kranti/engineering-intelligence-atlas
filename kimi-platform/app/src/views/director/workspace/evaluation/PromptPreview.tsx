import { useState } from "react";
import { PromptBudgetSchema, STRATEGY_IDS } from "@contracts/prompting";
import type { CompiledPrompt, PromptCompilerInput, StrategyId } from "./evalTypes";
import { exampleCompilerInput, fmtInt } from "./evalTypes";

/**
 * Compiled-prompt preview: dry-runs the real prompt compiler (no provider
 * call) and shows the concise execution plan, resource ordering, and every
 * truncation/redaction/degradation event. No chain-of-thought is requested,
 * shown, or transported anywhere — plans are brief action summaries only.
 */

const EXAMPLE_SHA_PLACEHOLDER = "a".repeat(64);

export function PromptPreviewForm({
  onCompile,
  pending,
}: {
  onCompile(input: PromptCompilerInput): void;
  pending?: boolean;
}) {
  const [goal, setGoal] = useState("");
  const [role, setRole] = useState("Research Scientist");
  const [skillName, setSkillName] = useState("");
  const [skillVersion, setSkillVersion] = useState("1.0.0");
  const [skillSha, setSkillSha] = useState("");
  const [skillBody, setSkillBody] = useState("");
  const [artifactType, setArtifactType] = useState("brief");
  const [sections, setSections] = useState("summary, evidence, limitations");
  const [strategy, setStrategy] = useState<StrategyId>("direct_structured");
  const [resourcesJson, setResourcesJson] = useState("[]");
  const [formError, setFormError] = useState<string | null>(null);

  const fillExample = () => {
    const ex = exampleCompilerInput();
    setGoal(ex.goal);
    setRole(ex.role);
    setSkillName(ex.skill.pin.name);
    setSkillVersion(ex.skill.pin.version);
    setSkillSha(ex.skill.pin.sha256);
    setSkillBody(ex.skill.body);
    setArtifactType(ex.output.artifactType);
    setSections(ex.output.requiredSections.join(", "));
    setStrategy(ex.strategy.id);
    setResourcesJson(JSON.stringify(ex.resources, null, 2));
    setFormError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    let resources: unknown;
    try {
      resources = JSON.parse(resourcesJson || "[]");
    } catch {
      setFormError("Resources JSON does not parse — fix it or reset to [].");
      return;
    }
    if (!Array.isArray(resources)) {
      setFormError("Resources must be a JSON array of curated resource objects.");
      return;
    }
    if (!/^[0-9a-f]{64}$/.test(skillSha)) {
      setFormError("Skill sha256 must be 64 lowercase hex characters (content-pinned skill).");
      return;
    }
    const requiredSections = sections
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!requiredSections.length) {
      setFormError("At least one required output section is needed.");
      return;
    }
    onCompile({
      goal,
      role,
      skill: { pin: { name: skillName, version: skillVersion, sha256: skillSha }, body: skillBody },
      // The server validates the full CuratedResource schema (zod).
      resources: resources as PromptCompilerInput["resources"],
      upstream: [],
      output: { artifactType, requiredSections, requireCitationOrLimitation: true },
      budgets: PromptBudgetSchema.parse({}),
      strategy: { id: strategy },
    });
  };

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] text-[hsl(var(--ink-soft))]">
          Compiles locally on the server — no provider call, no cost. Untrusted
          content is fenced, control characters stripped, and fence delimiters
          escaped; every intervention is reported below.
        </p>
        <button
          type="button"
          className="btn min-h-[32px] px-2 text-[12px]"
          onClick={fillExample}
        >
          Fill deterministic example
        </button>
      </div>
      <label className="text-[13px] font-bold">
        Goal (director-issued, trusted)
        <textarea
          required
          className="input mt-1 block min-h-[64px] w-full text-[13px]"
          value={goal}
          maxLength={4000}
          onChange={(e) => setGoal(e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[13px] font-bold">
          Role
          <input
            required
            className="input mt-1 block w-full text-[13px]"
            value={role}
            maxLength={200}
            onChange={(e) => setRole(e.target.value)}
          />
        </label>
        <label className="text-[13px] font-bold">
          Strategy
          <select
            className="input mt-1 block w-full text-[13px]"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as StrategyId)}
          >
            {STRATEGY_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-bold">
          Skill name (hash-pinned)
          <input
            required
            className="input mt-1 block w-full text-[13px]"
            value={skillName}
            maxLength={200}
            onChange={(e) => setSkillName(e.target.value)}
          />
        </label>
        <label className="text-[13px] font-bold">
          Skill version
          <input
            required
            className="input mt-1 block w-full text-[13px]"
            value={skillVersion}
            maxLength={50}
            onChange={(e) => setSkillVersion(e.target.value)}
          />
        </label>
        <label className="text-[13px] font-bold sm:col-span-2">
          Skill sha256 (64 lowercase hex)
          <input
            required
            className="input mono mt-1 block w-full text-[12px]"
            value={skillSha}
            placeholder={"e.g. " + EXAMPLE_SHA_PLACEHOLDER.slice(0, 24) + "…"}
            onChange={(e) => setSkillSha(e.target.value)}
          />
        </label>
      </div>
      <label className="text-[13px] font-bold">
        Skill body (vetted content for the pinned hash)
        <textarea
          className="input mt-1 block min-h-[64px] w-full text-[13px]"
          value={skillBody}
          onChange={(e) => setSkillBody(e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[13px] font-bold">
          Artifact type
          <input
            required
            className="input mt-1 block w-full text-[13px]"
            value={artifactType}
            maxLength={64}
            onChange={(e) => setArtifactType(e.target.value)}
          />
        </label>
        <label className="text-[13px] font-bold">
          Required sections (comma-separated)
          <input
            required
            className="input mt-1 block w-full text-[13px]"
            value={sections}
            onChange={(e) => setSections(e.target.value)}
          />
        </label>
      </div>
      <label className="text-[13px] font-bold">
        Curated resources (JSON array — excerpts are pre-fetched; the compiler
        never fetches URLs)
        <textarea
          className="input mono mt-1 block min-h-[96px] w-full text-[12px]"
          value={resourcesJson}
          spellCheck={false}
          onChange={(e) => setResourcesJson(e.target.value)}
        />
      </label>
      {formError ? (
        <p role="alert" className="chip chip-alert text-[12px]">
          {formError}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn min-h-[36px] text-[13px]" disabled={pending}>
          {pending ? "Compiling…" : "Compile preview"}
        </button>
      </div>
    </form>
  );
}

/** The compiled contract: plan, ordering, truncation/redaction metadata. */
export function CompiledPromptView({ compiled }: { compiled: CompiledPrompt }) {
  const { plan, meta } = compiled;
  return (
    <div className="grid gap-3" data-testid="compiled-prompt">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="chip chip-cornflower mono">{plan.strategy}</span>
        <span className="chip mono">strategy v{plan.strategyVersion}</span>
        <span className="chip mono">compiler v{compiled.version}</span>
        {plan.evaluationOnly ? <span className="chip chip-mustard">evaluation only</span> : null}
        {plan.requiresOrchestration ? (
          <span className="chip chip-mustard">needs orchestration (v1 compiles single call)</span>
        ) : null}
        {meta.degraded ? <span className="chip chip-alert">degraded input</span> : null}
      </div>

      <section aria-label="Concise execution plan">
        <h4 className="text-[13px] font-extrabold">
          Concise plan ({plan.steps.length} steps — action summaries, never chain-of-thought)
        </h4>
        <ol className="mt-1 grid gap-1">
          {plan.steps.map((s) => (
            <li key={s.index} className="border border-[hsl(var(--line))] p-2 text-[13px]">
              <b className="mono text-[12px]">{s.index}.</b> {s.action}
              {s.evidence ? (
                <span className="block text-[12px] text-[hsl(var(--ink-soft))]">
                  evidence: {s.evidence}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        {plan.notes.length ? (
          <ul className="mt-1 grid gap-0.5 text-[12px] text-[hsl(var(--ink-soft))]">
            {plan.notes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-label="Compiler metadata">
        <h4 className="text-[13px] font-extrabold">Metadata</h4>
        <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-[12px] text-[hsl(var(--ink-soft))]">bytes (system + user)</dt>
            <dd className="mono text-[12px]">
              {fmtInt(meta.bytes.system)} + {fmtInt(meta.bytes.user)} = {fmtInt(meta.bytes.total)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[hsl(var(--ink-soft))]">
              estimated tokens (bytes/4 planning estimate — not metered)
            </dt>
            <dd className="mono text-[12px]">{fmtInt(meta.estimatedTokens)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[hsl(var(--ink-soft))]">resolved fan-out / retries</dt>
            <dd className="mono text-[12px]">
              {meta.resolvedFanout} / {meta.resolvedRetries}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[hsl(var(--ink-soft))]">
              cost multiplier (planning estimate)
            </dt>
            <dd className="mono text-[12px]">≈{meta.costMultiplier}×</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[hsl(var(--ink-soft))]">deterministic seed</dt>
            <dd className="mono text-[12px]">{meta.seed}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Resource ordering">
        <h4 className="text-[13px] font-extrabold">
          Resources — deterministic relevance ordering
        </h4>
        {meta.resourcesIncluded.length ? (
          <ol className="mt-1 flex flex-wrap gap-1.5">
            {meta.resourcesIncluded.map((id, i) => (
              <li key={id} className="chip mono" aria-label={`position ${i + 1}: ${id}`}>
                {i + 1}. {id}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">
            No resources admitted.
          </p>
        )}
        {meta.resourcesDropped.length ? (
          <ul className="mt-1 grid gap-0.5 text-[12px]">
            {meta.resourcesDropped.map((d) => (
              <li key={d.id}>
                <span className="chip chip-alert mono">{d.id}</span>{" "}
                <span className="text-[hsl(var(--ink-soft))]">dropped: {d.reason}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-label="Truncation and redaction events">
        <h4 className="text-[13px] font-extrabold">Truncations &amp; redactions</h4>
        {meta.truncations.length ? (
          <table className="table-cat mt-1 text-[12px]">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Original</th>
                <th scope="col">Kept</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {meta.truncations.map((t, i) => (
                <tr key={`${t.field}-${i}`}>
                  <td className="mono">{t.field}</td>
                  <td className="mono">{fmtInt(t.originalBytes)} B</td>
                  <td className="mono">{fmtInt(t.keptBytes)} B</td>
                  <td>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">No truncations.</p>
        )}
        {meta.redactions.length ? (
          <ul className="mt-1 grid gap-0.5 text-[12px]" aria-label="Redaction events">
            {meta.redactions.map((r, i) => (
              <li key={`${r.field}-${r.kind}-${i}`}>
                <span className="chip chip-mustard mono">{r.kind}</span>{" "}
                <span className="mono">{r.field}</span>{" "}
                <span className="text-[hsl(var(--ink-soft))]">×{r.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">No redactions needed.</p>
        )}
        {meta.degradationNotes.length ? (
          <ul className="mt-1 grid gap-0.5 text-[12px]" aria-label="Degradation notes">
            {meta.degradationNotes.map((n) => (
              <li key={n}>
                <span className="chip chip-alert">degraded</span>{" "}
                <span className="text-[hsl(var(--ink-soft))]">{n}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-label="Assembled messages">
        <h4 className="text-[13px] font-extrabold">Assembled messages</h4>
        <details className="mt-1 border border-[hsl(var(--line))] p-2">
          <summary className="cursor-pointer text-[13px] font-bold">
            system message ({fmtInt(meta.bytes.system)} bytes)
          </summary>
          <pre className="mono mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[12px]">
            {compiled.system}
          </pre>
        </details>
        <details className="mt-1 border border-[hsl(var(--line))] p-2">
          <summary className="cursor-pointer text-[13px] font-bold">
            user message ({fmtInt(meta.bytes.user)} bytes)
          </summary>
          <pre className="mono mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[12px]">
            {compiled.user}
          </pre>
        </details>
        <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">
          Untrusted excerpts are fenced as data, not instructions. No
          chain-of-thought is requested, stored, or transported — the plan
          above is the only reasoning artifact, and it is a brief action
          summary.
        </p>
      </section>
    </div>
  );
}
