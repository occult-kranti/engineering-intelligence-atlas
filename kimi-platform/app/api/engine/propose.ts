import { z } from "zod";
import { createHash } from "node:crypto";
import type { DagSpec, NodeSpec } from "@contracts/dag";
import {
  defaultNodeBudget,
  defaultRunBudget,
  defaultTermination,
} from "@contracts/dag";
import type { Skill } from "@db/schema";
import { getProvider } from "../ai/provider";
import type { ProviderId } from "@contracts/run";
import {
  DEPTH_HEURISTIC_LABEL,
  type LinkedResource,
  type ProposalNodeCoverage,
  type ResourceSelection,
} from "@contracts/registry";
import { selectRoleResources } from "../registry/selection";

/**
 * Director squad/DAG proposals (spec §5.1, §8.6).
 * Mock mode: fully deterministic from the goal text — same goal yields the
 * same plan. Live mode: the provider proposes structure; ALL references are
 * then re-resolved server-side against the registry (roles must exist, skills
 * are re-pinned to vetted rows with their real content hashes, resources come
 * from the curated registry). The proposal is never executed and never saved
 * automatically — it returns to the human editor for edit + approval.
 *
 * Resource selection is role/goal-relevant via the role→resource matrix
 * (never arbitrary): core links before trigger-matched conditional before
 * internal, ordered by relevance with deterministic caps; stale resources
 * are excluded and reported. Every proposal carries per-node coverage/gap
 * information.
 */

export interface RegistryRoleProfileSlice {
  slug: string;
  depthScore: number;
  depthBand: string;
  capabilityGaps: string[];
}

export interface RegistrySlice {
  roles: string[];
  /** Role name → matrix profile (depth/gaps) when the role is in the matrix. */
  profilesByRole: Map<string, RegistryRoleProfileSlice>;
  /** Role name → curated role→resource links. */
  linksByRole: Map<string, LinkedResource[]>;
  vettedSkills: Pick<Skill, "name" | "version" | "contentSha256" | "manifest">[];
}

/** Resources admitted per node in a proposal (deterministic cap). */
export const PROPOSAL_MAX_RESOURCES = 6;

const PlanProposalSchema = z.object({
  nodes: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        role: z.string().min(1).max(200),
        goal: z.string().min(1).max(4000),
        outputArtifactType: z.string().min(1),
        inputArtifactTypes: z.array(z.string()).default([]),
        approvalBefore: z.enum(["start", "accept"]).optional(),
      }),
    )
    .min(1)
    .max(12),
  edges: z.array(
    z.object({ from: z.string(), to: z.string(), kind: z.enum(["artifact", "control"]) }),
  ),
});

function pickSkill(
  skills: RegistrySlice["vettedSkills"],
  outputType: string,
  seed: number,
): RegistrySlice["vettedSkills"][number] | null {
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  const matching = sorted.filter((s) =>
    s.manifest.outputArtifactTypes.includes(outputType),
  );
  if (matching.length) return matching[seed % matching.length]!;
  return sorted.length ? sorted[seed % sorted.length]! : null;
}

/** Role/goal-relevant resource selection for one proposed node. */
function selectNodeResources(
  registry: RegistrySlice,
  role: string,
  goal: string,
): ResourceSelection {
  const links = registry.linksByRole.get(role) ?? [];
  return selectRoleResources(links, goal, { maxResources: PROPOSAL_MAX_RESOURCES });
}

/** Per-node coverage/gap information returned alongside every proposal. */
export function nodeCoverage(
  registry: RegistrySlice,
  nodeKey: string,
  role: string,
  goal: string,
): ProposalNodeCoverage {
  const profile = registry.profilesByRole.get(role);
  const selection = selectNodeResources(registry, role, goal);
  return {
    nodeKey,
    role,
    roleKnown: !!profile,
    depthScore: profile?.depthScore ?? null,
    depthBand: profile?.depthBand ?? null,
    depthHeuristic: DEPTH_HEURISTIC_LABEL,
    gapLabels: profile?.capabilityGaps ?? ["role has no profile in the role/resource matrix"],
    resources: selection,
  };
}

