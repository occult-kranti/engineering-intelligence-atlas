/**
 * Tiny DOM helpers. All model/user content is rendered via textContent or
 * document.createElement — never innerHTML — so injected text cannot escape.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const btn = el('button', className, text);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

export function badgeForStatus(status: string, error?: string | null): HTMLSpanElement {
  const cls =
    status === 'succeeded' || status === 'completed' || status === 'approved'
      ? 'ok'
      : status === 'failed' || status === 'cancelled' || status === 'rejected'
        ? 'fail'
        : status === 'running' || status === 'waiting-approval'
          ? 'pass'
          : // Neutral (not alarming yellow) for not-yet-started / undecided states.
            'neutral';
  const badge = el('span', `badge ${cls}`, error ? `${status}: ${error}` : status);
  return badge;
}

export function statusMessage(kind: '' | 'ok' | 'error' | 'warn', message: string): HTMLParagraphElement {
  const p = el('p', `status ${kind}`.trim(), message);
  return p;
}
