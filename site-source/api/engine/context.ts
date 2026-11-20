import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { registryResources, registryRoles, skills } from "@db/schema";
import type { ValidationContext } from "./dag-validate";

/** DB-backed lookups for server-side DAG validation (spec §6.2). */
export function makeValidationContext(): ValidationContext {
  return {
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
        .where(inArray(registryResources.url, [url]))
        .limit(1);
      return rows.length > 0;
    },
  };
}
