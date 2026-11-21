import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SKILL_PACKAGES } from './skills';
import { ROLE_MATRIX, ROLE_MATRIX_META } from './roleMatrix';
import {
  CREATIVE_CHARTERS,
  CREATIVE_DOWNLOADS,
  CREATIVE_PACKAGES,
} from './creativePractices';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const FILL = JSON.parse(
  readFileSync(path.join(ROOT, 'db/data/creative_resource_fill.json'), 'utf8'),
) as {
  summary: Record<string, number>;
  agent_contexts: string[];
  resources: { id: string; url: string; source_pack: string }[];
  edges: { role_slug: string; url: string; flag: string; trigger: string }[];
  skill_mappings: Record<string, { consumer_roles: string[] }>;
  charter_references_not_cataloged: unknown[];
};
const MATRIX = JSON.parse(
  readFileSync(path.join(ROOT, 'db/data/role_capability_matrix.json'), 'utf8'),
) as {
  resource_links: { link_id: string; resource_url: string }[];
  roles: { slug: string; depth: { depth_score: number }; skill_packs: string[] }[];
  skill_mappings: Record<string, { consumer_roles: string[] }>;
  evaluation_tasks: unknown[];
};
const GRAPH = JSON.parse(
  readFileSync(path.join(ROOT, 'public/research/agent_reference_graph.json'), 'utf8'),
) as {
  counts: {
    nodes: number;
    edges: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
  };
  nodes: { id: string; type: string; provenance: string }[];
  edges: { type: string; from: string; to: string; provenance: string }[];
};

describe('creative integration — packages and charters', () => {
  it('ships both creative packages and all five agent charters', () => {
    expect(CREATIVE_PACKAGES.map((p) => p.id)).toEqual([
      'civilization-art-design-research',
      'music-theory-production-engineering',
    ]);
    expect(CREATIVE_CHARTERS).toHaveLength(5);
    expect(FILL.agent_contexts).toHaveLength(5);
    const ids = SKILL_PACKAGES.map((s) => s.id);
    for (const p of CREATIVE_PACKAGES) expect(ids).toContain(p.id);
  });

  it('maps contexts onto existing roles only — no role inflation', () => {
    const slugs = new Set(ROLE_MATRIX.map((r) => r.id));
    for (const e of FILL.edges) expect(slugs.has(e.role_slug)).toBe(true);
    // the four primaries are covered
    const primaries = new Set(FILL.edges.map((e) => e.role_slug));
    for (const p of [
      'architectural-historian-researcher',
      'computational-geometer-applied-mathematician',
      'game-audio-designer-programmer',
      'legal-policy-compliance-specialist',
    ]) {
      expect(primaries.has(p)).toBe(true);
    }
    expect(ROLE_MATRIX).toHaveLength(109); // no new standing roles
    // skill mappings land on roles and carry the packs on role profiles
    for (const [pack, m] of Object.entries(FILL.skill_mappings)) {
      expect(MATRIX.skill_mappings[pack].consumer_roles).toEqual(m.consumer_roles);
      for (const slug of m.consumer_roles) expect(slugs.has(slug)).toBe(true);
    }
    expect(Object.keys(MATRIX.skill_mappings)).toHaveLength(21);
  });

  it('marks both creative charters installed/bundled, never PROPOSED', () => {
    for (const c of CREATIVE_CHARTERS) {
      const text = readFileSync(path.join(ROOT, 'public', c.href), 'utf8');
      expect(text).toContain('INSTALLED');
      expect(text).not.toMatch(/PROPOSED|not yet packaged/);
    }
  });
});

describe('creative integration — fill invariants', () => {
  it('uses stable cr-* ids and appends creative links as RL-1684+', () => {
    const ids = FILL.resources.map((r) => r.id);
    expect(ids).toHaveLength(FILL.summary.new_resources);
    for (const id of ids) expect(id).toMatch(/^cr-\d{3}$/);
    expect(new Set(ids).size).toBe(ids.length);
    const linkIds = MATRIX.resource_links.map((l) => l.link_id);
    expect(linkIds[1683]).toBe('RL-1684');
    expect(linkIds).toHaveLength(1683 + FILL.summary.new_edges);
    // creative edges land only on the 19 new resources
    const crUrls = new Set(FILL.resources.map((r) => r.url));
    for (const l of MATRIX.resource_links.slice(1683)) {
      expect(crUrls.has(l.resource_url)).toBe(true);
    }
  });

  it('adds no evaluation tasks and keeps every conditional edge triggered', () => {
    expect(FILL.summary.role_evaluation_tasks_added).toBe(0);
    expect(MATRIX.evaluation_tasks).toHaveLength(336);
    for (const e of FILL.edges) {
      if (e.flag === 'conditional') expect(e.trigger.length).toBeGreaterThan(0);
    }
    // URL-less charter references stay out of the catalog
    expect(FILL.charter_references_not_cataloged.length).toBeGreaterThan(0);
  });

  it('keeps all 109 depth scores invariant (mean 87.3, 93 >= 70, 16 < 70)', () => {
    const scores = MATRIX.roles.map((r) => r.depth.depth_score);
    const mean =
      Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    expect(mean).toBe(87.3);
    expect(scores.filter((s) => s >= 70)).toHaveLength(93);
    expect(scores.filter((s) => s < 70)).toHaveLength(16);
    expect(ROLE_MATRIX_META.depthStats.mean).toBe(87.3);
  });
});

