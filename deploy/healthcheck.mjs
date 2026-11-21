// Nonsecret liveness check. This does not claim provider readiness or job success.
const port = process.env.DAFTAR_PORT || '8788';
try {
  const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
    redirect: 'error',
    signal: AbortSignal.timeout(3500),
  });
  if (response.status !== 200) process.exitCode = 1;
  await response.body?.cancel();
} catch {
  process.exitCode = 1;
}
