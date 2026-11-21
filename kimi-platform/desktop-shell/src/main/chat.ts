import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type {
  BudgetLimits,
  ChatMessage,
  ChatProvenance,
  ChatSession,
  ChatSessionSummary,
  CreateChatSessionRequest,
  ProjectProvider,
  SendChatMessageRequest,
  SendChatMessageResult,
} from '../shared/contract';
import { deriveOfficeSnapshot } from '../shared/office';
import { buildDonnaPrompt } from '../shared/assistant';
import {
  MAX_OUTPUT_TOKENS_PER_CALL,
  SAFE_ID,
  validateBudget,
  validatePriceRates,
  type GenerateFn,
  type ProjectStore,
} from './projects';
import { resolveContainedPath } from './paths';
import type { SkillRegistry } from './skills';
import { capUtf8, truncationMarker } from './textCap';

/**
 * v4 Director chat: persistent, local, provider-backed chat sessions.
 *
 *  - Storage: JSON sessions under `userData/chats/<id>/session.json`, atomic
 *    writes, no secrets (prompts/outputs/usage/hashes only; API keys are
 *    resolved per call by the injected GenerateFn from the vault).
 *  - sendMessage REQUIRES `confirmed: true` (the UI must collect an explicit
 *    user confirmation), validates message length and per-session quotas, and
 *    enforces hard token / USD / generation-minute ceilings per session.
 *  - Sending is asynchronous: the user message and a pending assistant
 *    placeholder are persisted synchronously, then generation runs with an
 *    AbortController (stop()) and the session file is updated on completion,
 *    error, or cancellation. Desktop and VS Code clients poll for state.
 *  - The Director prompt is deterministic: fixed system brief + bounded
 *    recent history + optional project goal/success criteria/office summary
 *    + bounded, integrity-verified SKILL.md excerpts. No chain-of-thought is
 *    requested, there is no streaming, no tool use, no code execution.
 *  - Assistant output is UNTRUSTED display text. Suggested next steps are
 *    exposed only as data (ChatAction), never as remote commands.
 */

export const DEFAULT_CHAT_SKILL_IDS = ['agent-research-director', 'ai-research-frontier'] as const;

export const MAX_CHAT_SESSIONS = 50;
export const MAX_MESSAGES_PER_SESSION = 100;
export const MAX_CHAT_MESSAGE_CHARS = 8000;
export const MAX_SESSION_TITLE = 120;
export const MAX_HISTORY_MESSAGES = 12;
/** Per-history-message prompt excerpt cap (UTF-8-safe). */
export const MAX_HISTORY_EXCERPT_CHARS = 2000;
/** Caps for the linked-project context section. */
export const MAX_GOAL_CONTEXT_CHARS = 4000;
export const MAX_OFFICE_CONTEXT_CHARS = 2000;
/** Hard ceiling for the fully composed user prompt. */
export const MAX_CHAT_PROMPT_CHARS = 60000;

const CHAT_BUDGET_CEILING: BudgetLimits = { maxTokens: 2_000_000, maxMinutes: 24 * 60, maxUsd: 200 };
const DEFAULT_CHAT_BUDGET: BudgetLimits = { maxTokens: 100_000, maxMinutes: 30, maxUsd: 5 };
const MAX_MODEL_ID = 200;

const DIRECTOR_SYSTEM_PROMPT = [
  'You are the Research Director, an expert research-strategy assistant inside a local desktop application.',
  'Answer the user directly and concretely, drawing on the bundled skill briefings and any linked project context provided.',
  'Rules: plain text only; never claim to run tools, code, or external actions; never fabricate results or citations; state uncertainties explicitly.',
  'You may SUGGEST next steps as plain text (e.g. creating a project or opening a roadmap); the application decides what to do with suggestions.',
  'Do not reveal internal chain-of-thought; give concise, final reasoning only.',
].join(' ');

/**
 * v6: Donna advisory sessions reuse this exact ChatManager (same confirmed
 * sends, budgets, provenance) with the byte-identical contract system prompt
 * from buildDonnaPrompt. Deterministic: derived once, no clocks/randomness.
 * Donna output remains untrusted text; proposals are parsed/validated by the
 * AssistantStore (never executed from chat text).
 */
const DONNA_SYSTEM_PROMPT = buildDonnaPrompt({ objective: '' }).system;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function atomicWrite(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

function zeroSessionUsage(): ChatSession['usage'] {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0, elapsedSeconds: 0 };
}

