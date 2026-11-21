/**
 * WCAG 2.x contrast ratio computation, mirrored 1:1 from the bundled UI/UX
 * skill's scripts/contrast_check.py (WCAG 2.2 SC 1.4.3 / 1.4.11). APCA is
 * intentionally NOT used: it is not normative anywhere.
 *
 * KNOWN_TOKEN_PAIRS is the automated regression list: every text/background
 * pair the theme actually uses, with its required minimum ratio. The
 * renderer test suite resolves these tokens from chrome.css and asserts the
 * ratios, so a theme edit that drops a pair below AA fails the build.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse #rgb / #rrggbb / #rrggbbaa to 0..1 channel floats (alpha composited over `bg`). */
export function parseHexColor(value: string, bg?: Rgb): Rgb {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(value.trim());
  if (!m || !m[1]) throw new Error(`not a 3/6/8-digit hex color: ${value}`);
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  let r = parseInt(h.slice(0, 2), 16) / 255;
  let g = parseInt(h.slice(2, 4), 16) / 255;
  let b = parseInt(h.slice(4, 6), 16) / 255;
  if (h.length === 8) {
    const a = parseInt(h.slice(6, 8), 16) / 255;
    const base = bg ?? { r: 1, g: 1, b: 1 };
    r = a * r + (1 - a) * base.r;
    g = a * g + (1 - a) * base.g;
    b = a * b + (1 - a) * base.b;
  }
  return { r, g, b };
}

function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance of an sRGB color. */
export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrastRatio(foreground: string | Rgb, background: string | Rgb): number {
  const fg = typeof foreground === 'string' ? parseHexColor(foreground) : foreground;
  const bg = typeof background === 'string' ? parseHexColor(background) : background;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Composite an rgba() overlay color over an opaque hex background. */
export function compositeOver(overlay: string, alpha: number, background: string): Rgb {
  const fg = parseHexColor(overlay);
  const bg = parseHexColor(background);
  return {
    r: alpha * fg.r + (1 - alpha) * bg.r,
    g: alpha * fg.g + (1 - alpha) * bg.g,
    b: alpha * fg.b + (1 - alpha) * bg.b,
  };
}

export interface TokenPair {
  /** Human-readable name for failure reports. */
  name: string;
  /** Foreground: a CSS variable name (--x) or literal color. */
  foreground: string;
  /** Background: a CSS variable name or literal color. */
  background: string;
  /** Minimum WCAG ratio: 4.5 normal text, 3 large text / non-text. */
  min: number;
}

/**
 * The theme's known text pairs. Foregrounds/backgrounds reference the :root
 * custom properties in chrome.css so the test checks the shipped theme, not
 * a copy. All normal-text pairs require 4.5:1 (WCAG 2.2 SC 1.4.3 AA).
 */
export const KNOWN_TOKEN_PAIRS: TokenPair[] = [
  { name: 'body text on app background', foreground: '--text', background: '--bg', min: 4.5 },
  { name: 'body text on panel', foreground: '--text', background: '--panel', min: 4.5 },
  { name: 'body text on panel-2 (cards)', foreground: '--text', background: '--panel-2', min: 4.5 },
  { name: 'muted text on app background', foreground: '--muted', background: '--bg', min: 4.5 },
  { name: 'muted text on panel', foreground: '--muted', background: '--panel', min: 4.5 },
  { name: 'muted text on panel-2', foreground: '--muted', background: '--panel-2', min: 4.5 },
  { name: 'primary button label', foreground: '--on-accent', background: '--accent', min: 4.5 },
  { name: 'primary button hover label', foreground: '--on-accent', background: '--accent-strong', min: 4.5 },
  { name: 'secondary button label', foreground: '--text', background: '--panel-2', min: 4.5 },
  { name: 'danger/Reject button label', foreground: '--danger-text', background: '--danger-bg', min: 4.5 },
  { name: 'danger button hover label', foreground: '--danger-text', background: '--danger-bg-hover', min: 4.5 },
  { name: 'error status text on panel', foreground: '--danger-text', background: '--panel', min: 4.5 },
  { name: 'error status text on app background', foreground: '--danger-text', background: '--bg', min: 4.5 },
  { name: 'ok status text on panel', foreground: '--ok', background: '--panel', min: 4.5 },
  { name: 'warn status text on panel', foreground: '--warn', background: '--panel', min: 4.5 },
  { name: 'link / roadmap accent text on panel', foreground: '--link', background: '--panel', min: 4.5 },
  { name: 'link text on app background', foreground: '--link', background: '--bg', min: 4.5 },
  { name: 'timeline loop marker text', foreground: '--link', background: '--panel', min: 4.5 },
  { name: 'pass badge text on badge fill', foreground: '--link-strong', background: '--badge-pass-bg', min: 4.5 },
  { name: 'ok badge text on badge fill', foreground: '--ok', background: '--badge-ok-bg', min: 4.5 },
  { name: 'fail badge text on badge fill', foreground: '--danger-text', background: '--badge-fail-bg', min: 4.5 },
  { name: 'warn badge text on badge fill', foreground: '--warn', background: '--badge-warn-bg', min: 4.5 },
  { name: 'neutral badge text on badge fill', foreground: '--text', background: '--line', min: 4.5 },
  { name: 'focus outline vs panel (non-text 3:1)', foreground: '--focus', background: '--panel', min: 3 },
  { name: 'selected tab underline vs panel (non-text 3:1)', foreground: '--accent-strong', background: '--panel', min: 3 },
];
