import { z } from "zod";

/** Skill registry contracts (spec §7). */

export const SKILL_STATUSES = [
  "quarantined",
  "vetted",
  "deprecated",
  "suspended",
] as const;
export const SkillStatusSchema = z.enum(SKILL_STATUSES);
export type SkillStatus = z.infer<typeof SkillStatusSchema>;

/**
 * Extended agentskills.io frontmatter (R2 extension fields).
 * All extension fields are optional at intake; missing fields fall back to
 * curated defaults and are recorded in the audit report.
 */
export const SkillManifestSchema = z.object({
  name: z.string().min(1).max(200),
  version: z.string().max(50).default("0.0.0"),
  description: z.string().max(4000).default(""),
  role: z.string().max(200).optional(),
  capabilities: z.array(z.string().max(120)).max(32).default([]),
  toolsAllowed: z.array(z.string().max(64)).max(32).default([]),
  costClass: z.enum(["low", "medium", "high"]).default("medium"),
  inputArtifactTypes: z.array(z.string().max(64)).max(16).default([]),
  outputArtifactTypes: z.array(z.string().max(64)).max(16).default([]),
  licenseDeclared: z.string().max(200).default(""),
  provenanceUrl: z.string().max(1000).default(""),
});
export type SkillManifest = z.infer<typeof SkillManifestSchema>;

export const RISK_SIGNAL_KINDS = [
  "network-access",
  "secret-access",
  "env-read",
  "code-execution",
  "shell-command",
  "hook-config",
  "mcp-manifest",
  "external-download",
  "obfuscation",
] as const;
export type RiskSignalKind = (typeof RISK_SIGNAL_KINDS)[number];

export const RiskSignalSchema = z.object({
  kind: z.enum(RISK_SIGNAL_KINDS),
  detail: z.string().max(500),
});
export type RiskSignal = z.infer<typeof RiskSignalSchema>;

export const SKILL_FILE_KINDS = ["body", "script", "reference", "asset"] as const;
export type SkillFileKind = (typeof SKILL_FILE_KINDS)[number];

/** Allowed status transitions; every transition needs an owner review note. */
export const SKILL_TRANSITIONS: Record<SkillStatus, SkillStatus[]> = {
  quarantined: ["vetted", "deprecated"],
  vetted: ["deprecated", "suspended", "quarantined"],
  suspended: ["vetted", "deprecated"],
  deprecated: [],
};