/** Persistence for non-secret chat sessions under userData/chats. */
export class ChatStore {
  private readonly root: string;

  constructor(userDataPath: string) {
    this.root = path.join(userDataPath, 'chats');
    fs.mkdirSync(this.root, { recursive: true });
  }

  private assertId(id: unknown): string {
    if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error('invalid chat session id');
    return id;
  }

  sessionFile(sessionId: string): string {
    return path.join(resolveContainedPath(this.root, this.assertId(sessionId)), 'session.json');
  }

  save(session: ChatSession): void {
    atomicWrite(this.sessionFile(session.id), JSON.stringify(session, null, 2));
  }

  get(sessionId: string): ChatSession | null {
    try {
      const raw = JSON.parse(fs.readFileSync(this.sessionFile(sessionId), 'utf8')) as ChatSession;
      if (!isRecord(raw) || typeof raw.id !== 'string' || !Array.isArray(raw.messages)) return null;
      return raw;
    } catch {
      return null;
    }
  }

  listIds(): string[] {
    let dirs: fs.Dirent[];
    try {
      dirs = fs.readdirSync(this.root, { withFileTypes: true });
    } catch {
      return [];
    }
    return dirs.filter((d) => d.isDirectory() && SAFE_ID.test(d.name)).map((d) => d.name);
  }

