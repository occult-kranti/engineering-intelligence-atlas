'use strict';

// The editor selects records from a fresh snapshot. Native authority remains
// responsible for effective grants, lifecycle, limits, and durable writes.
const OPERATIONS = Object.freeze([
  ['hire_employee', 'Add a permanent employee definition'],
  ['update_employee', 'Edit an employee name, role, or skills'],
  ['fire_employee', 'Retire a specialist and retain its history'],
  ['create_office', 'Add an office'],
  ['rename_office', 'Rename an office'],
  ['create_department', 'Add a department'],
  ['rename_department', 'Rename a department'],
  ['set_department_parent', 'Move a department within its office'],
  ['pause_department', 'Pause a department'],
  ['resume_department', 'Resume a department'],
]);
const list = value => Array.isArray(value) ? value : [];
function text(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value.trim()) > maximum || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${label} must be nonempty text of at most ${maximum} bytes.`);
  return value.trim();
}
function skillPaths(value) {
  const values = list(value);
  if (!Array.isArray(value) || new Set(values).size !== values.length || values.length > 20 || values.some(path => typeof path !== 'string' || !/^skills\/[a-zA-Z0-9_-]+\/SKILL\.md$/.test(path))) throw new Error('Choose at most 20 repository skill paths, such as skills/agent-research-director/SKILL.md.');
  return [...new Set(values)];
}
function scopeRecords(snapshot, companyId) {
  const company = list(snapshot?.companies).find(row => row.id === companyId);
  if (!company) throw new Error('Choose an existing company.');
  return {
    company,
    offices: list(snapshot.offices).filter(row => row.companyId === companyId),
    departments: list(snapshot.departments).filter(row => row.companyId === companyId),
    employees: list(snapshot.employees).filter(row => row.companyId === companyId),
  };
}
function managementCommand(snapshot, companyId, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid management request.');
  const records = scopeRecords(snapshot, companyId);
  const office = id => {
    const value = records.offices.find(row => row.id === id);
    if (!value) throw new Error('Office is outside the selected company.');
    return value;
  };
  const department = id => {
    const value = records.departments.find(row => row.id === id);
    if (!value) throw new Error('Department is outside the selected company.');
    office(value.officeId);
    return value;
  };
  const employee = id => {
    const value = records.employees.find(row => row.id === id);
    if (!value || value.status === 'fired') throw new Error('Choose a current employee in this company.');
    return value;
  };
  const action = input.action;
  if (action === 'create_office') return { action, companyId, name: text(input.name, 'Office name', 150) };
  if (action === 'rename_office') return { action, officeId: office(input.officeId).id, name: text(input.name, 'Office name', 150) };
  if (action === 'create_department') return { action, officeId: office(input.officeId).id, name: text(input.name, 'Department name', 150) };
  if (['rename_department', 'pause_department', 'resume_department', 'set_department_parent'].includes(action)) {
    const child = department(input.departmentId);
    const result = { action, departmentId: child.id };
    if (action === 'rename_department') result.name = text(input.name, 'Department name', 150);
    if (action === 'set_department_parent') {
      if (input.parentDepartmentId !== null) {
        const parent = department(input.parentDepartmentId);
        if (parent.officeId !== child.officeId || parent.id === child.id) throw new Error('Choose another department in the same office.');
        const visited = new Set([child.id]);
        let next = parent;
        while (next) {
          if (visited.has(next.id)) throw new Error('A department cannot be moved beneath its own descendant.');
          visited.add(next.id);
          next = next.parentDepartmentId ? department(next.parentDepartmentId) : null;
        }
      }
      result.parentDepartmentId = input.parentDepartmentId;
    }
    return result;
  }
  if (action === 'hire_employee') {
    const target = office(input.officeId);
    const dept = input.departmentId == null ? null : department(input.departmentId);
    if (dept && dept.officeId !== target.id) throw new Error('Department must belong to the chosen office.');
    return { action, companyId, officeId: target.id, departmentId: dept?.id ?? null, name: text(input.name, 'Employee name', 150), role: text(input.role, 'Role definition', 200), skillPaths: skillPaths(input.skillPaths ?? []) };
  }
  if (['update_employee', 'pause_employee', 'resume_employee', 'fire_employee'].includes(action)) {
    const member = employee(input.employeeId);
    if (action === 'fire_employee' && (member.id === 'donna' || member.kind === 'assistant')) throw new Error('Permanent assistants retain ownership. Pause them instead of retiring them.');
    const result = { action, employeeId: member.id };
    if (action === 'update_employee') {
      if (input.name !== undefined) result.name = text(input.name, 'Employee name', 150);
      if (input.role !== undefined) result.role = text(input.role, 'Role definition', 200);
      if (input.skillPaths !== undefined) result.skillPaths = skillPaths(input.skillPaths);
      if (Object.keys(result).length === 2) throw new Error('Choose a name, role, or skills change.');
    }
    return result;
  }
  throw new Error('Unsupported management action.');
}

function ownershipSummary(snapshot, companyId, at = Date.now()) {
  const records = scopeRecords(snapshot, companyId);
  const assignments = [{ kind: 'global', id: 'donna', name: 'Global coordinator', assistantId: 'donna' },
    { kind: 'company', id: companyId, name: records.company.name, assistantId: records.company.assistantId },
    ...records.offices.map(row => ({ kind: 'office', ...row })),
    ...records.departments.map(row => ({ kind: 'department', ...row }))];
  const assistants = new Map(list(snapshot.employees).map(row => [row.id, row]));
  const grants = list(snapshot.authority?.grants);
  return assignments.map(row => {
    const member = assistants.get(row.assistantId);
    const scopeMatches = row.kind === 'global'
      ? member?.id === 'donna' && member.companyId == null && member.officeId == null && member.departmentId == null
      : member?.companyId === companyId && (row.kind === 'company'
        ? member.officeId == null && member.departmentId == null
        : row.kind === 'office' ? member.officeId === row.id && member.departmentId == null
          : member.officeId === row.officeId && member.departmentId === row.id);
    const validOwner = member?.kind === 'assistant' && ['active','paused'].includes(member.status) && scopeMatches;
    const grantScope = row.kind === 'global' ? {kind:'company',id:companyId} : {kind:row.kind,id:row.id};
    return { kind: row.kind, id: row.id, name: row.name, assistantId: row.assistantId, assistantName: member?.name || 'Missing assistant', status: member?.status || 'missing', validOwner: Boolean(validOwner),
      grantScope,
      grantCount: grants.filter(grant => grant.employeeId === row.assistantId && !grant.revokedAt && Number.isFinite(Date.parse(grant.grantedAt)) && Date.parse(grant.grantedAt) <= at && Number.isFinite(Date.parse(grant.expiresAt)) && Date.parse(grant.expiresAt) > at && grant.scope?.kind === grantScope.kind && grant.scope.id === grantScope.id).length };
  });
}

module.exports = { OPERATIONS, scopeRecords, managementCommand, ownershipSummary };
