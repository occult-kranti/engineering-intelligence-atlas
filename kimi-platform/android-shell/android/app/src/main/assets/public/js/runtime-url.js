/**
 * Runtime URL normalization and validation for the Research Director shell.
 *
 * Pure module: no DOM, no Capacitor imports — shared by the launcher WebView
 * and the Node test suite.
 *
 * Policy:
 *  - HTTPS is accepted for any host.
 *  - HTTP (cleartext) is accepted only for loopback/development hosts:
 *    localhost, *.localhost, 127.0.0.0/8, [::1], and the Android emulator
 *    host alias 10.0.2.2.
 *  - Every other scheme (file:, javascript:, intent:, data:, ...) is rejected.
 *  - Embedded credentials (user:pass@host) are rejected — the shell must never
 *    persist secrets.
 */

const LOOPBACK_HOSTNAMES = new Set(['localhost', 'ip6-localhost']);

/** True when the URL's host is a loopback/development target. */
export function isDevelopmentHost(url) {
  const host = (url.hostname || '').toLowerCase();
  if (LOOPBACK_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.localhost')) return true;
  if (host === '[::1]' || host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  if (host === '10.0.2.2') return true; // Android emulator -> host machine
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return host.split('.').every((octet) => Number(octet) <= 255);
  }
  return false;
}

function fail(error) {
  return { ok: false, error };
}

/**
 * Normalize and validate user input into a runtime URL.
 *
 * @param {string} input raw user input, e.g. "director.example.com/app"
 * @returns {{ok:true, url:string, usesCleartext:boolean} | {ok:false, error:string}}
 */
export function normalizeRuntimeUrl(input) {
  if (typeof input !== 'string') return fail('Enter the URL of a running Research Director server.');
  let text = input.trim();
  if (!text) return fail('Enter the URL of a running Research Director server.');

  // Reject any explicit non-http(s) scheme before guessing.
  const schemeMatch = text.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'https' && scheme !== 'http') {
      return fail(`Unsupported scheme "${scheme}:" — only https:// is allowed (http:// only on localhost).`);
    }
  } else {
    // No scheme: default to HTTPS.
    text = `https://${text}`;
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    return fail('That does not look like a valid URL. Example: https://director.example.com');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return fail('Only https:// URLs are allowed (http:// only on localhost).');
  }

  if (url.username || url.password) {
    return fail('Do not embed usernames or passwords in the URL. Sign in on the server page instead.');
  }

  if (!url.hostname) return fail('The URL must include a host, e.g. https://director.example.com');

  const usesCleartext = url.protocol === 'http:';
  if (usesCleartext && !isDevelopmentHost(url)) {
    return fail(
      'Insecure http:// is only allowed for localhost development. Use https:// for a remote runtime.',
    );
  }

  // Normalize: drop default ports, keep path/query/hash as entered.
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }

  return { ok: true, url: url.href, usesCleartext };
}

/** True when a stored value should be offered again on launch. */
export function isPersistableRuntimeUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  return normalizeRuntimeUrl(value).ok;
}
