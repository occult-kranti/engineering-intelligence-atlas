import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createNativeCall, createToolHandler } from '../tools/atlas-mcp.mjs';
import { validateCompanyKits, planCompanyKits, applyCompanyKits, kitEntityId, bindingUri } from './apply-company-kits.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = path.join(repoRoot, 'desktop-shell/native', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core');
const catalog = JSON.parse(fs.readFileSync(path.join(repoRoot, 'company/company-kits/index.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function smallPlan() {
  return { schemaVersion: 1, classification: 'public-generic-preset', companies: [{ key: 'fixture-kit', id: 'fixture-kit', name: 'Synthetic kit company', office: { key: 'main', name: 'Main office' }, departments: [{ key: 'engineering', name: 'Engineering' }, { key: 'research', name: 'Research' }, { key: 'delivery', name: 'Delivery' }], employees: [
    { key: 'director', name: 'Subdirector', role: 'Company subdirector', reuseAssignmentKey: 'subdirector', skillPaths: ['skills/agent-research-director/SKILL.md'] },
    { key: 'specialist', name: 'Delivery specialist', role: 'Synthetic delivery specialist', departmentKey: 'delivery', skillPaths: ['skills/agent-research-director/SKILL.md'] }
  ], services: [{ key: 'engineering', departmentKey: 'engineering' }, { key: 'research-knowledge' }], roadmap: [
    { key: 'deliver', title: 'Deliver a synthetic artifact', description: 'Synthetic test acceptance record.', ownerKey: 'specialist', departmentKey: 'delivery', dependsOn: ['discover'] },
    { key: 'discover', title: 'Review synthetic evidence', description: 'Review only fixture material.', serviceKey: 'research-knowledge', departmentKey: 'research', dependsOn: [] }
  ], knowledge: [{ key: 'guide', title: 'Synthetic guide', summary: 'A fixture, not client data.', artifactUri: 'company/company-kits/README.md' }], group: { id: 'fixture-group', name: 'Synthetic group', description: 'Retain all existing members.' }, board: { title: 'Synthetic delivery map' } }] };
}
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-company-kits-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const make = () => createToolHandler({ nativeCall: createNativeCall({ repoRoot, seedDir: path.join(repoRoot, 'company'), stateDir: root, binary }), fetchImpl: async () => { throw new Error('Unexpected network request'); } });
  let handler = make(), state = (await handler('office_snapshot', {})).snapshot;
  const command = async (action, payload) => (state = (await handler('office_command', { action, payload })).snapshot);
  await command('ensure_shared_services', { preset: 'standard' });
  return { root, command, get snapshot() { return state; }, restart: async () => { handler = make(); return state = (await handler('office_snapshot', {})).snapshot; } };
}

test('public catalog and private source ceilings are validated in full before commands', () => {
  assert.equal(validateCompanyKits(catalog), catalog);
  const invalid = structuredClone(catalog); invalid.companies.at(-1).roadmap[0].dependsOn = ['does-not-exist'];
  assert.throws(() => validateCompanyKits(invalid), /Unknown roadmap dependency/);
  const cycle = smallPlan(); cycle.companies[0].roadmap[1].dependsOn = ['deliver'];
  assert.throws(() => validateCompanyKits(cycle), /cycle/);
  const privateRef = smallPlan(); privateRef.companies[0].knowledge[0].artifactUri = '/private/client/register.docx';
  assert.throws(() => validateCompanyKits(privateRef), /private\/local/);
  privateRef.classification = 'private-owner-workspace'; assert.doesNotThrow(() => validateCompanyKits(privateRef));
  privateRef.companies[0].knowledge[0].summary = 'é'.repeat(2001); assert.throws(() => validateCompanyKits(privateRef), /4000 printable UTF-8 bytes/);
  const unknown = smallPlan(); unknown.companies[0].credentials = { token: 'anything' }; assert.throws(() => validateCompanyKits(unknown), /unsupported field/);
  const stolenUri = smallPlan(); stolenUri.companies[0].knowledge[0].artifactUri = 'daftar-kit://impersonation'; assert.throws(() => validateCompanyKits(stolenUri), /impersonate/);
  const wrongOffice = smallPlan(); wrongOffice.companies[0].office.name = 'Second office'; assert.throws(() => validateCompanyKits(wrongOffice), /native Main office/);
});

test('real native catalog installs company topology, scoped shared work, boards and no running jobs', async t => {
  const f = await fixture(t), before = structuredClone(f.snapshot), preview = planCompanyKits(catalog, f.snapshot);
  assert.equal(preview.projected.companies, 2);
  assert.equal(preview.projected.employeeDefinitions, 41, 'Include the native assistants/directors without double-counting reused bootstrap bindings.');
  const { snapshot, receipt } = await applyCompanyKits(catalog, { snapshot: f.snapshot, command: f.command });
  assert.equal(receipt.created.companies, 2); assert.equal(receipt.created.contracts, 10); assert.equal(receipt.created.roadmapItems, 18);
  assert.equal(snapshot.jobs.length, before.jobs.length); assert.equal(snapshot.schedules.length, before.schedules.length);
  assert.deepEqual(snapshot.policy, before.policy); assert.deepEqual(snapshot.authority.grants, before.authority.grants);
  assert.deepEqual(snapshot.portfolio.services, before.portfolio.services); assert.equal(snapshot.activeCompanyId, before.activeCompanyId);
  for (const c of catalog.companies) {
    const installed = receipt.companies.find(x => x.companyId === c.id);
    const b = snapshot.blueprints.find(x => x.officeId === installed.officeId);
    assert.ok(b); assert.equal(new Set(installed.employeeIds).size, c.employees.length);
    const board = b.whiteboards.find(x => x.id === installed.boardId); assert.deepEqual(new Set(board.roadmapItemIds), new Set(installed.roadmapIds));
    for (const spec of c.services) {
      const service = snapshot.portfolio.services.find(x => x.key === spec.key);
      const contracts = snapshot.portfolio.contracts.filter(x => x.serviceId === service.id && x.recipientCompanyId === c.id);
      assert.ok(contracts.some(x => x.recipientOfficeId === installed.officeId));
      for (const contract of contracts) { assert.deepEqual(contract.employeeIds, service.employeeIds); assert.deepEqual(contract.allowedTools, []); }
    }
    for (const r of c.roadmap) {
      const actual = snapshot.portfolio.roadmap.find(x => x.id === kitEntityId(c, 'roadmap', r.key));
      assert.equal(actual.status, 'planned'); assert.deepEqual(actual.dependencies, r.dependsOn.map(key => kitEntityId(c, 'roadmap', key)));
    }
  }
  const rerun = await applyCompanyKits(catalog, { snapshot: await f.restart(), command: f.command });
  assert.equal(rerun.receipt.mutations, 0, 'Restart must not clone, recreate or reflow any installed identity.');
  assert.ok(Object.values(rerun.receipt.created).every(n => n === 0));
});

test('owner names, completed roadmap evidence, room edits and unrelated groups survive repeat installation', async t => {
  const f = await fixture(t), plan = smallPlan(), c = plan.companies[0];
  await f.command('upsert_portfolio_group', { id: c.group.id, name: 'Owner group title', description: 'Owner description', companyIds: [f.snapshot.activeCompanyId], status: 'paused' });
  const originalMember = f.snapshot.activeCompanyId;
  const { receipt } = await applyCompanyKits(plan, { snapshot: f.snapshot, command: f.command });
  await f.command('rename_company', { companyId: c.id, name: 'Owner renamed company' });
  const discovered = f.snapshot.portfolio.roadmap.find(x => x.id === kitEntityId(c, 'roadmap', 'discover'));
  await f.command('upsert_roadmap_item', { ...discovered, title: 'Owner accepted discovery', status: 'done', evidence: 'Synthetic owner test receipt' });
  const room = f.snapshot.blueprints.find(x => x.officeId === receipt.companies[0].officeId).rooms.find(x => x.departmentId == null);
  await f.command('upsert_room', { ...room, officeId: receipt.companies[0].officeId, name: 'Owner room', x: 0.01, y: 0.01, width: 0.21, height: 0.21 });
  const result = await applyCompanyKits(plan, { snapshot: await f.restart(), command: f.command });
  assert.equal(result.receipt.mutations, 0); assert.equal(result.snapshot.companies.find(x => x.id === c.id).name, 'Owner renamed company');
  assert.equal(result.snapshot.portfolio.roadmap.find(x => x.id === discovered.id).evidence, 'Synthetic owner test receipt');
  assert.equal(result.snapshot.blueprints.find(x => x.officeId === receipt.companies[0].officeId).rooms.find(x => x.id === room.id).x, 0.01);
  const group = result.snapshot.portfolio.groups.find(x => x.id === c.group.id);
  assert.equal(group.name, 'Owner group title'); assert.equal(group.status, 'paused'); assert.deepEqual(group.companyIds, [originalMember, c.id]);
});

test('a native hire committed before interrupted response is recovered without a second employee', async t => {
  const f = await fixture(t), plan = smallPlan(); let interrupted = false;
  await assert.rejects(applyCompanyKits(plan, { snapshot: f.snapshot, command: async (action, payload) => { const state = await f.command(action, payload); if (action === 'hire_employee' && !interrupted) { interrupted = true; throw new Error('Synthetic response loss after commit'); } return state; } }), /response loss/);
  assert.equal(f.snapshot.employees.filter(x => x.name === 'Delivery specialist').length, 1);
  const result = await applyCompanyKits(plan, { snapshot: await f.restart(), command: f.command });
  assert.equal(result.snapshot.employees.filter(x => x.name === 'Delivery specialist').length, 1);
  assert.equal(result.receipt.created.employeeDefinitions, 0);
  const again = await applyCompanyKits(plan, { snapshot: await f.restart(), command: f.command }); assert.equal(again.receipt.mutations, 0);
});

test('full-plan validation and conflicting persisted scope fail before an attempted write', async t => {
  const f = await fixture(t), invalid = structuredClone(catalog); invalid.companies[1].employees[0].departmentKey = 'missing'; let writes = 0;
  await assert.rejects(applyCompanyKits(invalid, { snapshot: f.snapshot, command: async () => { writes++; } }), /Unknown department/); assert.equal(writes, 0);
  const plan = smallPlan(); await applyCompanyKits(plan, { snapshot: f.snapshot, command: f.command });
  const c = plan.companies[0], good = f.snapshot.knowledge.find(x => x.artifactUri === bindingUri(c, 'office', 'main'));
  const bad = JSON.parse(good.summary); bad.entityId = f.snapshot.offices.find(x => x.companyId !== c.id).id;
  await f.command('add_knowledge', { companyId: c.id, title: 'Synthetic conflicting binding', summary: JSON.stringify(bad), artifactUri: good.artifactUri });
  await assert.rejects(applyCompanyKits(plan, { snapshot: await f.restart(), command: async () => { writes++; } }), /Conflicting persisted bindings/); assert.equal(writes, 0);
});

test('private receipts omit source content and cloud-style omitted artifact URIs retain identity', async t => {
  const f = await fixture(t), plan = smallPlan(); plan.classification = 'private-owner-workspace';
  plan.companies[0].knowledge[0] = { key: 'guide', title: 'Private client strategy', summary: 'PRIVATE SOURCE BODY', artifactUri: '/private/example/register.docx' };
  const result = await applyCompanyKits(plan, { snapshot: f.snapshot, command: f.command });
  const receiptText = JSON.stringify(result.receipt);
  for (const token of ['PRIVATE SOURCE BODY', 'Private client strategy', '/private/example']) assert.equal(receiptText.includes(token), false);
  const projected = structuredClone(result.snapshot); for (const k of projected.knowledge) k.artifactUri = null;
  const dry = planCompanyKits(plan, projected); assert.equal(dry.projected.sourceKnowledge, 0); assert.equal(dry.projected.employeeDefinitions, 0);
});

test('CLI preview makes no native calls or state writes; report errors fail before apply', async t => {
  const f = await fixture(t), planFile = path.join(f.root, 'plan.json'), stateFile = path.join(f.root, 'company-state.json');
  fs.writeFileSync(planFile, JSON.stringify(smallPlan())); const before = hash(fs.readFileSync(stateFile));
  const cli = path.join(repoRoot, 'scripts/apply-company-kits.mjs');
  const run = spawnSync(process.execPath, [cli, '--plan', planFile, '--state-dir', f.root], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); assert.equal(JSON.parse(run.stdout).mode, 'preview'); assert.equal(hash(fs.readFileSync(stateFile)), before);
  const deniedReport = spawnSync(process.execPath, [cli, '--plan', planFile, '--state-dir', f.root, '--apply', '--report', 'relative.json'], { encoding: 'utf8' });
  assert.notEqual(deniedReport.status, 0); assert.equal(hash(fs.readFileSync(stateFile)), before);
});

test('no-op imports at all registry/map caps succeed while actual new records fail before commands', async t => {
  const f = await fixture(t), plan = smallPlan(), c = plan.companies[0];
  const installed = await applyCompanyKits(plan, { snapshot: f.snapshot, command: f.command });
  const full = structuredClone(installed.snapshot), officeId = installed.receipt.companies[0].officeId;
  const b = full.blueprints.find(x => x.officeId === officeId), directorRoom = b.rooms.find(x => x.departmentId == null);
  // Synthetic valid scoped fillers model an owner-customized large workspace.
  while (b.rooms.length < 100) {
    const id = `fixture-extra-department-${b.rooms.length}`;
    full.departments.push({ ...full.departments.find(x => x.officeId === officeId), id, name: id });
    b.rooms.push({ id: `fixture-extra-room-${b.rooms.length}`, name: 'Other owner room', departmentId: id, x: 0, y: 0, width: 0.1, height: 0.1 });
  }
  while (b.desks.length < 1000) {
    const id = `fixture-extra-employee-${b.desks.length}`;
    full.employees.push({ ...full.employees.find(x => x.companyId === c.id && x.officeId === officeId), id, name: id, assignmentKey: null });
    b.desks.push({ id: `fixture-extra-desk-${b.desks.length}`, employeeId: id, roomId: directorRoom.id, x: 0.1, y: 0.2 });
  }
  while (b.whiteboards.length < 200) b.whiteboards.push({ ...b.whiteboards[0], id: `fixture-extra-board-${b.whiteboards.length}`, title: 'Other owner board' });
  while (full.knowledge.length < 5000) full.knowledge.push({ id: `fixture-extra-knowledge-${full.knowledge.length}`, companyId: c.id, title: 'Other source', summary: 'Synthetic source filler', artifactUri: `fixture:source/${full.knowledge.length}` });
  while (full.portfolio.groups.length < 100) full.portfolio.groups.push({ ...full.portfolio.groups[0], id: `fixture-extra-group-${full.portfolio.groups.length}` });
  let writes = 0; const command = async () => { writes++; throw new Error('Unexpected write'); };
  const noop = await applyCompanyKits(plan, { snapshot: full, command }); assert.equal(noop.receipt.mutations, 0); assert.equal(writes, 0);
  const knowledge = structuredClone(plan); knowledge.companies[0].knowledge.push({ key: 'new-source', title: 'Another source', summary: 'Fixture only.', artifactUri: 'company/new-source.md' });
  await assert.rejects(applyCompanyKits(knowledge, { snapshot: full, command }), /capacity/); assert.equal(writes, 0);
  const room = structuredClone(plan); room.companies[0].departments.push({ key: 'new-team', name: 'Another team' });
  await assert.rejects(applyCompanyKits(room, { snapshot: full, command }), /office map.*capacity/); assert.equal(writes, 0);
  const group = structuredClone(plan); group.companies[0].group.id = 'new-owner-group';
  await assert.rejects(applyCompanyKits(group, { snapshot: full, command }), /capacity/); assert.equal(writes, 0);
  const withoutBoard = structuredClone(full), wb = withoutBoard.blueprints.find(x => x.officeId === officeId);
  wb.whiteboards.find(x => x.id === kitEntityId(c, 'board', 'roadmap')).id = 'fixture-replaced-board';
  await assert.rejects(applyCompanyKits(plan, { snapshot: withoutBoard, command }), /office map.*capacity/); assert.equal(writes, 0);
  const withoutDesk = structuredClone(full), db = withoutDesk.blueprints.find(x => x.officeId === officeId);
  const specialist = installed.receipt.companies[0].employeeIds[1]; db.desks.find(x => x.employeeId === specialist).employeeId = 'fixture-another-scoped-employee';
  await assert.rejects(applyCompanyKits(plan, { snapshot: withoutDesk, command }), /office map.*capacity/); assert.equal(writes, 0);
});

test('new knowledge revisions append and bind once, scoped service pauses remain owner decisions', async t => {
  const f = await fixture(t), plan = smallPlan(), c = plan.companies[0];
  const first = await applyCompanyKits(plan, { snapshot: f.snapshot, command: f.command });
  const original = first.snapshot.knowledge.find(x => x.title === 'Synthetic guide');
  const next = structuredClone(plan); next.companies[0].knowledge.push({ key: 'guide-v2', title: 'Synthetic guide version two', summary: 'Explicit new revision.', artifactUri: 'company/guide-v2.md' });
  const appended = await applyCompanyKits(next, { snapshot: await f.restart(), command: f.command });
  assert.equal(appended.receipt.created.knowledgeRecords, 2, 'Exactly one source and one stable binding.');
  assert.deepEqual(appended.snapshot.knowledge.find(x => x.id === original.id), original);
  const contract = appended.snapshot.portfolio.contracts.find(x => x.recipientCompanyId === c.id && x.serviceId === appended.snapshot.portfolio.services.find(s => s.key === 'research-knowledge').id);
  await f.command('contract_service', { ...contract, status: 'paused' });
  const repeated = await applyCompanyKits(next, { snapshot: await f.restart(), command: f.command });
  assert.equal(repeated.receipt.mutations, 0); assert.equal(repeated.snapshot.portfolio.contracts.find(x => x.id === contract.id).status, 'paused');
  const more = structuredClone(next); more.companies[0].roadmap.push({ key: 'new-shared-work', title: 'A new shared research task', description: 'Requires a live existing contract.', serviceKey: 'research-knowledge', dependsOn: [] });
  let writes = 0; await assert.rejects(applyCompanyKits(more, { snapshot: f.snapshot, command: async () => { writes++; } }), /paused or revoked/); assert.equal(writes, 0);
});
