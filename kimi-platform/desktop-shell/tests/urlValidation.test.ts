import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { isAllowedContentNavigation, normalizeRuntimeUrl, validateExternalUrl, UrlValidationError } from '../src/main/urlValidation';

describe('normalizeRuntimeUrl', () => {
  it('accepts https URLs', () => {
    expect(normalizeRuntimeUrl('https://director.example.com')).toBe('https://director.example.com');
    expect(normalizeRuntimeUrl('https://director.example.com/app?q=1')).toBe(
      'https://director.example.com/app?q=1',
    );
  });

  it('strips fragments and trailing root slash', () => {
    expect(normalizeRuntimeUrl('https://director.example.com/#/x')).toBe('https://director.example.com');
    expect(normalizeRuntimeUrl('https://director.example.com/')).toBe('https://director.example.com');
  });

  it('accepts http only for loopback development hosts', () => {
    expect(normalizeRuntimeUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeRuntimeUrl('http://127.0.0.1:8000')).toBe('http://127.0.0.1:8000');
    expect(normalizeRuntimeUrl('http://127.0.0.2:8000')).toBe('http://127.0.0.2:8000');
    expect(normalizeRuntimeUrl('http://[::1]:3000')).toBe('http://[::1]:3000');
    expect(normalizeRuntimeUrl('http://dev.localhost:3000')).toBe('http://dev.localhost:3000');
  });

  it('rejects http for remote hosts', () => {
    expect(() => normalizeRuntimeUrl('http://example.com')).toThrow(UrlValidationError);
    expect(() => normalizeRuntimeUrl('http://192.168.1.10')).toThrow(/local development/);
  });

  it('rejects non-http(s) protocols', () => {
    for (const u of ['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'ws://x']) {
      expect(() => normalizeRuntimeUrl(u)).toThrow(UrlValidationError);
    }
  });

  it('rejects embedded credentials', () => {
    expect(() => normalizeRuntimeUrl('https://user:pass@director.example.com')).toThrow(/credentials/);
  });

  it('rejects unparseable and empty input', () => {
    for (const u of ['', '   ', 'not a url', 'https://', 'ht!tp://x y']) {
      expect(() => normalizeRuntimeUrl(u)).toThrow(UrlValidationError);
    }
  });

  it('rejects whitespace/control characters', () => {
    expect(() => normalizeRuntimeUrl('https://example.com/\ncookie: x')).toThrow(UrlValidationError);
  });
});

describe('validateExternalUrl', () => {
  it('allows http and https', () => {
    expect(validateExternalUrl('https://huggingface.co/a/b')).toContain('https://huggingface.co');
    expect(validateExternalUrl('http://example.com')).toContain('http://example.com');
  });

  it('blocks dangerous schemes', () => {
    for (const u of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x']) {
      expect(() => validateExternalUrl(u)).toThrow(UrlValidationError);
    }
  });

  it('blocks credentials', () => {
    expect(() => validateExternalUrl('https://u:p@example.com')).toThrow(/credentials/);
  });
});

describe('content-view navigation policy', () => {
  const atlasRoot = path.resolve('/atlas-root');
  const runtime = { kind: 'runtime' as const, runtimeOrigin: 'https://director.example.com', atlasRoot: null };
  const loopbackRuntime = { kind: 'runtime' as const, runtimeOrigin: 'http://127.0.0.1:8788', atlasRoot: null };
  const atlas = { kind: 'atlas' as const, runtimeOrigin: null, atlasRoot };

  it('runtime mode allows https only (plus the validated loopback http origin)', () => {
    expect(isAllowedContentNavigation('https://director.example.com/app', runtime)).toBe(true);
    expect(isAllowedContentNavigation('https://other.example.com/', runtime)).toBe(true);
    // Plain http is denied for an https runtime session.
    expect(isAllowedContentNavigation('http://director.example.com/', runtime)).toBe(false);
    // file: is never allowed in runtime mode.
    expect(isAllowedContentNavigation('file:///etc/passwd', runtime)).toBe(false);
    expect(isAllowedContentNavigation('file:///atlas-root/index.html', runtime)).toBe(false);

    // The validated loopback session may navigate its own origin over http.
    expect(isAllowedContentNavigation('http://127.0.0.1:8788/dashboard', loopbackRuntime)).toBe(true);
    // ...but not a different http origin.
    expect(isAllowedContentNavigation('http://127.0.0.1:9999/', loopbackRuntime)).toBe(false);
    expect(isAllowedContentNavigation('http://example.com/', loopbackRuntime)).toBe(false);
  });

  it('atlas mode allows only file paths contained in the atlas root', () => {
    expect(isAllowedContentNavigation(`file://${atlasRoot}/index.html`, atlas)).toBe(true);
    expect(isAllowedContentNavigation(`file://${atlasRoot}/assets/app.js`, atlas)).toBe(true);
    expect(isAllowedContentNavigation(`file://${atlasRoot}-evil/x`, atlas)).toBe(false);
    expect(isAllowedContentNavigation(`file://${atlasRoot}/../secret`, atlas)).toBe(false);
    expect(isAllowedContentNavigation('file:///etc/passwd', atlas)).toBe(false);
    // http(s) is denied in atlas mode (the caller routes it externally).
    expect(isAllowedContentNavigation('https://example.com/', atlas)).toBe(false);
    expect(isAllowedContentNavigation('http://127.0.0.1:8788/', atlas)).toBe(false);
  });

  it('denies everything else and everything with no active content', () => {
    const none = { kind: null, runtimeOrigin: null, atlasRoot: null };
    for (const url of ['about:blank', 'data:text/html,<h1>x</h1>', 'chrome://gpu', 'not a url', 'https://example.com/']) {
      expect(isAllowedContentNavigation(url, none)).toBe(false);
    }
    expect(isAllowedContentNavigation('about:blank', runtime)).toBe(false);
    expect(isAllowedContentNavigation('data:text/html,x', runtime)).toBe(false);
  });
});
