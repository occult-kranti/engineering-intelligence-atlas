// Pure deterministic layout helpers for Freeflow. No DOM, bridge or storage.

export interface LRect { x: number; y: number; width: number; height: number }

export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function unionBounds(rects: readonly LRect[], pad = 0): LRect {
  if (!rects.length) return { x: 0, y: 0, width: 1200, height: 800 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width); y1 = Math.max(y1, r.y + r.height);
  }
  return { x: x0 - pad, y: y0 - pad, width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 };
}

/** Row-major grid packing of equal cells starting at origin. */
export function packGrid(count: number, cellW: number, cellH: number, gap: number, columns: number, originX = 0, originY = 0): LRect[] {
  const cols = Math.max(1, Math.floor(columns));
  const out: LRect[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: originX + (i % cols) * (cellW + gap), y: originY + Math.floor(i / cols) * (cellH + gap), width: cellW, height: cellH });
  }
  return out;
}

export function gridColumns(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))));
}

/** Cluster cells laid out around a conference table; radius grows with total folios. */
export function packClusters(sizes: readonly number[], cellW: number, cellH: number, gap: number): { origins: Array<{ x: number; y: number }>; rects: LRect[][] } {
  const n = sizes.length;
  const dims = sizes.map((s) => {
    const cols = gridColumns(s);
    const rows = Math.ceil(s / cols);
    return { cols, w: cols * (cellW + gap) - gap, h: rows * (cellH + gap) - gap };
  });
  const total = sizes.reduce((a, b) => a + b, 0);
  const maxDim = dims.reduce((m, d) => Math.max(m, d.w, d.h), 0);
  const radius = n <= 1 ? 0 : Math.max(maxDim, (n * (maxDim + 200)) / (2 * Math.PI)) + Math.sqrt(total) * 40;
  const origins: Array<{ x: number; y: number }> = [];
  const rects: LRect[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
    const d = dims[i]!;
    const ox = Math.round(Math.cos(a) * radius - d.w / 2);
    const oy = Math.round(Math.sin(a) * radius - d.h / 2);
    origins.push({ x: ox, y: oy });
    rects.push(packGrid(sizes[i]!, cellW, cellH, gap, d.cols, ox, oy));
  }
  return { origins, rects };
}

/** Map normalized 0..1 or native geometry into office world units without mutating state. */
export function mapNative(v: { x: number; y: number; width: number; height: number }, origin: { x: number; y: number }, scale: number): LRect {
  const f = (n: number) => (Number.isFinite(n) ? n : 0);
  return { x: origin.x + f(v.x) * scale, y: origin.y + f(v.y) * scale, width: Math.max(1, f(v.width) * scale), height: Math.max(1, f(v.height) * scale) };
}

export function looksNormalized(rooms: ReadonlyArray<{ x: number; y: number; width: number; height: number }>): boolean {
  return rooms.length > 0 && rooms.every((r) => r.x >= 0 && r.y >= 0 && r.width <= 1.5 && r.height <= 1.5 && r.x + r.width <= 1.5 && r.y + r.height <= 1.5);
}
