/**
 * Free arrangement on the dotted sheet. Positions are bubble centres: x as a
 * share of the sheet's width (so a layout survives a narrower window), y in
 * pixels from the top. Pure, so the browser and the tests share it.
 */

export type Size = { w: number; h: number };
export type Point = { x: number; y: number };
/** A bubble on screen, in pixels, centre-based. */
export type Box = Point & Size;

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

function overlaps(a: Box, b: Box, margin = 12): boolean {
  return left(a) < right(b) + margin && right(a) + margin > left(b) && top(a) < bottom(b) + margin && bottom(a) + margin > top(b);
}

/**
 * Where every bubble goes. Moved ones keep their spot; the rest flow in rows
 * around them, in the order given (centred rows when nothing has been moved).
 */
export function layout(
  items: { id: string; size: Size; at: Point | null }[],
  width: number,
): Map<string, Box> {
  const out = new Map<string, Box>();
  const placed: Box[] = [];
  for (const it of items) {
    if (!it.at) continue;
    const box = clamp({ x: it.at.x * width, y: it.at.y, ...it.size }, width);
    out.set(it.id, box);
    placed.push(box);
  }

  const free = items.filter((it) => !it.at);
  const rows: (Box & { id: string })[][] = [];
  let row: (Box & { id: string })[] = [];
  let x = PAD;
  let y = PAD;
  let rowH = 0;
  const newRow = () => {
    if (row.length) rows.push(row);
    row = [];
    x = PAD;
    y += rowH + GAP_Y;
    rowH = 0;
  };
  for (const it of free) {
    const { w, h } = it.size;
    for (let guard = 0; guard < 500; guard++) {
      if (x + w > width - PAD && row.length) {
        newRow();
        continue;
      }
      const box = { x: x + w / 2, y: y + h / 2, w, h };
      const hit = placed.find((p) => overlaps(box, p));
      if (!hit) {
        row.push({ ...box, id: it.id });
        x += w + GAP_X;
        rowH = Math.max(rowH, h);
        break;
      }
      x = right(hit) + GAP_X;
      if (x + w > width - PAD) {
        rowH = Math.max(rowH, 1);
        newRow();
      }
    }
  }
  if (row.length) rows.push(row);

  for (const r of rows) {
    // Nothing moved yet: centre each row, like a fresh sheet.
    const shift = placed.length ? 0 : (width - (right(r[r.length - 1]) - left(r[0]))) / 2 - left(r[0]);
    for (const { id, ...b } of r) out.set(id, { ...b, x: b.x + shift });
  }
  return out;
}

/** Keeps a bubble wholly on the sheet. */
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
