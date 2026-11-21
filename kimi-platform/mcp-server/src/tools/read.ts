/**
 * Read-only tools. Always enabled. All output is sanitized and size-capped.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  ARTIFACT_TEXT_DEFAULT_CAP,
  ARTIFACT_TEXT_HARD_CAP,
  CHAT_MESSAGES_HARD_CAP,
  CHAT_TEXT_HARD_CAP,
  EVENTS_PAGE_DEFAULT,
  EVENTS_PAGE_HARD_CAP,
} from '../config.js';
import { capText } from '../sanitize.js';
import { STABLE_ROUTES } from '../client/routes.js';
import { companionFailure, idField, okResult, type ToolContext, type ToolResult } from './common.js';

export function registerReadTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'health',
    {
      title: 'Companion health',
      description: 'Liveness check for the desktop companion bridge. Returns the bridge version and service name.',
      inputSchema: {},
    },
    async (): Promise<ToolResult> => {
      const res = await ctx.http.request(STABLE_ROUTES.health());
      if (!res.ok) return companionFailure(ctx, res, 'health');
      return okResult(ctx, { ok: true, ...(res.data as Record<string, unknown>) });
    },
  );

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'List all Research Director projects known to the desktop app (metadata only).',
      inputSchema: {},
    },
    async (): Promise<ToolResult> => {
      const res = await ctx.http.request(STABLE_ROUTES.listProjects());
      if (!res.ok) return companionFailure(ctx, res, 'list_projects');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'get_office',
    {
      title: 'Get office snapshot',
      description: 'Get the office/org snapshot (agents, roles, run state) for a project, optionally scoped to a run.',
      inputSchema: {
        projectId: idField('Project ID'),
        runId: idField('Run ID').optional(),
      },
    },
    async ({ projectId, runId }): Promise<ToolResult> => {
      const res = await ctx.http.request(STABLE_ROUTES.office(projectId, runId));
      if (!res.ok) return companionFailure(ctx, res, 'get_office');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'list_runs',
    {
      title: 'List runs',
      description: 'List runs, optionally filtered to one project. Includes status and usage totals.',
      inputSchema: { projectId: idField('Project ID').optional() },
    },
    async ({ projectId }): Promise<ToolResult> => {
      const res = await ctx.http.request(STABLE_ROUTES.listRuns(projectId));
      if (!res.ok) return companionFailure(ctx, res, 'list_runs');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'read_artifact',
    {
      title: 'Read artifact',
      description:
        'Read a bounded slice of a run artifact produced by a node attempt. Text is hard-capped (default 8000 chars, max 32768) and sanitized; metadata is included.',
      inputSchema: {
        projectId: idField('Project ID'),
        runId: idField('Run ID'),
        nodeId: idField('Node ID'),
        attempt: z.number().int().min(1).optional().describe('Attempt number (defaults to latest)'),
        maxChars: z.number().int().min(100).max(ARTIFACT_TEXT_HARD_CAP).default(ARTIFACT_TEXT_DEFAULT_CAP),
      },
    },
    async ({ projectId, runId, nodeId, attempt, maxChars }): Promise<ToolResult> => {
      const res = await ctx.http.request(STABLE_ROUTES.readArtifact(projectId, runId, nodeId, attempt));
      if (!res.ok) return companionFailure(ctx, res, 'read_artifact');
      const data = res.data as Record<string, unknown>;
      const rawText = typeof data['text'] === 'string' ? data['text'] : '';
      const { text, truncated } = capText(rawText, maxChars ?? ARTIFACT_TEXT_DEFAULT_CAP);
      return okResult(ctx, {
        ok: true,
        projectId,
        runId,
        nodeId,
        ...(attempt !== undefined ? { attempt } : {}),
        text,
        textTruncated: truncated,
        textChars: rawText.length,
        meta: (data['meta'] as Record<string, unknown> | undefined) ?? null,
      });
    },
  );

  server.registerTool(
    'read_events',
    {
      title: 'Read run events (keyset page)',
      description:
        'Read a keyset-capped page of run events. Pass the returned nextIndex as afterIndex for the next page. Page size is capped at 200 events.',
      inputSchema: {
        projectId: idField('Project ID'),
        runId: idField('Run ID'),
        afterIndex: z.number().int().min(0).default(0).describe('Keyset cursor: read events after this index'),
        limit: z.number().int().min(1).max(EVENTS_PAGE_HARD_CAP).default(EVENTS_PAGE_DEFAULT),
      },
    },
    async ({ projectId, runId, afterIndex, limit }): Promise<ToolResult> => {
      const res = await ctx.http.request(STABLE_ROUTES.readEvents(projectId, runId, afterIndex ?? 0));
      if (!res.ok) return companionFailure(ctx, res, 'read_events');
      const data = res.data as Record<string, unknown>;
      const events = Array.isArray(data['events']) ? data['events'] : [];
      const page = events.slice(0, limit ?? EVENTS_PAGE_DEFAULT);
      const nextIndex = typeof data['nextIndex'] === 'number' ? data['nextIndex'] : null;
      const lastSeen = afterIndex ?? 0;
      return okResult(ctx, {
        ok: true,
        events: page,
        returned: page.length,
        capped: events.length > page.length,
        // Keyset cursor: prefer the desktop's nextIndex; fall back to local count.
        nextIndex: nextIndex ?? lastSeen + page.length,
        hasMore: nextIndex !== null ? nextIndex > lastSeen + page.length : events.length > page.length,
      });
    },
  );

  server.registerTool(
    'list_chat_sessions',
    {
      title: 'List chat sessions',
      description: 'List desktop chat sessions (metadata only; use get_chat for bounded message content).',
      inputSchema: {},
    },
    async (): Promise<ToolResult> => {
      const res = await ctx.http.request(STABLE_ROUTES.listChatSessions());
      if (!res.ok) return companionFailure(ctx, res, 'list_chat_sessions');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );

  server.registerTool(
    'get_chat',
    {
      title: 'Get chat session (bounded)',
      description:
        'Get one chat session with bounded content: at most maxMessages most-recent messages, each truncated to maxCharsPerMessage. Sanitized.',
      inputSchema: {
        sessionId: idField('Chat session ID'),
        maxMessages: z.number().int().min(1).max(CHAT_MESSAGES_HARD_CAP).default(50),
        maxCharsPerMessage: z.number().int().min(100).max(CHAT_TEXT_HARD_CAP).default(4_000),
      },
    },
    async ({ sessionId, maxMessages, maxCharsPerMessage }): Promise<ToolResult> => {
      const res = await ctx.http.request(STABLE_ROUTES.getChatSession(sessionId));
      if (!res.ok) return companionFailure(ctx, res, 'get_chat');
      const data = res.data as Record<string, unknown>;
      const session = (data['session'] as Record<string, unknown> | undefined) ?? {};
      const messages = Array.isArray(session['messages']) ? (session['messages'] as Array<Record<string, unknown>>) : [];
      const tail = messages.slice(-(maxMessages ?? 50)).map((m) => {
        const content = typeof m['content'] === 'string' ? m['content'] : typeof m['text'] === 'string' ? m['text'] : '';
        const { text, truncated } = capText(content, maxCharsPerMessage ?? 4_000);
        const { content: _c, text: _t, reasoning: _r, ...rest } = m;
        return { ...rest, text, textTruncated: truncated };
      });
      return okResult(ctx, {
        ok: true,
        session: { ...session, messages: tail },
        messageCount: messages.length,
        returnedMessages: tail.length,
      });
    },
  );

  server.registerTool(
    'list_approvals',
    {
      title: 'List approvals',
      description: 'List pending/decided approval records, optionally filtered by project and/or run.',
      inputSchema: {
        projectId: idField('Project ID').optional(),
        runId: idField('Run ID').optional(),
      },
    },
    async ({ projectId, runId }): Promise<ToolResult> => {
      const res = await ctx.http.request(STABLE_ROUTES.listApprovals(projectId, runId));
      if (!res.ok) return companionFailure(ctx, res, 'list_approvals');
      return okResult(ctx, res.data as Record<string, unknown>);
    },
  );
}
