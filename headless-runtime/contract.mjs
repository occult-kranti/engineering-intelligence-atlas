// Owner-facing command contract. Worker claims and accounting stay internal.
export const API_VERSION = 1;
export const BODY_LIMIT = 256 * 1024;
export const OUTPUT_LIMIT = 8 * 1024 * 1024 + 64 * 1024;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export class RuntimeError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'RuntimeError';
    this.code = code;
    this.status = status;
  }
}

// Mirrors native-core/src/remote_commands.rs, excluding its internal chat import.
export const OWNER_ACTIONS = Object.freeze([
  'create_company', 'rename_company', 'select_company', 'create_office', 'rename_office', 'set_company_parent',
  'create_department', 'rename_department', 'set_department_parent', 'hire_employee', 'update_employee', 'pause_employee', 'resume_employee',
  'fire_employee', 'pause_company', 'resume_company', 'pause_office',
  'resume_office', 'pause_department', 'resume_department', 'enqueue_job',
  'cancel_job', 'pause_job', 'resume_job', 'create_schedule', 'pause_schedule',
  'resume_schedule', 'configure_cache', 'clear_cache', 'add_knowledge',
  'configure_policy', 'approve_job', 'bootstrap_directors', 'post_chat',
  'create_goal', 'plan_goal', 'set_goal_plan', 'execute_goal', 'pause_goal',
  'resume_goal', 'checkpoint_goal', 'ensure_blueprint', 'save_blueprint',
  'upsert_room', 'place_employee', 'upsert_whiteboard', 'configure_ceo',
  'upsert_portfolio_group', 'ensure_shared_services', 'optimize_portfolio',
  'contract_service', 'share_knowledge', 'upsert_roadmap_item', 'convene_panel',
  'start_panel_round', 'record_panel_decision', 'pause_panel', 'resume_panel',
  'grant_authority', 'promote_employee', 'revoke_authority',
  'set_authority_enforcement', 'rebuild_office_index', 'apply_employee_command',
]);

export function assertObject(value, name = 'Request') {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new RuntimeError('INVALID_REQUEST', `${name} must be a plain object.`);
  }
  return value;
}

function inspect(value, depth = 0) {
  if (depth > 16) throw new RuntimeError('INVALID_REQUEST', 'Request nesting exceeds its limit.');
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        throw new RuntimeError('INVALID_REQUEST', 'Reserved object key.');
      }
      inspect(child, depth + 1);
    }
  }
}

export function validateCommandEnvelope(input) {
  const value = assertObject(input);
  if (Object.keys(value).some(key => !['id', 'expectedStateHash', 'command'].includes(key)) ||
      typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.id) ||
      typeof value.expectedStateHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.expectedStateHash)) {
    throw new RuntimeError('INVALID_REQUEST', 'A command id and expected state hash are required.');
  }
  const command = assertObject(value.command, 'Command');
  if (!OWNER_ACTIONS.includes(command.action)) {
    throw new RuntimeError('ACTION_DENIED', 'This action is not an owner control operation.', 403);
  }
  inspect(command);
  if (Buffer.byteLength(JSON.stringify(value)) > BODY_LIMIT) {
    throw new RuntimeError('REQUEST_TOO_LARGE', 'Request exceeds 256 KiB.', 413);
  }
  return { id: value.id, expectedStateHash: value.expectedStateHash, command };
}
