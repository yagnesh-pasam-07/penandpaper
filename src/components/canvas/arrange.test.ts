import { describe, expect, it } from "vitest";
import { columnOf, COLUMN_MAX, GRID, inRange, layout, limitSpot, savedSpot, settleShift, snap, X_SHARE_LIMIT, Y_LIMIT } from "./arrange";

const size = { w: 200, h: 100 };

describe("layout", () => {
  it("flows unmoved bubbles into centred rows", () => {
    const { boxes } = layout(
      ["a", "b", "c"].map((id) => ({ id, size, at: null })),
      1000,
    );
    const a = boxes.get("a")!;
    const c = boxes.get("c")!;
    expect(a.y).toBe(c.y);
    // Row of three 200px bubbles with 32px gaps is centred on 1000px.
    expect(a.x - a.w / 2).toBeCloseTo((1000 - (3 * 200 + 2 * 32)) / 2);
  });

  it("puts new drops right under the input and the arranged group below them", () => {
    const { boxes, lift } = layout(
      [
        { id: "moved", size, at: { x: 0.15, y: 400 } },
        { id: "other", size, at: { x: 0.6, y: 520 } },
        { id: "new", size, at: null },
      ],
      1000,
    );
    const fresh = boxes.get("new")!;
    const moved = boxes.get("moved")!;
    expect(fresh.y - fresh.h / 2).toBe(22);
    expect(moved.y - moved.h / 2).toBeGreaterThan(fresh.y + fresh.h / 2);
    // The group keeps its shape.
    expect(boxes.get("other")!.y - moved.y).toBe(120);
    expect(moved.y).toBe(400 + lift);
  });

  it("holds the group still when given a lift", () => {
    const { boxes } = layout([{ id: "a", size, at: { x: 0.5, y: 300 } }], 1000, 0);
    expect(boxes.get("a")!.y).toBe(300);
  });

  it("wraps to a new row when the sheet is full", () => {
    const { boxes } = layout(
      ["a", "b"].map((id) => ({ id, size, at: null })),
      300,
    );
    expect(boxes.get("b")!.y).toBeGreaterThan(boxes.get("a")!.y);
  });
});

describe("snap", () => {
  const other = { x: 300, y: 200, ...size };

  it("lines up with a neighbour's centre when close", () => {
    const { box, guides } = snap({ x: 309, y: 420, ...size }, [other]);
    expect(box.x).toBe(300);
    expect(guides.x).toBe(300);
  });

  it("lines up start edges", () => {
    const { box, guides } = snap({ x: 410, y: 400, w: 400, h: 100 }, [other]);
    expect(box.x - 200).toBe(200);
    expect(guides.x).toBe(200);
  });

  it("clicks onto the dots when nothing is near", () => {
    const { box, guides } = snap({ x: 700, y: 650, ...size }, [other]);
    expect((box.x - GRID / 2) % GRID).toBe(0);
    expect((box.y - GRID / 2) % GRID).toBe(0);
    expect(guides).toEqual({ x: undefined, y: undefined });
  });

  it("can settle anywhere: no edge pulls it back", () => {
    const left = snap({ x: -5000, y: -3000, ...size }, []);
    expect(left.box.x).toBeLessThan(0);
    expect(left.box.y).toBeLessThan(0);
    const far = snap({ x: 90000, y: 120000, ...size }, []);
    expect(far.box.x).toBeGreaterThan(80000);
    expect(far.box.y).toBeGreaterThan(100000);
  });
});

