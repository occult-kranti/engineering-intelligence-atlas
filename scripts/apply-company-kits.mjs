#!/usr/bin/env node
/** Additive company templates through the existing native/MCP command boundary.
 * Definitions are not running workers. This importer never calls providers,
 * GitHub, a social platform, or a website deployment API.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createNativeCall, createToolHandler, resolveLaunchConfig } from '../tools/atlas-mcp.mjs';

const BINDING = 'daftar-company-kit-binding';
const SAFE_ID = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}$/;
const SAFE_KEY = /^[a-z][a-z0-9-]{0,59}$/;
const SERVICES = new Set(['engineering', 'design-architecture', 'research-knowledge', 'security', 'hackathon', 'music-arts']);
const BOOTSTRAP = new Set(['subdirector', 'blueprint-steward', 'knowledge-curator', 'qa-lead', 'github-steward', 'code-engineer']);
const SECRET = /(?:sk-ant-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,})/;
const count = (rows, test = () => true) => (rows ?? []).filter(test).length;
const fail = message => { throw new Error(`Company kit: ${message}`); };
const object = (v, label, allowed) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${label} must be an object.`);
  for (const key of Object.keys(v)) if (!allowed.includes(key)) fail(`${label} contains an unsupported field.`);
};
const textValue = (v, label, max) => {
  if (typeof v !== 'string' || !v.trim() || Buffer.byteLength(v) > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(v)) fail(`${label} must contain 1..${max} printable UTF-8 bytes.`);
};
const keyValue = (v, label) => { if (typeof v !== 'string' || !SAFE_KEY.test(v)) fail(`${label} must be a lowercase stable key.`); };
const idValue = (v, label) => { if (typeof v !== 'string' || !SAFE_ID.test(v)) fail(`${label} must be a safe ID of at most 100 characters.`); };
const rows = (v, label, max, min = 0) => { if (!Array.isArray(v) || v.length < min || v.length > max) fail(`${label} must contain ${min}..${max} entries.`); };
const unique = (values, label) => { if (new Set(values).size !== values.length) fail(`${label} contains duplicates.`); };
const has = (v, field) => Object.hasOwn(v, field);
export const kitEntityId = (company, type, key) => `kit-${type}-${crypto.createHash('sha256').update(`${company.id}\0${company.key}\0${key}`).digest('hex').slice(0, 32)}`;
export const bindingUri = (company, type, key) => `daftar-kit://${company.id}/${company.key}/binding/${type}/${key}`;

/** Validate the complete plan before consulting state or applying any command. */
export function validateCompanyKits(plan) {
  object(plan, 'plan', ['schemaVersion', 'classification', 'companies']);
  if (plan.schemaVersion !== 1 || !['public-generic-preset', 'private-owner-workspace'].includes(plan.classification)) fail('Unsupported schema version or classification.');
  if (Buffer.byteLength(JSON.stringify(plan)) > 2_000_000) fail('Plan exceeds 2 MB.');
  if (SECRET.test(JSON.stringify(plan))) fail('A possible credential appears in the plan. Use the credential vault instead.');
  rows(plan.companies, 'companies', 20, 1);
  unique(plan.companies.map(c => c?.id), 'company IDs');
  unique(plan.companies.map(c => c?.key), 'company keys');
  for (const c of plan.companies) {
    object(c, 'company', ['key', 'id', 'name', 'office', 'departments', 'employees', 'services', 'roadmap', 'knowledge', 'group', 'board']);
    keyValue(c.key, 'company key'); idValue(c.id, 'company ID'); textValue(c.name, 'company name', 200);
    object(c.office, 'office', ['key', 'name']); keyValue(c.office.key, 'office key'); textValue(c.office.name, 'office name', 150);
    rows(c.departments, 'departments', 30, 1); unique(c.departments.map(d => d?.key), 'department keys'); unique(c.departments.map(d => d?.name), 'department names');
    const departments = new Set(c.departments.map(d => d.key));
    for (const d of c.departments) { object(d, 'department', ['key', 'name']); keyValue(d.key, 'department key'); textValue(d.name, 'department name', 150); if (d.key === 'director') fail('The director room key is reserved; choose another department key.'); }
    rows(c.employees, 'employees', 50); unique(c.employees.map(e => e?.key), 'employee keys');
    unique(c.employees.map(e => `${e.departmentKey ?? ''}\0${e.name}`), 'employee names within departments');
    unique(c.employees.filter(e => e.reuseAssignmentKey).map(e => e.reuseAssignmentKey), 'bootstrap assignments');
    const employees = new Set(c.employees.map(e => e.key));
    const departmentRef = (v, field = 'departmentKey') => { if (has(v, field) && !departments.has(v[field])) fail('Unknown department reference.'); };
    for (const e of c.employees) {
      object(e, 'employee', ['key', 'name', 'role', 'departmentKey', 'skillPaths', 'reuseAssignmentKey']);
      keyValue(e.key, 'employee key'); textValue(e.name, 'employee name', 150); textValue(e.role, 'employee role', 200); departmentRef(e);
      if (e.key === 'donna') fail('Donna is the global assistant; choose another employee key.');
      rows(e.skillPaths, 'employee skillPaths', 20); unique(e.skillPaths, 'skill paths');
      for (const s of e.skillPaths) if (typeof s !== 'string' || Buffer.byteLength(s) > 300 || !/^skills\/(?:[A-Za-z0-9_.-]+\/)+SKILL\.md$/.test(s) || s.split('/').some(x => x === '.' || x === '..')) fail('Skill references must be safe repository-relative skills/.../SKILL.md paths of at most 300 bytes.');
      if (has(e, 'reuseAssignmentKey') && (!BOOTSTRAP.has(e.reuseAssignmentKey) || has(e, 'departmentKey'))) fail('Bootstrap reuse requires a known office-level assignment and no department override.');
      if (has(e, 'reuseAssignmentKey') && c.office.name !== 'Main office') fail('Bootstrap assignments belong to the native Main office.');
    }
    rows(c.services, 'services', 20); unique(c.services.map(s => `${s?.key}\0${s?.departmentKey ?? ''}`), 'scoped services');
    for (const s of c.services) { object(s, 'service', ['key', 'departmentKey']); if (!SERVICES.has(s.key)) fail('Unknown shared service key.'); departmentRef(s); }
    rows(c.roadmap, 'roadmap', 100); unique(c.roadmap.map(r => r?.key), 'roadmap keys');
    const roadmap = new Set(c.roadmap.map(r => r.key));
    for (const r of c.roadmap) {
      object(r, 'roadmap item', ['key', 'title', 'description', 'ownerKey', 'serviceKey', 'departmentKey', 'dependsOn']);
      keyValue(r.key, 'roadmap key'); textValue(r.title, 'roadmap title', 200); textValue(r.description, 'roadmap description', 4000); departmentRef(r);
      if (has(r, 'ownerKey') && has(r, 'serviceKey')) fail('A roadmap item must choose either a company owner or a shared service.');
      if (has(r, 'ownerKey') && !employees.has(r.ownerKey) && r.ownerKey !== 'donna') fail('Unknown roadmap owner.');
      if (has(r, 'serviceKey') && !c.services.some(s => s.key === r.serviceKey && (!s.departmentKey || s.departmentKey === r.departmentKey))) fail('Roadmap service has no matching recipient contract in the plan.');
      rows(r.dependsOn, 'roadmap dependencies', 100); unique(r.dependsOn, 'dependencies');
      if (r.dependsOn.some(key => !roadmap.has(key))) fail('Unknown roadmap dependency.');
    }
    topologicalRoadmap(c.roadmap);
    rows(c.knowledge, 'knowledge', 100); unique(c.knowledge.map(k => k?.key), 'knowledge keys');
    for (const k of c.knowledge) {
      object(k, 'knowledge record', ['key', 'title', 'summary', 'artifactUri']);
      keyValue(k.key, 'knowledge key'); textValue(k.title, 'knowledge title', 200); textValue(k.summary, 'knowledge summary', 4000); textValue(k.artifactUri, 'knowledge reference', 3000);
      if (/^daftar-kit:/i.test(k.artifactUri)) fail('Knowledge sources cannot impersonate importer binding references.');
      if (plan.classification === 'public-generic-preset' && /^(?:file:|\/|[A-Za-z]:[\\/]|\\\\|https:\/\/chatgpt\.com\/library\?)/i.test(k.artifactUri)) fail('Public presets cannot contain private/local artifact references.');
    }
    if (c.group) { object(c.group, 'group', ['id', 'name', 'description']); idValue(c.group.id, 'group ID'); textValue(c.group.name, 'group name', 200); textValue(c.group.description, 'group description', 4000); }
    object(c.board, 'board', ['title']); textValue(c.board.title, 'whiteboard title', 200);
  }
  return plan;
}

