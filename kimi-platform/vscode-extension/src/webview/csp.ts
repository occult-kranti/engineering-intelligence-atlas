/**
 * Content-Security-Policy construction for the chat webview. Pure module so
 * the exact policy string is unit-testable.
 */

export function buildChatCsp(nonce: string, cspSource: string): string {
  return [
    `default-src 'none'`,
    // Scripts/styles: only our nonce-tagged tags or files under the
    // extension media folder served via the webview scheme.
    `script-src 'nonce-${nonce}' ${cspSource}`,
    `style-src 'nonce-${nonce}' ${cspSource}`,
    `img-src ${cspSource}`,
    `font-src 'none'`,
    `connect-src 'none'`,
    `frame-src 'none'`,
    `worker-src 'none'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'none'`,
  ].join('; ');
}

export function newNonce(randomHex: () => string): string {
  return randomHex();
}
