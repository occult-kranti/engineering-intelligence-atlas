/**
 * Automated known-pair contrast checks, using the WCAG 2.x logic mirrored
 * from the bundled UI/UX skill's scripts/contrast_check.py (SC 1.4.3 AA
 * 4.5:1 normal text; SC 1.4.11 3:1 non-text). The pairs resolve against the
 * shipped chrome.css :root tokens, so a theme regression fails this suite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KNOWN_TOKEN_PAIRS,
  compositeOver,
  contrastRatio,
  parseHexColor,
  relativeLuminance,
  type Rgb,
} from '../../src/renderer/office/contrast';

function loadRootTokens(): Record<string, string> {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'chrome.css'), 'utf8');
  const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootBlock || !rootBlock[1]) throw new Error('chrome.css :root block not found');
  const tokens: Record<string, string> = {};
  for (const m of rootBlock[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[m[1]!] = m[2]!.trim();
  }
  return tokens;
}

function resolveColor(value: string, tokens: Record<string, string>): string | Rgb {
  if (value.startsWith('--')) {
    const resolved = tokens[value];
    if (!resolved) throw new Error(`token ${value} missing from chrome.css :root`);
    return resolved;
  }
  return value;
}

describe('WCAG contrast computation (mirrors the UI/UX skill logic)', () => {
  it('matches known reference ratios', () => {
    // Black on white = 21:1; white on white = 1:1.
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // WCAG worked example: #777777 on white ≈ 4.48 (just under AA).
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(relativeLuminance(parseHexColor('#ffffff'))).toBeCloseTo(1, 5);
  });

  it('parses 3/6/8-digit hex and composites alpha', () => {
    expect(parseHexColor('#abc')).toEqual(parseHexColor('#aabbcc'));
    const blended = compositeOver('#000000', 0.5, '#ffffff');
    expect(contrastRatio(blended, parseHexColor('#808080'))).toBeCloseTo(1, 1);
  });
});

describe('shipped theme known pairs (WCAG 2.2 SC 1.4.3 / 1.4.11)', () => {
  const tokens = loadRootTokens();

  it('defines every token referenced by the known-pair list', () => {
    for (const pair of KNOWN_TOKEN_PAIRS) {
      for (const ref of [pair.foreground, pair.background]) {
        if (ref.startsWith('--')) expect(tokens, `missing ${ref}`).toHaveProperty(ref);
      }
    }
  });

  for (const pair of KNOWN_TOKEN_PAIRS) {
    it(`${pair.name} >= ${pair.min}:1`, () => {
      const fg = resolveColor(pair.foreground, tokens);
      const bg = resolveColor(pair.background, tokens);
      const ratio = contrastRatio(fg as string, bg as string);
      expect(
        ratio,
        `${pair.name}: ${pair.foreground} on ${pair.background} = ${ratio.toFixed(2)}:1 (min ${pair.min}:1)`,
      ).toBeGreaterThanOrEqual(pair.min);
    });
  }
});