export function topologicalRoadmap(items) {
  const byKey = new Map(items.map(item => [item.key, item])), visiting = new Set(), done = new Set(), ordered = [];
  const visit = key => {
    if (visiting.has(key)) fail('Roadmap dependencies contain a cycle.');
    if (done.has(key)) return;
    const item = byKey.get(key); if (!item) fail('Roadmap dependency is missing.');
    visiting.add(key); for (const dependency of item.dependsOn) visit(dependency);
    visiting.delete(key); done.add(key); ordered.push(item);
  };
  for (const item of items) visit(item.key);
  return ordered;
}

function binding(state, c, type, key) {
  const uri = bindingUri(c, type, key);
  const found = state.knowledge.filter(k => k.artifactUri === uri || (() => { try { const b = JSON.parse(k.summary); return b.kind === BINDING && b.companyId === c.id && b.kitKey === c.key && b.entityType === type && b.key === key; } catch { return false; } })());
  if (!found.length) return null;
  const values = found.map(k => {
    let b; try { b = JSON.parse(k.summary); } catch { fail('A persisted kit binding is not valid JSON.'); }
    if (k.companyId !== c.id || b.kind !== BINDING || b.schemaVersion !== 1 || b.companyId !== c.id || b.kitKey !== c.key || b.entityType !== type || b.key !== key) fail('A persisted kit binding has conflicting scope.');
    idValue(b.entityId, 'binding entity ID'); return b.entityId;
  });
  if (new Set(values).size !== 1) fail('Conflicting persisted bindings require owner review before import.');
  return values[0];
}
function resolveEntity(state, c, type, key, collection, valid, candidates) {
  const id = binding(state, c, type, key);
  if (id) {
    const record = collection.find(row => row.id === id);
    if (!record || !valid(record)) fail('A bound kit entity is missing or moved outside its scope.');
    return record;
  }
  const matches = collection.filter(row => valid(row) && candidates(row));
  if (matches.length > 1) fail('Ambiguous existing identities require an explicit correction before import.');
  return matches[0] ?? null;
}
const officeEntity = (s, c) => resolveEntity(s, c, 'office', c.office.key, s.offices, r => r.companyId === c.id, r => r.name === c.office.name);
const departmentEntity = (s, c, d, officeId) => resolveEntity(s, c, 'department', d.key, s.departments, r => r.companyId === c.id && (!officeId || r.officeId === officeId), r => r.officeId === officeId && r.name === d.name);
const employeeEntity = (s, c, e, officeId, departmentId) => resolveEntity(s, c, 'employee', e.key, s.employees,
  r => r.companyId === c.id && (!officeId || r.officeId === officeId) && (departmentId === undefined || (r.departmentId ?? null) === departmentId),
  r => e.reuseAssignmentKey ? r.assignmentKey === e.reuseAssignmentKey : r.name === e.name && r.role === e.role && (r.departmentId ?? null) === (departmentId ?? null));
