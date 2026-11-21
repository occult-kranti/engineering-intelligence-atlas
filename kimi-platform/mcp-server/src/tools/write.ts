/**
 * Write tools — DISABLED by default. Every handler enforces BOTH:
 *   1. the server CLI flag --enable-writes, and
 *   2. per-call input `confirmed: true` (plus payloadHash for approvals).
 * The provider-paid chat send additionally requires --enable-provider-writes.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { STABLE_ROUTES } from '../client/routes.js';
import {
  companionFailure,
  confirmedField,
  gateProviderWrites,
  gateWrites,
  idField,
  okResult,
  payloadHashField,
  type ToolContext,
  type ToolResult,
} from './common.js';

const budgetShape = {
  maxTokens: z.number().int().min(1).optional(),
  maxMinutes: z.number().int().min(1).optional(),
  maxUsd: z.number().min(0).optional(),
};

const priceRatesShape = {
  inputPerMillionUsd: z.number().min(0).optional(),
  outputPerMillionUsd: z.number().min(0).optional(),
};

const WRITES_DISABLED_NOTE = 'Requires the server to be started with --enable-writes AND confirmed:true in the input.';

export function registerWriteTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'create_project',
    {
      title: 'Create project (write)',
      description: `Create a new Research Director project in the desktop app. ${WRITES_DISABLED_NOTE}`,
      inputSchema: {
        name: z.string().min(1).max(200),
        goal: z.string().min(1).max(8_000),
        provider: z.string().min(1).max(64).describe('Desktop-configured provider id (the desktop owns provider credentials)'),
        model: z.string().min(1).max(128),
        template: z.enum(['standard', 'office']).optional(),
        successCriteria: z.array(z.string().max(500)).max(20).optional(),
        confirmed: confirmedField,
      },
    },
    async ({ name, goal, provider, model, template, successCriteria, confirmed }): Promise<ToolResult> => {
      const gate = gateWrites(ctx, confirmed);
      if (gate) return gate;
      const res = await ctx.http.request(
        STABLE_ROUTES.createProject({
          name,
          goal,
          provider,
          model,
          ...(template !== undefined ? { template } : {}),
          ...(successCriteria !== undefined ? { successCriteria } : {}),
          confirmed: true,
        }),
      );
      if (!res.ok) return companionFailure(ctx, res, 'create_project');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'start_mock_run',
    {
      title: 'Start run (write)',
      description: `Start a run for a project (use the desktop's mock/dry-run provider for no-cost runs). ${WRITES_DISABLED_NOTE}`,
      inputSchema: {
        projectId: idField('Project ID'),
        runBudget: z.object(budgetShape).strict().optional(),
        priceRates: z.object(priceRatesShape).strict().optional(),
        confirmed: confirmedField,
      },
    },
    async ({ projectId, runBudget, priceRates, confirmed }): Promise<ToolResult> => {
      const gate = gateWrites(ctx, confirmed);
      if (gate) return gate;
      const res = await ctx.http.request(
        STABLE_ROUTES.startRun({
          projectId,
          ...(runBudget !== undefined ? { runBudget } : {}),
          ...(priceRates !== undefined ? { priceRates } : {}),
        }),
      );
      if (!res.ok) return companionFailure(ctx, res, 'start_mock_run');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  const runLifecycle = (action: 'pause' | 'resume' | 'cancel' | 'recover') => {
    server.registerTool(
      `${action}_run`,
      {
        title: `${action[0]!.toUpperCase()}${action.slice(1)} run (write)`,
        description: `${action[0]!.toUpperCase()}${action.slice(1)} an existing run. ${WRITES_DISABLED_NOTE}`,
        inputSchema: { runId: idField('Run ID'), confirmed: confirmedField },
      },
      async ({ runId, confirmed }): Promise<ToolResult> => {
        const gate = gateWrites(ctx, confirmed);
        if (gate) return gate;
        const res = await ctx.http.request(STABLE_ROUTES.runAction(action, runId));
        if (!res.ok) return companionFailure(ctx, res, `${action}_run`);
        return okResult(ctx, res.data as Record<string, unknown>);
      },
    );
  };
  runLifecycle('pause');
  runLifecycle('resume');
  runLifecycle('cancel');
  runLifecycle('recover');

  server.registerTool(
    'decide_approval',
    {
      title: 'Decide approval (write)',
      description: `Approve or reject a pending approval. The payloadHash binds the decision to the exact payload that was shown to the user. ${WRITES_DISABLED_NOTE}`,
      inputSchema: {
        projectId: idField('Project ID'),
        approvalId: idField('Approval ID'),
        runId: idField('Run ID').optional(),
        decision: z.enum(['approved', 'rejected']),
        payloadHash: payloadHashField,
        confirmed: confirmedField,
      },
    },
    async ({ projectId, approvalId, runId, decision, payloadHash, confirmed }): Promise<ToolResult> => {
      const gate = gateWrites(ctx, confirmed);
      if (gate) return gate;
      const res = await ctx.http.request(
        STABLE_ROUTES.decideApproval({
          projectId,
          approvalId,
          decision,
          payloadHash,
          ...(runId !== undefined ? { runId } : {}),
        }),
      );
      if (!res.ok) return companionFailure(ctx, res, 'decide_approval');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'send_chat_message',
    {
      title: 'Send chat message (provider-paid write)',
      description:
        'Send a user message to a desktop chat session. This can incur provider API spend and is gated TWICE: the server needs --enable-writes AND --enable-provider-writes, and the input needs confirmed:true. The desktop owns the provider credentials; this server never sees them.',
      inputSchema: {
        sessionId: idField('Chat session ID'),
        text: z.string().min(1).max(16_000),
        confirmed: confirmedField,
      },
    },
    async ({ sessionId, text, confirmed }): Promise<ToolResult> => {
      const gate = gateProviderWrites(ctx, confirmed);
      if (gate) return gate;
      const res = await ctx.http.request(STABLE_ROUTES.sendChatMessage(sessionId, { text, confirmed: true }));
      if (!res.ok) return companionFailure(ctx, res, 'send_chat_message');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );
}
