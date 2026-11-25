import {RESOURCE_CATALOG, RESOURCE_CATALOG_SHA256} from './resource-catalog.ts';
import {RESOURCE_LIMITS, selectResourceReferences, type ResourceCatalog, type ResourcePacket} from './resource-routing.ts';

const knownSkills = new Set(RESOURCE_CATALOG.routes.map(route => route.skill));
const skillTokens = [...knownSkills].sort().map(skill => ({ skill,
  // IDs are restricted to lowercase letters, digits and hyphens by the build
  // validator. Boundaries prevent suffix/prefix names from becoming assignments.
  pattern: new RegExp(`(?:^|[^a-z0-9-])${skill}(?=$|[^a-z0-9-])`),
}));
function canonicalSkill(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200) return null;
  const name = /^skills\/([a-z][a-z0-9-]{0,79})\/SKILL\.md$/.exec(value)?.[1] ?? value;
  return knownSkills.has(name) ? name : null;
}

/** Offline public metadata only. Exact known skill names narrow recommendations;
 * otherwise Donna's curated director route supplies useful starting references.
 * Matching a skill name never assigns an employee, loads a skill body, accepts a
 * company knowledge store, or changes capabilities, scope or spending limits. */
export function hostedResourceContext(task: string, skills: string[] = []): ResourcePacket {
  const boundedTask = typeof task === 'string' ? task.slice(0, 10000) : '';
  const supplied = (Array.isArray(skills) ? skills.slice(0, 32) : []).map(canonicalSkill).filter((skill): skill is string => skill !== null);
  const named = skillTokens.filter(({pattern}) => pattern.test(boundedTask.toLowerCase())).map(({skill}) => skill);
  const selected = [...new Set([...supplied, ...named])].slice(0, RESOURCE_LIMITS.assignedSkills);
  return selectResourceReferences(RESOURCE_CATALOG as unknown as ResourceCatalog, RESOURCE_CATALOG_SHA256, {
    query: boundedTask.slice(0, 2000), skills: selected,
    ...(selected.length ? {} : {roleKey: 'donna'}), maxReferences: 6, maxBytes: 8192,
  });
}
