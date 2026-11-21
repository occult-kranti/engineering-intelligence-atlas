import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { GOAL_MODES, type GoalMode, type GoalModePreset } from "@contracts/office";
import { newIdempotencyKey } from "../workspace/adapter";
import { parseGoalModePreset } from "./officeAdapter";

const PANEL_PROVIDERS = ["openai", "anthropic"] as const;

interface DraftRow {
  strategyId: string;
  preamble: string;
  outputTokenFraction: number;
}

/**
 * Provider goal-mode controls (stage 01). A goal mode is a prompt/strategy
 * preset layered onto dispatch — explore/build/evaluate/operate per
 * provider. Presets never carry a model id: the schema is .strict() and the
 * client validates before sending (parseGoalModePreset), so model identity
 * continues to come only from provider env / gateway discovery. Defaults
 * are the shipped presets; saving writes one owner override.
 */
export default function GoalModePanel() {
  const q = trpc.ai.goalModes.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const setM = trpc.ai.setGoalModePreset.useMutation({
    onSuccess: () => void utils.ai.goalModes.invalidate(),
  });
  /**
   * Edits overlay the server presets: an untouched row renders server
   * truth, an edited row renders the local draft until it is saved.
   */
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [rowState, setRowState] = useState<Record<string, { error?: string; saved?: boolean }>>({});

  if (q.error) {
    return (
      <section aria-labelledby="dw-goalmode-heading" className="grid max-w-3xl gap-2">
        <span className="kicker">Provider goal modes</span>
        <p role="status" className="chip chip-alert">
          goal modes unavailable — {q.error.message}
        </p>
      </section>
    );
  }
  if (!q.data) {
    return (
      <section aria-labelledby="dw-goalmode-heading" className="grid max-w-3xl gap-2">
        <span className="kicker">Provider goal modes</span>
        <p className="text-[13px] text-[hsl(var(--ink-soft))]">loading goal modes…</p>
      </section>
    );
  }

  const key = (provider: string, mode: GoalMode) => `${provider}:${mode}`;

  const draftFor = (provider: string, mode: GoalMode): DraftRow | null => {
    const preset = q.data.providers[provider]?.[mode];
    if (!preset) return null;
    return (
      drafts[key(provider, mode)] ?? {
        strategyId: preset.strategyId,
        preamble: preset.preamble,
        outputTokenFraction: preset.outputTokenFraction,
      }
    );
  };

  const edit = (provider: string, mode: GoalMode, next: DraftRow) =>
    setDrafts((s) => ({ ...s, [key(provider, mode)]: next }));

  const save = (provider: (typeof PANEL_PROVIDERS)[number], mode: GoalMode) => {
    const d = draftFor(provider, mode);
    if (!d) return;
    const parsed = parseGoalModePreset({
      mode,
      strategyId: d.strategyId,
      preamble: d.preamble,
      outputTokenFraction: d.outputTokenFraction,
    });
    if (!parsed.ok) {
      setRowState((s) => ({ ...s, [key(provider, mode)]: { error: parsed.error } }));
      return;
    }
    setM.mutate(
      {
        provider,
        preset: parsed.preset,
        idempotencyKey: newIdempotencyKey("ai.setGoalModePreset"),
      },
      {
        onSuccess: () =>
          setRowState((s) => ({ ...s, [key(provider, mode)]: { saved: true } })),
        onError: (e) =>
          setRowState((s) => ({ ...s, [key(provider, mode)]: { error: e.message } })),
      },
    );
  };

  const isDirty = (provider: string, mode: GoalMode, preset?: GoalModePreset) => {
    const d = drafts[key(provider, mode)];
    if (!d || !preset) return false;
    return (
      d.strategyId !== preset.strategyId ||
      d.preamble !== preset.preamble ||
      d.outputTokenFraction !== preset.outputTokenFraction
    );
  };

  return (
    <section aria-labelledby="dw-goalmode-heading" className="grid max-w-3xl gap-3">
      <span className="kicker">Provider goal modes</span>
      <h2 id="dw-goalmode-heading" className="text-lg font-extrabold tracking-tight">
        explore · build · evaluate · operate
      </h2>
      <p className="text-[12px] text-[hsl(var(--ink-soft))]">
        Prompt/strategy presets per provider. A preset is never a model id — model identity
        comes only from provider configuration at runtime, and a &quot;model&quot; key is rejected
        client- and server-side.
      </p>
      {PANEL_PROVIDERS.map((provider) => (
        <div
          key={provider}
          className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3"
        >
          <h3 className="text-[14px] font-extrabold">{provider}</h3>
          <div className="mt-2 grid gap-3">
            {GOAL_MODES.map((mode) => {
              const preset = q.data.providers[provider]?.[mode];
              const d = draftFor(provider, mode);
              const st = rowState[key(provider, mode)];
              if (!preset || !d) return null;
              const dirty = isDirty(provider, mode, preset);
              return (
                <fieldset key={mode} className="border border-[hsl(var(--ink)/0.12)] p-2">
                  <legend className="chip mono">{mode}</legend>
                  <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                    <label className="text-[12px] font-bold">
                      Strategy
                      <select
                        className="input mt-1 text-[13px]"
                        value={d.strategyId}
                        onChange={(e) => edit(provider, mode, { ...d, strategyId: e.target.value })}
                      >
                        {/* Only dispatchable strategies are offered — the
                            server rejects evaluationOnly/orchestrated ids. */}
                        {q.data.dispatchableStrategyIds.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[12px] font-bold">
                      Output token fraction (0–1]
                      <input
                        type="number"
                        className="input mt-1 text-[13px]"
                        min={0.01}
                        max={1}
                        step={0.05}
                        value={d.outputTokenFraction}
                        onChange={(e) =>
                          edit(provider, mode, { ...d, outputTokenFraction: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <label className="mt-2 block text-[12px] font-bold">
                    Preamble (trusted, labeled; ≤2000 chars)
                    <textarea
                      className="input mt-1 text-[13px]"
                      rows={2}
                      maxLength={2000}
                      value={d.preamble}
                      onChange={(e) => edit(provider, mode, { ...d, preamble: e.target.value })}
                    />
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="btn min-h-[36px] px-3 text-[12px] font-bold"
                      disabled={!dirty || setM.isPending}
                      onClick={() => save(provider, mode)}
                    >
                      {setM.isPending ? "Saving…" : dirty ? "Save preset" : "Saved (server truth)"}
                    </button>
                    {st?.error ? (
                      <span role="alert" className="text-[12px] font-bold text-[hsl(var(--alert))]">
                        {st.error}
                      </span>
                    ) : st?.saved && !dirty ? (
                      <span role="status" className="text-[12px] text-[hsl(var(--ink-soft))]">
                        saved — effective on the next dispatch
                      </span>
                    ) : null}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
