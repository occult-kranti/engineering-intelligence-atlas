import { describe, expect, it } from 'vitest';
import {
  assertLoopbackUrl,
  baseUrlFor,
  normalizeLoopbackHost,
  parseBridgeAddress,
  parsePort,
  seg,
} from '../src/bridge/url.js';

describe('loopback host validation', () => {
  it('accepts 127.0.0.1, localhost, [::1], ::1', () => {
    expect(normalizeLoopbackHost('127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeLoopbackHost(' localhost ')).toBe('localhost');
    expect(normalizeLoopbackHost('[::1]')).toBe('[::1]');
    expect(normalizeLoopbackHost('::1')).toBe('[::1]');
    expect(normalizeLoopbackHost('LOCALHOST')).toBe('localhost');
  });

  it('rejects non-loopback hosts', () => {
    for (const h of ['0.0.0.0', 'example.com', '192.168.1.10', '10.0.0.5', '127.0.0.2', 'localhost.evil.com', '']) {
      expect(normalizeLoopbackHost(h), h).toBeNull();
    }
  });
});

describe('port parsing', () => {
  it('accepts valid ports', () => {
    expect(parsePort('1')).toBe(1);
    expect(parsePort('4777')).toBe(4777);
    expect(parsePort('65535')).toBe(65535);
  });
  it('rejects invalid ports', () => {
    for (const p of ['0', '65536', '-1', 'abc', '4.5', '', '  ', '080x']) {
      expect(parsePort(p), p).toBeNull();
    }
  });
});

describe('bridge address + base url', () => {
  it('builds a loopback base url', () => {
    const addr = parseBridgeAddress('127.0.0.1', '4777');
    expect(addr).toEqual({ host: '127.0.0.1', port: 4777 });
    expect(baseUrlFor(addr!)).toBe('http://127.0.0.1:4777');
  });
  it('refuses non-loopback pairs', () => {
    expect(parseBridgeAddress('example.com', '4777')).toBeNull();
    expect(parseBridgeAddress('127.0.0.1', '99999')).toBeNull();
  });
});

describe('assertLoopbackUrl (defense in depth)', () => {
  it('accepts loopback http urls', () => {
    expect(assertLoopbackUrl('http://127.0.0.1:4777/v1/health').hostname).toBe('127.0.0.1');
    expect(assertLoopbackUrl('http://localhost:4777/v1/health').hostname).toBe('localhost');
    expect(assertLoopbackUrl('http://[::1]:4777/v1/health').hostname).toBe('[::1]');
  });
  it('rejects remote hosts, credentials, and other schemes', () => {
    expect(() => assertLoopbackUrl('http://example.com/v1/health')).toThrow(/loopback/);
    expect(() => assertLoopbackUrl('http://user:pass@127.0.0.1:4777/v1/health')).toThrow(/credentials/);
    expect(() => assertLoopbackUrl('file:///etc/passwd')).toThrow(/http/);
    expect(() => assertLoopbackUrl('gopher://127.0.0.1/')).toThrow(/http/);
    expect(() => assertLoopbackUrl('http://169.254.169.254/latest')).toThrow(/loopback/);
  });
});

describe('path segment encoding', () => {
  it('encodes ids safely', () => {
    expect(seg('abc123')).toBe('abc123');
    expect(seg('a/b?c&d')).toBe('a%2Fb%3Fc%26d');
    expect(seg('../..')).toBe('..%2F..');
  });
});
