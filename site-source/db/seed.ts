/**
 * db/seed.ts — seeds the owner-readable registry (spec §7.1):
 *   - 109 roles and 296 curated resources from the atlas datasets
 *     (src/data — the same verified snapshots the public atlas renders);
 *   - the 15 curated skill packages from the workspace (the original 8
 *     engineering packages plus the 7 science/model-library packages:
 *     game-reconstruction, mathematics, physics, chemistry, biology,
 *     science-history, ai-open-model-research), parsed through the
 *     same intake pipeline as uploads (manifest + L2 body + file inventory +
 *     risk signals). Seeded packages are platform-curated and marked vetted
 *     with an explicit provenance note; user-uploaded skills always start
 *     quarantined and can never self-promote. Content is hashed and
 *     inventoried only — seeding NEVER executes any bundled script.
 *
 * Idempotent: re-running skips rows that already exist.
 *
 * Usage: npx tsx db/seed.ts
 * Skill source root: $SKILL_SEED_ROOT, default <repo>/.. (the workspace).
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import { registryResources, registryRoles, skillFiles, skills } from "./schema";
import { ROLES } from "../src/data/roles";
import { RESOURCES } from "../src/data/resources";
import {
  classifySkillFile,
  intakeSkillMarkdown,
  sha256Hex,
} from "../api/registry/intake";
import type { SkillManifest } from "../contracts/skill";

const SKILL_SEED_ROOT =
  process.env.SKILL_SEED_ROOT ??
  path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

/** Curated extended metadata (R2 fields) for the 15 platform skill packages. */
const SKILL_META: Record<
  string,
  Pick<
    SkillManifest,
    "role" | "inputArtifactTypes" | "outputArtifactTypes" | "toolsAllowed" | "costClass"
  >
