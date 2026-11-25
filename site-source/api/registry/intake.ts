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

/** Inert YAML subset: scalar strings, string lists, and folded/literal blocks. */
export function parseFrontmatter(text: string): {
  frontmatter: Record<string, string | string[]>;
  body: string;
  issues: string[];
} {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { frontmatter: {}, body: text,
    issues: text.startsWith("---") ? ["frontmatter delimiter is missing or malformed"] : [] };
  const lines = m[1]!.split(/\r?\n/);
  const fm: Record<string, string | string[]> = Object.create(null);
  const issues: string[] = [];
  function scalar(raw: string): string {
    const value = raw.trim();
    if (value.startsWith('"')) {
      try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed === "string") return parsed;
      } catch { /* Report unsupported or malformed quoted content below. */ }
      issues.push("malformed double-quoted frontmatter string");
      return "";
    }
    if (value.startsWith("'")) {
      if (/^'(?:[^']|'')*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'");
      issues.push("malformed single-quoted frontmatter string");
      return "";
    }
    if (/^[&*!{]/.test(value)) {
      issues.push("YAML aliases, tags and nested objects are not supported");
      return "";
    }
    return value.replace(/\s+#.*$/, "").trimEnd();
  }
  function list(raw: string): string[] {
    if (raw.trim() === "") return [];
    const parts: string[] = [];
    let start = 0, quote = "", escaped = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i]!;
      if (quote) {
        if (escaped) escaped = false;
        else if (quote === '"' && c === "\\") escaped = true;
        else if (c === quote) {
          if (quote === "'" && raw[i + 1] === "'") i++;
          else quote = "";
        }
      } else if (c === '"' || c === "'") quote = c;
      else if (c === ",") { parts.push(raw.slice(start, i)); start = i + 1; }
    }
    if (quote) issues.push("unterminated quote in frontmatter list");
    parts.push(raw.slice(start));
    if (parts.some(part => !part.trim())) issues.push("empty item in frontmatter list");
    return parts.map(scalar);
  }
  let currentKey: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      currentKey = kv[1]!;
      if (Object.hasOwn(fm, currentKey) || ["__proto__", "constructor", "prototype"].includes(currentKey)) {
        issues.push(`duplicate or reserved frontmatter key: ${currentKey}`);
        currentKey = null;
        continue;
      }
      const value = kv[2]!.trim();
      if (/^[>|][-+]?$/.test(value)) {
        const block: string[] = [];
        let indent = 0;
        while (i + 1 < lines.length) {
          const next = lines[i + 1]!;
          if (next.trim() && !/^ +/.test(next)) break;
          if (next.trim() && !indent) indent = next.match(/^ +/)![0].length;
          if (next.trim() && next.match(/^ */)![0].length < indent) {
            issues.push(`inconsistent indentation in ${currentKey}`);
            break;
          }
          block.push(next.trim() ? next.slice(indent) : "");
          i++;
        }
        let parsed = "";
        for (let n = 0; n < block.length; n++) {
          const here = block[n]!, next = block[n + 1];
          parsed += here;
          if (next === undefined || value[0] === "|") parsed += "\n";
          else if (here && next && !/^\s/.test(here) && !/^\s/.test(next)) parsed += " ";
          else if (here || !next) parsed += "\n";
        }
        if (value.endsWith("-")) parsed = parsed.replace(/\n+$/, "");
        else if (!value.endsWith("+") && parsed) parsed = parsed.replace(/\n+$/, "") + "\n";
        fm[currentKey] = parsed;
        currentKey = null;
      } else if (/^[>|]/.test(value)) {
        issues.push("unsupported YAML block indicator");
        fm[currentKey] = "";
        currentKey = null;
      } else if (value === "") {
        fm[currentKey] = [];
      } else if (value.startsWith("[") && value.endsWith("]")) {
        fm[currentKey] = list(value.slice(1, -1));
        currentKey = null;
      } else {
        fm[currentKey] = scalar(value);
        currentKey = null;
      }
      continue;
    }
    const li = /^\s+-\s+(.+)$/.exec(line);
    if (li && currentKey && Array.isArray(fm[currentKey])) {
      (fm[currentKey] as string[]).push(scalar(li[1]!));
    } else {
      issues.push(`unsupported frontmatter line ${i + 1}`);
    }
  }
  return { frontmatter: fm, body: text.slice(m[0].length), issues };
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
    // Keep invalid uploads inert and inspectable, even with an invalid name.
    const name = typeof fm.name === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fm.name) && fm.name.length <= 64
      ? fm.name : "unnamed-skill";
    return SkillManifestSchema.parse({ name });
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
  const { frontmatter, body, issues: parserIssues } = parseFrontmatter(text);
  issues.push(...parserIssues);
  if (typeof frontmatter.name !== "string" || !frontmatter.name) {
    issues.push("frontmatter is missing a name");
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frontmatter.name) || frontmatter.name.length > 64) {
    issues.push("frontmatter name must be a lowercase hyphenated identifier of at most 64 characters");
  }
  const fields = Object.fromEntries(Object.entries(EXTENDED_KEY_MAP)
    .filter(([key]) => frontmatter[key] !== undefined)
    .map(([key, target]) => [target, frontmatter[key]]));
  const validation = SkillManifestSchema.safeParse(fields);
  if (!validation.success) issues.push(...validation.error.issues.map(issue => `invalid manifest field: ${issue.path.join(".") || "manifest"}`));
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
