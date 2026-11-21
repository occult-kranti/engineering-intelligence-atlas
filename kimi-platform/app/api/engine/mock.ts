import { createHash } from "node:crypto";
import { ACCEPTANCE_RULES, type ArtifactType } from "@contracts/artifacts";
import type { UsageRecord } from "@contracts/run";
import type { StructuredRequest, StructuredResponse } from "../ai/provider";

/**
 * Deterministic mock provider (spec §8.3). Outputs derive solely from
 * sha256(system + prompt): the same run seed / node / attempt reproduces a
 * byte-identical artifact. Mock events are identical in shape to live events;
 * mock runs consume no model quota.
 */

export class MockScriptedFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MockScriptedFailure";
  }
}

export const ARTIFACT_OBJECT_FIELDS = [
  "title",
  "summary",
  "markdown",
  "keyFindings",
  "limitations",
] as const;

export interface ArtifactObject {
  title: string;
  summary: string;
  markdown: string;
  keyFindings: string[];
  limitations: string[];
}

function words(seed: Buffer, bank: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(bank[seed[i % seed.length]! % bank.length]!);
  return out;
}

const FINDING_BANK = [
  "bounded delegation with explicit budgets reduces runaway token burn",
  "typed artifact handoffs avoid free-form transcript drift",
  "hash-pinned vetted skills constrain the supply-chain surface",
  "approval gates keep dispatch authority with the owner",
  "termination counters detect repetition and no-progress loops",
  "provenance records make evidence auditable after the fact",
  "progressive disclosure bounds per-node context cost",
  "independent acceptance checks keep producers from self-certifying",
];

const LIMITATION_BANK = [
  "mock output is deterministic filler, not research evidence",
  "coverage depends on the curated registry, not a live census",
  "no external fetches were performed for this node",
  "single-pass generation; no peer re-derivation was run",
];

export function mockArtifactObject(
  seedText: string,
  artifactType: string,
  goal: string,
  resourceUrls: string[],
): ArtifactObject {
  const seed = createHash("sha256").update(seedText).digest();
  const rule = ACCEPTANCE_RULES[artifactType as ArtifactType];
  const sections = rule?.requiredSections ?? ["Summary"];
  const citation = resourceUrls[0] ?? "https://sfia-online.org/en/sfia-9";
  const findings = words(seed, FINDING_BANK, 3);
  const limitations = words(seed.subarray(8), LIMITATION_BANK, 2);
  const title = `${artifactType} — ${goal.slice(0, 60).trim() || "untitled"}`;

  const sectionBody = (s: string, i: number): string => {
    switch (true) {
      case /summary/i.test(s):
        return `Deterministic mock summary for goal "${goal.slice(0, 120)}". This artifact was produced by the offline mock provider (seed ${seed.subarray(0, 4).toString("hex")}) and consumes no model quota.`;
      case /evidence/i.test(s):
        return `- Evidence anchor: [curated source](${citation})\n- Finding: ${findings[0]}.\n- Finding: ${findings[1]}.`;
      case /comparison/i.test(s):
        return `| Option | Strength | Risk |\n|---|---|---|\n| A (${findings[0]}) | bounded | slower |\n| B (${findings[1]}) | flexible | noisier |`;
      case /decision/i.test(s):
        return `Decision: proceed with the bounded option — ${findings[0]}.`;
      case /rationale/i.test(s):
        return `Rationale: ${findings[1]}; see evidence at ${citation}.`;
      case /alternatives/i.test(s):
        return `Alternatives considered: ${findings[2] ?? findings[0]}; rejected to keep scope bounded.`;
      case /plan/i.test(s):
        return `Plan: 1) scope, 2) evidence, 3) synthesis, following ${citation}.`;
      case /assignments/i.test(s):
        return `Assignments: each node runs under its pinned skill and budget contract.`;
      case /synthesis/i.test(s):
        return `Synthesis: ${findings.join("; ")}.`;
      case /limitations/i.test(s):
        return limitations.map((l) => `- ${l}.`).join("\n");
      default:
        return `Mock section ${i + 1} for "${s}": ${findings[i % findings.length]}. Reference: ${citation}.`;
    }
  };

  const markdown =
    `# ${title}\n\n` +
    sections.map((s, i) => `## ${s}\n\n${sectionBody(s, i)}`).join("\n\n") +
    (sections.some((s) => /limitations/i.test(s))
      ? ""
      : `\n\n## Limitations\n\n${limitations.map((l) => `- ${l}.`).join("\n")}`) +
    "\n";

  return {
    title,
    summary: `Mock ${artifactType} for: ${goal.slice(0, 140)}`,
    markdown,
    keyFindings: findings,
    limitations,
  };
}

/**
 * Simulated mock rates — clearly labeled, deterministic, never real billing.
 * Mock "cents" exist so dollar-budget enforcement can be exercised offline.
 */
export const MOCK_INPUT_USD_PER_MILLION = 0.1;
export const MOCK_OUTPUT_USD_PER_MILLION = 0.2;

export function mockUsage(seedText: string): UsageRecord {
  const seed = createHash("sha256").update(`usage:${seedText}`).digest();
  const promptTokens = 400 + seed[0]! * 8;
  const completionTokens = 600 + seed[1]! * 8;
  return {
    promptTokens,
    completionTokens,
    calls: 1,
    costUsdMicros: Math.round(
      promptTokens * MOCK_INPUT_USD_PER_MILLION +
        completionTokens * MOCK_OUTPUT_USD_PER_MILLION,
    ),
    simulated: true,
  };
}

/** Deterministic stand-in for generateObject under the mock provider. */
export async function mockGenerateStructured(
  req: StructuredRequest,
): Promise<StructuredResponse> {
  const seedText = `${req.system}\n${req.prompt}`;
  if (/\[mock:fail\]/i.test(seedText)) {
    throw new MockScriptedFailure(
      "scripted mock failure ([mock:fail] directive in goal)",
    );
  }
  // Recover the artifact type and goal hints the runner embedded in the prompt.
  const artifactType =
    req.artifactType ??
    /ARTIFACT_TYPE:\s*([a-z-]+)/i.exec(req.system)?.[1] ??
    "research-brief";
  const goal = /NODE_GOAL:\s*([^\n]+)/i.exec(req.prompt)?.[1] ?? "mock task";
  // Resource URLs appear either as legacy RESOURCE: lines or as `url:` lines
  // inside the compiler's UNTRUSTED_RESOURCE data fences.
  const legacy = [...req.prompt.matchAll(/RESOURCE:\s*(\S+)/gi)].map((m) => m[1]!);
  const fenced = [...req.prompt.matchAll(/<<<UNTRUSTED_RESOURCE[\s\S]*?<<<END_UNTRUSTED_RESOURCE>>>/gi)]
    .map((m) => /(?:^|\n)url:\s*(\S+)/.exec(m[0])?.[1])
    .filter((u): u is string => !!u);
  const resources = legacy.length ? legacy : fenced;
  const object = mockArtifactObject(seedText, artifactType, goal, resources);
  return {
    object,
    usage: mockUsage(seedText),
    provider: "mock",
    model: "mock-deterministic",
  };
}
