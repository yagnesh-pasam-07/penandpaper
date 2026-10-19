import { describe, expect, it } from "vitest";
import { GRID, layout, snap } from "./arrange";

const size = { w: 200, h: 100 };

describe("layout", () => {
  it("flows unmoved bubbles into centred rows", () => {
    const boxes = layout(
      ["a", "b", "c"].map((id) => ({ id, size, at: null })),
      1000,
    );
    const a = boxes.get("a")!;
    const c = boxes.get("c")!;
    expect(a.y).toBe(c.y);
    // Row of three 200px bubbles with 32px gaps is centred on 1000px.
    expect(a.x - a.w / 2).toBeCloseTo((1000 - (3 * 200 + 2 * 32)) / 2);
  });

  it("keeps a moved bubble where it was put and flows the rest around it", () => {
    const boxes = layout(
      [
        { id: "moved", size, at: { x: 0.15, y: 80 } },
        { id: "free", size, at: null },
      ],
      1000,
    );
    expect(boxes.get("moved")).toMatchObject({ x: 150, y: 80 });
    const free = boxes.get("free")!;
    expect(free.x - free.w / 2).toBeGreaterThanOrEqual(250);
  });

  it("wraps to a new row when the sheet is full", () => {
    const boxes = layout(
      ["a", "b"].map((id) => ({ id, size, at: null })),
      300,
    );
    expect(boxes.get("b")!.y).toBeGreaterThan(boxes.get("a")!.y);
  });
});

describe("snap", () => {
  const other = { x: 300, y: 200, ...size };

  it("lines up with a neighbour's centre when close", () => {
    const { box, guides } = snap({ x: 309, y: 420, ...size }, [other], 1000);
    expect(box.x).toBe(300);
    expect(guides.x).toBe(300);
  });

  it("lines up start edges", () => {
    const { box, guides } = snap({ x: 410, y: 400, w: 400, h: 100 }, [other], 1000);
    expect(box.x - 200).toBe(200);
    expect(guides.x).toBe(200);
  });

  it("clicks onto the dots when nothing is near", () => {
    const { box, guides } = snap({ x: 700, y: 650, ...size }, [other], 1000);
    expect((box.x - GRID / 2) % GRID).toBe(0);
    expect((box.y - GRID / 2) % GRID).toBe(0);
    expect(guides).toEqual({ x: undefined, y: undefined });
  });

  it("stays on the sheet", () => {
    const { box } = snap({ x: 990, y: -40, ...size }, [], 1000);
    expect(box.x).toBe(900);
    expect(box.y).toBe(50);
  });
});
