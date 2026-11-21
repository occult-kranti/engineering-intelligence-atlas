/**
 * Project mode orchestration (pure module — Node-testable with a fake provider).
 *
 * A project = goal + small editable squad (default Director/Research/Build/
 * Review). A run executes the enabled squad nodes IN ORDER, one native
 * provider text call per node, feeding each node the goal plus the (truncated)
 * text artifacts of the nodes before it.
 *
 * Properties:
 *  - run / pause / resume / cancel; per-node status tracking.
 *  - Budgets: max tokens, max minutes, max USD per run. USD is computed from
 *    the user's own price rates (per 1M input/output tokens). A budget of 0
 *    disables that specific cap.
 *  - Every state transition is persisted through the project store, so partial
 *    results (completed artifacts + the event log) survive app restarts.
 *  - Text only: no code execution, no repository writes, no tool use.
 *  - No secrets pass through here: the engine only sees the provider NAME;
 *    the API key stays in the native Keystore-backed store and is used by the
 *    native HTTPS client.
 */

export const DEFAULT_SQUAD = [
  {
    name: 'Director',
    brief:
      'You direct the squad. Restate the goal crisply, list the key questions to answer, and give each later role clear instructions.',
  },
  {
    name: 'Research',
    brief:
      'You gather and organize relevant knowledge for the goal. State facts, assumptions, and uncertainties explicitly. No fabrication.',
  },
  {
    name: 'Build',
    brief:
      'You turn the research into a concrete deliverable outline: structure, steps, and draft content, grounded only in the prior notes.',
  },
  {
    name: 'Review',
    brief:
      'You critique the draft: find gaps, contradictions, and risks; then produce a short final revised summary of the answer to the goal.',
  },
];

const MAX_CONTEXT_CHARS_PER_ARTIFACT = 1500;
const MAX_TOTAL_PROMPT_CHARS = 22_000; // leaves headroom under the native 24k cap

function randomId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Estimate token usage when a provider does not report it (~4 chars/token). */
export function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

export function computeCostUsd(inputTokens, outputTokens, priceInPerMillion, priceOutPerMillion) {
  return (
    (Math.max(0, inputTokens) / 1_000_000) * Math.max(0, priceInPerMillion) +
    (Math.max(0, outputTokens) / 1_000_000) * Math.max(0, priceOutPerMillion)
  );
}

/** JS-side belt-and-braces redaction for provider error text. */
export function redactError(message) {
  return String(message ?? 'unknown error')
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, '[redacted]')
    .slice(0, 240);
}

function buildNodePrompt(project, node, priorArtifacts) {
  const parts = [
    `You are the "${node.name}" on a small text-only research squad.`,
    node.brief ? `Role brief: ${node.brief}` : '',
    `Project goal: ${project.goal}`,
  ];
  if (priorArtifacts.length) {
    parts.push('Prior work from the squad (oldest first):');
    for (const artifact of priorArtifacts) {
      const text = String(artifact.text).slice(0, MAX_CONTEXT_CHARS_PER_ARTIFACT);
      parts.push(`--- ${artifact.nodeName} ---\n${text}`);
    }
  }
  parts.push(
    'Respond with your contribution as plain text only. Do not run code, do not invent sources, and state uncertainties.',
  );
  let prompt = parts.filter(Boolean).join('\n\n');
  if (prompt.length > MAX_TOTAL_PROMPT_CHARS) {
    prompt = prompt.slice(0, MAX_TOTAL_PROMPT_CHARS);
  }
  return prompt;
}

function normalizeSquadInput(squad) {
  const source = Array.isArray(squad) && squad.length ? squad : DEFAULT_SQUAD;
  return source.map((n, i) => ({
    name: String(n?.name ?? DEFAULT_SQUAD[Math.min(i, DEFAULT_SQUAD.length - 1)].name).trim() || `Node ${i + 1}`,
    brief: String(n?.brief ?? '').trim(),
    enabled: n?.enabled !== false,
  }));
}

/**
 * @param {{store: object, provider: {generate(args:object):Promise<object>}, now?: () => number}} deps
 */
