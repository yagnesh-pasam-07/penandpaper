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

/* ---------- Loops, shapes and selection ---------- */

/** The smallest box around the points. */
export function boundsOfPoints(points: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * A line that comes back to where it started is a loop: a ring drawn round a
 * group of things (like a person's column on a planning paper). The ends must
 * meet within a quarter of its size (at least 40 px), and it must be big enough
 * to hold something.
 */
export function isLoop(points: Pt[]): boolean {
  if (points.length < 8) return false;
  const b = boundsOfPoints(points);
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  if (size < 60) return false;
  const [ax, ay] = points[0];
  const [zx, zy] = points[points.length - 1];
  return Math.hypot(zx - ax, zy - ay) <= Math.max(40, size * 0.25);
}

/** Whether `p` is inside the closed polygon (ray casting; the gap between the ends is closed). */
export function insidePolygon(p: Point, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The outline a shape is drawn as, for hit tests and "what's inside" (an ellipse as 48 points). */
export function shapeOutline(shape: "rect" | "ellipse", corners: Pt[]): Pt[] {
  const [[x1, y1], [x2, y2]] = corners.length >= 2 ? corners : [corners[0], corners[0]];
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  if (shape === "rect") return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]];
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
  return Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt;
  });
}

/** Shape corners as given while dragging: Shift keeps it a square or circle. */
export function shapeCorners(from: Point, to: Point, even: boolean): Pt[] {
  if (!even) return [[from.x, from.y], [to.x, to.y]];
  const d = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  return [[from.x, from.y], [from.x + Math.sign(to.x - from.x || 1) * d, from.y + Math.sign(to.y - from.y || 1) * d]];
}

/**
 * A hand-drawn path for a shape: each side bows a little and the pen
 * overshoots where it closes, seeded so it looks the same every time.
 */
export function handShapePath(shape: "rect" | "ellipse", corners: Pt[], seed: string): string {
  const r = (k: number) => {
    let h = 0x811c9dc5 ^ k;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
    return ((h >>> 0) / 0xffffffff - 0.5) * 2;
  };
  const b = boundsOfPoints(corners.length >= 2 ? corners : [corners[0], corners[0]]);
  const w = b.maxX - b.minX, h = b.maxY - b.minY;
  const wob = Math.min(3, Math.max(w, h) * 0.015);
  const f = (n: number) => Math.round(n * 10) / 10;
  if (shape === "rect") {
    const c: Pt[] = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]];
    const j = c.map(([x, y], i) => [x + r(i * 2) * wob, y + r(i * 2 + 1) * wob] as Pt);
    let d = `M${f(j[0][0])} ${f(j[0][1])}`;
    for (let i = 1; i <= 4; i++) {
      const [px, py] = j[i - 1];
      const [x, y] = j[i % 4];
      const mx = (px + x) / 2 + r(10 + i) * wob, my = (py + y) / 2 + r(20 + i) * wob;
      d += `Q${f(mx)} ${f(my)} ${f(x)} ${f(y)}`;
    }
    // A little overshoot past the first corner, as a pen does.
    const [ox, oy] = j[1];
    return `${d}L${f(j[0][0] + (ox - j[0][0]) * 0.06)} ${f(j[0][1] + (oy - j[0][1]) * 0.06)}`;
  }
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2, rx = w / 2, ry = h / 2;
  const start = r(1) * Math.PI;
  const pts: Pt[] = Array.from({ length: 27 }, (_, i) => {
    const a = start + (i / 24) * Math.PI * 2;
    const k = 1 + r(30 + (i % 24)) * 0.015;
    return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)];
  });
  return pathOf(pts);
}

/** Moves every point by (dx, dy). */
export const shift = (points: Pt[], dx: number, dy: number): Pt[] => points.map(([x, y]) => [Math.round((x + dx) * 10) / 10, Math.round((y + dy) * 10) / 10]);
