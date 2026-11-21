import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const workspace = sqliteTable('atlas_workspace', {
  id: text('id').primaryKey(), revision: integer('revision').notNull().default(0),
  snapshot: text('snapshot').notNull().default('{}'), sourceClientId: text('source_client_id'), updatedAt: text('updated_at').notNull(),
});
export const devices = sqliteTable('atlas_devices', {
  id: text('id').primaryKey(), tokenHash: text('token_hash').notNull().unique(), name: text('name').notNull(), kind: text('kind').notNull(), clientId: text('client_id'),
  createdAt: text('created_at').notNull(), expiresAt: text('expires_at').notNull(), revokedAt: text('revoked_at'),
});
export const commands = sqliteTable('atlas_commands', {
  id: text('id').primaryKey(), idempotencyKey: text('idempotency_key').notNull().unique(), command: text('command').notNull(), status: text('status').notNull().default('queued'),
  baseRevision: integer('base_revision').notNull(), createdAt: text('created_at').notNull(), acknowledgedAt: text('acknowledged_at'), error: text('error'),
}, (t)=>[index('atlas_command_queue').on(t.status,t.createdAt)]);
export const messages = sqliteTable('atlas_messages', {
  id: text('id').primaryKey(), scopeKey: text('scope_key').notNull(), requestId: text('request_id').notNull(), role: text('role').notNull(), content: text('content').notNull(), createdAt: text('created_at').notNull(),
}, (t)=>[uniqueIndex('atlas_message_request_role').on(t.requestId,t.role),index('atlas_message_scope_date').on(t.scopeKey,t.createdAt,t.id),index('atlas_message_cursor').on(t.createdAt,t.id)]);
export const requests = sqliteTable('atlas_requests', {
  id: text('id').primaryKey(), idempotencyKey: text('idempotency_key').notNull().unique(), scopeKey: text('scope_key').notNull(), status: text('status').notNull(), requestHash: text('request_hash').notNull(),
  reservedMicros: integer('reserved_micros').notNull(), costMicros: integer('cost_micros'), usage: text('usage'), reply: text('reply'), createdAt: text('created_at').notNull(), finishedAt: text('finished_at'),
});

