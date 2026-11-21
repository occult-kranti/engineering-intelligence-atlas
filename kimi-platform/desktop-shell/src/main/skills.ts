import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  HireAssignment,
  HirePlanPreview,
  Project,
  ProjectNode,
  SkillSummary,
} from '../shared/contract';
import { capUtf8, truncationMarker } from './textCap';

/**
 * Bundled atlas SkillRegistry.
 *
 * Skills are DATA: the registry reads only the SKILL.md body referenced by the
 * reviewed catalog (resources/skills/skills.catalog.json) and treats every
 * other bundled file — including scripts/ — as inert payload that is never
 * read into prompts and NEVER executed. Every body is re-hashed at load and
 * compared against the catalog sha256; mismatches are reported as
 * `verified: false` and excluded from hiring and prompts.
 *
 * No secrets: catalog entries and excerpts contain documentation text only.
 */

export const MAX_SKILL_EXCERPT_CHARS = 4000;
const MAX_DESCRIPTION = 600;
const MAX_KEYWORDS = 32;
const MAX_SKILL_ID = 80;
const SAFE_SKILL_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  role: string;
  keywords: string[];
  sha256: string;
  path: string;
}

export interface SkillExcerpt {
  text: string;
  truncated: boolean;
  originalLength: number;
  keptLength: number;
  skill: SkillSummary;
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Stable JSON (sorted keys, recursively) for approval/plan hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

export function hashPayload(payload: unknown): string {
  return sha256(canonicalJson(payload));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Validate one raw catalog entry; throws with a precise reason. */
function validateEntry(raw: unknown, index: number): SkillCatalogEntry {
  if (!isRecord(raw)) throw new Error(`skills catalog entry ${index} must be an object`);
  const id = String(raw.id ?? '');
  if (!SAFE_SKILL_ID.test(id) || id.length > MAX_SKILL_ID) throw new Error(`skills catalog entry ${index}: invalid id`);
  const name = String(raw.name ?? '').trim();
  if (name.length === 0 || name.length > 120) throw new Error(`skill ${id}: invalid name`);
  const description = String(raw.description ?? '').trim();
  if (description.length === 0 || description.length > MAX_DESCRIPTION) throw new Error(`skill ${id}: invalid description`);
  const role = String(raw.role ?? '').trim();
  if (role.length === 0 || role.length > 40) throw new Error(`skill ${id}: invalid role`);
  if (!Array.isArray(raw.keywords) || raw.keywords.length > MAX_KEYWORDS) {
    throw new Error(`skill ${id}: keywords must be an array of at most ${MAX_KEYWORDS}`);
  }
  const keywords = raw.keywords.map((k) => {
    const kw = String(k).trim().toLowerCase();
    if (kw.length === 0 || kw.length > 40) throw new Error(`skill ${id}: invalid keyword`);
    return kw;
  });
  const hash = String(raw.sha256 ?? '');
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error(`skill ${id}: invalid sha256`);
  const relPath = String(raw.path ?? '');
  // Body path must stay inside the skills root and point at a SKILL.md.
  if (relPath !== `${id}/SKILL.md`) throw new Error(`skill ${id}: unexpected body path`);
  return { id, name, description, role, keywords, sha256: hash, path: relPath };
}

export class SkillRegistry {
  private readonly skills = new Map<string, SkillSummary>();

  constructor(skillsRoot: string) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(skillsRoot, 'skills.catalog.json'), 'utf8'));
    } catch (err) {
      throw new Error(`cannot load skills catalog: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!isRecord(raw) || !Array.isArray(raw.skills)) throw new Error('skills catalog must contain a skills array');
    raw.skills.forEach((entry, i) => {
      const validated = validateEntry(entry, i);
      if (this.skills.has(validated.id)) throw new Error(`duplicate skill id ${validated.id}`);
      // Re-hash the on-disk body; a tampered body is reported, never trusted.
      let verified = false;
      try {
        const body = fs.readFileSync(path.join(skillsRoot, validated.path), 'utf8');
        verified = sha256(body) === validated.sha256;
      } catch {
        verified = false;
      }
      this.skills.set(validated.id, { ...validated, verified });
    });
  }

  list(): SkillSummary[] {
    return [...this.skills.values()].map((s) => ({ ...s, keywords: [...s.keywords] }));
  }

  /** skill id -> canonical room id, for office room derivation. */
  skillRoles(): Map<string, string> {
    return new Map([...this.skills.values()].map((s) => [s.id, s.role]));
  }

  get(id: string): SkillSummary | null {
    const skill = this.skills.get(id);
    return skill ? { ...skill, keywords: [...skill.keywords] } : null;
  }

  /**
   * Bounded, provenance-stamped SKILL.md excerpt for inclusion in a worker
   * prompt. Returns null for unknown or unverified (tampered) skills.
   */
  excerpt(skillsRoot: string, id: string, maxChars: number = MAX_SKILL_EXCERPT_CHARS): SkillExcerpt | null {
    const skill = this.skills.get(id);
    if (!skill || !skill.verified) return null;
    let body: string;
    try {
      body = fs.readFileSync(path.join(skillsRoot, skill.path), 'utf8');
    } catch {
      return null;
    }
    const capped = capUtf8(body, Math.min(maxChars, MAX_SKILL_EXCERPT_CHARS));
    const provenance = `skill: ${skill.id} | name: ${skill.name} | sha256: ${skill.sha256}`;
    const text = capped.truncated ? `${capped.text}\n${truncationMarker(capped)}` : capped.text;
    return {
      text: `[${provenance}]\n${text}`,
      truncated: capped.truncated,
      originalLength: capped.originalLength,
      keptLength: capped.keptLength,
      skill,
    };
  }
}

// ---------------------------------------------------------------------------
// Deterministic goal -> skill hire preview + plan validation
// ---------------------------------------------------------------------------

const WORD_SPLIT = /[^a-z0-9]+/;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(WORD_SPLIT)
      .filter((w) => w.length >= 2),
  );
}

/**
 * A keyword hits a token set when ALL of its tokens are present. Keywords and
 * goal/node text are normalized with the SAME tokenizer, so a hyphenated
 * catalog keyword like "peer-review" matches goal text "peer review".
 */
function keywordHits(keyword: string, targets: Set<string>): boolean {
  const tokens = tokenize(keyword);
  if (tokens.size === 0) return false;
  for (const token of tokens) {
    if (!targets.has(token)) return false;
  }
  return true;
}

/** Nodes that may receive a skill: everything except the root Director. */
export function isHirableNode(node: ProjectNode): boolean {
  if (node.skillRef != null) return false; // already hired
  if (node.kind === 'director' || node.depth === 0 || node.role === 'director') return false;
  return true;
}

/**
 * Deterministic hire preview: scores every hirable node against every
 * verified skill by keyword overlap with the goal/success criteria and the
 * node title/instructions. Ties break by lexicographic skill id. Pure — the
 * same project always yields the same preview and the same planHash.
 */
export function computeHirePreview(project: Project, registry: SkillRegistry): HirePlanPreview {
  const skills = registry
    .list()
    .filter((s) => s.verified)
    .sort((a, b) => a.id.localeCompare(b.id));
  const goalTokens = tokenize([project.goal, ...(project.successCriteria ?? [])].join('\n'));

  const assignments: HireAssignment[] = [];
  for (const node of [...project.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!isHirableNode(node)) continue;
    const nodeTokens = tokenize(`${node.title}\n${node.instructions}`);
    let best: { skill: SkillSummary; matched: string[]; score: number } | null = null;
    for (const skill of skills) {
      const matched = skill.keywords.filter((kw) => keywordHits(kw, goalTokens) || keywordHits(kw, nodeTokens)).sort();
      // Goal keywords weigh double: hiring is goal-driven, node text refines.
      const score = skill.keywords.reduce(
        (acc, kw) => acc + (keywordHits(kw, goalTokens) ? 2 : 0) + (keywordHits(kw, nodeTokens) ? 1 : 0),
        0,
      );
      if (score <= 0) continue;
      if (best === null || score > best.score || (score === best.score && skill.id < best.skill.id)) {
        best = { skill, matched, score };
      }
    }
    if (best !== null) {
      assignments.push({
        nodeId: node.id,
        nodeTitle: node.title,
        skillId: best.skill.id,
        skillName: best.skill.name,
        skillSha256: best.skill.sha256,
        matchedKeywords: best.matched,
        score: best.score,
      });
    }
  }
  assignments.sort((a, b) => a.nodeId.localeCompare(b.nodeId));

  const payload = {
    projectId: project.id,
    projectVersion: project.version,
    assignments: assignments.map((a) => ({ nodeId: a.nodeId, skillId: a.skillId, skillSha256: a.skillSha256 })),
  };
  return {
    projectId: project.id,
    projectVersion: project.version,
    assignments,
    planHash: hashPayload(payload),
  };
}

export interface ValidatedHire {
  nodeId: string;
  skillId: string;
  skillSha256: string;
}

/**
 * Validate a (manual or preview-derived) hire plan against the live project
 * and registry. Bounded, duplicate-safe, and refuses unknown/unverified
 * skills and non-hirable nodes. Returns canonicalized sorted assignments.
 */
export function validateHirePlan(
  project: Project,
  registry: SkillRegistry,
  rawAssignments: unknown,
): ValidatedHire[] {
  if (!Array.isArray(rawAssignments) || rawAssignments.length === 0) {
    throw new Error('assignments must be a non-empty array');
  }
  if (rawAssignments.length > project.nodes.length) {
    throw new Error('assignments exceed the number of project nodes');
  }
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: ValidatedHire[] = [];
  for (const raw of rawAssignments) {
    if (!isRecord(raw)) throw new Error('each assignment must be an object');
    const nodeId = String(raw.nodeId ?? '');
    const skillId = String(raw.skillId ?? '');
    const node = byId.get(nodeId);
    if (!node) throw new Error(`unknown node id "${nodeId}"`);
    if (seen.has(nodeId)) throw new Error(`duplicate hire for node "${nodeId}"`);
    if (!isHirableNode(node)) throw new Error(`node "${nodeId}" is not hirable (root director or already hired)`);
    const skill = registry.get(skillId);
    if (!skill) throw new Error(`unknown skill id "${skillId}"`);
    if (!skill.verified) throw new Error(`skill "${skillId}" failed integrity verification`);
    seen.add(nodeId);
    out.push({ nodeId, skillId: skill.id, skillSha256: skill.sha256 });
  }
  out.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  return out;
}
