"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { boundsOf, fitView, HOME, isHome, MAX_ZOOM, MIN_ZOOM, parseView, PATTERN_MIN_ZOOM, wheelFactor, zoomAround, ZOOM_STEP, type Rect, type View } from "@/components/canvas/view";

/** Presses on these never start a pan: they have their own jobs. */
const OWN = "button, a, input, textarea, select, summary, header, [data-note], [role='dialog'], [role='menu'], [data-no-pan]";

/** A screen point relative to the sheet's origin. */
function localPoint(origin: HTMLElement | null, clientX: number, clientY: number) {
  const o = origin?.getBoundingClientRect();
  return { x: clientX - (o?.left ?? 0), y: clientY - (o?.top ?? 0) };
}

/**
 * Zoom and pan for the page-wide canvas, Excalidraw style.
 * - Ctrl/Cmd + wheel, or a trackpad pinch, zooms around the pointer; Ctrl/Cmd + + / − / 0 and the buttons too.
 * - Dragging empty canvas, or the middle mouse button anywhere, pans.
 * - The plain wheel keeps scrolling the page while the view is at home; once it is zoomed or panned it pans instead.
 * `page` carries the pattern variables; `origin` is the untransformed top-left of the sheet the notes sit on.
 * The view is remembered on this device, per paper (`storageKey`).
 */
export function useCanvasView(page: RefObject<HTMLElement | null>, origin: RefObject<HTMLElement | null>, storageKey: string) {
  const [view, setViewState] = useState<View>(HOME);
  const ref = useRef(view);
  const loaded = useRef(false);

  const setView = useCallback((next: View | ((v: View) => View)) => {
    ref.current = typeof next === "function" ? next(ref.current) : next;
    setViewState(ref.current);
  }, []);

  // Remembered per device; read after mount so the server and first render agree.
  useEffect(() => {
    try {
      setView(parseView(localStorage.getItem(storageKey)));
    } catch {}
    loaded.current = true;
  }, [setView, storageKey]);
  useEffect(() => {
    // The first render after mount still shows home while the restored view is on its way (the ref already
    // holds it): writing then would wipe the saved view, so wait until the state has caught up with the ref.
    if (!loaded.current || view !== ref.current) return;
    try {
      if (isHome(view)) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(view));
    } catch {}
  }, [view, storageKey]);

  // The pattern follows the notes: its tile scales with the zoom and starts where the sheet does, shifted by the pan.
  useLayoutEffect(() => {
    const p = page.current;
    const o = origin.current?.getBoundingClientRect();
    if (!p) return;
    if (!o || o.width === 0) {
      for (const name of ["--canvas-zoom", "--canvas-x", "--canvas-y"]) p.style.removeProperty(name);
      p.removeAttribute("data-far");
      return;
    }
    const r = p.getBoundingClientRect();
    p.style.setProperty("--canvas-zoom", String(view.zoom));
    p.toggleAttribute("data-far", view.zoom < PATTERN_MIN_ZOOM);
    p.style.setProperty("--canvas-x", `${o.left - r.left + view.x}px`);
    p.style.setProperty("--canvas-y", `${o.top - r.top + view.y}px`);
  });

  const zoomBy = (factor: number, at?: { x: number; y: number }) => {
    const centre = at ?? localPoint(origin.current, window.innerWidth / 2, window.innerHeight / 2);
    setView((v) => zoomAround(v, v.zoom * factor, centre));
  };
  const reset = () => setView(HOME);
  /** Shifts the view by screen pixels (the edge auto-pan while a note is carried). */
  const panBy = useCallback((dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy })), [setView]);
  /** Zooms and pans so every note is on screen; with no notes, back home. */
  const fit = () => {
    const o = origin.current?.getBoundingClientRect();
    const notes = [...(page.current?.querySelectorAll<HTMLElement>("[data-note]") ?? [])];
    if (!o || !notes.length) return setView(HOME);
    const v = ref.current;
    const rects: Rect[] = notes.map((n) => {
      const r = n.getBoundingClientRect();
      const at = (x: number, y: number) => ({ x: (x - o.left - v.x) / v.zoom, y: (y - o.top - v.y) / v.zoom });
      const a = at(r.left, r.top);
      const b = at(r.right, r.bottom);
      return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
    });
    const bounds = boundsOf(rects);
    if (bounds) setView(fitView(bounds, { w: window.innerWidth, h: window.innerHeight }, { x: o.left, y: o.top }));
  };
  // The listeners below are bound once; they call the latest of these.
  const api = useRef({ zoomBy, reset });
  useLayoutEffect(() => {
    api.current = { zoomBy, reset };
  });

  useEffect(() => {
    const el = page.current;
    if (!el) return;
    const hasSheet = () => !!origin.current && origin.current.getBoundingClientRect().width > 0;

    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement | null)?.closest("textarea, input, select, [role='dialog']")) return;
      if (!hasSheet()) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        api.current.zoomBy(wheelFactor(e.deltaY), localPoint(origin.current, e.clientX, e.clientY));
      } else if (!isHome(ref.current)) {
        e.preventDefault();
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const target = e.target as HTMLElement | null;
      const middle = e.button === 1;
      if (!middle && (e.button !== 0 || target?.closest(OWN))) return;
      if (!hasSheet()) return;
      e.preventDefault();
      let last = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = "grabbing";
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - last.x;
        const dy = ev.clientY - last.y;
        last = { x: ev.clientX, y: ev.clientY };
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      };
      const stop = () => {
        document.body.style.cursor = "";
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    };

    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!hasSheet()) return;
      if (e.key === "=" || e.key === "+") api.current.zoomBy(ZOOM_STEP);
      else if (e.key === "-" || e.key === "_") api.current.zoomBy(1 / ZOOM_STEP);
      else if (e.key === "0") api.current.reset();
      else return;
      e.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [page, origin, setView]);

  return { view, zoomBy, reset, panBy, fit };
}

/** − 100% + at the bottom right; the percentage puts the view back at home, and "Fit all" shows every note. */
export function ViewControls({ view, onZoom, onReset, onFit }: { view: View; onZoom: (factor: number) => void; onReset: () => void; onFit: () => void }) {
  const btn = "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[14px] font-medium text-mute hover:bg-soft hover:text-ink disabled:opacity-40";
  return (
    <div
      role="group"
      aria-label="Zoom"
      data-no-pan=""
      className="fixed right-4 bottom-4 z-20 flex items-center gap-0.5 rounded-xl border border-line bg-sheet p-1 shadow-[0_8px_24px_-12px_var(--shadow)] max-sm:hidden"
    >
      <button type="button" onClick={() => onZoom(1 / ZOOM_STEP)} disabled={view.zoom <= MIN_ZOOM} aria-label="Zoom out" title="Zoom out (Ctrl/⌘ −)" className={btn}>
        −
      </button>
      <button type="button" onClick={onReset} aria-label="Reset the view to 100%" title="Reset view (Ctrl/⌘ 0)" className={`${btn} w-14 tabular-nums`}>
        {Math.round(view.zoom * 100)}%
      </button>
      <button type="button" onClick={() => onZoom(ZOOM_STEP)} disabled={view.zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in (Ctrl/⌘ +)" className={btn}>
        +
      </button>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
      <button type="button" onClick={onFit} aria-label="Fit all notes on screen" title="Fit all notes on screen" className={btn}>
        Fit all
      </button>
    </div>
  );
}
