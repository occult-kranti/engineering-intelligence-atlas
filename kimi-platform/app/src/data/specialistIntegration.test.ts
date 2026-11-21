import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SKILL_PACKAGES } from './skills';
import { RESOURCES } from './resources';
import {
  PROPOSED_ROLE,
  ROLE_MATRIX,
  ROLE_MATRIX_META,
} from './roleMatrix';
import {
  SPECIALIST_CHARTERS,
  SPECIALIST_DOWNLOADS,
  SPECIALIST_PACKAGES,
} from './specialistPractices';
import { ROLE_DETAILS } from './roleDetails';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const FILL = JSON.parse(
  readFileSync(path.join(ROOT, 'db/data/specialist_resource_fill.json'), 'utf8'),
) as {
  summary: Record<string, number>;
  resources: { url: string; id: string }[];
  edges: { link_id?: string }[];
  candidate_extension: { evaluation_tasks: { task_id: string }[] };
};
const CREATIVE_FILL = JSON.parse(
  readFileSync(path.join(ROOT, 'db/data/creative_resource_fill.json'), 'utf8'),
) as {
  summary: Record<string, number>;
  resources: { url: string; id: string }[];
  edges: { link_id?: string }[];
};
const MATRIX = JSON.parse(
  readFileSync(path.join(ROOT, 'db/data/role_capability_matrix.json'), 'utf8'),
) as {
  resources: unknown[];
  resource_links: { link_id: string }[];
  evaluation_tasks: { task_id: string }[];
  skill_mappings: Record<string, unknown>;
  gaps: unknown[];
  roles: { slug: string; depth: { depth_score: number } }[];
};

describe('specialist integration — skill packages', () => {
  it('ships 21 skill packages including the specialist, creative, and executive packages', () => {
    expect(SKILL_PACKAGES).toHaveLength(21);
    const ids = SKILL_PACKAGES.map((s) => s.id);
    expect(ids).toContain('architecture-database-backend-engineering');
    expect(ids).toContain('ui-ux-research-design-engineering');
    expect(ids).toContain('ai-research-frontier');
    expect(ids).toContain('civilization-art-design-research');
    expect(ids).toContain('music-theory-production-engineering');
    expect(ids).toContain('executive-operations-assistant');
  });

  it('Overview constellation has a position for every package', () => {
    const overview = readFileSync(
      path.join(ROOT, 'src/views/Overview.tsx'),
      'utf8',
    );
    for (const s of SKILL_PACKAGES) {
      expect(overview).toContain(`'${s.id}':`);
    }
  });
});

describe('specialist integration — counts from the final fill', () => {
  it('matrix JSON counts match the combined fill summaries', () => {
    expect(MATRIX.resources).toHaveLength(
      346 + FILL.summary.new_resources + CREATIVE_FILL.summary.new_resources,
    );
    expect(MATRIX.resource_links).toHaveLength(
      1556 + FILL.summary.new_edges + CREATIVE_FILL.summary.new_edges,
    );
    expect(MATRIX.evaluation_tasks).toHaveLength(
      327 +
        FILL.summary.role_evaluation_tasks_added +
        CREATIVE_FILL.summary.role_evaluation_tasks_added,
    );
    expect(Object.keys(MATRIX.skill_mappings)).toHaveLength(21);
    expect(MATRIX.gaps).toHaveLength(84); // no gaps close
  });

  it('TS meta mirrors the same counts', () => {
    expect(ROLE_MATRIX_META.roleCount).toBe(109);
    expect(ROLE_MATRIX_META.resourceCount).toBe(MATRIX.resources.length);
    expect(ROLE_MATRIX_META.resourceEdges).toBe(MATRIX.resource_links.length);
    expect(ROLE_MATRIX_META.evaluationTaskCount).toBe(
      MATRIX.evaluation_tasks.length,
    );
    expect(ROLE_MATRIX_META.skillPackCount).toBe(21);
  });

  it('the atlas Library carries every new specialist and creative resource', () => {
    expect(RESOURCES).toHaveLength(
      346 + FILL.summary.new_resources + CREATIVE_FILL.summary.new_resources,
    );
    const urls = new Set(RESOURCES.map((r) => r.url));
    for (const r of FILL.resources) expect(urls.has(r.url)).toBe(true);
    for (const r of CREATIVE_FILL.resources) expect(urls.has(r.url)).toBe(true);
  });
});

