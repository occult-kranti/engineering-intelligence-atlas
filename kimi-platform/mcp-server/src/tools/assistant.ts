/**
 * Enterprise (CEO office), Donna (assistant), and repository (Engineering
 * Intelligence Atlas) tools.
 *
 * These address CANDIDATE desktop routes via the isolated route map
 * (src/client/routes.ts). When the desktop build does not provide a route,
 * the tool returns an explicit `capability_unavailable` error — it NEVER
 * fabricates snapshot/ledger/proposal data.
 *
 * Donna write tools are PROPOSALS ONLY: typed, validated inputs that create
 * proposal/queue/schedule/assignment records on the desktop. They never
 * execute provider text, external code, shell commands, GitHub writes,
 * clones, or file writes — and they cannot, because this package contains no
 * execution primitives at all.
 */

import { createHash } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CANDIDATE_ROUTES } from '../client/routes.js';
import {
  companionFailure,
  confirmedField,
  gateWrites,
  idField,
  okResult,
  type ToolContext,
  type ToolResult,
} from './common.js';

const DONNA_WRITES_NOTE = 'Creates a proposal only (nothing is executed). Requires --enable-writes and confirmed:true.';

/** Stable client-side hash so a validated proposal has a deterministic id. */
function proposalHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function registerAssistantTools(server: McpServer, ctx: ToolContext): void {
  // ------------------------------------------------------------ enterprise
  server.registerTool(
    'enterprise.get_snapshot',
    {
      title: 'Enterprise snapshot',
      description:
        'Get the CEO-office enterprise snapshot (portfolio, finances, headcount rollups). Requires a desktop build that ships the enterprise companion route; otherwise returns capability_unavailable with no fabricated data.',
      inputSchema: { enterpriseId: idField('Enterprise ID').optional() },
    },
    async ({ enterpriseId }): Promise<ToolResult> => {
      const res = await ctx.http.request(CANDIDATE_ROUTES.enterpriseSnapshot(enterpriseId));
      if (!res.ok) return companionFailure(ctx, res, 'enterprise.get_snapshot');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'enterprise.list_ledger',
    {
      title: 'Enterprise ledger',
      description:
        'List enterprise ledger entries (budget/spend events). Requires a desktop build that ships the enterprise companion route; otherwise returns capability_unavailable with no fabricated data.',
      inputSchema: {
        enterpriseId: idField('Enterprise ID').optional(),
        limit: z.number().int().min(1).max(500).default(100),
      },
    },
    async ({ enterpriseId, limit }): Promise<ToolResult> => {
      const res = await ctx.http.request(CANDIDATE_ROUTES.enterpriseLedger(enterpriseId, limit));
      if (!res.ok) return companionFailure(ctx, res, 'enterprise.list_ledger');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  // ---------------------------------------------------------------- donna
  server.registerTool(
    'donna.list_proposals',
    {
      title: 'Donna: list proposals',
      description:
        'List assistant (Donna) action proposals and their status. Requires a desktop build that ships the Donna companion route; otherwise returns capability_unavailable.',
      inputSchema: { status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all') },
    },
    async ({ status }): Promise<ToolResult> => {
      const res = await ctx.http.request(CANDIDATE_ROUTES.donnaListProposals(status === 'all' ? undefined : status));
      if (!res.ok) return companionFailure(ctx, res, 'donna.list_proposals');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'donna.list_schedules',
    {
      title: 'Donna: list schedules',
      description:
        'List assistant (Donna) schedules. Requires a desktop build that ships the Donna companion route; otherwise returns capability_unavailable.',
      inputSchema: {},
    },
    async (): Promise<ToolResult> => {
      const res = await ctx.http.request(CANDIDATE_ROUTES.donnaListSchedules());
      if (!res.ok) return companionFailure(ctx, res, 'donna.list_schedules');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'donna.propose_action',
    {
      title: 'Donna: propose action (proposal only)',
      description: `Propose an assistant action for human review. ${DONNA_WRITES_NOTE} The action is never executed by this server.`,
      inputSchema: {
        kind: z.enum(['note', 'reminder', 'draft', 'triage', 'recommendation']),
        title: z.string().min(1).max(300),
        rationale: z.string().min(1).max(4_000),
        parameters: z.record(z.string(), z.unknown()).optional().describe('Structured, validated parameters for the proposal (never executed here)'),
        confirmed: confirmedField,
      },
    },
    async ({ kind, title, rationale, parameters, confirmed }): Promise<ToolResult> => {
      const gate = gateWrites(ctx, confirmed);
      if (gate) return gate;
      const proposal = { kind, title, rationale, ...(parameters !== undefined ? { parameters } : {}) };
      const res = await ctx.http.request(CANDIDATE_ROUTES.donnaProposeAction({ ...proposal, payloadHash: proposalHash(proposal) }));
      if (!res.ok) return companionFailure(ctx, res, 'donna.propose_action');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'donna.queue_proposal',
    {
      title: 'Donna: queue proposal (proposal only)',
      description: `Queue a previously described proposal for later human decision. ${DONNA_WRITES_NOTE}`,
      inputSchema: {
        proposalRef: z.string().min(1).max(256).describe('Reference/id of the proposal to queue'),
        priority: z.enum(['low', 'normal', 'high']).default('normal'),
        notBefore: z.string().datetime({ offset: true }).optional().describe('ISO-8601 earliest processing time'),
        confirmed: confirmedField,
      },
    },
    async ({ proposalRef, priority, notBefore, confirmed }): Promise<ToolResult> => {
      const gate = gateWrites(ctx, confirmed);
      if (gate) return gate;
      const payload = { proposalRef, priority, ...(notBefore !== undefined ? { notBefore } : {}) };
      const res = await ctx.http.request(CANDIDATE_ROUTES.donnaQueueProposal({ ...payload, payloadHash: proposalHash(payload) }));
      if (!res.ok) return companionFailure(ctx, res, 'donna.queue_proposal');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'donna.schedule',
    {
      title: 'Donna: create schedule (proposal only)',
      description: `Create an assistant schedule entry (cron-like or one-shot) for human-approved proposals. ${DONNA_WRITES_NOTE} Scheduling never triggers execution from this server.`,
      inputSchema: {
        label: z.string().min(1).max(200),
        proposalRef: z.string().min(1).max(256),
        schedule: z
          .object({
            kind: z.enum(['once', 'interval', 'cron']),
            at: z.string().datetime({ offset: true }).optional(),
            intervalMinutes: z.number().int().min(5).max(43_200).optional(),
            cron: z.string().min(1).max(120).optional(),
          })
          .strict(),
        confirmed: confirmedField,
      },
    },
    async ({ label, proposalRef, schedule, confirmed }): Promise<ToolResult> => {
      const gate = gateWrites(ctx, confirmed);
      if (gate) return gate;
      const payload = { label, proposalRef, schedule };
      const res = await ctx.http.request(CANDIDATE_ROUTES.donnaCreateSchedule({ ...payload, payloadHash: proposalHash(payload) }));
      if (!res.ok) return companionFailure(ctx, res, 'donna.schedule');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  // ------------------------------------------------------------ repository
  server.registerTool(
    'repository.preview_assignment',
    {
      title: 'Repository: preview assignment',
      description:
        'Preview how a repository company/asset would be assigned (roles, teams, routing) without changing anything. Requires a desktop build that ships the repository companion route; otherwise returns capability_unavailable.',
      inputSchema: { companyId: idField('Company ID').optional() },
    },
    async ({ companyId }): Promise<ToolResult> => {
      const res = await ctx.http.request(CANDIDATE_ROUTES.repositoryPreviewAssignment(companyId));
      if (!res.ok) return companionFailure(ctx, res, 'repository.preview_assignment');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'repository.propose_assignment',
    {
      title: 'Repository: propose assignment (proposal only)',
      description: `Propose a repository assignment for Engineering Intelligence Atlas assets. ${DONNA_WRITES_NOTE}`,
      inputSchema: {
        companyId: idField('Company ID'),
        target: z.string().min(1).max(300).describe('Assignment target (team/role/lane identifier)'),
        rationale: z.string().min(1).max(4_000),
        confirmed: confirmedField,
      },
    },
    async ({ companyId, target, rationale, confirmed }): Promise<ToolResult> => {
      const gate = gateWrites(ctx, confirmed);
      if (gate) return gate;
      const payload = { companyId, target, rationale };
      const res = await ctx.http.request(CANDIDATE_ROUTES.repositoryProposeAssignment({ ...payload, payloadHash: proposalHash(payload) }));
      if (!res.ok) return companionFailure(ctx, res, 'repository.propose_assignment');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'propose_repository_company',
    {
      title: 'Propose repository company (EIA metadata)',
      description:
        'Propose a new company entry for the Engineering Intelligence Atlas (EIA) repository, with typed metadata. Uses the shared desktop routing when the companion route exists; otherwise returns the validated proposal with applied:false — it never claims the entry was created.',
      inputSchema: {
        name: z.string().min(1).max(200),
        domain: z.string().max(200).optional().describe('Primary domain, e.g. example.com (no scheme)'),
        kind: z.enum(['lab', 'startup', 'bigtech', 'academic', 'opensource', 'other']).default('other'),
        focusAreas: z.array(z.string().min(1).max(120)).max(20).default([]),
        notableWork: z.array(z.string().min(1).max(300)).max(20).default([]),
        metadata: z.record(z.string(), z.unknown()).optional().describe('Additional EIA metadata (validated, never executed)'),
        confirmed: confirmedField,
      },
    },
    async ({ name, domain, kind, focusAreas, notableWork, metadata, confirmed }): Promise<ToolResult> => {
      const gate = gateWrites(ctx, confirmed);
      if (gate) return gate;
      const proposal = {
        name,
        ...(domain !== undefined ? { domain } : {}),
        kind,
        focusAreas,
        notableWork,
        ...(metadata !== undefined ? { metadata } : {}),
      };
      const hash = proposalHash(proposal);
      const res = await ctx.http.request(CANDIDATE_ROUTES.repositoryProposeCompany({ ...proposal, payloadHash: hash }));
      if (!res.ok) {
        if (res.code === 'capability_unavailable') {
          // Shared routing not available in this desktop build: return the
          // validated proposal WITHOUT claiming it was applied.
          return okResult(ctx, {
            ok: true,
            status: 'proposal_validated',
            applied: false,
            note: 'The desktop companion does not provide the repository company route yet. This is a validated proposal only; nothing was created or applied.',
            proposal,
            payloadHash: hash,
          });
        }
        return companionFailure(ctx, res, 'propose_repository_company');
      }
      const data = res.data as Record<string, unknown>;
      return okResult(ctx, { ...data, applied: data['ok'] === true, payloadHash: hash });
    },
  );
}