function finalizeNodes(
  raw: z.infer<typeof PlanProposalSchema>["nodes"],
  registry: RegistrySlice,
  goalSeed: string,
): { nodes: NodeSpec[]; coverage: ProposalNodeCoverage[] } {
  const roleSet = new Set(registry.roles);
  const fallbackRole = registry.roles[0] ?? "Research Scientist";
  const coverage: ProposalNodeCoverage[] = [];
  const nodes = raw.map((n, i) => {
    const seed = createHash("sha256").update(`${goalSeed}:${n.key}:${i}`).digest()[0]!;
    const skill = pickSkill(registry.vettedSkills, n.outputArtifactType, seed);
    if (!skill) throw new Error("no vetted skill available in the registry");
    const key = n.key.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const role = roleSet.has(n.role) ? n.role : fallbackRole;
    const cov = nodeCoverage(registry, key, role, n.goal);
    coverage.push(cov);
    return {
      key,
      role,
      skill: {
        name: skill.name,
        version: skill.version,
        sha256: skill.contentSha256, // re-pinned server-side, never from the model
      },
      goal: n.goal,
      inputArtifactTypes: n.inputArtifactTypes,
      outputArtifactType: n.outputArtifactType,
      toolsAllowed: skill.manifest.toolsAllowed
        .filter((t): t is NodeSpec["toolsAllowed"][number] =>
          ["read", "summarize", "compare", "cite", "classify", "synthesize"].includes(t),
        )
        .slice(0, 4),
      resourceUrls: cov.resources.selected.map((s) => s.url),
      budget: defaultNodeBudget(),
      termination: defaultTermination(),
      ...(n.approvalBefore ? { approvalBefore: n.approvalBefore } : {}),
      position: { x: 120 + i * 260, y: 120 + (i % 2) * 160 },
    };
  });
  return { nodes, coverage };
}

export interface SquadProposal {
  spec: DagSpec;
  /** Per-node role coverage + resource selection with explicit gap labels. */
  coverage: ProposalNodeCoverage[];
}

/** Deterministic mock squad: 4-node pipeline derived from the goal text. */
export function mockProposal(
  goal: string,
  revision: number,
  registry: RegistrySlice,
): SquadProposal {
  const rolePick = (i: number) =>
    registry.roles[
      createHash("sha256").update(`${goal}:role:${i}`).digest()[0]! % registry.roles.length
    ] ?? "Research Scientist";
  const raw: z.infer<typeof PlanProposalSchema>["nodes"] = [
    {
      key: "scope",
      role: rolePick(0),
      goal: `Scope and decompose: ${goal}`,
      outputArtifactType: "plan",
      inputArtifactTypes: [],
    },
    {
      key: "evidence",
      role: rolePick(1),
      goal: `Collect and verify evidence for: ${goal}`,
      outputArtifactType: "research-brief",
      inputArtifactTypes: ["plan"],
    },
    {
      key: "compare",
      role: rolePick(2),
      goal: `Compare alternatives and trade-offs for: ${goal}`,
      outputArtifactType: "comparison-table",
      inputArtifactTypes: ["research-brief"],
    },
    {
      key: "synthesize",
      role: rolePick(3),
      goal: `Synthesize findings and limits for: ${goal}`,
      outputArtifactType: "synthesis-draft",
      inputArtifactTypes: ["research-brief", "comparison-table"],
      approvalBefore: "accept",
    },
  ];
  const { nodes, coverage } = finalizeNodes(raw, registry, goal);
  return {
    spec: {
      revision,
      nodes,
      edges: [
        { from: "scope", to: "evidence", kind: "artifact" },
        { from: "evidence", to: "compare", kind: "artifact" },
        { from: "evidence", to: "synthesize", kind: "artifact" },
        { from: "compare", to: "synthesize", kind: "artifact" },
      ],
      budget: defaultRunBudget(),
    },
    coverage,
  };
}

/** Live provider proposal, sanitized against the registry server-side. */
export async function liveProposal(
  providerId: ProviderId,
  model: string | undefined,
  goal: string,
  revision: number,
  registry: RegistrySlice,
  ownerId?: number,
): Promise<{ spec: DagSpec; usedModel: string; coverage: ProposalNodeCoverage[] }> {
  const provider = await getProvider(providerId);
  const system = [
    "You are the Research Director planner. Propose a bounded squad DAG for the research goal.",
    "Rules: 2-6 nodes; acyclic; edges reference node keys; artifact types from:",
    "research-brief, evidence-matrix, comparison-table, decision-log, synthesis-draft, plan.",
    "Roles must come from the provided registry list. Every node has a clear one-sentence goal.",
    "Mark approvalBefore='accept' for the final synthesis node.",
  ].join("\n");
  const prompt = [
    `GOAL: ${goal}`,
    `REGISTRY_ROLES:\n${registry.roles.slice(0, 120).map((r) => `- ${r}`).join("\n")}`,
  ].join("\n\n");
  const res = await provider.generateStructured({
    system,
    prompt,
    schema: PlanProposalSchema,
    maxOutputTokens: 4000,
    model,
    ownerId,
  });
  const plan = PlanProposalSchema.parse(res.object);
  const { nodes, coverage } = finalizeNodes(plan.nodes, registry, goal);
  const spec: DagSpec = {
    revision,
    nodes,
    edges: plan.edges,
    budget: defaultRunBudget(),
  };
  return { spec, usedModel: res.model, coverage };
}
