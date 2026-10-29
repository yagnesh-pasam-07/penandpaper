import { describe, expect, it } from "vitest";
import { autoPanVelocity, boundsOf, clampZoom, fitView, HOME, isHome, MAX_ZOOM, MIN_ZOOM, parseView, toCanvas, wheelFactor, zoomAround } from "./view";

describe("view", () => {
  it("maps a screen point back to the canvas", () => {
    expect(toCanvas({ zoom: 2, x: 100, y: 40 }, { x: 300, y: 140 })).toEqual({ x: 100, y: 50 });
    expect(toCanvas(HOME, { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
  });
  it("zooms around the cursor: the point under it stays put", () => {
    const at = { x: 400, y: 250 };
    const v0 = { zoom: 1, x: -30, y: 12 };
    const before = toCanvas(v0, at);
    for (const z of [0.5, 1.7, 3]) {
      const v = zoomAround(v0, z, at);
      expect(v.zoom).toBe(z);
      const after = toCanvas(v, at);
      expect(after.x).toBeCloseTo(before.x, 9);
      expect(after.y).toBeCloseTo(before.y, 9);
    }
  });
  it("keeps the zoom between the limits", () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(zoomAround(HOME, 99, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
  });
  it("zooms in when the wheel goes up and out when it goes down, by a bounded amount", () => {
    expect(wheelFactor(-10)).toBeGreaterThan(1);
    expect(wheelFactor(10)).toBeLessThan(1);
    expect(wheelFactor(100000)).toBe(wheelFactor(25));
  });
  it("reads a saved view, falling back to home", () => {
    expect(parseView(JSON.stringify({ zoom: 2, x: 5, y: -5 }))).toEqual({ zoom: 2, x: 5, y: -5 });
    expect(parseView(JSON.stringify({ zoom: 50, x: 0, y: 0 })).zoom).toBe(MAX_ZOOM);
    expect(parseView("nope")).toEqual(HOME);
    expect(parseView(null)).toEqual(HOME);
    expect(isHome(parseView('{"zoom":"2"}'))).toBe(true);
  });

  it("maps screen points to canvas points at several zooms and pans, negative results included", () => {
    for (const v of [
      { zoom: 0.25, x: 300, y: -80 },
      { zoom: 1, x: -500, y: 400 },
      { zoom: 3, x: 900, y: 900 },
    ]) {
      for (const s of [{ x: 0, y: 0 }, { x: 120, y: 60 }, { x: 1700, y: 1000 }]) {
        const c = toCanvas(v, s);
        // The inverse: the canvas point lands back on the same screen point.
        expect(v.x + v.zoom * c.x).toBeCloseTo(s.x, 9);
        expect(v.y + v.zoom * c.y).toBeCloseTo(s.y, 9);
      }
    }
    // At 25% a point near the screen's left edge is far left of the origin once panned right.
    expect(toCanvas({ zoom: 0.25, x: 400, y: 0 }, { x: 20, y: 10 })).toEqual({ x: -1520, y: 40 });
  });
});

describe("edge auto-pan", () => {
  const win = { w: 1600, h: 900 };
  it("does nothing away from the edges", () => {
    expect(autoPanVelocity({ x: 800, y: 450 }, win)).toEqual({ x: 0, y: 0 });
    expect(autoPanVelocity({ x: 72, y: 828 }, win)).toEqual({ x: 0, y: 0 });
  });
  it("reveals what is left and above when the pointer is at the left or top edge", () => {
    const v = autoPanVelocity({ x: 0, y: 0 }, win);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(0);
  });
  it("reveals what is right and below at the right or bottom edge", () => {
    const v = autoPanVelocity({ x: 1600, y: 900 }, win);
    expect(v.x).toBeLessThan(0);
    expect(v.y).toBeLessThan(0);
  });
  it("speeds up the closer the pointer gets, and is capped", () => {
    const slow = autoPanVelocity({ x: 60, y: 450 }, win).x;
    const fast = autoPanVelocity({ x: 10, y: 450 }, win).x;
    expect(fast).toBeGreaterThan(slow);
    expect(autoPanVelocity({ x: -500, y: 450 }, win).x).toBe(autoPanVelocity({ x: 0, y: 450 }, win).x);
    expect(autoPanVelocity({ x: 0, y: 0 }, win).x).toBe(22);
  });
});

describe("fit all", () => {
  it("is the bounds of every rectangle, or nothing", () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ minX: -50, minY: 10, maxX: 20, maxY: 40 }, { minX: 0, minY: -300, maxX: 900, maxY: 5 }])).toEqual({ minX: -50, minY: -300, maxX: 900, maxY: 40 });
  });
  it("shows every note, centred, and never zooms in past 100%", () => {
    const origin = { x: 0, y: 140 };
    const window = { w: 1600, h: 900 };
    const bounds = { minX: -1500, minY: -600, maxX: 1500, maxY: 1200 };
    const v = fitView(bounds, window, origin);
    expect(v.zoom).toBeLessThan(1);
    // Both corners land on screen, inside the window and below the header.
    for (const c of [{ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY }]) {
      const sx = origin.x + v.x + v.zoom * c.x;
      const sy = origin.y + v.y + v.zoom * c.y;
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sx).toBeLessThanOrEqual(window.w);
      expect(sy).toBeGreaterThanOrEqual(88);
      expect(sy).toBeLessThanOrEqual(window.h);
    }
    // A single small note isn't blown up.
    expect(fitView({ minX: 0, minY: 0, maxX: 200, maxY: 100 }, window, origin).zoom).toBe(1);
  });
  it("can't show a spread wider than the lowest zoom allows, so it stops there instead of zooming further", () => {
    expect(fitView({ minX: -9e6, minY: -9e6, maxX: 9e6, maxY: 9e6 }, { w: 1600, h: 900 }, { x: 0, y: 0 }).zoom).toBe(MIN_ZOOM);
  });
});
