/**
 * The canvas view: how far it is zoomed and where it has been panned to.
 * A canvas point p sits on screen at `origin + pan + zoom * p`, where the
 * origin is the top-left of the untransformed sheet. View only: saved note
 * positions never change when the view does.
 */
export type View = { zoom: number; x: number; y: number };

export const MIN_ZOOM = 0.25;
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
