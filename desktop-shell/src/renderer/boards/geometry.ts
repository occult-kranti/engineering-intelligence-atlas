import { screenToWorld, type Camera, type Point, type Size } from '../freeflow/camera.js';

export interface BoardMap { originX: number; originY: number; scaleX: number; scaleY: number }
export const BOARD_HEIGHT = 620;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** One normalized mapping for paint, preview and save. The whole card stays on its board. */
export function cardMap(room: { x: number; y: number; width: number; height: number }, board: Size, card: Size): BoardMap {
  const width = Math.max(1, board.width), height = Math.max(1, board.height);
  const marginX = Math.min(16, Math.max(0, (width - card.width) / 2));
  const marginY = Math.min(16, Math.max(0, (height - card.height) / 2));
  const right = Math.max(marginX, width - card.width - marginX);
  const bottom = Math.max(marginY, height - card.height - marginY);
  const x = clamp(room.x * width, marginX, right), y = clamp(room.y * height, marginY, bottom);
  return {
    originX: x / width, originY: y / height,
    scaleX: Math.max(0, Math.min(room.width * width * .55, right - x)) / width,
    scaleY: Math.max(0, Math.min(room.height * height * .55, bottom - y)) / height,
  };
}

/** Screen points are relative to the same canvas viewport; panels share its z=0 plane. */
export function projectedDelta(camera: Camera, viewport: Size, from: Point, to: Point): Point {
  const a = screenToWorld(camera, viewport, from), b = screenToWorld(camera, viewport, to);
  return { x: b.x - a.x, y: b.y - a.y };
}

export function moveOnBoard(start: Point, delta: Point, board: Size, map: BoardMap, max: Point = { x: 1, y: 1 }): Point {
  return {
    x: clamp(start.x + (map.scaleX > 0 ? delta.x / Math.max(1, board.width) / map.scaleX : 0), 0, max.x),
    y: clamp(start.y + (map.scaleY > 0 ? delta.y / Math.max(1, board.height) / map.scaleY : 0), 0, max.y),
  };
}

export function boardPoint(point: Point, map: BoardMap): Point {
  return { x: map.originX + point.x * map.scaleX, y: map.originY + point.y * map.scaleY };
}
