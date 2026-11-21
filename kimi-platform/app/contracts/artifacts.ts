/**
 * Typed document artifacts (spec §9.1) and their deterministic acceptance
 * checks (spec §8.5). Checks are pure and shared so the engine and the UI
 * evaluate the same rules.
 */
import { z } from "zod";

/** Structured shape every node generation must return (generateObject). */
export const ArtifactObjectSchema = z.object({
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(2000),
  markdown: z.string().min(1).max(200_000),
  keyFindings: z.array(z.string().max(1000)).max(20),
  limitations: z.array(z.string().max(1000)).max(20),
});
export type ArtifactObjectT = z.infer<typeof ArtifactObjectSchema>;

export const ARTIFACT_TYPES = [
  "research-brief",
  "evidence-matrix",
  "comparison-table",
  "decision-log",
  "synthesis-draft",
  "plan",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

interface AcceptanceRule {
  format: "markdown" | "json";
  /** Section headings (## …) that must be present for markdown artifacts. */
  requiredSections: string[];
  minLength: number;
  /** Markdown artifacts must cite at least one source or explicit limitation. */
  requireCitationOrLimitation: boolean;
}

export const ACCEPTANCE_RULES: Record<ArtifactType, AcceptanceRule> = {
  "research-brief": {
    format: "markdown",
    requiredSections: ["Summary", "Evidence", "Limitations"],
    minLength: 200,
    requireCitationOrLimitation: true,
  },
  "evidence-matrix": {
    format: "markdown",
    requiredSections: ["Summary", "Evidence"],
    minLength: 150,
    requireCitationOrLimitation: true,
  },
  "comparison-table": {
    format: "markdown",
    requiredSections: ["Summary", "Comparison", "Limitations"],
    minLength: 150,
    requireCitationOrLimitation: true,
  },
  "decision-log": {
    format: "markdown",
    requiredSections: ["Decision", "Rationale", "Alternatives"],
    minLength: 120,
    requireCitationOrLimitation: false,
  },
  "synthesis-draft": {
    format: "markdown",
    requiredSections: ["Summary", "Synthesis", "Limitations"],
    minLength: 200,
    requireCitationOrLimitation: true,
  },
  plan: {
    format: "markdown",
    requiredSections: ["Plan", "Assignments"],
    minLength: 120,
    requireCitationOrLimitation: false,
  },
};

export interface AcceptanceFailure {
  rule: string;
  message: string;
}

export interface AcceptanceOutcome {
  ok: boolean;
  failures: AcceptanceFailure[];
}

/** Deterministic acceptance checks; the producing node never runs these. */
export function checkArtifactAcceptance(
  type: string,
  content: string,
): AcceptanceOutcome {
  const rule = ACCEPTANCE_RULES[type as ArtifactType];
  const failures: AcceptanceFailure[] = [];
  if (!rule) {
    return {
      ok: false,
      failures: [
        {
          rule: "artifact-type",
          message: `unregistered artifact type "${type}" (no acceptance schema)`,
        },
      ],
    };
  }
  if (content.trim().length < rule.minLength) {
    failures.push({
      rule: "min-length",
      message: `content is ${content.trim().length} chars; minimum is ${rule.minLength}`,
    });
  }
  if (rule.format === "markdown") {
    for (const section of rule.requiredSections) {
      const re = new RegExp(`^#{1,4}\\s+.*${section}.*$`, "im");
      if (!re.test(content)) {
        failures.push({
          rule: "required-section",
          message: `missing required section "${section}"`,
        });
      }
    }
  }
  if (rule.requireCitationOrLimitation) {
    const hasCitation = /\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/\S+/.test(
      content,
    );
    const hasLimitation = /^#{1,4}\s+.*Limitations/im.test(content);
    if (!hasCitation && !hasLimitation) {
      failures.push({
        rule: "citation-or-limitation",
        message: "artifact must cite a source or state limitations explicitly",
      });
    }
  }
  return { ok: failures.length === 0, failures };
}
