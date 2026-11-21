#!/usr/bin/env node
/**
 * Stdio entrypoint.
 *
 * Logging discipline: stdio is the protocol channel, so ALL diagnostics go to
 * stderr, and the pairing token is NEVER printed (only a short SHA-256
 * fingerprint prefix, matching the desktop's own status surface).
 */

import { createHash } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfigError, HELP_TEXT, parseCliFlags, parseConfig, TOKEN_ENV_VAR, URL_ENV_VAR } from './config.js';
import { buildServer } from './server.js';

function log(message: string): void {
  process.stderr.write(`[research-director-mcp] ${message}\n`);
}

async function main(): Promise<void> {
  let argv: string[] = [];
  try {
    argv = process.argv.slice(2);
    if (parseCliFlags(argv).help) {
      process.stderr.write(HELP_TEXT);
      process.exit(0);
    }
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n\n${HELP_TEXT}`);
    process.exit(2);
  }

  let config;
  try {
    config = parseConfig(argv, process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      log(`configuration error: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }

  if (config.token === null) {
    log(`WARNING: ${TOKEN_ENV_VAR} is not set; every tool call will fail with auth_not_configured until it is provided.`);
  } else {
    const fingerprint = createHash('sha256').update(config.token).digest('hex').slice(0, 12);
    log(`pairing token loaded from env (sha256:${fingerprint}); companion: ${config.baseUrl}`);
  }
  log(
    `writes: ${config.enableWrites ? 'ENABLED (--enable-writes)' : 'disabled'}; provider writes: ${
      config.enableProviderWrites ? 'ENABLED (--enable-provider-writes)' : 'disabled'
    }`,
  );
  void URL_ENV_VAR;

  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('stdio transport connected');
}

main().catch((err: unknown) => {
  // Sanitized fatal path: message only, never the token, never the stack of
  // arbitrary upstream data.
  log(`fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