> = {
  "agent-research-director": {
    role: "Agent Research Director / Orchestration Lead",
    inputArtifactTypes: ["research-brief", "evidence-matrix", "comparison-table"],
    outputArtifactTypes: ["plan", "synthesis-draft"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify", "synthesize"],
    costClass: "high",
  },
  "architecture-and-built-heritage-research": {
    role: "Architectural Historian / Researcher",
    inputArtifactTypes: ["evidence-matrix"],
    outputArtifactTypes: ["research-brief"],
    toolsAllowed: ["read", "summarize", "cite", "classify"],
    costClass: "medium",
  },
  "computational-geometry-engineering": {
    role: "Research Scientist",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["evidence-matrix"],
    toolsAllowed: ["read", "summarize", "classify"],
    costClass: "medium",
  },
  "defensive-reverse-engineering": {
    role: "Malware Analyst / Reverse Engineer",
    inputArtifactTypes: [],
    outputArtifactTypes: ["evidence-matrix", "research-brief"],
    toolsAllowed: ["read", "summarize", "classify", "cite"],
    costClass: "medium",
  },
  "engineering-job-market-intelligence": {
    role: "Market Research / Competitive Intelligence Analyst",
    inputArtifactTypes: [],
    outputArtifactTypes: ["evidence-matrix", "comparison-table"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify"],
    costClass: "medium",
  },
  "engineering-organization-architect": {
    role: "Chief Technology Officer / VP Engineering",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "decision-log"],
    toolsAllowed: ["read", "summarize", "compare", "synthesize"],
    costClass: "medium",
  },
  "spatial-3d-production-engineering": {
    role: "Software / Solutions Architect",
    inputArtifactTypes: ["research-brief"],
    outputArtifactTypes: ["comparison-table", "decision-log"],
    toolsAllowed: ["read", "summarize", "compare"],
    costClass: "medium",
  },
  "local-model-runtime-engineering": {
    role: "Research Engineer",
    inputArtifactTypes: ["evidence-matrix", "comparison-table"],
    outputArtifactTypes: ["decision-log", "research-brief"],
    toolsAllowed: ["read", "summarize", "compare", "cite"],
    costClass: "medium",
  },
  // ── Science & model-library packages (7 dedicated research agents) ──
  "mathematics-research": {
    role: "Mathematics Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "compute", "cite", "classify"],
    costClass: "medium",
  },
  "physics-research": {
    role: "Physics Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "compute", "cite", "classify"],
    costClass: "medium",
  },
  "chemistry-research": {
    role: "Chemistry Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "cite", "classify"],
    costClass: "medium",
  },
  "biology-research": {
    role: "Biology Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "cite", "classify"],
    costClass: "medium",
  },
  "science-history-research": {
    role: "Science History Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "cite", "classify"],
    costClass: "medium",
  },
  "game-reconstruction-engineering": {
    role: "Game Reconstruction Engineer",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["evidence-matrix", "comparison-table"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify"],
    costClass: "high",
  },
  "ai-open-model-research": {
    role: "AI Open-Model Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["comparison-table", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify"],
    costClass: "high",
  },
};

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(pool, { schema, mode: "planetscale" });

  // ── Roles ──
  let rolesAdded = 0;
  for (const r of ROLES) {
    const existing = await db.query.registryRoles.findFirst({
      where: eq(registryRoles.name, r.name),
    });
    if (existing) continue;
    await db.insert(registryRoles).values({
      name: r.name,
      family: r.function,
      mission: r.mission,
      outputs: r.outputs,
      skills: r.skills,
      senior: r.senior,
      interfaces: r.interfaces,
      source: r.source,
    });
    rolesAdded++;
  }

  // ── Resources ──
  let resourcesAdded = 0;
  for (const r of RESOURCES) {
    const existing = await db.query.registryResources.findFirst({
      where: eq(registryResources.url, r.url),
    });
    if (existing) continue;
    await db.insert(registryResources).values({
      domain: r.domain,
      name: r.name,
      type: r.type,
      level: r.level,
      url: r.url,
      purpose: r.purpose,
      prereqs: r.prereqs,
      access: r.access,
      license: r.license,
      caveat: r.caveat,
      verified: r.verified,
    });
    resourcesAdded++;
  }

  // ── Skill packages ──
  let skillsAdded = 0;
  for (const [dirName, meta] of Object.entries(SKILL_META)) {
    const dir = path.join(SKILL_SEED_ROOT, dirName);
    const skillPath = path.join(dir, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      console.warn(`skill source missing, skipped: ${skillPath}`);
      continue;
    }
    const text = fs.readFileSync(skillPath, "utf8");
    const intake = intakeSkillMarkdown(text);
    const manifest: SkillManifest = { ...intake.manifest, ...meta };
    const existing = await db.query.skills.findFirst({
      where: and(
        eq(skills.name, manifest.name),
        eq(skills.version, manifest.version),
      ),
    });
    if (existing) continue;
    const [row] = await db.insert(skills).values({
      ownerId: null, // platform-curated seed
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      manifest,
      bodyText: intake.body,
      riskSignals: intake.riskSignals,
      contentSha256: intake.contentSha256,
      status: "vetted",
      provenanceUrl: "workspace-curated:skill-package",
      licenseDeclared: manifest.licenseDeclared || "workspace-curated",
      reviewedBy: "platform-seed",
      reviewedAt: new Date(),
      reviewNote:
        "Platform-curated skill package shipped with the atlas workspace; hashed and inventoried at seed time.",
    });
    const skillId = Number(row.insertId);
    const walk = (d: string, prefix: string) => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) {
          walk(full, rel);
        } else {
          const buf = fs.readFileSync(full);
          files.push({
            skillId,
            path: rel,
            size: buf.length,
            sha256: sha256Hex(buf),
            kind: classifySkillFile(rel) as
              | "body"
              | "script"
              | "reference"
              | "asset",
          });
        }
      }
    };
    const files: Array<{
      skillId: number;
      path: string;
      size: number;
      sha256: string;
      kind: "body" | "script" | "reference" | "asset";
    }> = [];
    walk(dir, "");
    for (const f of files) await db.insert(skillFiles).values(f);
    skillsAdded++;
    console.log(
      `seeded skill ${manifest.name}@${manifest.version} (${files.length} files, ${intake.riskSignals.length} risk signals)`,
    );
  }

  console.log(
    `seed complete: +${rolesAdded} roles, +${resourcesAdded} resources, +${skillsAdded} skills`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
