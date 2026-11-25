import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { intakeSkillMarkdown, parseFrontmatter, sha256Hex } from './intake';

const document = (metadata: string, body = '# Task\nKeep this body.\n') => `---\n${metadata}\n---\n${body}`;

describe('skill frontmatter intake', () => {
  it('loads the actual repository folded descriptions instead of the block marker', () => {
    const root = fileURLToPath(new URL('../../../skills/', import.meta.url));
    const names = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory());
    expect(names.length).toBeGreaterThan(0);
    for (const entry of names) {
      const source = readFileSync(join(root, entry.name, 'SKILL.md'), 'utf8');
      const result = intakeSkillMarkdown(source);
      expect(result.manifest.name).toBe(entry.name);
      expect(result.manifest.description.length).toBeGreaterThan(30);
      expect(result.manifest.description).not.toMatch(/^[>|][-+]?$/);
      expect(result.parseIssues, entry.name).toEqual([]);
      expect(result.contentSha256).toBe(sha256Hex(source));
      expect(source).toContain(result.body);
    }
  });

  it('folds prose lines, preserves paragraph breaks and strips a >- trailing newline', () => {
    const parsed = parseFrontmatter(document('name: example\ndescription: >-\n  First line\n  continues.\n\n  Second paragraph.'));
    expect(parsed.frontmatter.description).toBe('First line continues.\nSecond paragraph.');
    expect(parsed.issues).toEqual([]);
    expect(parsed.body).toBe('# Task\nKeep this body.\n');
  });

  it('preserves literal blocks and applies clip/keep/strip trailing line rules', () => {
    expect(parseFrontmatter(document('name: example\ndescription: |\n  First\n  Second')).frontmatter.description).toBe('First\nSecond\n');
    expect(parseFrontmatter(document('name: example\ndescription: |-\n  First\n  Second')).frontmatter.description).toBe('First\nSecond');
    expect(parseFrontmatter(document('name: example\ndescription: |+\n  First\n\n')).frontmatter.description).toBe('First\n\n\n');
    expect(parseFrontmatter(document('name: example\ndescription: >\n  First\n  Second')).frontmatter.description).toBe('First Second\n');
  });

  it('preserves more-indented block examples and CRLF input', () => {
    const raw = document('name: example\ndescription: >-\n  Intro\n    sample: read\n  Ending').replaceAll('\n', '\r\n');
    const parsed = parseFrontmatter(raw);
    expect(parsed.frontmatter.description).toBe('Intro\n  sample: read\nEnding');
    expect(parsed.body).toBe('# Task\r\nKeep this body.\r\n');
  });

  it('parses quoted strings and string lists without splitting quoted commas', () => {
    const parsed = intakeSkillMarkdown(document(`name: example\ndescription: 'It''s useful'\ntools-allowed: ["read", 'summarize, compare']\ncapabilities:\n  - read\n  - "cite"`));
    expect(parsed.manifest.description).toBe("It's useful");
    expect(parsed.manifest.toolsAllowed).toEqual(['read', 'summarize, compare']);
    expect(parsed.manifest.capabilities).toEqual(['read', 'cite']);
    expect(parsed.parseIssues).toEqual([]);
  });

  it('reports duplicate/reserved keys and retains the first authority metadata', () => {
    const parsed = intakeSkillMarkdown(document('name: example\ntools-allowed: []\ntools-allowed: [publish]\n__proto__: invalid'));
    expect(parsed.manifest.toolsAllowed).toEqual([]);
    expect(parsed.parseIssues).toContain('duplicate or reserved frontmatter key: tools-allowed');
    expect(parsed.parseIssues).toContain('duplicate or reserved frontmatter key: __proto__');
    expect(({} as Record<string, unknown>).invalid).toBeUndefined();
  });

  it('keeps malformed and missing frontmatter inspectable, never executes tags or aliases', () => {
    for (const raw of ['---\nname: broken', '---\nname: broken\n---not-a-delimiter\nBody']) {
      const parsed = intakeSkillMarkdown(raw);
      expect(parsed.body).toBe(raw);
      expect(parsed.parseIssues).toContain('frontmatter delimiter is missing or malformed');
      expect(parsed.manifest.name).toBe('unnamed-skill');
    }
    for (const value of ['!execute code', '&alias text', '*alias', '{nested: value}']) {
      const parsed = intakeSkillMarkdown(document(`name: example\ndescription: ${value}`));
      expect(parsed.parseIssues).toContain('YAML aliases, tags and nested objects are not supported');
    }
  });

  it('reports malformed identifiers, wrong field types and oversized names without throwing', () => {
    for (const name of ['../../private', 'Bad Name', 'a'.repeat(201)]) {
      const parsed = intakeSkillMarkdown(document(`name: ${name}`));
      expect(parsed.parseIssues.some(issue => issue.includes('lowercase hyphenated'))).toBe(true);
    }
    const parsed = intakeSkillMarkdown(document('name: []\ntools-allowed: publish'));
    expect(parsed.manifest.name).toBe('unnamed-skill');
    expect(parsed.manifest.toolsAllowed).toEqual([]);
    expect(parsed.parseIssues).toContain('frontmatter is missing a name');
    expect(parsed.parseIssues).toContain('invalid manifest field: toolsAllowed');
  });

  it('surfaces unsupported indentation, quotes, lists and block indicators', () => {
    for (const metadata of ['name: example\ndescription: >2\n  text', 'name: example\ndescription: "unterminated', 'name: example\ntools-allowed: [read,,cite]', 'name: example\ndescription: ordinary\n  unsupported continuation']) {
      expect(intakeSkillMarkdown(document(metadata)).parseIssues.length).toBeGreaterThan(0);
    }
  });

  it('preserves content hashes and existing risk signals independent of parsed metadata', () => {
    const text = document('name: example\ndescription: >-\n  Review supplied evidence.', 'Use subprocess and process.env only as quoted source text.');
    const parsed = intakeSkillMarkdown(text);
    expect(parsed.contentSha256).toBe(sha256Hex(text));
    expect(parsed.riskSignals.map(signal => signal.kind)).toContain('code-execution');
    expect(parsed.riskSignals.map(signal => signal.kind)).toContain('env-read');
  });
});