export const applications = sqliteTable('daftar_applications', {
 id:text('id').primaryKey(), revision:integer('revision').notNull().default(0), entries:text('entries').notNull().default('[]'), updatedAt:text('updated_at').notNull(),
});
export const integrations = sqliteTable('daftar_integrations', {
 id:text('id').primaryKey(), companyId:text('company_id').notNull(), provider:text('provider').notNull(), config:text('config').notNull(), updatedAt:text('updated_at').notNull(),
});
export const collabUsers = sqliteTable('daftar_users', {
 id:text('id').primaryKey(), issuer:text('issuer',{length:300}).notNull(), subject:text('subject',{length:300}).notNull(), email:text('email',{length:320}), displayName:text('display_name',{length:200}), status:text('status',{length:20}).notNull().default('active'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
},(t)=>[uniqueIndex('daftar_user_issuer_subject').on(t.issuer,t.subject)]);
export const workspaceOwners = sqliteTable('daftar_workspace_owners', {
 workspaceId:text('workspace_id').primaryKey(), userId:text('user_id').notNull(), boundAt:text('bound_at').notNull(),
});
export const companyMemberships = sqliteTable('daftar_company_memberships', {
 id:text('id').primaryKey(), workspaceId:text('workspace_id',{length:80}).notNull().default('owner'), companyId:text('company_id',{length:120}).notNull(), userId:text('user_id').notNull(), role:text('role',{length:20}).notNull(), status:text('status',{length:20}).notNull().default('active'), expiresAt:text('expires_at'), revokedAt:text('revoked_at'), aclRevision:integer('acl_revision').notNull().default(1), grantedByUserId:text('granted_by_user_id').notNull(), revokedByUserId:text('revoked_by_user_id'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
},(t)=>[uniqueIndex('daftar_membership_company_user').on(t.companyId,t.userId),index('daftar_membership_user').on(t.userId,t.status)]);
export const invitations = sqliteTable('daftar_invitations', {
 id:text('id').primaryKey(), companyId:text('company_id',{length:120}).notNull(), role:text('role',{length:20}).notNull(), tokenDigest:text('token_digest',{length:64}).notNull().unique(), intendedEmail:text('intended_email',{length:320}), invitedByUserId:text('invited_by_user_id').notNull(), status:text('status',{length:20}).notNull().default('pending'), expiresAt:text('expires_at').notNull(), acceptedByUserId:text('accepted_by_user_id'), acceptedAt:text('accepted_at'), createdAt:text('created_at').notNull(),
},(t)=>[index('daftar_invitation_company').on(t.companyId,t.status)]);
export const connections = sqliteTable('daftar_connections', {
 id:text('id').primaryKey(), ownerUserId:text('owner_user_id').notNull(), provider:text('provider',{length:40}).notNull(), label:text('label',{length:120}).notNull(), ciphertext:text('ciphertext').notNull(), nonce:text('nonce',{length:64}).notNull(), keyVersion:text('key_version',{length:40}).notNull(), accountMeta:text('account_meta',{length:2000}), status:text('status',{length:20}).notNull().default('active'), model:text('model',{length:120}), capMicros:integer('cap_micros'), inputRateMicros:integer('input_rate_micros'), outputRateMicros:integer('output_rate_micros'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
},(t)=>[index('daftar_connection_owner').on(t.ownerUserId,t.status)]);
export const resourceGrants = sqliteTable('daftar_resource_grants', {
 id:text('id').primaryKey(), connectionId:text('connection_id').notNull(), ownerUserId:text('owner_user_id').notNull(), beneficiaryUserId:text('beneficiary_user_id').notNull(), companyId:text('company_id',{length:120}).notNull(), operations:text('operations',{length:1000}).notNull(), model:text('model',{length:120}), repoAllowlist:text('repo_allowlist',{length:4000}), perRequestCapMicros:integer('per_request_cap_micros'), totalCapMicros:integer('total_cap_micros'), maxConcurrent:integer('max_concurrent').notNull().default(1), expiresAt:text('expires_at'), revokedAt:text('revoked_at'), createdAt:text('created_at').notNull(),
},(t)=>[index('daftar_grant_beneficiary').on(t.beneficiaryUserId,t.companyId)]);
export const memberRequests = sqliteTable('daftar_member_requests', {
 id:text('id').primaryKey(), companyId:text('company_id',{length:120}).notNull(), requesterUserId:text('requester_user_id').notNull(), payerUserId:text('payer_user_id').notNull(), connectionId:text('connection_id'), grantId:text('grant_id'), operation:text('operation',{length:60}).notNull(), idempotencyKey:text('idempotency_key',{length:150}).notNull(), inputHash:text('input_hash',{length:64}).notNull(), status:text('status',{length:20}).notNull(), reservedMicros:integer('reserved_micros').notNull(), costMicros:integer('cost_micros'), inputTokens:integer('input_tokens'), outputTokens:integer('output_tokens'), createdAt:text('created_at').notNull(), finishedAt:text('finished_at'),
},(t)=>[uniqueIndex('daftar_request_actor_key').on(t.requesterUserId,t.idempotencyKey),index('daftar_request_admission').on(t.payerUserId,t.status)]);
export const memberMessages = sqliteTable('daftar_member_messages', {
 id:text('id').primaryKey(), companyId:text('company_id',{length:120}).notNull(), authorUserId:text('author_user_id').notNull(), visibility:text('visibility',{length:20}).notNull(), role:text('role',{length:20}).notNull(), content:text('content',{length:20000}).notNull(), requestId:text('request_id'), createdAt:text('created_at').notNull(),
},(t)=>[index('daftar_message_company').on(t.companyId,t.visibility,t.createdAt,t.id)]);
export const taskProposals = sqliteTable('daftar_task_proposals', {
 id:text('id').primaryKey(), companyId:text('company_id',{length:120}).notNull(), requesterUserId:text('requester_user_id').notNull(), approverUserId:text('approver_user_id'), assignedUserId:text('assigned_user_id'), brief:text('brief',{length:10000}).notNull(), sourceHash:text('source_hash',{length:64}).notNull(), evidenceLinks:text('evidence_links',{length:4000}), status:text('status',{length:20}).notNull().default('proposed'), queuedCommandId:text('queued_command_id'), nativeRef:text('native_ref',{length:200}), decidedAt:text('decided_at'), createdAt:text('created_at').notNull(),
},(t)=>[index('daftar_proposal_company').on(t.companyId,t.status,t.createdAt)]);
export const collabEvents = sqliteTable('daftar_collaboration_events', {
 id:text('id').primaryKey(), actorUserId:text('actor_user_id').notNull(), action:text('action',{length:80}).notNull(), companyId:text('company_id',{length:120}), scopeId:text('scope_id',{length:200}), summary:text('summary',{length:1000}).notNull(), createdAt:text('created_at').notNull(),
},(t)=>[index('daftar_collab_event_date').on(t.createdAt,t.id)]);
export const integrationEvents = sqliteTable('daftar_integration_events', {
 id:text('id').primaryKey(), actorId:text('actor_id').notNull(), action:text('action').notNull(), scopeId:text('scope_id').notNull(), summary:text('summary').notNull(), createdAt:text('created_at').notNull(),
},(t)=>[index('daftar_event_date').on(t.createdAt,t.id)]);
