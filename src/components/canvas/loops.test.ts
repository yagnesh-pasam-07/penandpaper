import { describe, expect, it } from "vitest";
import { handShapePath, insidePolygon, isLoop, shapeCorners, shapeOutline, shift, type Pt } from "./ink";

const ring = (cx: number, cy: number, r: number, n = 40, gap = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * (Math.PI * 2 - gap);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

describe("loops", () => {
  it("knows a ring drawn round things from a line", () => {
    expect(isLoop(ring(0, 0, 200))).toBe(true);
    expect(isLoop(ring(0, 0, 200, 40, 0.3))).toBe(true); // ends nearly meet
    expect(isLoop(ring(0, 0, 200, 40, Math.PI))).toBe(false); // half a circle
    expect(isLoop(ring(0, 0, 20))).toBe(false); // too small to hold anything
    expect(isLoop(Array.from({ length: 20 }, (_, i) => [i * 20, 0] as Pt))).toBe(false);
  });

  it("finds what's inside a loop", () => {
    const loop = ring(0, 0, 100);
    expect(insidePolygon({ x: 10, y: 10 }, loop)).toBe(true);
    expect(insidePolygon({ x: 150, y: 0 }, loop)).toBe(false);
  });

  it("outlines shapes, and Shift keeps them even", () => {
    expect(shapeOutline("rect", [[10, 10], [0, 0]])[0]).toEqual([0, 0]);
    expect(insidePolygon({ x: 50, y: 25 }, shapeOutline("ellipse", [[0, 0], [100, 50]]))).toBe(true);
    expect(insidePolygon({ x: 2, y: 2 }, shapeOutline("ellipse", [[0, 0], [100, 50]]))).toBe(false);
    expect(shapeCorners({ x: 0, y: 0 }, { x: 30, y: -10 }, true)).toEqual([[0, 0], [30, -30]]);
  });

  it("draws a shape the same way every time", () => {
    const a = handShapePath("rect", [[0, 0], [100, 60]], "seed");
    expect(a).toBe(handShapePath("rect", [[0, 0], [100, 60]], "seed"));
    expect(a.startsWith("M")).toBe(true);
    expect(handShapePath("ellipse", [[0, 0], [100, 60]], "s").length).toBeGreaterThan(20);
  });

  it("moves points", () => {
    expect(shift([[1, 2]], 3, 4)).toEqual([[4, 6]]);
  });
});
