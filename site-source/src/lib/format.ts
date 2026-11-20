const nf = new Intl.NumberFormat('en-US');

export function fmt(n: number): string {
  return nf.format(n);
}

export function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Lifecycle/status flag detection used to mark risky ecosystem entries. */
export function statusFlags(status: string, license: string) {
  const s = status.toLowerCase();
  const l = license.toLowerCase();
  return {
    deprecated: s.includes('deprecated') || s.includes('archived') || s.includes('404'),
    maintenance: s.includes('maintenance') || s.includes('legacy') || s.includes('demo'),
    unlicensed:
      l.includes('no root license') || l.includes('not open source') || l === '',
    community: false as boolean,
  };
}

/** USD micros (1e-6 USD) → display string. */
export function fmtUsd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}
