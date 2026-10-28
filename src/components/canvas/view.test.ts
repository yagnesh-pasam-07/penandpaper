import { describe, expect, it } from "vitest";
import { clampZoom, HOME, isHome, MAX_ZOOM, MIN_ZOOM, parseView, toCanvas, wheelFactor, zoomAround } from "./view";

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
});
