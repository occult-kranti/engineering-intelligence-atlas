import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SKILL_PACKAGES } from './skills';
import { ROLE_MATRIX } from './roleMatrix';
import {
  EXECUTIVE_CHARTERS,
  EXECUTIVE_DOWNLOADS,
  EXECUTIVE_PACKAGES,
} from './executivePractices';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MAPPING = JSON.parse(
  readFileSync(path.join(ROOT, 'db/data/assistant_skill_mapping.json'), 'utf8'),
) as {
  summary: Record<string, number>;
  agent_contexts: string[];
  skill_mappings: Record<
    string,
    { consumer_roles: string[]; context_role_edges: Record<string, string[]> }
  >;
};
const MATRIX = JSON.parse(
  readFileSync(path.join(ROOT, 'db/data/role_capability_matrix.json'), 'utf8'),
) as {
  resources: unknown[];
  resource_links: { link_id: string }[];
  evaluation_tasks: unknown[];
  roles: { slug: string; skill_packs: string[]; depth: { depth_score: number } }[];
  skill_mappings: Record<string, { consumer_roles: string[] }>;
  gaps: unknown[];
};
const GRAPH = JSON.parse(
  readFileSync(path.join(ROOT, 'public/research/agent_reference_graph.json'), 'utf8'),
) as {
  counts: { nodesByType: Record<string, number>; edgesByType: Record<string, number> };
  nodes: { id: string; type: string; group?: string }[];
  edges: { type: string; from: string; to: string }[];
};

const PACK = 'executive-operations-assistant';
const CONSUMERS = [
  'agent-research-director-orchestration-lead',
  'knowledge-transfer-learning-systems-manager',
  'api-integration-engineer',
];

describe('executive integration — package and charters', () => {
  it('ships the executive package as the 21st skill with three contexts', () => {
    expect(EXECUTIVE_PACKAGES.map((p) => p.id)).toEqual([PACK]);
    expect(EXECUTIVE_CHARTERS).toHaveLength(3);
    expect(MAPPING.agent_contexts).toHaveLength(3);
    expect(SKILL_PACKAGES.map((s) => s.id)).toContain(PACK);
  });

  it('maps onto exactly three existing roles — no role inflation', () => {
    const slugs = new Set(ROLE_MATRIX.map((r) => r.id));
    expect(ROLE_MATRIX).toHaveLength(109); // no new standing roles
    expect(MATRIX.skill_mappings[PACK].consumer_roles).toEqual(CONSUMERS);
    expect(MAPPING.skill_mappings[PACK].consumer_roles).toEqual(CONSUMERS);
    expect(Object.keys(MATRIX.skill_mappings)).toHaveLength(21);
    const bySlug = new Map(MATRIX.roles.map((r) => [r.slug, r]));
    for (const slug of CONSUMERS) {
      expect(slugs.has(slug)).toBe(true);
      expect(bySlug.get(slug)?.skill_packs).toContain(PACK);
    }
  });

  it('marks all three executive charters INSTALLED, never PROPOSED', () => {
    for (const c of EXECUTIVE_CHARTERS) {
      const text = readFileSync(path.join(ROOT, 'public', c.href), 'utf8');
      expect(text).toContain('INSTALLED');
      expect(text).not.toMatch(/PROPOSED|not yet packaged/);
    }
  });
});

describe('executive integration — mapping-only invariants', () => {
  it('adds no resources, links, tasks, or gaps; depth invariant', () => {
    expect(MAPPING.summary.new_resources).toBe(0);
    expect(MAPPING.summary.new_edges).toBe(0);
    expect(MAPPING.summary.role_evaluation_tasks_added).toBe(0);
    expect(MAPPING.summary.gaps_closed).toBe(0);
    expect(MAPPING.summary.new_standing_roles).toBe(0);
    expect(MATRIX.resources).toHaveLength(436);
    expect(MATRIX.resource_links).toHaveLength(1756);
    expect(MATRIX.evaluation_tasks).toHaveLength(336);
    expect(MATRIX.gaps).toHaveLength(84);
    const scores = MATRIX.roles.map((r) => r.depth.depth_score);
    const mean =
      Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    expect(mean).toBe(87.3);
    expect(scores.filter((s) => s >= 70)).toHaveLength(93);
    expect(scores.filter((s) => s < 70)).toHaveLength(16);
  });
});

