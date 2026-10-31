/**
 * Ink on the canvas: freehand lines, and connectors (a line whose ends are tied
 * to things on the paper). Pure geometry, shared by the canvas and the tests.
 * Points are canvas px, the sheet's own (untransformed) units.
 */
import type { Box, Point } from "./arrange";

export type Pt = [number, number];

/** Drops points closer than `min` px to the last one kept, so a slow hand doesn't make a heavy line. */
export function thin(points: Pt[], min = 2): Pt[] {
  if (points.length < 3) return points;
  const out: Pt[] = [points[0]];
  for (const p of points.slice(1, -1)) {
    const [lx, ly] = out[out.length - 1];
    if (Math.hypot(p[0] - lx, p[1] - ly) >= min) out.push(p);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Rounds to 0.1 px: smaller to save, and nobody can see the difference. */
export const round = (points: Pt[]): Pt[] => points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);

/** A smooth SVG path through the points (midpoint quadratic curves), as a pen would draw it. */
export function pathOf(points: Pt[]): string {
  if (!points.length) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M${x} ${y}l0.01 0`;
  }
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d}L${lx} ${ly}`;
}

/** How near (px) an end must be to a thing's edge to tie onto it. */
export const TIE_REACH = 14;

/** The thing whose box holds `p` (with a little reach), the smallest one when they overlap; null on bare paper. */
export function hitThing(p: Point, boxes: Map<string, Box>, reach = TIE_REACH): string | null {
  let best: { id: string; area: number } | null = null;
  for (const [id, b] of boxes) {
    if (Math.abs(p.x - b.x) <= b.w / 2 + reach && Math.abs(p.y - b.y) <= b.h / 2 + reach) {
      const area = b.w * b.h;
      if (!best || area < best.area) best = { id, area };
    }
  }
  return best?.id ?? null;
}

/**
 * Where a connector meets the edge of a box, on the way from the box's centre
 * towards `toward`: a line looks tied on, not stabbed into the middle.
 */
export function edgePoint(b: Box, toward: Point, gap = 6): Point {
  const dx = toward.x - b.x;
  const dy = toward.y - b.y;
  if (!dx && !dy) return { x: b.x, y: b.y };
  const hw = b.w / 2 + gap;
  const hh = b.h / 2 + gap;
  const k = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: b.x + dx * k, y: b.y + dy * k };
}

/**
 * The line as it should show now. A free line is as drawn. A tied end follows
 * its thing: the drawn shape is kept, stretched and turned so its ends land on
 * the edges of what it connects, wherever those things have moved to.
 */
export function placeStroke(points: Pt[], from: Box | null, to: Box | null): Pt[] {
  if (points.length < 2 || (!from && !to)) return points;
  const a: Point = { x: points[0][0], y: points[0][1] };
  const z: Point = { x: points[points.length - 1][0], y: points[points.length - 1][1] };
  // Aim each tied end at the other end (its thing's centre when tied), then stop at the edge.
  const farA = to ? { x: to.x, y: to.y } : z;
  const farZ = from ? { x: from.x, y: from.y } : a;
  const A = from ? edgePoint(from, farA) : a;
  const Z = to ? edgePoint(to, farZ) : z;
  return mapEnds(points, a, z, A, Z);
}

/** Moves every point so the line's ends go from (a, z) to (A, Z): a stretch, a turn and a shift. */
export function mapEnds(points: Pt[], a: Point, z: Point, A: Point, Z: Point): Pt[] {
  const vx = z.x - a.x;
  const vy = z.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-6) {
    // A dot or a closed loop: just shift it.
    return points.map(([x, y]) => [x + A.x - a.x, y + A.y - a.y]);
  }
  const Vx = Z.x - A.x;
  const Vy = Z.y - A.y;
  // The complex ratio V / v: scale and rotation in one.
  const re = (Vx * vx + Vy * vy) / len2;
  const im = (Vy * vx - Vx * vy) / len2;
  return points.map(([x, y]) => {
    const px = x - a.x;
    const py = y - a.y;
    return [A.x + px * re - py * im, A.y + px * im + py * re];
  });
}

/** Distance from p to the segment a–b. */
function toSegment(p: Point, a: Pt, b: Pt): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a[0]) * vx + (p.y - a[1]) * vy) / len2)) : 0;
  return Math.hypot(p.x - (a[0] + t * vx), p.y - (a[1] + t * vy));
}

/** Whether `p` is within `reach` px of the line: for the eraser and for picking a line. */
export function nearStroke(p: Point, points: Pt[], reach = 8): boolean {
  if (points.length === 1) return Math.hypot(p.x - points[0][0], p.y - points[0][1]) <= reach;
  for (let i = 1; i < points.length; i++) if (toSegment(p, points[i - 1], points[i]) <= reach) return true;
  return false;
}

/** The angle (radians) the line is heading at its end, for an arrowhead; null for a dot. */
export function endAngle(points: Pt[]): number | null {
  if (points.length < 2) return null;
  const [lx, ly] = points[points.length - 1];
  // Look back a little, so a last tiny wobble doesn't turn the arrow.
  for (let i = points.length - 2; i >= 0; i--) {
    const [x, y] = points[i];
    if (Math.hypot(lx - x, ly - y) >= 12 || i === 0) return Math.atan2(ly - y, lx - x);
  }
  return null;
}