export function createProjectEngine({ store, provider, now = () => Date.now() }) {
  if (!store || !provider) throw new Error('createProjectEngine requires { store, provider }');
  // In-memory control flags per project (pause/cancel take effect between nodes).
  const control = new Map();

  function flags(projectId) {
    if (!control.has(projectId)) {
      control.set(projectId, { pauseRequested: false, cancelRequested: false, driving: false });
    }
    return control.get(projectId);
  }

  function pushEvent(run, event) {
    run.events.push({ ts: new Date(now()).toISOString(), ...event });
  }

  /** Returns 'tokens' | 'minutes' | 'usd' | null for the first exceeded cap. */
  function budgetExceeded(project, run, sessionStart) {
    const b = run.budget;
    if (b.maxTokens > 0 && run.usage.totalTokens >= b.maxTokens) return 'tokens';
    const elapsedMs = run.elapsedMs + (now() - sessionStart);
    if (b.maxMinutes > 0 && elapsedMs >= b.maxMinutes * 60_000) return 'minutes';
    if (b.maxUsd > 0 && run.usage.costUsd >= b.maxUsd) return 'usd';
    return null;
  }

  async function persist(project) {
    project.updatedAt = new Date(now()).toISOString();
    await store.saveProject(project);
  }

  function activeRun(project) {
    return project.runs.length ? project.runs[project.runs.length - 1] : null;
  }

  async function drive(projectId) {
    const f = flags(projectId);
    if (f.driving) return; // single driver per project
    f.driving = true;
    const sessionStart = now();
    let project;
    let drove = false;
    try {
      project = await store.loadProject(projectId);
      if (!project) return;
      const run = activeRun(project);
      if (!run || (run.status !== 'running' && run.status !== 'paused')) return;
      drove = true;
      run.status = 'running';

      const nodes = project.squad;
      while (run.cursor < nodes.length) {
        // Control checks between nodes.
        if (f.cancelRequested) {
          run.status = 'cancelled';
          pushEvent(run, { type: 'run-cancelled' });
          await persist(project);
          return;
        }
        if (f.pauseRequested) {
          run.status = 'paused';
          pushEvent(run, { type: 'run-paused' });
          await persist(project);
          return;
        }
        const exceeded = budgetExceeded(project, run, sessionStart);
        if (exceeded) {
          run.status = 'budget-exhausted';
          pushEvent(run, { type: 'budget-exhausted', cap: exceeded });
          await persist(project);
          return;
        }

        const node = nodes[run.cursor];
        if (!node.enabled) {
          run.nodeStatuses[run.cursor] = 'skipped';
          pushEvent(run, { type: 'node-skipped', node: node.name });
          run.cursor += 1;
          await persist(project);
          continue;
        }

        run.nodeStatuses[run.cursor] = 'running';
        pushEvent(run, { type: 'node-start', node: node.name });
        await persist(project);

        const priorArtifacts = run.artifacts;
        const prompt = buildNodePrompt(project, node, priorArtifacts);
        try {
          const result = await provider.generate({
            provider: project.provider,
            model: project.model,
            prompt,
            maxTokens: run.maxOutputTokensPerCall,
          });
          const text = String(result?.text ?? '');
          const inputTokens = Number.isFinite(result?.inputTokens)
            ? result.inputTokens
            : estimateTokens(prompt);
          const outputTokens = Number.isFinite(result?.outputTokens)
            ? result.outputTokens
            : estimateTokens(text);
          run.usage.inputTokens += inputTokens;
          run.usage.outputTokens += outputTokens;
          run.usage.totalTokens += inputTokens + outputTokens;
          run.usage.costUsd += computeCostUsd(
            inputTokens,
            outputTokens,
            run.budget.priceInPerMillion,
            run.budget.priceOutPerMillion,
          );
          run.artifacts.push({
            nodeName: node.name,
            text,
            inputTokens,
            outputTokens,
            at: new Date(now()).toISOString(),
          });
          run.nodeStatuses[run.cursor] = 'done';
          pushEvent(run, { type: 'node-done', node: node.name, inputTokens, outputTokens });
          run.cursor += 1;
          await persist(project);
        } catch (err) {
          // Partial results stay persisted; the failed node is marked and the
          // run stops with a redacted error (no secrets, no automatic retry).
          run.nodeStatuses[run.cursor] = 'error';
          run.status = 'error';
          pushEvent(run, { type: 'node-error', node: node.name, message: redactError(err?.message) });
          await persist(project);
          return;
        }
      }

      run.status = 'completed';
      pushEvent(run, { type: 'run-completed' });
      await persist(project);
    } finally {
      const run = project && activeRun(project);
      if (run && drove) {
        run.elapsedMs += now() - sessionStart;
        try {
          await persist(project);
        } catch {
          /* persist errors surfaced on next save */
        }
      }
      f.driving = false;
      f.pauseRequested = false;
    }
  }

  return {
    DEFAULT_SQUAD,

    async createProject({ goal, squad, provider: providerName, model, budget }) {
      const settings = await store.loadSettings();
      const project = {
        id: randomId('p'),
        goal: String(goal ?? '').trim(),
        squad: normalizeSquadInput(squad),
        provider: providerName,
        model: String(model ?? '').trim(),
        budget: {
          maxTokens: Number(budget?.maxTokens ?? settings.maxTokensPerRun) || 0,
          maxMinutes: Number(budget?.maxMinutes ?? settings.maxMinutesPerRun) || 0,
          maxUsd: Number(budget?.maxUsd ?? settings.maxUsdPerRun) || 0,
          priceInPerMillion: Number(budget?.priceInPerMillion ?? settings.priceInPerMillion) || 0,
          priceOutPerMillion: Number(budget?.priceOutPerMillion ?? settings.priceOutPerMillion) || 0,
        },
        createdAt: new Date(now()).toISOString(),
        updatedAt: new Date(now()).toISOString(),
        runs: [],
      };
      await store.saveProject(project); // validates (and rejects secret fields)
      return project;
    },

    /** Start a NEW run for the project and drive it until done/paused/error. */
    async startRun(projectId) {
      const project = await store.loadProject(projectId);
      if (!project) throw new Error('project not found');
      const existing = activeRun(project);
      if (existing && (existing.status === 'running' || existing.status === 'paused')) {
        throw new Error('a run is already active for this project (resume or cancel it first)');
      }
      const settings = await store.loadSettings();
      const run = {
        id: randomId('r'),
        status: 'running',
        cursor: 0,
        nodeStatuses: project.squad.map(() => 'pending'),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        budget: { ...project.budget },
        maxOutputTokensPerCall: settings.maxOutputTokensPerCall,
        artifacts: [],
        events: [],
        startedAt: new Date(now()).toISOString(),
        elapsedMs: 0,
      };
      project.runs.push(run);
      const f = flags(projectId);
      f.pauseRequested = false;
      f.cancelRequested = false;
      pushEvent(run, { type: 'run-started', nodes: project.squad.map((n) => n.name) });
      await persist(project);
      await drive(projectId);
      // Return the persisted post-drive state (drive works on a fresh copy).
      const updated = await store.loadProject(projectId);
      return updated ? activeRun(updated) : run;
    },

    async pauseRun(projectId) {
      const f = flags(projectId);
      f.pauseRequested = true;
      const project = await store.loadProject(projectId);
      const run = project && activeRun(project);
      // If not currently driving (e.g. paused between sessions), mark immediately.
      if (run && run.status === 'running' && !f.driving) {
        run.status = 'paused';
        pushEvent(run, { type: 'run-paused' });
        await persist(project);
      }
      return run?.status ?? null;
    },

    async resumeRun(projectId) {
      const project = await store.loadProject(projectId);
      const run = project && activeRun(project);
      if (!run || run.status !== 'paused') {
        throw new Error('no paused run to resume');
      }
      const f = flags(projectId);
      f.pauseRequested = false;
      f.cancelRequested = false;
      run.status = 'running';
      pushEvent(run, { type: 'run-resumed' });
      await persist(project);
      await drive(projectId);
      const updated = await store.loadProject(projectId);
      return updated ? activeRun(updated) : run;
    },

    async cancelRun(projectId) {
      const f = flags(projectId);
      f.cancelRequested = true;
      const project = await store.loadProject(projectId);
      const run = project && activeRun(project);
      if (run && (run.status === 'running' || run.status === 'paused') && !f.driving) {
        run.status = 'cancelled';
        pushEvent(run, { type: 'run-cancelled' });
        await persist(project);
      }
      return run?.status ?? null;
    },

    async getProject(projectId) {
      return store.loadProject(projectId);
    },
  };
}
