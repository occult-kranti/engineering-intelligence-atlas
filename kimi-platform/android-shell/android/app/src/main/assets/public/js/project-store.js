/**
 * Local persistence for Project mode (pure module — Node-testable).
 *
 * Stores ONLY non-secret data: project goals, squad definitions, budgets,
 * price rates, run records, events, and text artifacts. Secret-shaped fields
 * are rejected at the boundary as defense in depth (API keys live exclusively
 * in the native Keystore-backed store and never pass through this module).
 *
 * Backed by the same storage adapter shape as runtime-store.js
 * (Capacitor Preferences on device, localStorage fallback in a dev browser).
 */

export const PROJECTS_INDEX_KEY = 'research-director.projects.index';
export const PROJECT_KEY_PREFIX = 'research-director.project.';
export const SETTINGS_KEY = 'research-director.project-settings';

export const LIMITS = {
  maxProjects: 50,
  maxGoalChars: 4000,
  maxSquadNodes: 8,
  maxNodeBriefChars: 2000,
  maxNodeNameChars: 60,
  maxModelChars: 128,
  maxArtifactChars: 100_000,
  maxEventsPerRun: 500,
};

/** Keys that must never appear in a persisted document (exact, case-insensitive). */
const FORBIDDEN_FIELD_NAMES = new Set([
  'secret',
  'secrets',
  'apikey',
  'api_key',
  'api-key',
  'authorization',
  'password',
  'privatekey',
  'private_key',
  'accesstoken',
  'access_token',
  'bearer',
]);

export class StoreValidationError extends Error {}

export const PROVIDERS = new Set(['openai', 'anthropic']);

function assertNoForbiddenFields(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoForbiddenFields(item, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_FIELD_NAMES.has(key.toLowerCase())) {
        throw new StoreValidationError(`refusing to persist secret-shaped field "${path}.${key}"`);
      }
      assertNoForbiddenFields(child, `${path}.${key}`);
    }
  }
}

function asNonNegNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Normalize/validate the non-secret settings document. */
export function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const provider = PROVIDERS.has(src.provider) ? src.provider : '';
  const model = typeof src.model === 'string' ? src.model.trim().slice(0, LIMITS.maxModelChars) : '';
  return {
    provider,
    model,
    // User-entered price rates (USD per 1M tokens). 0 disables cost budgeting.
    priceInPerMillion: asNonNegNumber(src.priceInPerMillion, 0),
    priceOutPerMillion: asNonNegNumber(src.priceOutPerMillion, 0),
    // Per-run budget caps.
    maxTokensPerRun: Math.min(Math.max(asNonNegNumber(src.maxTokensPerRun, 20_000), 0), 1_000_000),
    maxMinutesPerRun: Math.min(Math.max(asNonNegNumber(src.maxMinutesPerRun, 10), 0), 240),
    maxUsdPerRun: Math.min(Math.max(asNonNegNumber(src.maxUsdPerRun, 0), 0), 1_000),
    maxOutputTokensPerCall: Math.min(Math.max(asNonNegNumber(src.maxOutputTokensPerCall, 512), 1), 4096),
  };
}

function normalizeNode(raw, index) {
  const node = raw && typeof raw === 'object' ? raw : {};
  const name = typeof node.name === 'string' ? node.name.trim() : '';
  const brief = typeof node.brief === 'string' ? node.brief.trim() : '';
  if (!name || name.length > LIMITS.maxNodeNameChars) {
    throw new StoreValidationError(`squad node ${index + 1} needs a name (<= ${LIMITS.maxNodeNameChars} chars)`);
  }
  if (brief.length > LIMITS.maxNodeBriefChars) {
    throw new StoreValidationError(`squad node ${index + 1} brief is too long`);
  }
  return { name, brief, enabled: node.enabled !== false };
}

function normalizeBudget(raw, settings) {
  const b = raw && typeof raw === 'object' ? raw : {};
  return {
    maxTokens: asNonNegNumber(b.maxTokens, settings.maxTokensPerRun),
    maxMinutes: asNonNegNumber(b.maxMinutes, settings.maxMinutesPerRun),
    maxUsd: asNonNegNumber(b.maxUsd, settings.maxUsdPerRun),
    priceInPerMillion: asNonNegNumber(b.priceInPerMillion, settings.priceInPerMillion),
    priceOutPerMillion: asNonNegNumber(b.priceOutPerMillion, settings.priceOutPerMillion),
  };
}

