// Bundles the reviewed atlas skill packages into resources/skills and
// (re)generates skills.catalog.json with id/name/description/role/keywords/
// sha256/body path. Skill packages are DATA for the runtime: the SkillRegistry
// reads SKILL.md bodies only and never executes bundled scripts.
//
// Usage: node scripts/build-skills-catalog.mjs [sourceDir]
//   sourceDir defaults to ../../output (the workspace atlas output folder).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const sourceRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(root, '..', '..', 'output');
const destRoot = path.join(root, 'resources', 'skills');

/**
 * Curated, deterministic metadata per reviewed skill package. `role` is a
 * canonical office room id; `keywords` drive deterministic goal→skill hiring.
 * A package missing from this map fails the build loudly — never guessed.
 */
const SKILL_META = {
  'agent-research-director': {
    role: 'operations',
    keywords: ['research', 'director', 'orchestration', 'squad', 'planning', 'delegation', 'brief'],
  },
  'ai-open-model-research': {
    role: 'research',
    keywords: ['ai', 'open', 'model', 'llm', 'license', 'evaluation', 'local', 'weights', 'inference'],
  },
  'ai-research-frontier': {
    role: 'research',
    keywords: ['ai', 'research', 'paper', 'literature', 'novelty', 'citation', 'venue', 'peer-review', 'reproducibility', 'benchmark'],
  },
  'architecture-and-built-heritage-research': {
    role: 'architecture',
    keywords: ['architecture', 'heritage', 'building', 'conservation', 'urban', 'design', 'history'],
  },
  'architecture-database-backend-engineering': {
    role: 'architecture',
    keywords: ['architecture', 'database', 'backend', 'schema', 'sql', 'api', 'system', 'scalability'],
  },
  'biology-research': {
    role: 'research',
    keywords: ['biology', 'genomics', 'protein', 'cell', 'ecology', 'evolution', 'laboratory'],
  },
  'chemistry-research': {
    role: 'research',
    keywords: ['chemistry', 'molecule', 'reaction', 'synthesis', 'spectroscopy', 'materials'],
  },
  'civilization-art-design-research': {
    role: 'design',
    keywords: ['art', 'design', 'civilization', 'symmetry', 'pattern', 'ornament', 'museum', 'heritage', 'history'],
  },
  'computational-geometry-engineering': {
    role: 'engineering',
    keywords: ['geometry', 'algorithm', 'mesh', 'computational', 'spatial', 'cad', 'engineering'],
  },
  'defensive-reverse-engineering': {
    role: 'engineering',
    keywords: ['security', 'reverse', 'engineering', 'malware', 'defensive', 'binary', 'vulnerability'],
  },
  'engineering-job-market-intelligence': {
    role: 'data',
    keywords: ['job', 'market', 'intelligence', 'hiring', 'salary', 'trends', 'data', 'engineering'],
  },
  'engineering-organization-architect': {
    role: 'operations',
    keywords: ['organization', 'engineering', 'team', 'structure', 'management', 'process', 'architecture'],
  },
  'executive-operations-assistant': {
    role: 'operations',
    keywords: ['assistant', 'executive', 'approval', 'proposal', 'schedule', 'queue', 'repository', 'steward', 'operations'],
  },
  'game-reconstruction-engineering': {
    role: 'engineering',
    keywords: ['game', 'reconstruction', 'engine', 'assets', 'reverse', 'engineering', 'remake'],
  },
  'local-model-runtime-engineering': {
    role: 'engineering',
    keywords: ['local', 'model', 'runtime', 'inference', 'llama', 'gguf', 'quantization', 'engineering'],
  },
  'mathematics-research': {
    role: 'research',
    keywords: ['mathematics', 'proof', 'theorem', 'algebra', 'analysis', 'topology', 'number'],
  },
  'music-theory-production-engineering': {
    role: 'engineering',
    keywords: ['music', 'theory', 'audio', 'dsp', 'tuning', 'midi', 'loudness', 'rights', 'provenance', 'production'],
  },
  'physics-research': {
    role: 'research',
    keywords: ['physics', 'quantum', 'relativity', 'particle', 'experiment', 'measurement'],
  },
  'science-history-research': {
    role: 'research',
    keywords: ['history', 'science', 'archive', 'provenance', 'historiography', 'primary', 'sources'],
  },
  'spatial-3d-production-engineering': {
    role: 'design',
    keywords: ['3d', 'spatial', 'production', 'rendering', 'modeling', 'pipeline', 'assets', 'scene'],
  },
  'ui-ux-research-design-engineering': {
    role: 'design',
    keywords: ['ui', 'ux', 'design', 'usability', 'accessibility', 'wcag', 'interface', 'prototype', 'user', 'research'],
  },
};

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function parseFrontmatter(body, id) {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`${id}: SKILL.md is missing YAML frontmatter`);
  const fm = match[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  // description may be a folded scalar (description: >-); collect raw text.
  let description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  if (description === '>-' || description === '>' || description === '|' || description === '|-') {
    const lines = fm.split(/\r?\n/);
    const start = lines.findIndex((l) => /^description:/.test(l));
    const collected = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (/^\S/.test(line)) break; // next top-level key
      collected.push(line.trim());
    }
    description = collected.join(' ').trim();
  }
  if (!name) throw new Error(`${id}: frontmatter is missing a name`);
  if (!description) throw new Error(`${id}: frontmatter is missing a description`);
  return { name, description };
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const entries = [];
for (const [id, meta] of Object.entries(SKILL_META)) {
  const srcDir = path.join(sourceRoot, id);
  const bodyPath = path.join(srcDir, 'SKILL.md');
  if (!fs.existsSync(bodyPath)) throw new Error(`missing reviewed skill package: ${srcDir}`);
  const body = fs.readFileSync(bodyPath, 'utf8');
  const { name, description } = parseFrontmatter(body, id);
  const destDir = path.join(destRoot, id);
  fs.rmSync(destDir, { recursive: true, force: true });
  copyDir(srcDir, destDir);
  entries.push({
    id,
    name,
    description: description.slice(0, 600),
    role: meta.role,
    keywords: [...meta.keywords].sort(),
    sha256: sha256(body),
    path: `${id}/SKILL.md`,
  });
}

entries.sort((a, b) => a.id.localeCompare(b.id));
const catalog = { version: 1, generatedBy: 'scripts/build-skills-catalog.mjs', skills: entries };
fs.mkdirSync(destRoot, { recursive: true });
fs.writeFileSync(path.join(destRoot, 'skills.catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log(`Bundled ${entries.length} skill packages -> ${destRoot}`);
