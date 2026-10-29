/**
 * The canvas view: how far it is zoomed and where it has been panned to.
 * A canvas point p sits on screen at `origin + pan + zoom * p`, where the
 * origin is the top-left of the untransformed sheet. View only: saved note
 * positions never change when the view does.
 */
export type View = { zoom: number; x: number; y: number };

export const MIN_ZOOM = 0.1;
/** Below this the pattern would just be a grey wash, so the page hides it. */
export const PATTERN_MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;
/** Each step of the − / + buttons and keys. */
export const ZOOM_STEP = 1.2;
export const HOME: View = { zoom: 1, x: 0, y: 0 };

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const isHome = (v: View) => v.zoom === 1 && v.x === 0 && v.y === 0;

/** A point on screen (relative to the sheet's origin) as a point on the canvas. */
export function toCanvas(v: View, s: { x: number; y: number }): { x: number; y: number } {
  return { x: (s.x - v.x) / v.zoom, y: (s.y - v.y) / v.zoom };
}

/** Zooms to `zoom`, keeping the canvas point under `at` (relative to the sheet's origin) where it is. */
export function zoomAround(v: View, zoom: number, at: { x: number; y: number }): View {
  const z = clampZoom(zoom);
  const p = toCanvas(v, at);
  return { zoom: z, x: at.x - z * p.x, y: at.y - z * p.y };
}

/** A box on the canvas, as its edges. */
export type Rect = { minX: number; minY: number; maxX: number; maxY: number };

/** The smallest rectangle holding all of `rects`, or null when there are none. */
export function boundsOf(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  return {
    minX: Math.min(...rects.map((r) => r.minX)),
    minY: Math.min(...rects.map((r) => r.minY)),
    maxX: Math.max(...rects.map((r) => r.maxX)),
    maxY: Math.max(...rects.map((r) => r.maxY)),
  };
}

/**
 * The view that shows `bounds` (canvas units) whole: as zoomed in as fits (never past `maxZoom`),
 * centred in what's left of the window after the header (`top`) and the controls (`bottom`).
 * `origin` is the sheet's untransformed top-left on screen.
 */
export function fitView(
  bounds: Rect,
  window: { w: number; h: number },
  origin: { x: number; y: number },
  { pad = 48, top = 88, bottom = 72, maxZoom = 1 }: { pad?: number; top?: number; bottom?: number; maxZoom?: number } = {},
): View {
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const availW = Math.max(1, window.w - pad * 2);
  const availH = Math.max(1, window.h - top - bottom - pad * 2);
  const zoom = clampZoom(Math.min(availW / bw, availH / bh, maxZoom));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const targetX = window.w / 2;
  const targetY = top + (window.h - top - bottom) / 2;
  return { zoom, x: targetX - origin.x - zoom * cx, y: targetY - origin.y - zoom * cy };
}

/**
 * How far to shift the view each frame while a note is dragged near the window's edge, so it can be
 * carried past one screen. Positive x means the content moves right (revealing what is to the left).
 * Zero in the middle; ramps up the closer the pointer gets to an edge.
 */
export function autoPanVelocity(
  pointer: { x: number; y: number },
  window: { w: number; h: number },
  { margin = 72, max = 22 }: { margin?: number; max?: number } = {},
): { x: number; y: number } {
  const ramp = (depth: number) => Math.round(Math.min(1, Math.max(0, depth / margin)) ** 2 * max);
  const axis = (p: number, size: number) => ramp(margin - p) - ramp(margin - (size - p));
  return { x: axis(pointer.x, window.w), y: axis(pointer.y, window.h) };
}

/** A wheel tick's zoom factor: smooth for a trackpad's small deltas, steady for a mouse wheel's big ones. */
export function wheelFactor(deltaY: number): number {
  return Math.exp(-Math.max(-25, Math.min(25, deltaY)) * 0.01);
}

/** Where a paper's view is remembered on this device: each paper keeps its own zoom and pan. */
export const viewKey = (paperId: string) => `pp-drop-view:${paperId}`;

/** Reads a saved view, or home if it's missing or wrong. */
export function parseView(raw: string | null): View {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<View> | null;
    if (v && [v.zoom, v.x, v.y].every((n) => typeof n === "number" && Number.isFinite(n))) {
      return { zoom: clampZoom(v.zoom!), x: v.x!, y: v.y! };
    }
  } catch {}
  return HOME;
}
