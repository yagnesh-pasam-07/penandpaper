/**
 * Free arrangement on the canvas. Positions are bubble centres: x as a share of
 * the reading column's width (so a layout survives a narrower window; 0 is the
 * column's left edge, 1 its right, and notes dragged out to the sides have a
 * share below 0 or above 1), y in pixels from the top. Pure, so the browser and
 * the tests share it.
 */

export type Size = { w: number; h: number };
export type Point = { x: number; y: number };
/** A bubble on screen, in pixels, centre-based. */
export type Box = Point & Size;
/** The reading column's place on the canvas: where its left edge is, and how wide it is (px). */
export type Column = { left: number; width: number };

/** Widest the column gets; the canvas itself is as wide as the page. */
export const COLUMN_MAX = 1056;
/** Page gutter either side of the column. */
const GUTTER = 32;

/** The column on a canvas as wide as `width`: centred, never wider than COLUMN_MAX. Whole-width when `fill` is false. */
export function columnOf(width: number, fill = true): Column {
  if (!fill) return { left: 0, width };
  const w = Math.max(240, Math.min(width - GUTTER * 2, COLUMN_MAX));
  return { left: (width - w) / 2, width: w };
}

/** What gets saved for a bubble's centre: x as a share of the column, y without the group's lift. */
export function savedSpot(b: Point, column: Column, lift: number): Point {
  return { x: (b.x - column.left) / column.width, y: Math.round(b.y - lift) };
}

/** Dot spacing of `.dot-grid`; dots sit at 12, 36, 60, … */
export const GRID = 24;
/** How close (px) an edge or centre must come before it snaps to a neighbour. */
export const MAGNET = 14;
const PAD = 24;
/** Kept clear at the sheet's sides, and more at the top for a bubble's hover buttons. */
const EDGE = 12;
const EDGE_TOP = 22;
const GAP_X = 32;
const GAP_Y = 28;

const left = (b: Box) => b.x - b.w / 2;
const right = (b: Box) => b.x + b.w / 2;
const top = (b: Box) => b.y - b.h / 2;
const bottom = (b: Box) => b.y + b.h / 2;

/**
 * Where every bubble goes. Bubbles nobody has moved (new drops) flow in
 * centred rows at the top, right under the input; the arranged ones keep their
 * shape below them. `lift` is how far the arranged group was shifted to sit
 * there (display y = saved y + lift); pass it back to hold the group still,
 * e.g. while dragging.
 */
export function layout(
  items: { id: string; size: Size; at: Point | null }[],
  width: number,
  lift?: number,
  column: Column = { left: 0, width },
): { boxes: Map<string, Box>; lift: number } {
  const boxes = new Map<string, Box>();

  const rows: (Box & { id: string })[][] = [];
  let row: (Box & { id: string })[] = [];
  let x = PAD;
  let y = EDGE_TOP;
  let rowH = 0;
  for (const it of items) {
    if (it.at) continue;
    const { w, h } = it.size;
    if (x + w > column.width - PAD && row.length) {
      rows.push(row);
      row = [];
      x = PAD;
      y += rowH + GAP_Y;
      rowH = 0;
    }
    row.push({ id: it.id, x: x + w / 2, y: y + h / 2, w, h });
    x += w + GAP_X;
    rowH = Math.max(rowH, h);
  }
  if (row.length) rows.push(row);
  for (const r of rows) {
    const shift = column.left + (column.width - (right(r[r.length - 1]) - left(r[0]))) / 2 - left(r[0]);
    for (const { id, ...b } of r) boxes.set(id, clamp({ ...b, x: b.x + shift }, width));
  }
  const flowBottom = rows.length ? y + rowH + GAP_Y : EDGE_TOP;

  const placed = items.filter((it) => it.at);
  const tops = placed.map((it) => it.at!.y - it.size.h / 2);
  const natural = tops.length ? flowBottom - Math.min(...tops) : 0;
  const shift = lift ?? natural;
  for (const it of placed) {
    boxes.set(it.id, clamp({ x: column.left + it.at!.x * column.width, y: it.at!.y + shift, ...it.size }, width));
  }
  return { boxes, lift: shift };
}

/** Keeps a bubble wholly on the canvas. */
function clamp(b: Box, width: number): Box {
  const lo = b.w / 2 + EDGE;
  const x = Math.min(Math.max(b.x, lo), Math.max(lo, width - b.w / 2 - EDGE));
  return { ...b, x, y: Math.max(b.y, b.h / 2 + EDGE_TOP) };
}

const toDot = (v: number) => Math.round((v - GRID / 2) / GRID) * GRID + GRID / 2;

/** One axis: the nearest neighbour line within MAGNET, as [new centre, guide line]. */
function pull(centre: number, half: number, others: Box[], axis: "x" | "y"): [number, number] | null {
  let best: [number, number, number] | null = null;
  for (const o of others) {
    const c = o[axis];
    const lo = axis === "x" ? left(o) : top(o);
    const hi = axis === "x" ? right(o) : bottom(o);
    const options: [number, number][] = [
      [c, c], // centres line up
      [lo + half, lo], // start edges
      [hi - half, hi], // end edges
    ];
    for (const [to, line] of options) {
      const d = Math.abs(to - centre);
      if (d <= MAGNET && (!best || d < best[0])) best = [d, to, line];
    }
  }
  return best ? [best[1], best[2]] : null;
}

/**
 * Where a dragged bubble settles: it lines up with a neighbour's centre or
 * edge when close (the guide lines show which), otherwise clicks onto the dots.
 */
export function snap(box: Box, others: Box[], width: number): { box: Box; guides: { x?: number; y?: number } } {
  const gx = pull(box.x, box.w / 2, others, "x");
  const gy = pull(box.y, box.h / 2, others, "y");
  const snapped = clamp({ ...box, x: gx ? gx[0] : toDot(box.x), y: gy ? gy[0] : toDot(box.y) }, width);
  return { box: snapped, guides: { x: gx?.[1], y: gy?.[1] } };
}
