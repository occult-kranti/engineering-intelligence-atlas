#!/usr/bin/env node
/** Apply an owner-reviewed local portfolio plan through the same MCP/native tools.
 * No provider calls, GitHub writes, credential reads or repository execution.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createNativeCall, createToolHandler, resolveLaunchConfig } from '../tools/atlas-mcp.mjs';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
const planPath = option('--plan'), stateDir = option('--state-dir');
if (!planPath || !stateDir) throw new Error('Usage: node scripts/apply-portfolio.mjs --plan /absolute/portfolio-plan.json --state-dir /absolute/company [--pause-idle] [--report /absolute/receipt.json]');
if (!path.isAbsolute(planPath) || !path.isAbsolute(stateDir)) throw new Error('Use absolute local plan and state paths.');
const stat = fs.lstatSync(planPath);
if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8_000_000) throw new Error('Choose a regular plan file below 8 MB.');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
if (plan.schemaVersion !== 1 || !Array.isArray(plan.groups) || plan.groups.length > 100 || !Array.isArray(plan.repositories) || plan.repositories.length > 2000) throw new Error('Unsupported portfolio plan.');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = resolveLaunchConfig({ ...process.env, ATLAS_REPO_ROOT: repoRoot, ATLAS_STATE_DIR: stateDir, ATLAS_CORE_BINARY: path.join(repoRoot, 'desktop-shell/native', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core') });
const handler = createToolHandler({ nativeCall: createNativeCall(config) });
const snapshot = async () => (await handler('office_snapshot', {})).snapshot;
const command = async (action, payload) => (await handler('office_command', { action, payload })).snapshot;
let state = await snapshot();
const identity = url => typeof url === 'string' ? url.toLowerCase().replace(/\/$/, '') : '';
const companyByUrl = new Map(state.companies.filter(c => c.repoUrl).map(c => [identity(c.repoUrl), c]));
const seen = new Set(), groupsByKey = new Map(plan.groups.map(g => [g.key, g]));
for (const row of plan.repositories) {
  const key = identity(row.sourceRepository?.repoUrl);
  if (!companyByUrl.has(key) || seen.has(key) || !groupsByKey.has(row.groupKey) || !Array.isArray(row.roadmap) || row.roadmap.length > 100) throw new Error('The plan contains missing/duplicate repository identities or invalid group/roadmap references. Import the repositories first.');
  seen.add(key);
}
const groups = plan.groups.map(g => ({ id: `app-${g.key}`, name: g.name, description: g.description, companyIds: plan.repositories.filter(r => r.groupKey === g.key).map(r => companyByUrl.get(identity(r.sourceRepository.repoUrl)).id) }));
state = await command('optimize_portfolio', { preset: 'standard', groups, pauseRedundant: args.includes('--pause-idle') });
const optimization = state.lastAction;
state = await command('configure_ceo', { enabled: true, title: 'CEO / Portfolio', focusGroupId: groups[0]?.id ?? null });
let createdRoadmaps = 0;
const stableId = (url, id) => 'next-' + crypto.createHash('sha256').update(url + '\0' + id).digest('hex').slice(0, 32);
for (const row of plan.repositories) {
  const company = companyByUrl.get(identity(row.sourceRepository.repoUrl));
  for (const [index, step] of row.roadmap.entries()) {
    const id = stableId(company.repoUrl, step.id);
    if (state.portfolio.roadmap.some(r => r.id === id)) continue; // retain owner edits and completed evidence
    const key = ['research-knowledge', 'engineering', 'security'][index % 3];
    const service = state.portfolio.services.find(s => s.key === key);
    const contract = state.portfolio.contracts.find(c => c.serviceId === service?.id && c.recipientCompanyId === company.id && c.status === 'active');
    const department = state.departments.find(d => d.companyId === company.id && d.name === (index === 0 ? 'Research' : 'Engineering'));
    const description = [step.rationale, 'Acceptance:', ...(step.acceptance ?? []).map(v => `- ${v}`), 'Basis: inferred from the imported README snapshot. No build or implementation result is implied.', JSON.stringify(row.evidence.readme)].join('\n').slice(0, 4000);
    state = await command('upsert_roadmap_item', { id, scope: { kind: 'company', id: company.id }, title: step.title, description, ownerEmployeeId: contract?.employeeIds[0] ?? 'donna', serviceContractId: contract?.id ?? null, departmentId: department?.id ?? null, status: 'planned', dependencies: (step.dependsOn ?? []).map(dep => stableId(company.repoUrl, dep)) });
    createdRoadmaps++;
  }
  const office = state.offices.find(o => o.companyId === company.id);
  state = await command('ensure_blueprint', { officeId: office.id });
  const board = state.blueprints.find(b => b.officeId === office.id).whiteboards[0];
  if (board) state = await command('upsert_whiteboard', { officeId: office.id, ...board, roadmapItemIds: [...new Set([...(board.roadmapItemIds ?? []), ...row.roadmap.map(step => stableId(company.repoUrl, step.id))])].slice(0, 100) });
}
for (const group of groups) {
  const id = `coord-${group.id}`;
  if (state.portfolio.roadmap.some(r => r.id === id)) continue;
  state = await command('upsert_roadmap_item', { id, scope: { kind: 'group', id: group.id }, title: `Coordinate ${group.name}`, description: 'Review company-specific outcomes, reuse the contracted specialist services, and route accepted artifacts with named knowledge grants. Keep source repository ownership and individual build evidence intact.', ownerEmployeeId: 'donna', status: 'planned' });
  createdRoadmaps++;
}
const receipt = { appliedAt: new Date().toISOString(), planSha256: crypto.createHash('sha256').update(fs.readFileSync(planPath)).digest('hex'), repositoryCompanies: seen.size, totalCompanies: state.companies.length, offices: state.offices.length, departments: state.departments.length, employeeDefinitions: state.employees.length, activeEmployees: state.employees.filter(e => e.status === 'active').length, pausedEmployees: state.employees.filter(e => e.status === 'paused').length, blueprints: state.blueprints.length, groups: state.portfolio.groups.length, services: state.portfolio.services.length, contracts: state.portfolio.contracts.length, roadmapItems: state.portfolio.roadmap.length, createdRoadmaps, optimization, providerRequests: 0, githubWrites: 0 };
const report = option('--report');
if (report) { fs.mkdirSync(path.dirname(path.resolve(report)), { recursive: true, mode: 0o700 }); fs.writeFileSync(report, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 }); }
console.log(JSON.stringify(receipt));
