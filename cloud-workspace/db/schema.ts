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
export const integrationEvents = sqliteTable('daftar_integration_events', {
 id:text('id').primaryKey(), actorId:text('actor_id').notNull(), action:text('action').notNull(), scopeId:text('scope_id').notNull(), summary:text('summary').notNull(), createdAt:text('created_at').notNull(),
},(t)=>[index('daftar_event_date').on(t.createdAt,t.id)]);
