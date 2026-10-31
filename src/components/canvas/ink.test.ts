import { describe, expect, it } from "vitest";
import { edgePoint, endAngle, hitThing, mapEnds, nearStroke, pathOf, placeStroke, thin, type Pt } from "./ink";

const box = (x: number, y: number, w = 100, h = 50) => ({ x, y, w, h });

describe("ink", () => {
  it("thins a slow hand but keeps both ends", () => {
    const pts: Pt[] = [[0, 0], [0.5, 0], [1, 0], [5, 0], [5.5, 0], [10, 0]];
    expect(thin(pts)).toEqual([[0, 0], [5, 0], [10, 0]]);
  });

  it("draws a smooth path, and a dot for a single point", () => {
    expect(pathOf([[0, 0], [10, 0], [20, 10]])).toBe("M0 0Q10 0 15 5L20 10");
    expect(pathOf([[3, 4]])).toBe("M3 4l0.01 0");
  });

  it("ties an end onto the smallest thing under it", () => {
    const boxes = new Map([
      ["big", box(0, 0, 400, 400)],
      ["small", box(10, 10, 40, 40)],
    ]);
    expect(hitThing({ x: 12, y: 12 }, boxes)).toBe("small");
    expect(hitThing({ x: 150, y: 150 }, boxes)).toBe("big");
    expect(hitThing({ x: 900, y: 900 }, boxes)).toBeNull();
  });

  it("meets a box at its edge, not its centre", () => {
    const p = edgePoint(box(0, 0, 100, 50), { x: 500, y: 0 }, 0);
    expect(p).toEqual({ x: 50, y: 0 });
  });

  it("stretches and turns a line so its ends land where asked", () => {
    const out = mapEnds([[0, 0], [5, 5], [10, 0]], { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 20 });
    expect(out[0]).toEqual([0, 0]);
    expect(out[2][0]).toBeCloseTo(0);
    expect(out[2][1]).toBeCloseTo(20);
    // The bump keeps its side of the line, now turned.
    expect(out[1][0]).toBeCloseTo(-10);
    expect(out[1][1]).toBeCloseTo(10);
  });

  it("a connector follows the things it ties when they move", () => {
    const drawn: Pt[] = [[60, 0], [200, 0], [340, 0]];
    const moved = placeStroke(drawn, box(0, 0), box(400, 300));
    const [sx, sy] = moved[0];
    const [ex, ey] = moved[moved.length - 1];
    // Starts on the first box's edge and ends on the second's, wherever it went.
    expect(Math.abs(sx) <= 56 && Math.abs(sy) <= 31).toBe(true);
    expect(Math.abs(ex - 400) <= 56 && Math.abs(ey - 300) <= 31).toBe(true);
    // A free line is left as drawn.
    expect(placeStroke(drawn, null, null)).toBe(drawn);
  });

  it("finds a line under the eraser", () => {
    const pts: Pt[] = [[0, 0], [100, 0]];
    expect(nearStroke({ x: 50, y: 5 }, pts)).toBe(true);
    expect(nearStroke({ x: 50, y: 30 }, pts)).toBe(false);
  });

  it("points an arrow along the line's end", () => {
    expect(endAngle([[0, 0], [100, 0]])).toBeCloseTo(0);
    expect(endAngle([[0, 0]])).toBeNull();
  });
});
