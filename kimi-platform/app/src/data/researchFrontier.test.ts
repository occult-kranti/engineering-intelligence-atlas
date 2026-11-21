import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILL_PACKAGES } from './skills';
import { FRONTIER, SCIENCE_AGENTS, SCIENCE_COUNTS, SOURCE_REPORTS } from './science';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(APP_ROOT, 'public');

/** Resolve a bundle-relative href (e.g. 'research/x.md') against public/. */
const pub = (href: string) => path.join(PUBLIC, href);

describe('twenty-one skill packages', () => {
  it('contains ai-research-frontier as the sixteenth package', () => {
    expect(SKILL_PACKAGES).toHaveLength(21);
    const ids = SKILL_PACKAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // ai-research-frontier was added as the sixteenth package; the two
    // specialist packages (17th/18th), the two creative packages
    // (19th/20th), and the executive-operations package (21st) follow it.
    expect(ids[15]).toBe('ai-research-frontier');
    expect(ids).toContain('ai-research-frontier');
    expect(ids.slice(16)).toEqual([
      'architecture-database-backend-engineering',
      'ui-ux-research-design-engineering',
      'civilization-art-design-research',
      'music-theory-production-engineering',
      'executive-operations-assistant',
    ]);
  });
});

describe('science & models chapter', () => {
  it('lists ten dedicated agents including the frontier trio', () => {
    expect(SCIENCE_AGENTS).toHaveLength(10);
    expect(SCIENCE_COUNTS.agents).toBe(SCIENCE_AGENTS.length);
    const ids = SCIENCE_AGENTS.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'ai-research-director',
        'senior-ai-research-scientist',
        'research-writer-reproducibility-editor',
      ]),
    );
    for (const id of ['ai-research-director', 'senior-ai-research-scientist', 'research-writer-reproducibility-editor']) {
      expect(SCIENCE_AGENTS.find((a) => a.id === id)?.skill).toBe('ai-research-frontier');
    }
  });

  it('every agent charter link resolves inside the bundle', () => {
    for (const a of SCIENCE_AGENTS) {
      expect(fs.existsSync(pub(a.charter)), `missing charter: ${a.charter}`).toBe(true);
    }
  });

  it('every source report link resolves inside the bundle', () => {
    for (const r of SOURCE_REPORTS) {
      expect(fs.existsSync(pub(r.href)), `missing report: ${r.href}`).toBe(true);
    }
  });
});

describe('AI research-frontier section artifacts', () => {
  it('reports the published corpus figures', () => {
    expect(FRONTIER.papers).toBe(101);
    expect(FRONTIER.venues).toBe(22);
    expect(FRONTIER.artifacts).toBe(121);
    expect(FRONTIER.fields.reduce((n, f) => n + f.papers, 0)).toBe(FRONTIER.papers);
    expect(FRONTIER.snapshot).toBe('2026-11-21');
  });

  it('bundles the network image, report, workbook, graph, and practice doc', () => {
    for (const href of [
      FRONTIER.networkImage,
      FRONTIER.report,
      FRONTIER.workbook,
      FRONTIER.graphJson,
      FRONTIER.practice,
    ]) {
      expect(fs.existsSync(pub(href)), `missing artifact: ${href}`).toBe(true);
    }
  });

  it('bundles the ai-research-frontier skill package with all four references', () => {
    const dir = pub('research/skills/ai-research-frontier');
    expect(fs.existsSync(path.join(dir, 'SKILL.md'))).toBe(true);
    for (const ref of [
      'venue_and_writing.md',
      'literature_dataset.md',
      'evaluation_reproducibility.md',
      'ethics_and_roles.md',
    ]) {
      expect(fs.existsSync(path.join(dir, 'references', ref)), `missing reference: ${ref}`).toBe(true);
    }
  });
});

describe('role-capability matrix mapping', () => {
  const matrix = JSON.parse(
    fs.readFileSync(path.join(APP_ROOT, 'db/data/role_capability_matrix.json'), 'utf8'),
  ) as {
    skill_mappings: Record<string, { consumer_role_count: number; consumer_roles: string[] }>;
    roles: { slug: string; skill_packs: string[] }[];
  };

  it('maps ai-research-frontier to its four consumer roles', () => {
    // 21 mappings: 16 baseline (incl. frontier) + 2 specialist + 2 creative
    // packs + 1 executive-operations mapping.
    expect(Object.keys(matrix.skill_mappings)).toHaveLength(21);
    const m = matrix.skill_mappings['ai-research-frontier'];
    expect(m).toBeDefined();
    expect(m.consumer_role_count).toBe(m.consumer_roles.length);
    expect(m.consumer_role_count).toBe(4);
    const bySlug = new Map(matrix.roles.map((r) => [r.slug, r]));
    for (const slug of m.consumer_roles) {
      expect(bySlug.get(slug)?.skill_packs, `role ${slug} missing pack`).toContain(
        'ai-research-frontier',
      );
    }
  });
});

describe('published markdown link integrity', () => {
  it('has no broken relative links under public/research', () => {
    const root = pub('research');
    const broken: string[] = [];
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          walk(full);
        } else if (ent.name.endsWith('.md')) {
          const text = fs.readFileSync(full, 'utf8');
          for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
            const href = m[1];
            if (/^(https?:|#|mailto:)/.test(href)) continue;
            if (!fs.existsSync(path.normalize(path.join(dir, href)))) {
              broken.push(`${path.relative(root, full)} -> ${href}`);
            }
          }
        }
      }
    };
    walk(root);
    expect(broken).toEqual([]);
  }, 20_000);
});