/** Validate and normalize a full project document (defense in depth). */
export function normalizeProjectDoc(doc) {
  if (!doc || typeof doc !== 'object') {
    throw new StoreValidationError('project document is missing');
  }
  assertNoForbiddenFields(doc);
  if (typeof doc.id !== 'string' || !/^[A-Za-z0-9-]{6,64}$/.test(doc.id)) {
    throw new StoreValidationError('project id is invalid');
  }
  const goal = typeof doc.goal === 'string' ? doc.goal.trim() : '';
  if (!goal || goal.length > LIMITS.maxGoalChars) {
    throw new StoreValidationError(`goal is required (<= ${LIMITS.maxGoalChars} chars)`);
  }
  if (!Array.isArray(doc.squad) || doc.squad.length < 1 || doc.squad.length > LIMITS.maxSquadNodes) {
    throw new StoreValidationError(`squad must have 1..${LIMITS.maxSquadNodes} nodes`);
  }
  if (!PROVIDERS.has(doc.provider)) {
    throw new StoreValidationError('project provider must be "openai" or "anthropic"');
  }
  if (typeof doc.model !== 'string' || !/^[A-Za-z0-9._:/-]{1,128}$/.test(doc.model.trim())) {
    throw new StoreValidationError('project model id is missing or invalid');
  }
  const runs = Array.isArray(doc.runs) ? doc.runs : [];
  for (const run of runs) {
    if (Array.isArray(run?.events) && run.events.length > LIMITS.maxEventsPerRun) {
      run.events = run.events.slice(-LIMITS.maxEventsPerRun);
    }
    if (Array.isArray(run?.artifacts)) {
      for (const artifact of run.artifacts) {
        if (typeof artifact?.text === 'string' && artifact.text.length > LIMITS.maxArtifactChars) {
          artifact.text = artifact.text.slice(0, LIMITS.maxArtifactChars);
        }
      }
    }
  }
  return {
    ...doc,
    goal,
    squad: doc.squad.map(normalizeNode),
    provider: doc.provider,
    model: doc.model.trim(),
    runs,
  };
}

/**
 * Storage facade with validation at the boundary.
 *
 * @param {{getItem(k:string):Promise<string|null>, setItem(k:string,v:string):Promise<void>, removeItem(k:string):Promise<void>}} storage
 */
export function createProjectStore(storage) {
  async function readJson(key) {
    const raw = await storage.getItem(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null; // corrupt entry is treated as absent, never crashed on
    }
  }

  async function readIndex() {
    const index = await readJson(PROJECTS_INDEX_KEY);
    return Array.isArray(index) ? index.filter((id) => typeof id === 'string') : [];
  }

  async function writeIndex(ids) {
    await storage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(ids));
  }

  return {
    async loadSettings() {
      return normalizeSettings(await readJson(SETTINGS_KEY));
    },

    async saveSettings(settings) {
      const normalized = normalizeSettings(settings);
      assertNoForbiddenFields(normalized);
      await storage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
      return normalized;
    },

    /** Persist a full (normalized) project document; maintains the index. */
    async saveProject(doc) {
      const normalized = normalizeProjectDoc(doc);
      const ids = await readIndex();
      if (!ids.includes(normalized.id)) {
        if (ids.length >= LIMITS.maxProjects) {
          throw new StoreValidationError(`project limit (${LIMITS.maxProjects}) reached`);
        }
        ids.push(normalized.id);
        await writeIndex(ids);
      }
      await storage.setItem(PROJECT_KEY_PREFIX + normalized.id, JSON.stringify(normalized));
      return normalized;
    },

    async loadProject(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9-]{6,64}$/.test(id)) return null;
      const doc = await readJson(PROJECT_KEY_PREFIX + id);
      if (!doc) return null;
      try {
        return normalizeProjectDoc(doc);
      } catch {
        return null;
      }
    },

    async listProjects() {
      const ids = await readIndex();
      const out = [];
      for (const id of ids) {
        const doc = await this.loadProject(id);
        if (doc) {
          out.push({
            id: doc.id,
            goal: doc.goal.slice(0, 120),
            provider: doc.provider,
            model: doc.model,
            updatedAt: doc.updatedAt ?? null,
            lastRunStatus: doc.runs.length ? doc.runs[doc.runs.length - 1].status : null,
          });
        }
      }
      return out;
    },

    async deleteProject(id) {
      await storage.removeItem(PROJECT_KEY_PREFIX + id);
      const ids = await readIndex();
      await writeIndex(ids.filter((x) => x !== id));
    },
  };
}
