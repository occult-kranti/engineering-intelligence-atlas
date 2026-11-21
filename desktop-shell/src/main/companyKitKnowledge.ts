import type { OfficeKnowledge } from '../shared/office';

const KIND = 'daftar-company-kit-binding';
const ID = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}$/;
const KEY = /^[a-z][a-z0-9-]{0,59}$/;
const TYPES = new Set(['company', 'office', 'department', 'employee', 'room', 'knowledge']);
const FIELDS = new Set(['kind', 'schemaVersion', 'companyId', 'kitKey', 'entityType', 'key', 'entityId']);

interface Binding {
  kind: typeof KIND;
  schemaVersion: 1;
  companyId: string;
  kitKey: string;
  entityType: string;
  key: string;
  entityId: string;
}

function parse(summary: string): Record<string, unknown> | null {
  if (Buffer.byteLength(summary) > 4000) return null;
  try {
    const value: unknown = JSON.parse(summary);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch { return null; }
}

function metadata(record: OfficeKnowledge, value: Record<string, unknown> | null): boolean {
  return value?.kind === KIND
    || (typeof record.artifactUri === 'string' && /^daftar-kit:/i.test(record.artifactUri))
    || record.title.startsWith('Company kit identity:')
    || /"kind"\s*:\s*"daftar-company-kit-binding"/.test(record.summary);
}

function address(value: Record<string, unknown> | null): string | null {
  return typeof value?.kitKey === 'string' && KEY.test(value.kitKey)
    && typeof value.entityType === 'string' && TYPES.has(value.entityType)
    && typeof value.key === 'string' && KEY.test(value.key)
    ? `${value.kitKey}\0${value.entityType}\0${value.key}` : null;
}

function validBinding(record: OfficeKnowledge, value: Record<string, unknown> | null, companyId: string): value is Record<string, unknown> & Binding {
  if (!value || value.kind !== KIND || value.schemaVersion !== 1
    || value.companyId !== companyId || record.companyId !== companyId
    || !ID.test(companyId) || !address(value)
    || typeof value.entityId !== 'string' || !ID.test(value.entityId)
    || Object.keys(value).some(key => !FIELDS.has(key))) return false;
  // Hosted projections may omit artifactUri. An existing URI must not contradict
  // the durable summary; it is never followed or fetched by this selector.
  return !record.artifactUri || record.artifactUri === `daftar-kit://${companyId}/${value.kitKey}/binding/${value.entityType}/${value.key}`;
}

/** Select data only. Bindings never grant tools, authority, role keys or access.
 * No filesystem/network reads and no mutation. Generic employees retain their
 * existing last-six company knowledge behavior, excluding internal metadata.
 */
export function selectCompanyKitKnowledge(
  knowledge: OfficeKnowledge[], companyId: string, employeeId: string,
): { records: OfficeKnowledge[]; taskContractId: string | null } {
  const scoped = knowledge.filter(record => record.companyId === companyId);
  const ordinary: OfficeKnowledge[] = [];
  const groups = new Map<string, { values: Binding[]; invalid: boolean }>();
  for (const record of scoped) {
    const value = parse(record.summary);
    if (!metadata(record, value)) { ordinary.push(record); continue; }
    const key = address(value);
    if (!key) continue; // malformed internal records never enter model context
    const group = groups.get(key) ?? { values: [], invalid: false };
    if (validBinding(record, value, companyId)) group.values.push(value);
    else group.invalid = true;
    groups.set(key, group);
  }
  const resolved = new Map<string, Binding>();
  for (const [key, group] of groups) {
    if (group.invalid || !group.values.length || new Set(group.values.map(value => value.entityId)).size !== 1) continue;
    resolved.set(key, group.values[0]!);
  }
  const employees = [...resolved.values()].filter(value => value.entityType === 'employee' && value.entityId === employeeId);
  let contract: OfficeKnowledge | null = null;
  if (employees.length === 1) {
    const employee = employees[0]!;
    const source = resolved.get(`${employee.kitKey}\0knowledge\0prompt-${employee.key}`);
    if (source) {
      // Duplicate IDs are invalid even if one colliding row is metadata. Never
      // choose whichever record happens to occur first or cross company scope.
      const candidates = scoped.filter(record => record.id === source.entityId);
      if (candidates.length === 1 && ordinary.includes(candidates[0]!)) contract = candidates[0]!;
    }
  }
  const recent = ordinary.slice(-6);
  const records = contract && !recent.includes(contract) ? [contract, ...recent.slice(-5)] : recent;
  return { records, taskContractId: contract?.id ?? null };
}
