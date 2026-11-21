export type DirectoryLink = {
  label: string; url: string; kind: string; verification: 'verified' | 'reported';
  verifiedAt?: string; sourceUrl?: string;
};
export type DirectoryEntry = {
  id: string; companyId: string; name: string; description: string; kind: string;
  status: 'live' | 'preview' | 'release' | 'unverified' | 'archived';
  repositoryCreatedAt?: string; websiteCreatedAt?: string; firstPublishedAt?: string; updatedAt?: string;
  dateSourceUrl?: string; relatedCompanyIds: string[]; links: DirectoryLink[];
};
export type DirectoryCompany = {
  id: string; name: string; repoUrl: string | null; visibility: string | null; status: string;
  officeCreatedAt?: string; groups: {id: string; name: string}[]; applications: DirectoryEntry[];
};
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(row) : [];
const text = (value: unknown, limit = 2000) => typeof value === 'string' ? value.slice(0, limit) : '';
const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : undefined;

export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // Connection credentials are not catalog links. Ordinary deep-link query
    // parameters (such as Figma node-id) remain available.
    const parameterSets = [url.searchParams, new URLSearchParams(url.hash.slice(1))];
    for (const parameters of parameterSets) for (const name of parameters.keys()) if (/(?:token|api[_-]?key|authorization|password|secret)/i.test(name)) return null;
    return url.href;
  } catch { return null; }
}

export function officeLink(companyId: string, view: 'chat' | 'blueprint' | 'softboard' | 'timeline' | 'whiteboard' | 'decisions' = 'chat'): string {
  return `/workspace/chrome.html?company=${encodeURIComponent(companyId)}&workspace=${view}#office`;
}

export function buildDirectory(snapshot: unknown, input: unknown): DirectoryCompany[] {
  const state = row(snapshot);
  const companies = rows(state.companies).filter(c => text(c.id) && text(c.name));
  const ids = new Set(companies.map(c => text(c.id)));
  const groups = rows(row(state.portfolio).groups);
  const entries: DirectoryEntry[] = [];
  const seen = new Set<string>();
  for (const value of rows(input)) {
    const id = text(value.id, 200), companyId = text(value.companyId, 200);
    if (!id || seen.has(id) || !ids.has(companyId)) continue;
    seen.add(id);
    const links: DirectoryLink[] = [];
    const seenLinks = new Set<string>();
    for (const link of rows(value.links)) {
      const url = safeHttpsUrl(link.url);
      if (!url || seenLinks.has(url)) continue;
      seenLinks.add(url);
      const verifiedAt = date(link.verifiedAt);
      links.push({ label: text(link.label, 100) || 'Open link', url, kind: text(link.kind, 40) || 'application', verification: link.verification === 'verified' && verifiedAt ? 'verified' : 'reported', verifiedAt, sourceUrl: safeHttpsUrl(link.sourceUrl) ?? undefined });
    }
    const requestedStatus = text(value.status);
    const status = ['live', 'preview', 'release', 'archived'].includes(requestedStatus) ? requestedStatus as DirectoryEntry['status'] : 'unverified';
    // A source record saying "live" without an actual verified application
    // link must not become a deployment claim in the directory.
    const liveVerified = links.some(link => ['application', 'dashboard'].includes(link.kind) && link.verification === 'verified');
    entries.push({
      id, companyId, name: text(value.name, 200) || 'Untitled application', description: text(value.description),
      kind: text(value.kind, 40) || 'repository', status: status === 'live' && !liveVerified ? 'unverified' : status,
      repositoryCreatedAt: date(value.repositoryCreatedAt ?? value.repoCreatedAt), websiteCreatedAt: date(value.websiteCreatedAt), firstPublishedAt: date(value.firstPublishedAt), updatedAt: date(value.updatedAt),
      dateSourceUrl: safeHttpsUrl(value.dateSourceUrl) ?? undefined,
      relatedCompanyIds: [...new Set(strings(value.relatedCompanyIds).filter(id => ids.has(id) && id !== companyId))], links,
    });
  }
  return companies.map(c => {
    const id = text(c.id, 200);
    return {
      id, name: text(c.name, 200), repoUrl: safeHttpsUrl(c.repoUrl), visibility: text(c.visibility, 20) || null,
      status: text(c.status, 20) || 'active', officeCreatedAt: date(c.createdAt),
      groups: groups.filter(group => strings(group.companyIds).includes(id)).map(group => ({id: text(group.id, 200), name: text(group.name, 200)})),
      applications: entries.filter(entry => entry.companyId === id),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function filterDirectory(companies: DirectoryCompany[], filters: {query?: string; group?: string; status?: string; company?: string; sort?: string}): DirectoryCompany[] {
  const query = (filters.query ?? '').trim().toLocaleLowerCase();
  const matches = companies.filter(company => {
    if (filters.company && filters.company !== company.id) return false;
    if (filters.group && filters.group !== 'all' && !company.groups.some(group => group.id === filters.group)) return false;
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'no-links') { if (company.applications.some(app => app.links.some(link => ['application', 'dashboard', 'download'].includes(link.kind)))) return false; }
      else if (!company.applications.some(app => app.status === filters.status)) return false;
    }
    const haystack = [company.name, company.repoUrl, ...company.groups.map(g => g.name), ...company.applications.flatMap(a => [a.name, a.description, a.kind, ...a.relatedCompanyIds.map(id => companies.find(c => c.id === id)?.name ?? '')])].join(' ').toLocaleLowerCase();
    return !query || haystack.includes(query);
  });
  if (filters.sort === 'published' || filters.sort === 'repository-created') {
    const timestamp = (company: DirectoryCompany) => Math.max(0, ...company.applications.map(app => Date.parse((filters.sort === 'published' ? app.firstPublishedAt : app.repositoryCreatedAt) ?? '') || 0));
    matches.sort((a, b) => timestamp(b) - timestamp(a) || a.name.localeCompare(b.name));
  }
  return matches;
}

export function displayDate(value?: string): string {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(value)) : 'Not recorded';
}

export function reviewIsDue(value?: string, now = Date.now()): boolean {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && now - timestamp > 7 * 24 * 60 * 60 * 1000;
}
