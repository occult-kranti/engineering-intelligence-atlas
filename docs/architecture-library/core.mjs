/** Pure catalog operations shared by the browser and the verification gate. */
export const ERAS = Object.freeze([
  { id: 'all', label: 'Full chronology', start: -10000, end: 2026 },
  { id: 'early', label: 'Before 3000 BCE', start: -10000, end: -3001 },
  { id: 'ancient', label: '3000 BCE – 500 CE', start: -3000, end: 500 },
  { id: 'medieval', label: '501 – 1500', start: 501, end: 1500 },
  { id: 'early-modern', label: '1501 – 1850', start: 1501, end: 1850 },
  { id: 'modern', label: '1851 – 2000', start: 1851, end: 2000 },
  { id: 'contemporary', label: '2001 – 2026', start: 2001, end: 2026 },
]);
export const DATA_FILES = Object.freeze({
  monuments: 'data/monuments.json', elements: 'data/elements.json',
  samples: 'data/samples.json', tools: 'data/tools.json',
  historySources: 'data/sources-history.json', toolSources: 'data/sources-tools.json',
  elementSources: 'data/sources-elements.json',
});
export function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en');
}
export function yearLabel(year) {
  if (!Number.isInteger(year) || year === 0) throw new Error('Chronology requires a signed year with no year zero.');
  return `${Math.abs(year).toLocaleString('en-US')}${year < 0 ? ' BCE' : ' CE'}`;
}
// Convert signed historical years to an interval axis without inventing a year zero.
export function axisYear(year) { return year < 0 ? year + 1 : year; }
export function intervalPosition(record, era) {
  const a = axisYear(era.start), b = axisYear(era.end);
  const start = Math.max(a, axisYear(record.startYear));
  const end = Math.min(b, axisYear(record.endYear));
  return { left: 100 * (start - a) / (b - a), width: Math.max(.4, 100 * (end - start) / (b - a)) };
}
export function filterRecords(records, { query = '', region = '', category = '', era = 'all' } = {}) {
  const interval = ERAS.find(item => item.id === era) ?? ERAS[0];
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
  return records.filter(record => {
    if (region && record.region !== region) return false;
    if (category && !record.categories.includes(category)) return false;
    if (record.endYear < interval.start || record.startYear > interval.end) return false;
    const haystack = normalize([record.name, record.country, record.region, record.period,
      record.description, record.engineering, ...record.categories, ...record.materials,
      ...record.structuralSystems, ...record.elements].join(' '));
    return tokens.every(token => haystack.includes(token));
  }).sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.name.localeCompare(b.name));
}
export function groupChronology(records) {
  return ERAS.slice(1).map(era => ({ ...era,
    records: records.filter(record => record.startYear >= era.start && record.startYear <= era.end),
  })).filter(group => group.records.length);
}
export function safeAssetPath(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*\.[A-Za-z0-9]+$/.test(value)
    && !value.split('/').some(part => part === '.' || part === '..' || part.startsWith('.'));
}
export function sourceIndex(data) {
  const index = new Map();
  for (const key of ['historySources', 'toolSources', 'elementSources']) {
    for (const source of data[key].sources) {
      if (index.has(source.id)) throw new Error(`Duplicate source ID: ${source.id}`);
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`Unsafe source URL: ${source.id}`);
      index.set(source.id, source);
    }
  }
  return index;
}
export function prepareData(data) {
  for (const key of Object.keys(DATA_FILES)) {
    if (data[key]?.schemaVersion !== 1) throw new Error(`Unsupported ${key} schema.`);
  }
  if (!Array.isArray(data.monuments.records) || !Array.isArray(data.elements.elements)
      || !Array.isArray(data.samples.samples) || !Array.isArray(data.tools.tools)
      || !Array.isArray(data.tools.claims)) throw new Error('Incomplete catalog.');
  const sources = sourceIndex(data);
  for (const collection of [data.monuments.records, data.elements.elements, data.samples.samples, data.tools.tools, data.tools.claims]) {
    const ids = new Set();
    for (const record of collection) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id) || ids.has(record.id)) throw new Error(`Invalid or duplicate record ID: ${record.id}`);
      ids.add(record.id);
      if (!Array.isArray(record.sourceIds) || !record.sourceIds.length || record.sourceIds.some(id => !sources.has(id))) throw new Error(`Unresolved source in ${record.id}`);
    }
  }
  for (const record of data.monuments.records) {
    if (![record.startYear, record.endYear].every(year => Number.isInteger(year) && year !== 0 && year >= -10000 && year <= 2026)
      || record.endYear < record.startYear) throw new Error(`Invalid historical interval: ${record.id}`);
  }
  for (const sample of data.samples.samples) {
    if (!['blend', 'glb', 'preview', 'metadata'].every(key => safeAssetPath(sample.files?.[key]))) throw new Error(`Invalid sample asset path: ${sample.id}`);
  }
  return { ...data, sources };
}