const serviceEntity = (s, key) => s.portfolio.services.find(service => service.key === key);
function contractEntity(s, c, service, officeId, departmentId) {
  return s.portfolio.contracts.find(x => x.serviceId === service.id && x.recipientCompanyId === c.id && (x.recipientOfficeId ?? null) === officeId && (x.recipientDepartmentId ?? null) === departmentId);
}

/** A kit may add references, never remove or reorder the owner's saved skills. */
function mergedEmployeeSkills(employee, specification) {
  const current = employee?.skillPaths ?? [];
  rows(current, 'saved employee skillPaths', 20); unique(current, 'saved employee skill paths');
  for (const skill of current) if (typeof skill !== 'string' || Buffer.byteLength(skill) > 300 || !/^skills\/(?:[A-Za-z0-9_.-]+\/)+SKILL\.md$/.test(skill) || skill.split('/').some(x => x === '.' || x === '..')) fail('A saved employee has an invalid skill reference; reconcile it before importing.');
  const merged = [...current, ...specification.skillPaths.filter(skill => !current.includes(skill))];
  if (merged.length > 20) fail('The additive skill update exceeds the native 20-skill limit; review the employee references before importing.');
  return merged;
}

/** Read-only preview is intentionally a count projection, never a private data dump. */
export function planCompanyKits(plan, snapshot) {
  validateCompanyKits(plan);
  for (const key of ['companies', 'offices', 'departments', 'employees', 'knowledge', 'blueprints']) if (!Array.isArray(snapshot?.[key])) fail('A complete initialized native office snapshot is required.');
  for (const key of ['services', 'contracts', 'groups', 'roadmap']) if (!Array.isArray(snapshot?.portfolio?.[key])) fail('A complete native portfolio snapshot is required.');
  const projected = { companies: 0, offices: 0, departments: 0, employeeDefinitions: 0, contracts: 0, roadmapItems: 0, sourceKnowledge: 0 };
  const reused = { companies: 0, offices: 0, departments: 0, employeeDefinitions: 0, contracts: 0, roadmapItems: 0, sourceKnowledge: 0 };
  let missingBindings = 0;
  const updates = { employeeDefinitions: 0, skillReferencesAdded: 0 };
  for (const c of plan.companies) {
    const existing = snapshot.companies.find(x => x.id === c.id);
    const companyBinding = binding(snapshot, c, 'company', c.key);
    if (companyBinding && (companyBinding !== c.id || !existing)) fail('The company binding does not identify this company.');
    if (existing && !companyBinding && existing.name !== c.name) fail('Company ID already belongs to an unbound company with a different name.');
    if (!existing && snapshot.companies.some(x => x.name === c.name)) fail('A company with this name already exists under another ID.');
    (existing ? reused : projected).companies++;
    const office = existing ? officeEntity(snapshot, c) : null;
    // create_company automatically creates Main office, Engineering and Research.
    (office ? reused : projected).offices++;
    if (!existing && c.office.name !== 'Main office') projected.offices++;
    let addedDepartments = 0, addedSpecialists = 0;
    const departments = new Map(), employeeRecords = new Map();
    for (const d of c.departments) {
      const entity = existing ? departmentEntity(snapshot, c, d, office?.id) : null;
      departments.set(d.key, entity); (entity ? reused : projected).departments++;
      if (!entity) addedDepartments++;
    }
    for (const e of c.employees) {
      const entity = existing ? employeeEntity(snapshot, c, e, office?.id, e.departmentKey ? departments.get(e.departmentKey)?.id : null) : null;
      if (existing && e.reuseAssignmentKey && !entity) fail('A requested bootstrap identity is missing; initialize or reconcile the office before importing.');
      if (entity && (!office || (e.departmentKey && !departments.get(e.departmentKey)))) fail('A bound employee has a missing office or department binding.');
      if (entity?.status === 'fired') fail('A kit employee was fired. Import will not silently rehire or replace that identity.');
      if (entity) {
        const added = mergedEmployeeSkills(entity, e).length - entity.skillPaths.length;
        if (added) { updates.employeeDefinitions++; updates.skillReferencesAdded += added; }
      }
      employeeRecords.set(e.key, entity);
      if (entity) reused.employeeDefinitions++; else if (!e.reuseAssignmentKey) addedSpecialists++;
    }
    const defaultDepartments = !existing && c.office.name === 'Main office' ? c.departments.filter(d => ['Engineering', 'Research'].includes(d.name)).length : 0;
    if (!existing) projected.departments += 2 - defaultDepartments;
    projected.employeeDefinitions += (existing ? 0 : 10) + addedSpecialists + addedDepartments - defaultDepartments + ((!existing && c.office.name !== 'Main office') || (existing && !office) ? 1 : 0);
    for (const spec of c.services) {
      const service = serviceEntity(snapshot, spec.key);
      if (!service) fail('A requested shared service is absent. Set up shared services explicitly before applying this kit.');
      if (!service.employeeIds?.length || !service.employeeIds.every(id => snapshot.employees.some(e => e.id === id && e.status !== 'fired'))) fail('Shared service membership is incomplete.');
      const departmentId = spec.departmentKey ? departments.get(spec.departmentKey)?.id : null;
      const contract = office && (!spec.departmentKey || departmentId) ? contractEntity(snapshot, c, service, office.id, departmentId) : null;
      const newOwnedRoadmap = c.roadmap.some(r => r.serviceKey === spec.key && (!spec.departmentKey || r.departmentKey === spec.departmentKey) && !snapshot.portfolio.roadmap.some(x => x.id === kitEntityId(c, 'roadmap', r.key)));
      if (service.status !== 'active' && (!contract || newOwnedRoadmap)) fail('A requested shared service is paused; import does not resume it.');
      const fixed = snapshot.portfolio.contracts.find(x => x.id === kitEntityId(c, 'contract', `${spec.key}-${spec.departmentKey ?? 'office'}`));
      if (fixed && fixed !== contract) fail('A deterministic contract ID belongs to a different recipient scope.');
      if (contract && contract.status !== 'active' && newOwnedRoadmap) fail('A required roadmap contract is paused or revoked; import will not reactivate it.');
      (contract ? reused : projected).contracts++;
    }
    for (const r of c.roadmap) {
      const item = snapshot.portfolio.roadmap.find(x => x.id === kitEntityId(c, 'roadmap', r.key));
      if (item && (item.scope?.kind !== 'company' || item.scope.id !== c.id)) fail('A roadmap identity belongs to another scope.');
      (item ? reused : projected).roadmapItems++;
    }
    for (const k of c.knowledge) {
      const entity = resolveEntity(snapshot, c, 'knowledge', k.key, snapshot.knowledge, x => x.companyId === c.id, x => x.artifactUri === k.artifactUri && x.title === k.title);
      (entity ? reused : projected).sourceKnowledge++;
    }
    for (const [type, keys] of [['company', [c.key]], ['office', [c.office.key]], ['department', c.departments.map(d => d.key)], ['employee', c.employees.map(e => e.key)], ['room', [...c.departments.map(d => d.key), 'director']], ['knowledge', c.knowledge.map(k => k.key)]]) for (const key of keys) if (!binding(snapshot, c, type, key)) missingBindings++;
    if (office) {
      const b = snapshot.blueprints.find(x => x.officeId === office.id);
      const board = b?.whiteboards.find(x => x.id === kitEntityId(c, 'board', 'roadmap'));
      if (board && board.ownerEmployeeId !== office.assistantId && !snapshot.employees.some(e => e.id === board.ownerEmployeeId)) fail('Existing whiteboard owner is missing.');
      let missingRooms = 0;
      for (const d of c.departments) {
        const department = departments.get(d.key);
        const room = department && b ? resolveEntity(snapshot, c, 'room', d.key, b.rooms, r => r.departmentId === department.id, r => r.departmentId === department.id) : null;
        if (!room) {
          missingRooms++;
          const id = kitEntityId(c, 'room', d.key);
          if (b && [...b.rooms, ...b.desks, ...b.whiteboards].some(x => x.id === id)) fail('A planned room ID is already assigned to another blueprint entity.');
        }
      }
      if (b) {
        if (!resolveEntity(snapshot, c, 'room', 'director', b.rooms, r => r.departmentId == null, r => r.departmentId == null)) missingRooms++;
        const missingDesks = c.employees.filter(e => !employeeRecords.get(e.key) || !b.desks.some(d => d.employeeId === employeeRecords.get(e.key).id)).length;
        if (b.rooms.length + missingRooms > 100 || b.whiteboards.length + (board ? 0 : 1) > 200 || b.desks.length + missingDesks > 1000) fail('The projected office map exceeds room, whiteboard or desk capacity.');
        if (!board && [...b.rooms, ...b.desks].some(x => x.id === kitEntityId(c, 'board', 'roadmap'))) fail('A planned whiteboard ID is already assigned to another blueprint entity.');
      }
    }
  }
  // Count native assistants/directors and durable binding records as well as
  // the requested specialists. A no-op rerun remains valid at capacity.
  const extraKnowledge = projected.sourceKnowledge + missingBindings;
  const newGroups = new Set(plan.companies.map(c => c.group?.id).filter(id => id && !snapshot.portfolio.groups.some(g => g.id === id)));
  if (snapshot.companies.length + projected.companies > 2000 || snapshot.offices.length + projected.offices > 5000 || snapshot.departments.length + projected.departments > 16000 || snapshot.employees.length + projected.employeeDefinitions > 30000 || snapshot.knowledge.length + extraKnowledge > 5000 || snapshot.portfolio.contracts.length + projected.contracts > 12000 || snapshot.portfolio.roadmap.length + projected.roadmapItems > 20000 || snapshot.portfolio.groups.length + newGroups.size > 100 || snapshot.blueprints.length + projected.offices > 5000) fail('The projected import exceeds native registry capacity.');
  return { schemaVersion: 1, mode: 'preview', valid: true, kitCount: plan.companies.length, projected: { ...projected, identityBindings: missingBindings, knowledgeRecords: extraKnowledge }, reused, updates, providerRequests: 0, externalWrites: 0, caution: 'Projected employee definitions include native assistants/directors plus the requested new specialists. Apply only with one workspace writer. Missing kit skills are appended; existing skill order, names, progress, authority, paused states and board edits are retained.' };
}

