import { describe, expect, it } from 'vitest';
import { CORPUS_COUNTS } from './corpusCounts';
import { ROLES } from './roles';
import { RESOURCES } from './resources';
import { JOBS } from './jobs';
import { SKILL_PACKAGES } from './skills';

describe('corpusCounts — generated constants track the source arrays', () => {
  it('matches the source arrays exactly', () => {
    expect(CORPUS_COUNTS.roles).toBe(ROLES.length);
    expect(CORPUS_COUNTS.resources).toBe(RESOURCES.length);
    expect(CORPUS_COUNTS.skillPackages).toBe(SKILL_PACKAGES.length);
    expect(CORPUS_COUNTS.jobRecords).toBe(JOBS.recordCount);
  });

  it('chrome components use the constants, not the heavy arrays', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const root = path.resolve(import.meta.dirname, '..', '..');
    for (const rel of ['src/components/Chrome.tsx', 'src/views/Overview.tsx']) {
      const src = readFileSync(path.join(root, rel), 'utf8');
      expect(src).toContain('corpusCounts');
      expect(src).not.toMatch(/import \{ ROLES \} from '@\/data\/roles'/);
      expect(src).not.toMatch(/import \{ RESOURCES \} from '@\/data\/resources'/);
      expect(src).not.toMatch(/import \{ JOBS \} from '@\/data\/jobs'/);
    }
  });
});
