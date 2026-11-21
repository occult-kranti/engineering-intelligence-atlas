import type { DagSpec, Violation } from "@contracts/dag";
import { DagSpecSchema } from "@contracts/dag";
import { ACCEPTANCE_RULES } from "@contracts/artifacts";
import type { SkillStatus } from "@contracts/skill";
import { StrategyIdSchema } from "@contracts/prompting";
import { isDispatchableStrategy } from "../prompting/evaluation";

/**
 * Server-side DAG validation (spec §6.2). Runs identically on `dag.validate`,
 * `dag.saveRevision`, and at run start — the editor's own checks are never
 * trusted.
 */

export interface SkillLookup {
  status: SkillStatus;
  contentSha256: string;
  /** Tools the vetted skill manifest itself declares (a DAG may narrow, never widen). */
  toolsAllowed: string[];
}

export interface ValidationContext {
  resolveSkill: (name: string, version: string) => Promise<SkillLookup | null>;
  roleExists: (name: string) => Promise<boolean>;
  resourceExists: (url: string) => Promise<boolean>;
}

function v(rule: string, path: string, message: string): Violation {
  return { rule, path, message };
}

/** Kahn's algorithm; returns residual (cyclic) node keys, empty when acyclic. */
export function findCycle(spec: DagSpec): string[] {
  const keys = spec.nodes.map((n) => n.key);
  const indegree = new Map<string, number>(keys.map((k) => [k, 0]));
  const out = new Map<string, string[]>(keys.map((k) => [k, []]));
  for (const e of spec.edges) {
    if (!indegree.has(e.from) || !indegree.has(e.to)) continue;
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    out.get(e.from)!.push(e.to);
  }
  const queue = keys.filter((k) => (indegree.get(k) ?? 0) === 0);
  const seen = new Set<string>();
  while (queue.length) {
    const k = queue.shift()!;
    if (seen.has(k)) continue;
    seen.add(k);
    for (const nxt of out.get(k) ?? []) {
      indegree.set(nxt, (indegree.get(nxt) ?? 1) - 1);
      if ((indegree.get(nxt) ?? 0) === 0) queue.push(nxt);
    }
  }
  return keys.filter((k) => !seen.has(k));
}

/** Transitive upstream output artifact types via `artifact` edges. */
function upstreamArtifactOutputs(spec: DagSpec, key: string): Set<string> {
  const artifactIn = new Map<string, string[]>();
  for (const e of spec.edges) {
    if (e.kind !== "artifact") continue;
    artifactIn.set(e.to, [...(artifactIn.get(e.to) ?? []), e.from]);
  }
  const byKey = new Map(spec.nodes.map((n) => [n.key, n]));
  const produced = new Set<string>();
  const stack = [...(artifactIn.get(key) ?? [])];
  const seen = new Set<string>();
  while (stack.length) {
    const k = stack.pop()!;
    if (seen.has(k)) continue;
    seen.add(k);
    const upstream = byKey.get(k);
    if (upstream) produced.add(upstream.outputArtifactType);
    stack.push(...(artifactIn.get(k) ?? []));
  }
  return produced;
}