describe("column on a page-wide canvas", () => {
  it("centres the column and caps it", () => {
    expect(columnOf(2000)).toEqual({ left: (2000 - COLUMN_MAX) / 2, width: COLUMN_MAX });
    expect(columnOf(800)).toEqual({ left: 32, width: 736 });
    expect(columnOf(800, false)).toEqual({ left: 0, width: 800 });
  });

  it("places old saved spots exactly where the column-wide sheet put them", () => {
    const old = layout([{ id: "a", size, at: { x: 0.25, y: 300 } }], COLUMN_MAX, 0).boxes.get("a")!;
    const col = columnOf(2000);
    const now = layout([{ id: "a", size, at: { x: 0.25, y: 300 } }], 2000, 0, col).boxes.get("a")!;
    expect(now.x - col.left).toBeCloseTo(old.x);
    expect(now.y).toBe(old.y);
  });

  it("saves a spot outside the column as a share below 0 or above 1, and reads it back", () => {
    const col = columnOf(2000);
    const out = savedSpot({ x: 300, y: 240 }, col, 0);
    expect(out.x).toBeLessThan(0);
    const { boxes } = layout([{ id: "a", size, at: out }], 2000, 0, col);
    expect(boxes.get("a")!.x).toBeCloseTo(300);
    const far = savedSpot({ x: 1800, y: 240 }, col, 0);
    expect(far.x).toBeGreaterThan(1);
  });

  it("flows new drops in the column, and puts a placed bubble exactly where it was left, even off the page", () => {
    const col = columnOf(2000);
    const a = layout([{ id: "a", size, at: null }], 2000, undefined, col).boxes.get("a")!;
    expect(a.x).toBeCloseTo(1000);
    const out = layout([{ id: "b", size, at: { x: -9, y: -400 } }], 2000, 0, col).boxes.get("b")!;
    expect(out.x).toBeCloseTo(col.left - 9 * col.width);
    expect(out.y).toBe(-400);
    const below = layout([{ id: "c", size, at: { x: 40, y: 150000 } }], 2000, 0, col).boxes.get("c")!;
    expect(below.x).toBeCloseTo(col.left + 40 * col.width);
    expect(below.y).toBe(150000);
  });
});

describe("saved range", () => {
  it("accepts far-away spots and refuses absurd or non-finite ones", () => {
    expect(inRange({ x: -150, y: -180000 })).toBe(true);
    expect(inRange({ x: X_SHARE_LIMIT, y: Y_LIMIT })).toBe(true);
    expect(inRange({ x: X_SHARE_LIMIT + 1, y: 0 })).toBe(false);
    expect(inRange({ x: 0, y: -Y_LIMIT - 1 })).toBe(false);
    expect(inRange({ x: Number.NaN, y: 0 })).toBe(false);
  });

  it("holds a far drop inside the limits instead of losing it", () => {
    expect(limitSpot({ x: 5000, y: -9e9 })).toEqual({ x: X_SHARE_LIMIT, y: -Y_LIMIT });
    expect(limitSpot({ x: 0.5, y: 300 })).toEqual({ x: 0.5, y: 300 });
  });

  it("is wider than the old -8..9 shares and ±20,000 px", () => {
    expect(inRange({ x: -50, y: 100000 })).toBe(true);
  });
});

describe("dropping above everything", () => {
  const tall = { w: 200, h: 100 };
  it("re-anchors the group to the sheet's top, and says how far, so the canvas can pan the other way", () => {
    // Two placed bubbles shown with a lift of 100; a third dropped far above them.
    const saved = [{ y: 300, h: 100 }, { y: 420, h: 100 }, { y: -900, h: 100 }];
    const shift = settleShift(saved, 100);
    // The topmost bubble (centre -900) ends with its top at 22, so everything moves by this much.
    const natural = 22 - (-900 - 50);
    expect(shift).toBe(natural - 100);
    // Screen y of any bubble before and after differs by exactly the shift: panning by -shift keeps it still.
    const before = 300 + 100;
    const after = 300 + (22 - (-950));
    expect(after - before).toBe(shift);
  });

  it("is zero when the drop doesn't change what sits on top, and when there is nothing placed", () => {
    expect(settleShift([{ y: 300, h: 100 }, { y: 500, h: 100 }], 22 - 250)).toBe(0);
    expect(settleShift([], 40)).toBe(0);
  });

  it("matches what layout() does on the next render", () => {
    const at = [{ id: "a", x: 0.2, y: -900 }, { id: "b", x: 0.5, y: 300 }];
    const items = at.map((p) => ({ id: p.id, size: tall, at: { x: p.x, y: p.y } }));
    const { boxes, lift } = layout(items, 1000);
    expect(lift).toBe(22 - (-900 - 50));
    expect(boxes.get("a")!.y - tall.h / 2).toBe(22);
    expect(settleShift(at.map((p) => ({ y: p.y, h: tall.h })), 0)).toBe(lift);
  });
});