describe('specialist integration — ID stability and depth invariance', () => {
  it('keeps RL-0001..RL-1683 byte-stable and appends creative RL-1684+', () => {
    const ids = MATRIX.resource_links.map((l) => l.link_id);
    expect(ids[0]).toBe('RL-0001');
    expect(ids[1555]).toBe('RL-1556');
    expect(ids[1556]).toBe('RL-1557');
    expect(ids[1682]).toBe('RL-1683');
    expect(ids[1683]).toBe('RL-1684');
    expect(ids[ids.length - 1]).toBe(`RL-${String(ids.length).padStart(4, '0')}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps ET-NNN-1..3 tasks and appends ET-NNN-4+ and ET-CAND-*', () => {
    const ids = MATRIX.evaluation_tasks.map((t) => t.task_id);
    expect(ids.filter((id) => /-3$/.test(id))).toHaveLength(109);
    for (const id of ['ET-004-4', 'ET-004-5', 'ET-034-4', 'ET-008-7']) {
      expect(ids).toContain(id);
    }
    expect(ids.filter((id) => id.startsWith('ET-CAND-'))).toHaveLength(0); // candidate tasks live on the draft, not the standing battery
    const candIds = FILL.candidate_extension.evaluation_tasks.map(
      (t) => t.task_id,
    );
    expect(candIds).toEqual([
      'ET-CAND-1',
      'ET-CAND-2',
      'ET-CAND-3',
      'ET-CAND-4',
      'ET-CAND-5',
    ]);
  });

  it('keeps all 109 depth scores invariant (mean 87.3, 93 >= 70, 16 < 70)', () => {
    const scores = MATRIX.roles.map((r) => r.depth.depth_score);
    expect(scores).toHaveLength(109);
    const mean =
      Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    expect(mean).toBe(87.3);
    expect(scores.filter((s) => s >= 70)).toHaveLength(93);
    expect(ROLE_MATRIX_META.depthStats.mean).toBe(87.3);
    expect(ROLE_MATRIX_META.depthStats.roles_ge_70).toBe(93);
    expect(ROLE_MATRIX_META.depthStats.roles_lt_70).toBe(16);
  });

  it('computes shared-literacy exclusions dynamically (>30 roles)', () => {
    expect(ROLE_MATRIX_META.sharedLiteracyExcluded).toEqual(['Made to Stick']);
  });
});

describe('specialist integration — candidate rendering data', () => {
  it('keeps exactly one candidate, never a standing role', () => {
    expect(PROPOSED_ROLE.id).toBe('product-designer-ux-researcher');
    expect(ROLE_MATRIX.some((r) => r.id === PROPOSED_ROLE.id)).toBe(false);
    expect(ROLE_DETAILS[PROPOSED_ROLE.id]).toBeUndefined();
    expect(ROLE_MATRIX).toHaveLength(109);
  });

  it('attaches the fuller inventory and ET-CAND evaluations to the draft', () => {
    const inv = PROPOSED_ROLE.inventory;
    expect(inv.foundational.length + inv.core.length + inv.advanced.length).toBe(53);
    expect(PROPOSED_ROLE.evaluationTasks.map((t) => t.taskId)).toEqual([
      'ET-CAND-1',
      'ET-CAND-2',
      'ET-CAND-3',
      'ET-CAND-4',
      'ET-CAND-5',
    ]);
    expect(PROPOSED_ROLE.agentContexts).toHaveLength(3);
  });
});

describe('specialist integration — public/research bundle links', () => {
  it('has no broken links in the Specialist Practices data', () => {
    const hrefs = [
      ...SPECIALIST_PACKAGES.map((p) => p.skillHref),
      ...SPECIALIST_CHARTERS.map((c) => c.href),
      ...SPECIALIST_DOWNLOADS.map((d) => d.href),
    ];
    expect(SPECIALIST_PACKAGES).toHaveLength(2);
    expect(SPECIALIST_CHARTERS).toHaveLength(6);
    for (const href of hrefs) {
      expect(
        existsSync(path.join(ROOT, 'public', href)),
        `missing bundled asset: ${href}`,
      ).toBe(true);
    }
  });

  it('resolves every relative markdown link inside the bundled specialist artifacts', () => {
    const dirs = [
      path.join(ROOT, 'public/research/skills/architecture-database-backend-engineering'),
      path.join(ROOT, 'public/research/skills/ui-ux-research-design-engineering'),
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
      ...SPECIALIST_CHARTERS.map((c) => path.join(ROOT, 'public', c.href)),
      path.join(ROOT, 'public/research/architecture_database_backend_research.md'),
      path.join(ROOT, 'public/research/ui_ux_theory_implementation_research.md'),
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