describe('executive integration — public/research bundle links', () => {
  it('has no broken links in the Executive Operations data', () => {
    const hrefs = [
      ...EXECUTIVE_PACKAGES.map((p) => p.skillHref),
      ...EXECUTIVE_CHARTERS.map((c) => c.href),
      ...EXECUTIVE_DOWNLOADS.map((d) => d.href),
    ];
    for (const href of hrefs) {
      expect(
        existsSync(path.join(ROOT, 'public', href)),
        `missing bundled asset: ${href}`,
      ).toBe(true);
    }
  });

  it('resolves every relative markdown link inside the bundled executive artifacts', () => {
    const dir = path.join(ROOT, 'public/research/skills/executive-operations-assistant');
    const mdFiles: string[] = [];
    const walk = (d: string) => {
      for (const ent of readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (ent.name.endsWith('.md')) mdFiles.push(full);
      }
    };
    walk(dir);
    mdFiles.push(...EXECUTIVE_CHARTERS.map((c) => path.join(ROOT, 'public', c.href)));
    expect(mdFiles.length).toBeGreaterThan(8);
    const broken: string[] = [];
    const linkRe = /\]\(([^)#\s]+)(#[^)]*)?\)/g;
    for (const f of mdFiles) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(linkRe)) {
        const target = m[1];
        if (/^(https?:|mailto:|\/)/.test(target)) continue;
        const resolved = path.resolve(path.dirname(f), target);
        if (!existsSync(resolved)) {
          broken.push(`${path.relative(ROOT, f)} -> ${target}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('executive integration — reference graph', () => {
  it('adds three executive contexts without touching stewards or roles', () => {
    expect(GRAPH.counts.nodesByType.skill).toBe(21);
    expect(GRAPH.counts.nodesByType['agent-context']).toBe(24);
    expect(GRAPH.counts.nodesByType.steward).toBe(4); // PERMANENT_STEWARD_ROLES only
    expect(GRAPH.counts.nodesByType.role).toBe(109);
    const execContexts = GRAPH.nodes.filter(
      (n) => n.type === 'agent-context' && n.group === 'executive',
    );
    expect(execContexts.map((n) => n.id).sort()).toEqual([
      'context:donna-ceo-operations-assistant',
      'context:repository-integration-knowledge-engineer',
      'context:shared-department-operations-assistant',
    ]);
    // Donna and the steward are contexts, never steward/provider-worker nodes
    expect(
      GRAPH.nodes.some((n) => n.type === 'steward' && /donna|repository/.test(n.id)),
    ).toBe(false);
  });

  it('wires executive uses/mapped-to/contracts and skill scripts+samples', () => {
    for (const c of MAPPING.agent_contexts) {
      expect(
        GRAPH.edges.some(
          (e) => e.type === 'uses' && e.from === `context:${c}` && e.to === `skill:${PACK}`,
        ),
        `${c} missing uses edge`,
      ).toBe(true);
    }
    const edges = GRAPH.edges.filter((e) => e.type === 'mapped-to');
    for (const [ctx, roles] of Object.entries(
      MAPPING.skill_mappings[PACK].context_role_edges,
    )) {
      for (const slug of roles) {
        expect(
          edges.some((e) => e.from === `context:${ctx}` && e.to === `role:${slug}`),
          `${ctx} missing mapped-to ${slug}`,
        ).toBe(true);
      }
    }
    // reporting lines end at Donna; Donna does not compose under the director
    expect(
      GRAPH.edges.some(
        (e) =>
          e.type === 'contracts' &&
          e.from === 'context:donna-ceo-operations-assistant' &&
          e.to === 'context:ai-research-director',
      ),
    ).toBe(false);
    expect(
      GRAPH.edges.some(
        (e) =>
          e.type === 'contracts' &&
          e.from === 'context:repository-integration-knowledge-engineer' &&
          e.to === 'context:donna-ceo-operations-assistant',
      ),
    ).toBe(true);
    // executive scripts and action/schedule/study fixtures are sampled
    expect(
      GRAPH.edges.filter((e) => e.type === 'has-script' && e.from === `skill:${PACK}`)
        .length,
    ).toBeGreaterThanOrEqual(5);
    const sampleTargets = GRAPH.edges
      .filter((e) => e.type === 'has-sample' && e.from === `skill:${PACK}`)
      .map((e) => e.to);
    expect(sampleTargets.some((t) => t.includes('action_plans'))).toBe(true);
    expect(sampleTargets.some((t) => t.includes('schedules'))).toBe(true);
    expect(sampleTargets.some((t) => t.includes('study_queue'))).toBe(true);
  });
});
