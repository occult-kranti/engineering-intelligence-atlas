import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig, validateLoopbackUrl } from '../src/config.js';

const env = (url?: string, token = 'tok') =>
  ({
    RESEARCH_DIRECTOR_PAIRING_TOKEN: token,
    ...(url !== undefined ? { RESEARCH_DIRECTOR_COMPANION_URL: url } : {}),
  }) as NodeJS.ProcessEnv;

describe('loopback URL validation (SSRF guard)', () => {
  it('accepts loopback variants', () => {
    expect(validateLoopbackUrl('http://127.0.0.1:4319')).toBe('http://127.0.0.1:4319');
    expect(validateLoopbackUrl('http://localhost:4319')).toBe('http://localhost:4319');
    expect(validateLoopbackUrl('http://[::1]:4319')).toBe('http://[::1]:4319');
    expect(validateLoopbackUrl('http://127.0.0.1')).toBe('http://127.0.0.1');
  });

  it.each([
    'http://example.com',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.5',
    'http://192.168.1.1',
    'http://0.0.0.0:4319',
    'http://127.0.0.1.evil.com',
    'https://127.0.0.1:4319',
    'http://user:pass@127.0.0.1:4319',
    'http://127.0.0.1:4319/proxy',
    'http://127.0.0.1:4319/?x=1',
    'ftp://127.0.0.1',
    'not-a-url',
  ])('rejects %s', (bad) => {
    expect(() => validateLoopbackUrl(bad)).toThrow(ConfigError);
  });

  it('parseConfig defaults to http://127.0.0.1:4319', () => {
    const cfg = parseConfig([], env());
    expect(cfg.baseUrl).toBe('http://127.0.0.1:4319');
    expect(cfg.enableWrites).toBe(false);
    expect(cfg.enableProviderWrites).toBe(false);
  });

  it('parseConfig rejects a non-loopback env URL at startup', () => {
    expect(() => parseConfig([], env('http://evil.internal:9000'))).toThrow(ConfigError);
  });

  it('provider writes require writes too', () => {
    const cfg = parseConfig(['--enable-provider-writes'], env());
    expect(cfg.enableProviderWrites).toBe(false);
    const cfg2 = parseConfig(['--enable-writes', '--enable-provider-writes'], env());
    expect(cfg2.enableProviderWrites).toBe(true);
  });

  it('empty/whitespace token is treated as missing', () => {
    const cfg = parseConfig([], env(undefined, '   '));
    expect(cfg.token).toBeNull();
  });

  it('unknown CLI args are rejected', () => {
    expect(() => parseConfig(['--enable-everything'], env())).toThrow(ConfigError);
  });
});