/** command(action,payload) must return the complete committed native snapshot. */
export async function applyCompanyKits(plan, { snapshot, command }) {
  const preview = planCompanyKits(plan, snapshot);
  if (typeof command !== 'function') fail('A native command adapter is required.');
  let state = snapshot, mutations = 0;
  const updated = { employeeDefinitions: 0, skillReferencesAdded: 0 };
  const originalCompany = snapshot.activeCompanyId;
  const before = { companies: snapshot.companies.length, offices: snapshot.offices.length, departments: snapshot.departments.length, employeeDefinitions: snapshot.employees.length, contracts: snapshot.portfolio.contracts.length, roadmapItems: snapshot.portfolio.roadmap.length, knowledgeRecords: snapshot.knowledge.length };
  const send = async (action, payload) => { const next = await command(action, payload); if (!next?.companies || !next.portfolio) fail('Native command did not return a complete snapshot; reconcile state before retrying.'); state = next; mutations++; return next.lastAction; };
  const bind = async (c, type, key, entityId) => {
    const old = binding(state, c, type, key);
    if (old) { if (old !== entityId) fail('Identity binding changed during import.'); return; }
    await send('add_knowledge', { companyId: c.id, title: `Company kit identity: ${type} / ${key}`,
      summary: JSON.stringify({ kind: BINDING, schemaVersion: 1, companyId: c.id, kitKey: c.key, entityType: type, key, entityId }), artifactUri: bindingUri(c, type, key) });
  };
  const results = [];
  for (const c of plan.companies) {
    const createdCompany = !state.companies.some(x => x.id === c.id);
    if (createdCompany) await send('create_company', { id: c.id, name: c.name });
    await bind(c, 'company', c.key, c.id);
    let office = officeEntity(state, c);
    if (!office) { const result = await send('create_office', { companyId: c.id, name: c.office.name }); office = state.offices.find(x => x.id === result.officeId); }
    await bind(c, 'office', c.office.key, office.id);
    const departments = new Map(), employees = new Map();
    for (const d of c.departments) {
      let entity = departmentEntity(state, c, d, office.id);
      if (!entity) { const result = await send('create_department', { officeId: office.id, name: d.name }); entity = state.departments.find(x => x.id === result.departmentId); }
      departments.set(d.key, entity); await bind(c, 'department', d.key, entity.id);
    }
    for (const e of c.employees) {
      const departmentId = e.departmentKey ? departments.get(e.departmentKey).id : null;
      let entity = employeeEntity(state, c, e, office.id, departmentId);
      if (!entity && e.reuseAssignmentKey) fail('The expected bootstrap employee is missing; reconcile rather than creating a duplicate.');
      if (!entity) { const result = await send('hire_employee', { companyId: c.id, officeId: office.id, departmentId, name: e.name, role: e.role, skillPaths: e.skillPaths }); entity = state.employees.find(x => x.id === result.employeeId); }
      if (entity.status === 'fired') fail('A bound employee is fired; this importer will not recreate it.');
      const skillPaths = mergedEmployeeSkills(entity, e);
      if (skillPaths.length !== entity.skillPaths.length) {
        const added = skillPaths.length - entity.skillPaths.length;
        await send('update_employee', { employeeId: entity.id, skillPaths });
        entity = state.employees.find(x => x.id === entity.id);
        updated.employeeDefinitions++; updated.skillReferencesAdded += added;
      }
      employees.set(e.key, entity); await bind(c, 'employee', e.key, entity.id);
    }
    const contracts = new Map();
    for (const spec of c.services) {
      const service = serviceEntity(state, spec.key), departmentId = spec.departmentKey ? departments.get(spec.departmentKey).id : null;
      let contract = contractEntity(state, c, service, office.id, departmentId);
      if (!contract) {
        const id = kitEntityId(c, 'contract', `${spec.key}-${spec.departmentKey ?? 'office'}`);
        await send('contract_service', { id, serviceId: service.id, recipientCompanyId: c.id, recipientOfficeId: office.id, recipientDepartmentId: departmentId, employeeIds: service.employeeIds, allowedTools: [], status: 'active' });
        contract = state.portfolio.contracts.find(x => x.id === id);
      }
      contracts.set(`${spec.key}\0${spec.departmentKey ?? ''}`, contract);
    }
    for (const r of topologicalRoadmap(c.roadmap)) {
      const id = kitEntityId(c, 'roadmap', r.key);
      if (state.portfolio.roadmap.some(x => x.id === id)) continue;
      const contract = r.serviceKey ? contracts.get(`${r.serviceKey}\0${r.departmentKey ?? ''}`) ?? contracts.get(`${r.serviceKey}\0`) : null;
      const ownerEmployeeId = contract ? contract.employeeIds.find(id => state.employees.some(e => e.id === id && e.status !== 'fired')) : r.ownerKey && r.ownerKey !== 'donna' ? employees.get(r.ownerKey).id : 'donna';
      await send('upsert_roadmap_item', { id, scope: { kind: 'company', id: c.id }, title: r.title, description: r.description, ownerEmployeeId, serviceContractId: contract?.id ?? null, departmentId: r.departmentKey ? departments.get(r.departmentKey).id : null, status: 'planned', dependencies: r.dependsOn.map(key => kitEntityId(c, 'roadmap', key)) });
    }
    for (const k of c.knowledge) {
      let entity = resolveEntity(state, c, 'knowledge', k.key, state.knowledge, x => x.companyId === c.id, x => x.artifactUri === k.artifactUri && x.title === k.title);
      if (!entity) { const result = await send('add_knowledge', { companyId: c.id, title: k.title, summary: k.summary, artifactUri: k.artifactUri }); entity = state.knowledge.find(x => x.id === result.knowledgeId); }
      await bind(c, 'knowledge', k.key, entity.id);
    }
    if (c.group) {
      const group = state.portfolio.groups.find(x => x.id === c.group.id);
      if (!group?.companyIds.includes(c.id)) await send('upsert_portfolio_group', { id: c.group.id, name: group?.name ?? c.group.name, description: group?.description ?? c.group.description, status: group?.status ?? 'active', companyIds: [...(group?.companyIds ?? []), c.id] });
    }
    if (!state.blueprints.some(x => x.officeId === office.id)) await send('ensure_blueprint', { officeId: office.id });
    const blueprint = () => state.blueprints.find(x => x.officeId === office.id);
    // First import lays out the installed departments. Once a room is bound,
    // owner positions/names are kept. Existing custom rooms are never deleted.
    const roomSpecs = [...c.departments.map(d => ({ key: d.key, name: d.name, departmentId: departments.get(d.key).id })), { key: 'director', name: 'Director office', departmentId: null }];
    const columns = Math.min(3, roomSpecs.length), rowCount = Math.ceil(roomSpecs.length / columns), rooms = new Map();
    for (const [i, spec] of roomSpecs.entries()) {
      const bound = binding(state, c, 'room', spec.key);
      let room = resolveEntity(state, c, 'room', spec.key, blueprint().rooms, r => (r.departmentId ?? null) === spec.departmentId, r => (r.departmentId ?? null) === spec.departmentId);
      if (!bound) {
        const id = room?.id ?? kitEntityId(c, 'room', spec.key);
        await send('upsert_room', { officeId: office.id, id, name: room?.name ?? spec.name, departmentId: spec.departmentId, x: (i % columns) / columns, y: Math.floor(i / columns) / rowCount, width: 0.94 / columns, height: 0.94 / rowCount });
        room = blueprint().rooms.find(x => x.id === id); await bind(c, 'room', spec.key, room.id);
      }
      rooms.set(spec.key, room);
    }
    const occupants = new Map();
    for (const e of c.employees) {
      const employee = employees.get(e.key), room = rooms.get(e.departmentKey ?? 'director');
      if (blueprint().desks.some(d => d.employeeId === employee.id)) continue;
      const occupied = occupants.get(room.id) ?? blueprint().desks.filter(d => d.roomId === room.id).length;
      await send('place_employee', { officeId: office.id, employeeId: employee.id, roomId: room.id, x: 0.1 + (occupied % 4) * 0.22, y: 0.2 + (Math.floor(occupied / 4) % 4) * 0.18 }); occupants.set(room.id, occupied + 1);
    }
    const boardId = kitEntityId(c, 'board', 'roadmap');
    if (!blueprint().whiteboards.some(x => x.id === boardId)) await send('upsert_whiteboard', { officeId: office.id, id: boardId, roomId: rooms.get('director').id, ownerEmployeeId: office.assistantId, title: c.board.title, goalIds: [], jobIds: [], roadmapItemIds: c.roadmap.map(r => kitEntityId(c, 'roadmap', r.key)), x: 0.1, y: 0.05 });
    // Only IDs and record counts enter the receipt; no source/client text.
    results.push({ companyId: c.id, kitKey: c.key, officeId: office.id, departmentIds: [...departments.values()].map(x => x.id), employeeIds: [...employees.values()].map(x => x.id), boardId, roadmapIds: c.roadmap.map(r => kitEntityId(c, 'roadmap', r.key)) });
  }
  if (originalCompany && state.activeCompanyId !== originalCompany) await send('select_company', { companyId: originalCompany });
  const after = { companies: state.companies.length, offices: state.offices.length, departments: state.departments.length, employeeDefinitions: state.employees.length, contracts: state.portfolio.contracts.length, roadmapItems: state.portfolio.roadmap.length, knowledgeRecords: state.knowledge.length };
  return { snapshot: state, receipt: { schemaVersion: 1, mode: 'applied', appliedAt: new Date().toISOString(), planSha256: crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex'), mutations, created: Object.fromEntries(Object.keys(before).map(key => [key, after[key] - before[key]])), reused: preview.reused, updated, companies: results, providerRequests: 0, externalWrites: 0, workerProcessesStarted: 0 } };
}

function readRegular(file, limit) {
  if (!path.isAbsolute(file)) fail('File paths must be absolute.');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) fail('Input must be a bounded regular file.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
export async function main(argv = process.argv.slice(2)) {
  const allowed = new Set(['--plan', '--state-dir', '--report', '--apply']);
  const opts = {}; for (let i = 0; i < argv.length; i++) { const arg = argv[i]; if (!allowed.has(arg) || has(opts, arg)) fail('Unsupported or duplicate command-line argument.'); opts[arg] = arg === '--apply' ? true : argv[++i]; if (!opts[arg] || (typeof opts[arg] === 'string' && opts[arg].startsWith('--'))) fail('Missing command-line value.'); }
  if (!opts['--plan'] || !opts['--state-dir'] || !path.isAbsolute(opts['--state-dir'])) fail('Usage: node scripts/apply-company-kits.mjs --plan /absolute/kits.json --state-dir /absolute/company [--apply] [--report /absolute/receipt.json]');
  if (opts['--report'] && (!path.isAbsolute(opts['--report']) || fs.existsSync(opts['--report']))) fail('Choose a new absolute report path before applying.');
  const plan = validateCompanyKits(readRegular(opts['--plan'], 2_000_000));
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const c of plan.companies) for (const e of c.employees) for (const skill of e.skillPaths) if (!fs.existsSync(path.join(repoRoot, skill))) fail('A requested skill reference does not exist in this checkout.');
  // Native snapshots may perform migrations. The default preview reads an
  // already-initialized file directly and performs no writes of any kind.
  const initial = readRegular(path.join(opts['--state-dir'], 'company-state.json'), 32_000_000).office;
  const preview = planCompanyKits(plan, initial);
  let receipt = preview;
  if (opts['--apply']) {
    const config = resolveLaunchConfig({ ...process.env, ATLAS_REPO_ROOT: repoRoot, ATLAS_STATE_DIR: opts['--state-dir'], ATLAS_CORE_BINARY: path.join(repoRoot, 'desktop-shell/native', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core') });
    const handler = createToolHandler({ nativeCall: createNativeCall(config), fetchImpl: async () => { throw new Error('Company kit importer does not use network calls.'); } });
    const snapshot = (await handler('office_snapshot', {})).snapshot;
    receipt = (await applyCompanyKits(plan, { snapshot, command: async (action, payload) => (await handler('office_command', { action, payload })).snapshot })).receipt;
  }
  if (opts['--report']) { if (!path.isAbsolute(opts['--report'])) fail('Report path must be absolute.'); fs.mkdirSync(path.dirname(opts['--report']), { recursive: true, mode: 0o700 }); fs.writeFileSync(opts['--report'], `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' }); }
  console.log(JSON.stringify(receipt));
  return receipt;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