describe('creative integration — public/research bundle links', () => {
  it('has no broken links in the Creative Practices data', () => {
    const hrefs = [
      ...CREATIVE_PACKAGES.map((p) => p.skillHref),
      ...CREATIVE_CHARTERS.map((c) => c.href),
      ...CREATIVE_DOWNLOADS.map((d) => d.href),
    ];
    for (const href of hrefs) {
      expect(
        existsSync(path.join(ROOT, 'public', href)),
        `missing bundled asset: ${href}`,
      ).toBe(true);
    }
  });

  it('resolves every relative markdown link inside the bundled creative artifacts', () => {
    const dirs = [
      path.join(ROOT, 'public/research/skills/civilization-art-design-research'),
      path.join(ROOT, 'public/research/skills/music-theory-production-engineering'),
    ];
    const mdFiles: string[] = [];
    const walk = (d: string) => {
      for (const ent of readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (ent.name.endsWith('.md')) mdFiles.push(full);
      }
    };
    dirs.forEach(walk);
    mdFiles.push(
      ...CREATIVE_CHARTERS.map((c) => path.join(ROOT, 'public', c.href)),
      path.join(ROOT, 'public/research/civilization_design_music_research.md'),
    );
    expect(mdFiles.length).toBeGreaterThan(10);
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

describe('agent reference graph — integrity', () => {
  it('covers every role, skill, and agent context with validated counts', () => {
    const byType = GRAPH.counts.nodesByType;
    expect(byType.role).toBe(109);
    expect(byType.skill).toBe(21);
    expect(byType['agent-context']).toBe(24); // 10 science + 6 specialist + 5 creative + 3 executive
    expect(byType.resource).toBe(436);
    expect(byType['repo-case']).toBe(23 + 25 + 8 + 13);
    expect(byType.lab).toBe(17 + 10 + 7 + 7);
    expect(byType.steward).toBe(4); // PERMANENT_STEWARD_ROLES (contracts/enterprise.ts)
    expect(
      GRAPH.nodes.filter((n) => n.type === 'steward').map((n) => n.id),
    ).toEqual([
      'steward:blueprint-ops',
      'steward:cache-budget-steward',
      'steward:evidence-ledger-steward',
      'steward:roadmap-cartographer',
    ]);
    for (const n of GRAPH.nodes.filter((n) => n.type === 'steward')) {
      expect(n.provenance).toContain('PERMANENT_STEWARD_ROLES');
      expect(n.provenance).not.toMatch(/proposed/i);
    }
    expect(byType['evaluation-task']).toBe(336);
    expect(GRAPH.counts.nodes).toBe(GRAPH.nodes.length);
    expect(GRAPH.counts.edges).toBe(GRAPH.edges.length);
  });

  it('has no dangling references and only evidenced edge types', () => {
    const ids = new Set(GRAPH.nodes.map((n) => n.id));
    for (const e of GRAPH.edges) {
      expect(ids.has(e.from), `dangling from: ${e.from}`).toBe(true);
      expect(ids.has(e.to), `dangling to: ${e.to}`).toBe(true);
      expect(e.provenance.length).toBeGreaterThan(0);
    }
    const allowed = new Set([
      'uses',
      'mapped-to',
      'evaluates',
      'references',
      'has-lab',
      'has-script',
      'has-sample',
      'contracts',
    ]);
    for (const t of Object.keys(GRAPH.counts.edgesByType)) {
      expect(allowed.has(t)).toBe(true);
    }
    // no invented citation/coauthor edges
    expect(GRAPH.counts.edgesByType.cites).toBeUndefined();
    expect(GRAPH.counts.edgesByType.coauthor).toBeUndefined();
  });

  it('connects every role to a resource and every skill to a role', () => {
    const roleEdges = new Set(
      GRAPH.edges
        .filter((e) => e.type === 'mapped-to' && e.from.startsWith('role:'))
        .map((e) => e.from),
    );
    expect(roleEdges.size).toBe(109);
    const skillEdges = new Set(
      GRAPH.edges
        .filter((e) => e.type === 'mapped-to' && e.from.startsWith('skill:'))
        .map((e) => e.from),
    );
    expect(skillEdges.size).toBe(21);
    // creative skills carry labs, scripts, and samples
    for (const skill of [
      'skill:civilization-art-design-research',
      'skill:music-theory-production-engineering',
    ]) {
      for (const t of ['has-lab', 'has-script', 'has-sample'] as const) {
        expect(
          GRAPH.edges.some((e) => e.type === t && e.from === skill),
          `${skill} missing ${t}`,
        ).toBe(true);
      }
    }
  });
});
