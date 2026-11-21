import { useState } from "react";
import type { RunSuiteError, RunSuiteInput, RunSuiteResult } from "./evalTypes";
import { isPricingError, shortHash } from "./evalTypes";

/**
 * Deterministic mock stress-suite runner. The run is mock-metered and priced
 * strictly at the owner's configured USD rates for the chosen provider/model
 * — when no rate is configured the server refuses with PRECONDITION_FAILED
 * and this panel shows that honest error instead of any fabricated number.
 * Results are deterministic point estimates, never benchmark claims.
 */

export function MockSuiteRunner({
  run,
  onSaved,
}: {
  /** Real evaluation.runMockSuite mutation (injected so tests can stub it). */
  run(input: RunSuiteInput): Promise<RunSuiteResult>;
  onSaved?(id: number): void;
}) {
  const [provider, setProvider] = useState<RunSuiteInput["provider"]>("gateway");
  const [model, setModel] = useState("");
  const [repeats, setRepeats] = useState("6");
  const [k, setK] = useState("2");
  const [threshold, setThreshold] = useState("0.7");
  const [save, setSave] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RunSuiteError | null>(null);
  const [result, setResult] = useState<RunSuiteResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const input: RunSuiteInput = {
        provider,
        model: model.trim(),
        repeats: Number(repeats),
        k: Number(k),
        qualityThreshold: Number(threshold),
        save,
      };
      const out = await run(input);
      setResult(out);
      if (out.id != null) onSaved?.(out.id);
    } catch (err) {
      const e2 = err as RunSuiteError;
      setError({ message: e2?.message ?? String(err), data: e2?.data });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-3">
      <form className="grid gap-3" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[13px] font-bold">
            Provider (rates source)
            <select
              className="input mt-1 block w-full text-[13px]"
              value={provider}
              onChange={(e) => setProvider(e.target.value as RunSuiteInput["provider"])}
            >
              <option value="gateway">gateway</option>
              <option value="openai">openai</option>
              <option value="anthropic">anthropic</option>
            </select>
          </label>
          <label className="text-[13px] font-bold">
            Model (must have a configured price)
            <input
              required
              className="input mt-1 block w-full text-[13px]"
              value={model}
              maxLength={200}
              placeholder="e.g. claude-sonnet-4-5"
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
          <label className="text-[13px] font-bold">
            Trials per case/strategy (1–60)
            <input
              required
              type="number"
              min={1}
              max={60}
              className="input mt-1 block w-full text-[13px]"
              value={repeats}
              onChange={(e) => setRepeats(e.target.value)}
            />
          </label>
          <label className="text-[13px] font-bold">
            k for pass@k / pass^k (1–10)
            <input
              required
              type="number"
              min={1}
              max={10}
              className="input mt-1 block w-full text-[13px]"
              value={k}
              onChange={(e) => setK(e.target.value)}
            />
          </label>
          <label className="text-[13px] font-bold">
            Quality acceptance threshold (0–1)
            <input
              required
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="input mt-1 block w-full text-[13px]"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 self-end text-[13px] font-bold">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={save}
              onChange={(e) => setSave(e.target.checked)}
            />
            Save report (immutable, owner-scoped)
          </label>
        </div>
        <p className="text-[12px] text-[hsl(var(--ink-soft))]">
          Usage is mock-metered and priced at your configured rates for this
          provider/model (Director → Settings or server env) — not vendor list
          prices, not estimates. With fewer than 5 trials per outcome the
          verdict is explicitly inconclusive.
        </p>
        <div>
          <button type="submit" className="btn min-h-[36px] text-[13px]" disabled={pending}>
            {pending ? "Running deterministic suite…" : "Run mock stress suite"}
          </button>
        </div>
      </form>

      {pending ? (
        <p role="status" className="text-[13px] text-[hsl(var(--ink-soft))]">
          Running the deterministic mock suite — no provider calls are made…
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="dw-notice" data-severity="alert">
          <span className="chip chip-alert">
            {isPricingError(error) ? "pricing required" : "run failed"}
          </span>
          <span className="text-[13px]">
            {error.message}
            {isPricingError(error) ? (
              <>
                {" "}
                Configure input/output USD-per-million rates for this
                provider/model in Director → Settings (or server env) and retry.
                The harness never falls back to fabricated prices.
              </>
            ) : null}
          </span>
        </div>
      ) : null}

      {result ? (
        <div
          className="grid gap-1 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3"
          role="status"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <b className="text-[13px]">Suite complete: {result.suite.name}</b>
            <span className="chip mono">v{result.suite.version}</span>
            <span className="chip mono">suite {shortHash(result.suite.hash)}…</span>
            <span className="chip mono">report {shortHash(result.reportHash)}…</span>
            <span className={`chip ${result.verdict === "measured" ? "chip-sage" : "chip-mustard"}`}>
              {result.verdict === "measured"
                ? "measured point estimates"
                : "inconclusive — descriptive only"}
            </span>
            {result.id != null ? (
              <span className="chip chip-sage">saved as report #{result.id}</span>
            ) : (
              <span className="chip">not saved</span>
            )}
          </div>
          <p className="text-[12px] text-[hsl(var(--ink-soft))]">
            {result.report.cases.length} cases × (2 baselines + candidates) ·
            deterministic — identical suite, rates, and config reproduce this
            exact report hash. Full metrics are in the report detail below
            {result.id != null ? " (open it from Saved reports)" : ""}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
