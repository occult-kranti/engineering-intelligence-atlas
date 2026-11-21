import { eq, and } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "../queries/connection";
import { registryResources, registryRoles, skills } from "@db/schema";
import type { ValidationContext, SkillLookup } from "./dag-validate";

/** Coalesce repeated pins within one validation, never across requests or owners. */
export function memoizeValidationContext(source: ValidationContext): ValidationContext {
  const skills = new Map<string, Promise<SkillLookup | null>>();
  const roles = new Map<string, Promise<boolean>>();
  const resources = new Map<string, Promise<boolean>>();
  function once<T>(cache: Map<string, Promise<T>>, key: string, lookup: () => Promise<T>): Promise<T> {
    const cached = cache.get(key);
    if (cached) return cached;
    const pending = lookup();
    cache.set(key, pending);
    return pending;
  }
  return {
    resolveSkill: (name, version) => once(skills, JSON.stringify([name, version]), () => source.resolveSkill(name, version)),
    roleExists: (name) => once(roles, name, () => source.roleExists(name)),
    resourceExists: (url) => once(resources, url, () => source.resourceExists(url)),
  };
}

/** DB-backed lookups for server-side DAG validation (spec §6.2). */
export function makeValidationContext(): ValidationContext {
  return memoizeValidationContext({
    async resolveSkill(name, version) {
      const row = await getDb().query.skills.findFirst({
        where: and(eq(skills.name, name), eq(skills.version, version)),
      });
      if (!row) return null;
      return {
        status: row.status,
        contentSha256: row.contentSha256,
        toolsAllowed: row.manifest.toolsAllowed,
      };
    },
    async roleExists(name) {
      const row = await getDb().query.registryRoles.findFirst({
        where: eq(registryRoles.name, name),
      });
      return !!row;
    },
    async resourceExists(url) {
      if (url === "") return false;
      const rows = await getDb()
        .select({ id: registryResources.id })
        .from(registryResources)
        .where(and(
          eq(registryResources.urlSha256, createHash("sha256").update(url).digest("hex")),
          eq(registryResources.url, url),
        ))
        .limit(1);
      return rows.length > 0;
    },
  });
}
