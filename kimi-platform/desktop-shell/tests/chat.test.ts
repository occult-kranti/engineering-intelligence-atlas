import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ChatSession } from '../src/shared/contract';
import {
  ChatManager,
  ChatStore,
  DEFAULT_CHAT_SKILL_IDS,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_MESSAGES_PER_SESSION,
} from '../src/main/chat';
import { ProjectStore, type GenerateFn } from '../src/main/projects';
import { SkillRegistry } from '../src/main/skills';

const SKILLS_ROOT = path.join(__dirname, '..', 'resources', 'skills');
const RATES = { inputUsdPerMillion: 1, outputUsdPerMillion: 2 };

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chat-test-'));
}

async function waitFor(cond: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

function readAllFiles(dir: string): string {
  let out = '';
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out += readAllFiles(p);
    else out += fs.readFileSync(p, 'utf8');
  }
  return out;
}

const simpleGenerate: GenerateFn = async (req) => ({
  text: `answer to: ${req.prompt.split('\n').pop()}`,
  inputTokens: 10,
  outputTokens: 20,
});

describe('chat sessions', () => {
  let dir: string;
  let store: ChatStore;
  let projectStore: ProjectStore;
  let skills: { registry: SkillRegistry; root: string };

  beforeEach(() => {
    dir = tmpdir();
    store = new ChatStore(dir);
    projectStore = new ProjectStore(dir);
    skills = { registry: new SkillRegistry(SKILLS_ROOT), root: SKILLS_ROOT };
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  function makeManager(generate: GenerateFn = simpleGenerate): ChatManager {
    return new ChatManager(store, projectStore, generate, { skills });
  }

  function makeSession(manager: ChatManager, extra: Record<string, unknown> = {}): ChatSession {
    const res = manager.createSession({ provider: 'openai', model: 'gpt-5-mini', priceRates: RATES, ...extra });
    expect(res.ok).toBe(true);
    return res.session as ChatSession;
  }

  it('creates sessions with the default Director skill pair and persists them', () => {
    const manager = makeManager();
    const session = makeSession(manager);
    expect(session.skillIds).toEqual([...DEFAULT_CHAT_SKILL_IDS]);
    expect(session.messages).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'chats', session.id, 'session.json'))).toBe(true);
    // Rehydrated view: listed + retrievable.
    const manager2 = makeManager();
    expect(manager2.listSessions().map((s) => s.id)).toContain(session.id);
    expect(manager2.getSession(session.id)?.model).toBe('gpt-5-mini');
    expect(manager2.listSessions()[0]?.messageCount).toBe(0);
  });

  it('validates provider, model, skill ids, budget and price rates', () => {
    const manager = makeManager();
    expect(manager.createSession({ provider: 'azure', model: 'm', priceRates: RATES }).ok).toBe(false);
    expect(manager.createSession({ provider: 'openai', model: '', priceRates: RATES }).ok).toBe(false);
    expect(manager.createSession({ provider: 'openai', model: 'm', priceRates: RATES, skillIds: ['no-such-skill'] }).ok).toBe(false);
    const bad = manager.createSession({ provider: 'openai', model: 'm', priceRates: RATES, budget: { maxTokens: -1 } });
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/maxTokens/);
    const badRates = manager.createSession({ provider: 'openai', model: 'm', priceRates: { inputUsdPerMillion: -1, outputUsdPerMillion: 0 } });
    expect(badRates.ok).toBe(false);
  });

  it('links an existing project and rejects unknown project ids', () => {
    const manager = makeManager();
    const project = projectStore.createProject({ name: 'P', goal: 'g', provider: 'openai', model: 'm' });
    const session = makeSession(manager, { projectId: project.id });
    expect(session.projectId).toBe(project.id);
    expect(manager.createSession({ provider: 'openai', model: 'm', priceRates: RATES, projectId: 'proj-nope' }).ok).toBe(false);
  });

  it('requires explicit confirmation and validates message length/quotas', async () => {
    const manager = makeManager();
    const session = makeSession(manager);
    const unconfirmed = manager.sendMessage({ sessionId: session.id, text: 'hi', confirmed: false });
    expect(unconfirmed.ok).toBe(false);
    expect(unconfirmed.error).toMatch(/confirmation/);
    expect(manager.sendMessage({ sessionId: session.id, text: '', confirmed: true }).ok).toBe(false);
    expect(manager.sendMessage({ sessionId: session.id, text: 'x'.repeat(MAX_CHAT_MESSAGE_CHARS + 1), confirmed: true }).ok).toBe(false);
    expect(manager.sendMessage({ sessionId: 'chat-nope', text: 'hi', confirmed: true }).ok).toBe(false);
    expect(manager.getSession(session.id)?.messages).toHaveLength(0);
  });

  it('sends asynchronously: pending state persists, then completes with usage + provenance', async () => {
    let seenPrompt = '';
    let seenSystem = '';
    const generate: GenerateFn = async (req) => {
      seenPrompt = req.prompt;
      seenSystem = req.system;
      return { text: 'director answer', inputTokens: 100, outputTokens: 50 };
    };
    const manager = makeManager(generate);
    const session = makeSession(manager);
    const res = manager.sendMessage({ sessionId: session.id, text: 'What should we research?', confirmed: true });
    expect(res.ok).toBe(true);

    // Pending state is observable immediately (fire-and-poll).
    const pending = manager.getSession(session.id) as ChatSession;
    expect(pending.messages).toHaveLength(2);
    expect(pending.messages[0]?.role).toBe('user');
    expect(pending.messages[1]?.status).toBe('pending');

    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'completed');
    const done = manager.getSession(session.id) as ChatSession;
    const assistant = done.messages[1];
    expect(assistant?.text).toBe('director answer');
    expect(assistant?.usage).toEqual({ inputTokens: 100, outputTokens: 50, costUsd: (100 * 1 + 50 * 2) / 1_000_000 });
    expect(assistant?.provenance?.provider).toBe('openai');
    expect(assistant?.provenance?.model).toBe('gpt-5-mini');
    expect(assistant?.provenance?.skillIds).toEqual([...DEFAULT_CHAT_SKILL_IDS]);
    expect(assistant?.provenance?.promptSha256).toBe(crypto.createHash('sha256').update(seenPrompt, 'utf8').digest('hex'));
    expect(assistant?.provenance?.textSha256).toBe(crypto.createHash('sha256').update('director answer', 'utf8').digest('hex'));
    for (const id of DEFAULT_CHAT_SKILL_IDS) {
      expect(assistant?.provenance?.skillSha256[id]).toMatch(/^[0-9a-f]{64}$/);
    }
    // Session totals accumulated.
    expect(done.usage.inputTokens).toBe(100);
    expect(done.usage.outputTokens).toBe(50);

    // Deterministic Director prompt: CoT is explicitly refused, briefings included.
    expect(seenSystem).toContain('Research Director');
    expect(seenSystem).toContain('Do not reveal internal chain-of-thought');
    expect(seenSystem).not.toMatch(/show your reasoning|think step[- ]by[- ]step/i);
    expect(seenPrompt).toContain('--- Trusted skill briefing:');
    expect(seenPrompt).toContain('User:\nWhat should we research?');
  });

  it('includes bounded verified skill excerpts and linked project context', async () => {
    let seenPrompt = '';
    const generate: GenerateFn = async (req) => {
      seenPrompt = req.prompt;
      return { text: 'ok', inputTokens: 1, outputTokens: 1 };
    };
    const manager = makeManager(generate);
    const project = projectStore.createProject({
      name: 'Frontier scan',
      goal: 'Map the AI research frontier',
      provider: 'openai',
      model: 'm',
      successCriteria: ['weekly digest'],
    });
    const session = makeSession(manager, { projectId: project.id, skillIds: ['ai-research-frontier'] });
    manager.sendMessage({ sessionId: session.id, text: 'plan', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'completed');
    expect(seenPrompt).toContain('--- Linked project: Frontier scan ---');
    expect(seenPrompt).toContain('Map the AI research frontier');
    expect(seenPrompt).toContain('- weekly digest');
    expect(seenPrompt).toContain('Office (4 nodes):');
    expect(seenPrompt).toContain('skill: ai-research-frontier');
  });

  it('bounds recent history in the prompt UTF-8-safely', async () => {
    const prompts: string[] = [];
    const generate: GenerateFn = async (req) => {
      prompts.push(req.prompt);
      return { text: 'a'.repeat(10), inputTokens: 1, outputTokens: 1 };
    };
    const manager = makeManager(generate);
    const session = makeSession(manager, { skillIds: ['ai-research-frontier'] });
    // First message contains an astral-heavy tail to exercise the UTF-8 cap.
    manager.sendMessage({ sessionId: session.id, text: '😀'.repeat(1500) + 'x'.repeat(1500), confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'completed');
    manager.sendMessage({ sessionId: session.id, text: 'second', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[3]?.status === 'completed');
    const secondPrompt = prompts[1] as string;
    expect(secondPrompt).toMatch(/\[truncated: showing \d+ of \d+ characters\]/);
    // No broken surrogate pairs: UTF-8 round-trip is lossless.
    expect(Buffer.from(secondPrompt, 'utf8').toString('utf8')).toBe(secondPrompt);
    expect(secondPrompt).toContain('User:\nsecond');
  });

  it('stops an in-flight generation via AbortController and persists cancellation', async () => {
    const generate: GenerateFn = (req) =>
      new Promise((_resolve, reject) => {
        req.abortSignal.addEventListener('abort', () => reject(req.abortSignal.reason ?? new Error('aborted')), { once: true });
      });
    const manager = makeManager(generate);
    const session = makeSession(manager);
    manager.sendMessage({ sessionId: session.id, text: 'slow question', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'pending');
    expect(manager.stop(session.id).ok).toBe(true);
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'cancelled');
    const assistant = manager.getSession(session.id)?.messages[1];
    expect(assistant?.error).toBe('cancelled');
    expect(assistant?.usage).toBeNull();
    // No double-stop.
    expect(manager.stop(session.id).ok).toBe(false);
  });

  it('persists provider errors without leaking key material', async () => {
    const KEY = 'sk-test-0123456789abcdef0123456789abcdef';
    const generate: GenerateFn = async () => {
      throw new Error(`401 Unauthorized: invalid api key ${KEY}`);
    };
    const manager = makeManager(generate);
    const session = makeSession(manager);
    manager.sendMessage({ sessionId: session.id, text: 'hi', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'error');
    const everything = readAllFiles(path.join(dir, 'chats'));
    expect(everything).not.toContain(KEY);
    expect(manager.getSession(session.id)?.messages[1]?.status).toBe('error');
  });

  it('fails cleanly when no API key is configured (GenerateFn throws)', async () => {
    // Mirrors main/index.ts: vault returns null -> GenerateFn throws.
    const generate: GenerateFn = async (req) => {
      if (req.provider !== 'ollama') throw new Error(`No usable ${req.provider} API key is configured.`);
      return { text: 'ok', inputTokens: 1, outputTokens: 1 };
    };
    const manager = makeManager(generate);
    const session = makeSession(manager);
    manager.sendMessage({ sessionId: session.id, text: 'hi', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'error');
    expect(manager.getSession(session.id)?.messages[1]?.error).toMatch(/No usable openai API key/);

    // Ollama needs no key.
    const local = makeSession(manager, { provider: 'ollama', model: 'llama3' });
    manager.sendMessage({ sessionId: local.id, text: 'hi', confirmed: true });
    await waitFor(() => manager.getSession(local.id)?.messages[1]?.status === 'completed');
  });

  it('enforces hard token and USD ceilings (refuses before any billed call)', async () => {
    let calls = 0;
    const generate: GenerateFn = async () => {
      calls += 1;
      return { text: 'ok', inputTokens: 60, outputTokens: 60 };
    };
    const manager = makeManager(generate);
    const session = makeSession(manager, { budget: { maxTokens: 100, maxMinutes: 30, maxUsd: 10 } });
    manager.sendMessage({ sessionId: session.id, text: 'one', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'completed');
    // 120 tokens used > 100 ceiling: the next send is refused, no new call.
    const refused = manager.sendMessage({ sessionId: session.id, text: 'two', confirmed: true });
    expect(refused.ok).toBe(false);
    expect(refused.error).toMatch(/token budget exhausted/);
    expect(calls).toBe(1);

    const costly = makeSession(manager, { budget: { maxTokens: 100000, maxMinutes: 30, maxUsd: 0.00001 } });
    manager.sendMessage({ sessionId: costly.id, text: 'one', confirmed: true });
    await waitFor(() => manager.getSession(costly.id)?.messages[1]?.status === 'completed');
    const refusedUsd = manager.sendMessage({ sessionId: costly.id, text: 'two', confirmed: true });
    expect(refusedUsd.ok).toBe(false);
    expect(refusedUsd.error).toMatch(/cost budget exhausted/);
    expect(calls).toBe(2);
  });

  it('enforces the generation-minutes ceiling', async () => {
    let now = 1_000_000;
    const generate: GenerateFn = async () => {
      now += 120_000; // 2 minutes of wall clock per call
      return { text: 'ok', inputTokens: 1, outputTokens: 1 };
    };
    const manager = new ChatManager(store, projectStore, generate, { skills, now: () => now });
    const session = makeSession(manager, { budget: { maxTokens: 100000, maxMinutes: 1, maxUsd: 10 } });
    manager.sendMessage({ sessionId: session.id, text: 'one', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'completed');
    const refused = manager.sendMessage({ sessionId: session.id, text: 'two', confirmed: true });
    expect(refused.ok).toBe(false);
    expect(refused.error).toMatch(/generation-time budget exhausted/);
  });

  it('enforces the per-session message quota', () => {
    const manager = makeManager();
    const session = makeSession(manager);
    const s = store.get(session.id) as ChatSession;
    for (let i = 0; i < MAX_MESSAGES_PER_SESSION; i += 1) {
      s.messages.push({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        status: 'completed',
        text: 'x',
        error: null,
        usage: null,
        provenance: null,
        actions: [],
        createdAt: new Date().toISOString(),
        finishedAt: null,
      });
    }
    store.save(s);
    const res = manager.sendMessage({ sessionId: session.id, text: 'over', confirmed: true });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/message quota/);
  });

  it('rejects concurrent sends while a response is generating', async () => {
    let release: (() => void) | null = null;
    const generate: GenerateFn = () => new Promise((resolve) => {
      release = () => resolve({ text: 'ok', inputTokens: 1, outputTokens: 1 });
    });
    const manager = makeManager(generate);
    const session = makeSession(manager);
    expect(manager.sendMessage({ sessionId: session.id, text: 'one', confirmed: true }).ok).toBe(true);
    const second = manager.sendMessage({ sessionId: session.id, text: 'two', confirmed: true });
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/already generating/);
    release?.();
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'completed');
  });

  it('reconciles a stranded pending message after a restart', async () => {
    let release: (() => void) | null = null;
    const generate: GenerateFn = () => new Promise((resolve) => {
      release = () => resolve({ text: 'late', inputTokens: 1, outputTokens: 1 });
    });
    const manager = makeManager(generate);
    const session = makeSession(manager);
    manager.sendMessage({ sessionId: session.id, text: 'hi', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'pending');

    // Simulate process death: a NEW manager on the same store reconciles.
    const manager2 = makeManager(generate);
    const recovered = manager2.getSession(session.id) as ChatSession;
    expect(recovered.messages[1]?.status).toBe('error');
    expect(recovered.messages[1]?.error).toMatch(/Interrupted/);
    release?.(); // late completion must not clobber the reconciled state
    await new Promise((r) => setTimeout(r, 50));
    expect(manager2.getSession(session.id)?.messages[1]?.status).toBe('error');
    expect(manager).toBeDefined();
  });

  it('deletes sessions and aborts any in-flight generation', async () => {
    const generate: GenerateFn = (req) =>
      new Promise((_resolve, reject) => {
        req.abortSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    const manager = makeManager(generate);
    const session = makeSession(manager);
    manager.sendMessage({ sessionId: session.id, text: 'hi', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'pending');
    expect(manager.deleteSession(session.id).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(manager.getSession(session.id)).toBeNull();
    expect(fs.existsSync(path.join(dir, 'chats', session.id))).toBe(false);
    expect(manager.deleteSession(session.id).ok).toBe(true); // idempotent
  });

  it('persists no secrets anywhere in the chats directory', async () => {
    const manager = makeManager();
    const session = makeSession(manager);
    manager.sendMessage({ sessionId: session.id, text: 'hi', confirmed: true });
    await waitFor(() => manager.getSession(session.id)?.messages[1]?.status === 'completed');
    const everything = readAllFiles(path.join(dir, 'chats'));
    expect(everything).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(everything).not.toContain('apiKey');
    expect(everything).not.toContain('safeStorage');
  });
});