  list(): ChatSession[] {
    const out: ChatSession[] = [];
    for (const id of this.listIds()) {
      const session = this.get(id);
      if (session) out.push(session);
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  delete(sessionId: string): void {
    const dir = resolveContainedPath(this.root, this.assertId(sessionId));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function summarizeSession(session: ChatSession): ChatSessionSummary {
  const { messages, ...rest } = session;
  return { ...rest, messageCount: messages.length };
}

export interface ChatManagerDeps {
  /** Wall-clock milliseconds; injectable for deterministic tests. */
  now?: () => number;
  /** Bundled skill registry + root for verified prompt excerpts. */
  skills?: { registry: SkillRegistry; root: string } | null;
}

export class ChatManager extends EventEmitter {
  private readonly now: () => number;
  private readonly skills: { registry: SkillRegistry; root: string } | null;
  /** sessionId -> AbortController for the in-flight generation. */
  private readonly pending = new Map<string, AbortController>();

  constructor(
    private readonly store: ChatStore,
    private readonly projectStore: ProjectStore,
    private readonly generateFn: GenerateFn,
    deps: ChatManagerDeps = {},
  ) {
    super();
    this.now = deps.now ?? Date.now;
    this.skills = deps.skills ?? null;
    this.reconcileOrphans();
  }

  /** A process death can strand a 'pending' assistant message; mark it. */
  private reconcileOrphans(): void {
    for (const session of this.store.list()) {
      let dirty = false;
      for (const message of session.messages) {
        if (message.status === 'pending') {
          message.status = 'error';
          message.error = 'Interrupted: the app was closed while this response was generating.';
          message.finishedAt = new Date().toISOString();
          dirty = true;
        }
      }
      if (dirty) {
        session.updatedAt = new Date().toISOString();
        this.store.save(session);
      }
    }
  }

  private emitSession(session: ChatSession): void {
    this.emit('session', JSON.parse(JSON.stringify(summarizeSession(session))) as ChatSessionSummary);
  }

  listSessions(): ChatSessionSummary[] {
    return this.store.list().map(summarizeSession);
  }

  getSession(sessionId: string): ChatSession | null {
    if (typeof sessionId !== 'string') return null;
    try {
      return this.store.get(sessionId);
    } catch {
      return null;
    }
  }

  createSession(req: unknown): { ok: boolean; session?: ChatSession; error?: string } {
    try {
      if (!isRecord(req)) throw new Error('request must be an object');
      const r = req as unknown as CreateChatSessionRequest;
      if (this.store.listIds().length >= MAX_CHAT_SESSIONS) {
        throw new Error(`chat session quota reached (${MAX_CHAT_SESSIONS}); delete a session first`);
      }
      const provider = r.provider;
      if (provider !== 'openai' && provider !== 'anthropic' && provider !== 'ollama') {
        throw new Error('provider must be one of: openai, anthropic, ollama');
      }
      const model = String(r.model ?? '').trim();
      if (model.length === 0 || model.length > MAX_MODEL_ID) throw new Error('model must be selected or entered explicitly');
      const mode = r.mode === undefined ? 'director' : r.mode;
      if (mode !== 'director' && mode !== 'donna') throw new Error('mode must be director or donna');
      const defaultTitle = mode === 'donna' ? 'Donna' : 'Director chat';
      const title = (typeof r.title === 'string' && r.title.trim().length > 0 ? r.title.trim() : defaultTitle).slice(0, MAX_SESSION_TITLE);

      let projectId: string | null = null;
      if (r.projectId !== undefined && r.projectId !== null) {
        if (typeof r.projectId !== 'string' || !SAFE_ID.test(r.projectId)) throw new Error('invalid projectId');
        if (!this.projectStore.getProject(r.projectId)) throw new Error('unknown project id');
        projectId = r.projectId;
      }

      const skillIds = r.skillIds === undefined ? [...DEFAULT_CHAT_SKILL_IDS] : r.skillIds;
      if (!Array.isArray(skillIds) || skillIds.length > 8) throw new Error('skillIds must be an array of at most 8 ids');
      const validatedSkillIds: string[] = [];
      for (const id of skillIds) {
        if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error(`invalid skill id "${String(id)}"`);
        if (validatedSkillIds.includes(id)) throw new Error(`duplicate skill id "${id}"`);
        if (this.skills !== null) {
          const skill = this.skills.registry.get(id);
          if (!skill) throw new Error(`unknown skill id "${id}"`);
          if (!skill.verified) throw new Error(`skill "${id}" failed integrity verification`);
        }
        validatedSkillIds.push(id);
      }

      const priceRates = validatePriceRates(r.priceRates);
      const budget = validateBudget({ ...DEFAULT_CHAT_BUDGET, ...(isRecord(r.budget) ? r.budget : {}) }, 'chat', CHAT_BUDGET_CEILING);

      const now = new Date().toISOString();
      const session: ChatSession = {
        id: `chat-${crypto.randomUUID()}`,
        title,
        mode,
        projectId,
        provider,
        model,
        skillIds: validatedSkillIds,
        priceRates,
        budget,
        usage: zeroSessionUsage(),
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      this.store.save(session);
      this.emitSession(session);
      return { ok: true, session };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Persist the user message + a pending assistant placeholder, then run the
   * provider call asynchronously. Poll getSession() for the outcome.
   */
  sendMessage(req: unknown): SendChatMessageResult {
    try {
      if (!isRecord(req)) throw new Error('request must be an object');
      const r = req as unknown as SendChatMessageRequest;
      if (r.confirmed !== true) throw new Error('Sending a chat message requires explicit user confirmation.');
      if (typeof r.sessionId !== 'string') throw new Error('sessionId must be a string');
      const text = String(r.text ?? '').trim();
      if (text.length === 0 || text.length > MAX_CHAT_MESSAGE_CHARS) {
        throw new Error(`message must be 1..${MAX_CHAT_MESSAGE_CHARS} characters`);
      }
      const session = this.store.get(r.sessionId);
      if (!session) throw new Error('unknown chat session id');
      if (this.pending.has(session.id)) throw new Error('a response is already generating for this session');
      if (session.messages.length + 2 > MAX_MESSAGES_PER_SESSION) {
        throw new Error(`message quota reached (${MAX_MESSAGES_PER_SESSION} per session); start a new session`);
      }
      // Hard ceilings: refuse before any billed call is made.
      const usedTokens = session.usage.inputTokens + session.usage.outputTokens;
      if (usedTokens >= session.budget.maxTokens) {
        throw new Error(`session token budget exhausted (${usedTokens} >= ${session.budget.maxTokens})`);
      }
      if (session.usage.costUsd >= session.budget.maxUsd) {
        throw new Error(`session cost budget exhausted ($${session.usage.costUsd.toFixed(4)} >= $${session.budget.maxUsd})`);
      }
      const usedMinutes = session.usage.elapsedSeconds / 60;
      if (usedMinutes >= session.budget.maxMinutes) {
        throw new Error(`session generation-time budget exhausted (${usedMinutes.toFixed(1)} >= ${session.budget.maxMinutes} min)`);
      }

      const nowIso = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: `msg-${crypto.randomUUID()}`,
        role: 'user',
        status: 'completed',
        text,
        error: null,
        usage: null,
        provenance: null,
        actions: [],
        createdAt: nowIso,
        finishedAt: nowIso,
      };
      const assistantMessage: ChatMessage = {
        id: `msg-${crypto.randomUUID()}`,
        role: 'assistant',
        status: 'pending',
        text: '',
        error: null,
        usage: null,
        provenance: null,
        actions: [],
        createdAt: nowIso,
        finishedAt: null,
      };
      session.messages.push(userMessage, assistantMessage);
      session.updatedAt = nowIso;
      this.store.save(session);
      this.emitSession(session);

      const controller = new AbortController();
      this.pending.set(session.id, controller);
      void this.generate(session, assistantMessage.id, controller)
        .finally(() => this.pending.delete(session.id));

      return { ok: true, userMessageId: userMessage.id, assistantMessageId: assistantMessage.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Cancel the in-flight generation for a session (no-op result when none). */
  stop(sessionId: string): { ok: boolean; error?: string } {
    if (typeof sessionId !== 'string') return { ok: false, error: 'sessionId must be a string' };
    const controller = this.pending.get(sessionId);
    if (!controller) return { ok: false, error: 'no response is generating for this session' };
    controller.abort(new Error('cancelled by user'));
    return { ok: true };
  }

  deleteSession(sessionId: string): { ok: boolean; error?: string } {
    try {
      if (typeof sessionId !== 'string') throw new Error('sessionId must be a string');
      this.pending.get(sessionId)?.abort(new Error('session deleted'));
      this.store.delete(sessionId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ------------------------------------------------------------------ internals

  private async generate(sessionSnapshot: ChatSession, assistantMessageId: string, controller: AbortController): Promise<void> {
    const startedMs = this.now();
    // Generation-time ceiling: abort the call when the remaining minute
    // allowance elapses (a cancelled message is persisted, never billed blind).
    const remainingMs = Math.max(1, (sessionSnapshot.budget.maxMinutes - sessionSnapshot.usage.elapsedSeconds / 60) * 60_000);
    const timer = setTimeout(() => controller.abort(new Error('session exceeded its max-minutes budget')), remainingMs);
    try {
      const prompt = this.buildPrompt(sessionSnapshot);
      const tokenAllowance = Math.min(
        MAX_OUTPUT_TOKENS_PER_CALL,
        Math.max(1, Math.floor(sessionSnapshot.budget.maxTokens - sessionSnapshot.usage.inputTokens - sessionSnapshot.usage.outputTokens)),
      );
      const result = await this.generateFn({
        provider: sessionSnapshot.provider,
        model: sessionSnapshot.model,
        system: sessionSnapshot.mode === 'donna' ? DONNA_SYSTEM_PROMPT : DIRECTOR_SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: tokenAllowance,
        abortSignal: controller.signal,
      });
      clearTimeout(timer);

      const elapsedSeconds = Math.max(0, (this.now() - startedMs) / 1000);
      const usage = {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd:
          (result.inputTokens * sessionSnapshot.priceRates.inputUsdPerMillion +
            result.outputTokens * sessionSnapshot.priceRates.outputUsdPerMillion) /
          1_000_000,
      };
      const skillSha256: Record<string, string> = {};
      if (this.skills !== null) {
        for (const id of sessionSnapshot.skillIds) {
          const skill = this.skills.registry.get(id);
          if (skill?.verified) skillSha256[id] = skill.sha256;
        }
      }
      const provenance: ChatProvenance = {
        provider: sessionSnapshot.provider,
        model: sessionSnapshot.model,
        skillIds: [...sessionSnapshot.skillIds],
        skillSha256,
        promptSha256: sha256(prompt),
        textSha256: sha256(result.text),
      };
      this.finishMessage(sessionSnapshot.id, assistantMessageId, (session, message) => {
        message.status = 'completed';
        message.text = result.text;
        message.usage = usage;
        message.provenance = provenance;
        message.finishedAt = new Date().toISOString();
        session.usage.inputTokens += usage.inputTokens;
        session.usage.outputTokens += usage.outputTokens;
        session.usage.costUsd += usage.costUsd;
        session.usage.elapsedSeconds += elapsedSeconds;
      });
    } catch (err) {
      clearTimeout(timer);
      const cancelled = controller.signal.aborted;
      const reason = err instanceof Error ? err.message : String(err);
      this.finishMessage(sessionSnapshot.id, assistantMessageId, (_session, message) => {
        message.status = cancelled ? 'cancelled' : 'error';
        // Defense in depth: provider errors are sanitized upstream, but never
        // persist anything that looks like key material.
        message.error = (cancelled ? 'cancelled' : reason).replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted]').slice(0, 300);
        message.finishedAt = new Date().toISOString();
      });
    }
  }

  /** Re-read, mutate, persist + emit; the store file is the single truth. */
  private finishMessage(sessionId: string, messageId: string, mutate: (session: ChatSession, message: ChatMessage) => void): void {
    const session = this.store.get(sessionId);
    if (!session) return; // session was deleted while generating
    const message = session.messages.find((m) => m.id === messageId);
    if (!message) return;
    // Only a still-pending message may be finalized: a reconciled (post-
    // restart) or otherwise settled message is never clobbered by a late write.
    if (message.status !== 'pending') return;
    mutate(session, message);
    session.updatedAt = new Date().toISOString();
    this.store.save(session);
    this.emitSession(session);
  }

  /**
   * Deterministic prompt: project context (bounded), verified skill excerpts
   * (bounded), then the most recent completed exchanges (bounded). Everything
   * is capped UTF-8-safely; if the total would exceed MAX_CHAT_PROMPT_CHARS
   * the oldest history entries are dropped first.
   */
  private buildPrompt(session: ChatSession): string {
    const parts: string[] = [];

    if (session.projectId !== null) {
      const project = this.projectStore.getProject(session.projectId);
      if (project) {
        const goal = capUtf8(project.goal, MAX_GOAL_CONTEXT_CHARS);
        parts.push(
          `--- Linked project: ${project.name} ---`,
          `Goal:`,
          goal.truncated ? `${goal.text}\n${truncationMarker(goal)}` : goal.text,
        );
        if (project.successCriteria && project.successCriteria.length > 0) {
          parts.push(``, `Success criteria:`);
          for (const criterion of project.successCriteria) parts.push(`- ${criterion}`);
        }
        try {
          const latestRun = this.projectStore.listRuns(project.id)[0] ?? null;
          const snapshot = deriveOfficeSnapshot(project, latestRun, this.skills?.registry.skillRoles() ?? new Map());
          const lines: string[] = [`Office (${snapshot.nodeCount} nodes):`];
          for (const room of snapshot.rooms) {
            if (room.members.length === 0) continue;
            const members = room.members.map((m) => `${m.title} [${m.status}]`).join(', ');
            lines.push(`- ${room.label}: ${members}`);
          }
          const office = capUtf8(lines.join('\n'), MAX_OFFICE_CONTEXT_CHARS);
          parts.push(``, office.truncated ? `${office.text}\n${truncationMarker(office)}` : office.text);
        } catch {
          // Office projection is best-effort context; never fail a send on it.
        }
        parts.push(``, `--- End of project context ---`);
      }
    }

    // Bounded, provenance-stamped trusted skill briefings (verified only).
    if (this.skills !== null) {
      for (const id of session.skillIds) {
        const excerpt = this.skills.registry.excerpt(this.skills.root, id);
        if (excerpt) {
          parts.push(``, `--- Trusted skill briefing: ${excerpt.skill.name} (sha256 ${excerpt.skill.sha256.slice(0, 16)}…) ---`, excerpt.text);
        } else {
          parts.push(``, `--- Skill briefing unavailable: "${id}" is unknown or failed integrity verification ---`);
        }
      }
    }

    const history = session.messages.filter((m) => m.status === 'completed').slice(-MAX_HISTORY_MESSAGES);
    const historyBlocks: string[] = [];
    for (const message of history) {
      const capped = capUtf8(message.text, MAX_HISTORY_EXCERPT_CHARS);
      const header = message.role === 'user' ? 'User' : 'Director';
      historyBlocks.push(
        capped.truncated ? `${header} ${truncationMarker(capped)}:\n${capped.text}` : `${header}:\n${capped.text}`,
      );
    }

    // Drop the oldest history blocks until the total fits the prompt ceiling.
    let body = parts.join('\n');
    while (historyBlocks.length > 0 && body.length + historyBlocks.join('\n\n').length > MAX_CHAT_PROMPT_CHARS) {
      historyBlocks.shift();
    }
    if (historyBlocks.length > 0) body += `\n\n--- Conversation ---\n\n${historyBlocks.join('\n\n')}`;
    return body;
  }
}
