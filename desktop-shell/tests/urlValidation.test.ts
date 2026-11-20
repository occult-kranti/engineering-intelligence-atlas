import { describe, expect, it } from 'vitest';
import { normalizeRuntimeUrl, validateExternalUrl, UrlValidationError } from '../src/main/urlValidation';

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