export async function validateDag(
  rawSpec: unknown,
  ctx: ValidationContext,
): Promise<{ ok: boolean; violations: Violation[] }> {
  const violations: Violation[] = [];

  const parsed = DagSpecSchema.safeParse(rawSpec);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      violations.push(
        v(
          "schema",
          issue.path.join("."),
          `${issue.message} (limits must be explicit, positive, nonzero, within ceilings)`,
        ),
      );
    }
    return { ok: false, violations };
  }
  const spec = parsed.data;

  // Rule 6a: unique node keys.
  const seenKeys = new Set<string>();
  for (const n of spec.nodes) {
    if (seenKeys.has(n.key)) {
      violations.push(
        v("unique-keys", `nodes.${n.key}`, `duplicate node key "${n.key}"`),
      );
    }
    seenKeys.add(n.key);
  }

  // Rule 1: acyclicity — cycles are rejected, never "resolved".
  const cyclic = findCycle(spec);
  if (cyclic.length > 0) {
    violations.push(
      v(
        "acyclicity",
        "edges",
        `cycle detected involving node(s): ${cyclic.join(", ")}`,
      ),
    );
  }

  // Rule 2a: edge endpoints exist; no self-loops; no duplicate edges.
  const keySet = new Set(spec.nodes.map((n) => n.key));
  const seenEdges = new Set<string>();
  for (const e of spec.edges) {
    if (!keySet.has(e.from) || !keySet.has(e.to)) {
      violations.push(
        v(
          "referential-integrity",
          `edges.${e.from}->${e.to}`,
          "edge endpoint does not resolve to a node key",
        ),
      );
    }
    if (e.from === e.to) {
      violations.push(
        v("acyclicity", `edges.${e.from}`, "self-loop edge is a cycle"),
      );
    }
    const sig = `${e.from}->${e.to}:${e.kind}`;
    if (seenEdges.has(sig)) {
      violations.push(v("unique-edges", `edges.${sig}`, "duplicate edge"));
    }
    seenEdges.add(sig);
  }

  // Rule 4: run budget ≥ each node budget (schema already enforced positivity/ceilings).
  for (const n of spec.nodes) {
    if (n.budget.maxTokens > spec.budget.maxTokens) {
      violations.push(
        v(
          "budget-sanity",
          `nodes.${n.key}.budget.maxTokens`,
          "node token budget exceeds run token budget",
        ),
      );
    }
    if (n.budget.maxCalls > spec.budget.maxCalls) {
      violations.push(
        v(
          "budget-sanity",
          `nodes.${n.key}.budget.maxCalls`,
          "node call budget exceeds run call budget",
        ),
      );
    }
    if (n.budget.maxMinutes > spec.budget.maxMinutes) {
      violations.push(
        v(
          "budget-sanity",
          `nodes.${n.key}.budget.maxMinutes`,
          "node minute budget exceeds run minute budget",
        ),
      );
    }
    if (n.budget.maxCostUsd > spec.budget.maxCostUsd) {
      violations.push(
        v(
          "budget-sanity",
          `nodes.${n.key}.budget.maxCostUsd`,
          "node dollar budget exceeds run dollar budget",
        ),
      );
    }
    // Rule 3a: output artifact type must be registered.
    if (!(n.outputArtifactType in ACCEPTANCE_RULES)) {
      violations.push(
        v(
          "contract-typing",
          `nodes.${n.key}.outputArtifactType`,
          `unregistered artifact type "${n.outputArtifactType}" (no acceptance schema)`,
        ),
      );
    }
    for (const t of n.inputArtifactTypes) {
      if (!(t in ACCEPTANCE_RULES)) {
        violations.push(
          v(
            "contract-typing",
            `nodes.${n.key}.inputArtifactTypes`,
            `unregistered artifact type "${t}"`,
          ),
        );
      }
    }
    // Rule 8: a requested prompt strategy must be a known, dispatch-eligible
    // catalog id. Evaluation-only or orchestration-requiring strategies can
    // never enter normal dispatch (they are compilable offline only).
    if (n.promptStrategy) {
      const parsedId = StrategyIdSchema.safeParse(n.promptStrategy.id);
      if (!parsedId.success) {
        violations.push(
          v(
            "prompt-strategy",
            `nodes.${n.key}.promptStrategy.id`,
            `unknown prompt strategy "${n.promptStrategy.id}"`,
          ),
        );
      } else if (!isDispatchableStrategy(parsedId.data)) {
        violations.push(
          v(
            "prompt-strategy",
            `nodes.${n.key}.promptStrategy.id`,
            `strategy "${parsedId.data}" is evaluation-only or requires orchestration; it cannot enter normal dispatch (compile it via the evaluation API instead)`,
          ),
        );
      }
    }
  }

  // Rule 3b: input artifact types must be produced by transitive artifact upstreams.
  for (const n of spec.nodes) {
    if (n.inputArtifactTypes.length === 0) continue;
    const produced = upstreamArtifactOutputs(spec, n.key);
    for (const t of n.inputArtifactTypes) {
      if (!produced.has(t)) {
        violations.push(
          v(
            "contract-typing",
            `nodes.${n.key}.inputArtifactTypes`,
            `input artifact type "${t}" is not produced by any transitive artifact upstream`,
          ),
        );
      }
    }
  }

  // Rule 2b: skill pins resolve to vetted rows with matching content hash;
  // rule 6b: toolsAllowed narrows the skill manifest, never widens it.
  const skillCache = new Map<string, SkillLookup | null>();
  for (const n of spec.nodes) {
    const cacheKey = `${n.skill.name}@${n.skill.version}`;
    if (!skillCache.has(cacheKey)) {
      skillCache.set(
        cacheKey,
        await ctx.resolveSkill(n.skill.name, n.skill.version),
      );
    }
    const skill = skillCache.get(cacheKey);
    if (!skill) {
      violations.push(
        v(
          "skill-pin",
          `nodes.${n.key}.skill`,
          `skill ${cacheKey} not found in registry`,
        ),
      );
      continue;
    }
    if (skill.status !== "vetted") {
      violations.push(
        v(
          "skill-pin",
          `nodes.${n.key}.skill`,
          `skill ${cacheKey} is "${skill.status}" — only vetted skills are assignable`,
        ),
      );
    }
    if (skill.contentSha256 !== n.skill.sha256) {
      violations.push(
        v(
          "skill-pin",
          `nodes.${n.key}.skill.sha256`,
          `pinned hash does not match registry content hash (hash drift)`,
        ),
      );
    }
    for (const tool of n.toolsAllowed) {
      if (!skill.toolsAllowed.includes(tool)) {
        violations.push(
          v(
            "capability-scope",
            `nodes.${n.key}.toolsAllowed`,
            `tool "${tool}" is not declared by the skill manifest; a DAG can narrow but never widen capabilities`,
          ),
        );
      }
    }
  }

  // Roles resolve against the seeded registry; resources against curated URLs.
  const roleCache = new Map<string, boolean>();
  for (const n of spec.nodes) {
    if (!roleCache.has(n.role)) roleCache.set(n.role, await ctx.roleExists(n.role));
    if (!roleCache.get(n.role)) {
      violations.push(
        v(
          "role-reference",
          `nodes.${n.key}.role`,
          `role "${n.role}" is not in the role registry`,
        ),
      );
    }
    for (const url of n.resourceUrls) {
      if (!(await ctx.resourceExists(url))) {
        violations.push(
          v(
            "resource-reference",
            `nodes.${n.key}.resourceUrls`,
            `resource URL ${url} is not in the curated resource registry`,
          ),
        );
      }
    }
  }

  return { ok: violations.length === 0, violations };
}
