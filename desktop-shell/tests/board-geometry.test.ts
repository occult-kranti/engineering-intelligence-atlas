import { describe, expect, it } from 'vitest';
import { boardPoint, cardMap, moveOnBoard, projectedDelta } from '../src/renderer/boards/geometry';
import { DEFAULT_CAMERA, worldToScreen } from '../src/renderer/freeflow/camera';

describe('inner board geometry', () => {
  it.each([.6, 1, 1.25])('inverts outer zoom %s and optional perspective before moving a card', (zoom) => {
    for (const yaw of [-30, 0, 30]) for (const pitch of [0, 42]) {
      const camera = { ...DEFAULT_CAMERA, x: 220, y: 180, zoom, yaw, pitch };
      const viewport = { width: 1366, height: 768 }, a = { x: 400, y: 250 }, b = { x: 480, y: 290 };
      const delta = projectedDelta(camera, viewport, worldToScreen(camera, viewport, a), worldToScreen(camera, viewport, b));
      expect(delta.x).toBeCloseTo(80, 6); expect(delta.y).toBeCloseTo(40, 6);
    }
  });
  it.each([320, 650, 1000])('keeps the complete card inside a %s px board at all normalized extremes', (width) => {
    const board = { width, height: 620 }, card = { width: 223, height: 310 };
    for (const room of [{ x: .05, y: .05, width: .35, height: .35 }, { x: .9, y: .9, width: .5, height: .5 }]) {
      const map = cardMap(room, board, card);
      for (const x of [0, 1]) for (const y of [0, 1]) {
        const point = boardPoint({ x, y }, map);
        expect(point.x * width).toBeGreaterThanOrEqual(0);
        expect(point.x * width + card.width).toBeLessThanOrEqual(width + 1e-8);
        expect(point.y * board.height + card.height).toBeLessThanOrEqual(board.height + 1e-8);
      }
    }
  });
  it('uses exactly the same mapping for preview and canonical coordinates, including collapsed travel', () => {
    const board = { width: 650, height: 620 }, map = cardMap({ x: .1, y: .1, width: .6, height: .6 }, board, { width: 223, height: 250 });
    const start = { x: .2, y: .3 }, next = moveOnBoard(start, { x: 10, y: 15 }, board, map);
    const a = boardPoint(start, map), b = boardPoint(next, map);
    expect((b.x - a.x) * board.width).toBeCloseTo(10); expect((b.y - a.y) * board.height).toBeCloseTo(15);
    expect(moveOnBoard(start, { x: 1e5, y: 1e5 }, board, map)).toEqual({ x: 1, y: 1 });
    expect(moveOnBoard(start, { x: 10, y: 10 }, board, { ...map, scaleX: 0, scaleY: 0 })).toEqual(start);
  });
});
