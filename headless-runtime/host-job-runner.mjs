/** Runs inside its own tmux session. Never import a provider or controller token.
 * The intentional bash command has the OS privileges of the runtime owner.
 * Process groups clean up ordinary descendants, not a hostile root daemon. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { atomicJson, hash, LIMITS, object, privateDirectory, processIdentity, readJson, request, safeEnvironment } from './host-control-contract.mjs';

export async function runHostJob(jobDir) {
  if (typeof jobDir !== 'string' || !path.isAbsolute(jobDir)) throw new Error('Invalid job directory');
  privateDirectory(jobDir);
  const spec = readJson(path.join(jobDir, 'spec.json'), LIMITS.commandBytes + 16384);
  if (!object(spec) || spec.version !== 1 || !/^[a-f0-9]{64}$/.test(spec.nonce) || !object(spec.request)) throw new Error('Invalid job specification');
  const input = request(spec.request);
  if (spec.requestHash !== hash(JSON.stringify(input))) throw new Error('Invalid job request hash');
  // Exclusive creation makes a second accidental invocation fail without running.
  const logFd = fs.openSync(path.join(jobDir, 'output.log'), fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  const startedAt = new Date().toISOString();
  let child; let bytes = 0; let reason = null; let finished = false; let timeout; let poll; let escalation;
  const metadata = { version: 1, nonce: spec.nonce, pid: process.pid, identity: processIdentity(process.pid), childPid: null, childIdentity: null, startedAt };
  atomicJson(path.join(jobDir, 'runner.json'), metadata);
  const signalGroup = signal => {
    if (!child?.pid) return;
    try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const stop = why => {
    if (finished || reason) return;
    reason = why;
    signalGroup('SIGTERM');
    escalation = setTimeout(() => signalGroup('SIGKILL'), 700);
  };
  const onSignal = () => stop('runner_signal');
  process.on('SIGTERM', onSignal); process.on('SIGINT', onSignal);
  return new Promise(resolve => {
    const complete = (code, spawnFailed = false) => {
      if (finished) return;
      finished = true; clearTimeout(timeout); clearInterval(poll); clearTimeout(escalation);
      // A shell can exit while a background descendant retains stdout. Kill its
      // original process group on exit, then close our streams and durable log.
      signalGroup('SIGKILL'); child?.stdout?.destroy(); child?.stderr?.destroy();
      process.off('SIGTERM', onSignal); process.off('SIGINT', onSignal);
      fs.fsyncSync(logFd); fs.closeSync(logFd);
      const status = reason === 'cancelled' || reason === 'runner_signal' ? 'cancelled'
        : reason === 'timed_out' ? 'timed_out' : reason === 'output_limit' ? 'output_limit'
        : spawnFailed || code !== 0 ? 'failed' : 'completed';
      const result = { version: 1, nonce: spec.nonce, status, exitCode: Number.isInteger(code) ? code : null,
        reason: reason ?? (spawnFailed ? 'spawn_failed' : code === 0 ? null : 'exit_nonzero'),
        startedAt, finishedAt: new Date().toISOString(), outputBytes: bytes };
      atomicJson(path.join(jobDir, 'result.json'), result); resolve(result);
    };
    const consume = chunk => {
      if (finished) return;
      const available = input.maxOutputBytes - bytes;
      if (available > 0) { const part = chunk.subarray(0, available); fs.writeSync(logFd, part); bytes += part.length; }
      if (chunk.length > available) stop('output_limit');
    };
    try {
      const cancellation = readJson(path.join(jobDir, 'cancel.json'), 1024, true);
      if (cancellation?.nonce === spec.nonce) { reason = 'cancelled'; complete(null); return; }
      child = spawn('/bin/bash', ['--noprofile', '--norc', '-c', input.command], {
        cwd: input.cwd, env: safeEnvironment(), shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe']
      });
      metadata.childPid = child.pid ?? null; metadata.childIdentity = child.pid ? processIdentity(child.pid) : null;
      atomicJson(path.join(jobDir, 'runner.json'), metadata);
      child.stdout.on('data', consume); child.stderr.on('data', consume);
      child.on('error', () => complete(null, true));
      // 'exit' fires independently of inherited output pipes. Drain buffered data
      // before finalizing; background pipe holders are killed before waiting.
      child.on('exit', code => { signalGroup('SIGKILL'); child.once('close', () => complete(code)); });
      timeout = setTimeout(() => stop('timed_out'), input.timeoutSeconds * 1000);
      poll = setInterval(() => {
        try { if (readJson(path.join(jobDir, 'cancel.json'), 1024, true)?.nonce === spec.nonce) stop('cancelled'); }
        catch { stop('runner_signal'); }
      }, 150);
    } catch { complete(null, true); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runHostJob(process.argv[2]); }
  catch { process.stderr.write('Host job runner could not start safely.\n'); process.exitCode = 1; }
}
