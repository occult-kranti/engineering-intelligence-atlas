import { createHash } from "node:crypto";
import {
  SkillManifestSchema,
  type RiskSignal,
  type SkillManifest,
} from "@contracts/skill";

/**
 * Skill intake pipeline (spec §7.2). Parses pasted/uploaded SKILL.md text into
 * a quarantined draft: frontmatter metadata + content hash + file inventory +
 * risk-signal report. NEVER executes, evaluates, or imports any part of the
 * content — scripts are inventoried as inert bytes with hashes.
 */

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Minimal, strict YAML-frontmatter subset parser (scalars + string lists). */
export function parseFrontmatter(text: string): {
  frontmatter: Record<string, string | string[]>;
  body: string;
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { frontmatter: {}, body: text };
  const raw = m[1]!;
  const fm: Record<string, string | string[]> = {};
  let currentKey: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      currentKey = kv[1]!;
      const value = kv[2]!.trim();
      if (value === "") {
        fm[currentKey] = [];
      } else if (value.startsWith("[") && value.endsWith("]")) {
        fm[currentKey] = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      } else {
        fm[currentKey] = value.replace(/^["']|["']$/g, "");
      }
      continue;
    }
    const li = /^\s+-\s+(.+)$/.exec(line);
    if (li && currentKey) {
      const arr = Array.isArray(fm[currentKey]) ? (fm[currentKey] as string[]) : [];
      arr.push(li[1]!.trim().replace(/^["']|["']$/g, ""));
      fm[currentKey] = arr;
    }
  }
  return { frontmatter: fm, body: text.slice(m[0].length) };
}

const EXTENDED_KEY_MAP: Record<string, keyof SkillManifest> = {
  name: "name",
  version: "version",
  description: "description",
  role: "role",
  capabilities: "capabilities",
  "tools-allowed": "toolsAllowed",
  "cost-class": "costClass",
  "input-artifact-types": "inputArtifactTypes",
  "output-artifact-types": "outputArtifactTypes",
  license: "licenseDeclared",
  provenance: "provenanceUrl",
};

export function manifestFromFrontmatter(
  fm: Record<string, string | string[]>,
): SkillManifest {
  const out: Record<string, unknown> = {};
  for (const [k, target] of Object.entries(EXTENDED_KEY_MAP)) {
    if (fm[k] !== undefined) out[target] = fm[k];
  }
  const parsed = SkillManifestSchema.safeParse(out);
  if (!parsed.success) {
    // Fall back to a name-only manifest; the caller surfaces the issues.
    return SkillManifestSchema.parse({ name: String(fm.name ?? "unnamed-skill") });
  }
  return parsed.data;
}

const RISK_PATTERNS: Array<{ kind: RiskSignal["kind"]; re: RegExp; detail: string }> = [
  { kind: "network-access", re: /\b(fetch|axios|got|undici)\s*\(|https?:\/\/(?!sfia-online|agentskills)/i, detail: "network access or embedded URLs" },
  { kind: "secret-access", re: /api[_-]?key|secret|password|token\s*[:=]/i, detail: "credential-shaped tokens referenced" },
  { kind: "env-read", re: /process\.env|os\.environ|getenv/i, detail: "environment variable access" },
  { kind: "code-execution", re: /child_process|eval\s*\(|exec\s*\(|subprocess|os\.system/i, detail: "code execution primitive" },
  { kind: "shell-command", re: /\b(rm|curl|wget|chmod|sudo)\s+-|\|\s*(sh|bash)\b/i, detail: "shell command patterns" },
  { kind: "hook-config", re: /hooks?\s*:/i, detail: "hook configuration (lifecycle interception)" },
  { kind: "mcp-manifest", re: /\bmcp\b.*server|mcp\.json/i, detail: "MCP server manifest reference" },
  { kind: "external-download", re: /download|pip install|npm install/i, detail: "download/install instructions" },
  { kind: "obfuscation", re: /atob\s*\(|fromCharCode|\\x[0-9a-f]{2}\\x/i, detail: "possible obfuscated payload" },
];

export function scanRiskSignals(text: string): RiskSignal[] {
  const found: RiskSignal[] = [];
  const seen = new Set<string>();
  for (const { kind, re, detail } of RISK_PATTERNS) {
    if (re.test(text) && !seen.has(kind)) {
      seen.add(kind);
      found.push({ kind, detail });
    }
  }
  return found;
}

export interface SkillIntakeResult {
  manifest: SkillManifest;
  body: string;
  contentSha256: string;
  riskSignals: RiskSignal[];
  parseIssues: string[];
}

export function intakeSkillMarkdown(text: string): SkillIntakeResult {
  const issues: string[] = [];
  if (text.length > 500_000) throw new Error("skill text exceeds 500 KB intake cap");
  const { frontmatter, body } = parseFrontmatter(text);
  if (typeof frontmatter.name !== "string" || !frontmatter.name) {
    issues.push("frontmatter is missing a name");
  }
  const manifest = manifestFromFrontmatter(frontmatter);
  return {
    manifest,
    body,
    contentSha256: sha256Hex(text),
    riskSignals: scanRiskSignals(text),
    parseIssues: issues,
  };
}

export type SkillFileKindName = "body" | "script" | "reference" | "asset";

export function classifySkillFile(path: string): SkillFileKindName {
  if (/^SKILL\.md$/i.test(path)) return "body";
  if (/\.(py|sh|js|mjs|ts|rb|pl|exe|bat)$/i.test(path)) return "script";
  if (/\.(md|txt|rst)$/i.test(path)) return "reference";
  return "asset";
}
