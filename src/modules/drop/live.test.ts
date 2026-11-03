import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ httpDb: {} }));
vi.mock("@/lib/env", () => ({ env: { BETTER_AUTH_SECRET: "x".repeat(40), DATABASE_URL: "postgresql://u:p@ep-cool-1-pooler.eu.aws.neon.tech/db" } }));

import { applyLive, channelOf, inkFor, MAX_PAYLOAD, wire, type Peer } from "./live";
import { listenUrl, liveKey, readKey } from "./live-server";
import type { DropPaper, Thought } from "./logic";

const t = (id: string, more: Partial<Thought> = {}): Thought => ({ id, text: id, status: "open", shape: 0, createdAt: "2026-11-02T10:00:00.000Z", doneAt: null, x: null, y: null, ...more });
const paper = (thoughts: Thought[], strokes: DropPaper["strokes"] = []): DropPaper => ({ id: "p", name: null, createdAt: "", archivedAt: null, thoughts, strokes });

describe("applyLive", () => {
  it("adds a thought someone else dropped, and replaces one they changed", () => {
    const p = applyLive(paper([t("a")]), { type: "thought", thought: t("b") });
    expect(p.thoughts.map((x) => x.id)).toEqual(["a", "b"]);
    const q = applyLive(p, { type: "thought", thought: t("a", { text: "edited", status: "done" }) });
    expect(q.thoughts.find((x) => x.id === "a")).toMatchObject({ text: "edited", status: "done" });
    expect(q.thoughts).toHaveLength(2);
  });
  it("keeps the owner's own due date when a change arrives without one", () => {
    const mine = paper([t("a", { dueAt: "2026-11-03T12:00:00.000Z", dueHasTime: true })]);
    const bare = t("a", { text: "new words" });
    const p = applyLive(mine, { type: "thought", thought: bare });
    expect(p.thoughts[0]).toMatchObject({ text: "new words", dueAt: "2026-11-03T12:00:00.000Z", dueHasTime: true });
  });
  it("takes away a crumpled thought, and is a no-op for one it never had", () => {
    const start = paper([t("a"), t("b")]);
    expect(applyLive(start, { type: "gone", id: "a" }).thoughts.map((x) => x.id)).toEqual(["b"]);
    expect(applyLive(start, { type: "gone", id: "zzz" })).toBe(start);
  });
  it("moves thoughts, and sends one back into the flow", () => {
    const p = applyLive(paper([t("a"), t("b", { x: 0.5, y: 10 })]), {
      type: "moved",
      placements: [
        { id: "a", x: 0.2, y: 300 },
        { id: "b", x: null, y: null },
      ],
    });
    expect(p.thoughts.map((x) => [x.x, x.y])).toEqual([
      [0.2, 300],
      [null, null],
    ]);
  });
  it("draws, changes and rubs out lines, once each", () => {
    const line = { id: "s1", points: [[0, 0] as [number, number]], fromId: null, toId: null };
    let p = applyLive(paper([]), { type: "stroke", stroke: line });
    p = applyLive(p, { type: "stroke", stroke: line });
    expect(p.strokes).toHaveLength(1);
    p = applyLive(p, { type: "stroke-edit", id: "s1", change: { color: "cobalt", label: "plan" } });
    expect(p.strokes![0]).toMatchObject({ color: "cobalt", label: "plan" });
    expect(applyLive(p, { type: "stroke-gone", id: "s1" }).strokes).toEqual([]);
  });
  it("leaves the paper alone for presence and cursors", () => {
    const start = paper([t("a")]);
    expect(applyLive(start, { type: "cursor", sid: "x", at: { x: 0.1, y: 2 } })).toBe(start);
    expect(applyLive(start, { type: "leave", sid: "x" })).toBe(start);
  });
});

describe("wire", () => {
  it("sends a small change as it is, with who made it", () => {
    expect(JSON.parse(wire({ type: "gone", id: "a", by: "tab1" }))).toEqual({ type: "gone", id: "a", by: "tab1" });
  });
  it("turns a change too big for a NOTIFY (a picture) into 'fetch the paper again'", () => {
    const big = wire({ type: "thought", thought: t("a", { image: `data:image/webp;base64,${"A".repeat(20_000)}` }), by: "tab1" });
    expect(JSON.parse(big)).toEqual({ type: "sync", by: "tab1" });
    expect(new TextEncoder().encode(big).length).toBeLessThan(MAX_PAYLOAD);
  });
  it("counts bytes, not letters (Telugu takes three bytes a letter)", () => {
    const words = "మాట".repeat(900); // 2,700 letters, 8,100 bytes
    expect(JSON.parse(wire({ type: "thought", thought: t("a", { text: words }) })).type).toBe("sync");
  });
});

describe("channelOf", () => {
  it("is a safe identifier made from the paper id alone", () => {
    expect(channelOf("8E1B3C2A-1111-4222-8333-444455556666")).toBe("pp_8e1b3c2a111142228333444455556666");
    expect(channelOf(`x"; drop table users; --`)).toMatch(/^pp_[0-9a-f]*$/);
  });
});

describe("inkFor", () => {
  it("gives a person the same pigment on every screen, never plain ink", () => {
    expect(inkFor("user-1")).toBe(inkFor("user-1"));
    for (const id of ["a", "b", "c", "d", "e", "f"]) expect(inkFor(id)).not.toBe("ink");
  });
});

describe("live keys", () => {
  const peer: Peer = { sid: "tab123", uid: "u1", name: "Teja", ink: "cobalt", role: "edit" };
  const P = "11111111-1111-4111-8111-111111111111";
  it("reads back the person it was made for, on that paper only", () => {
    const k = liveKey(P, peer, 1000);
    expect(readKey(P, k, 2000)).toEqual(peer);
    expect(readKey("22222222-2222-4222-8222-222222222222", k, 2000)).toBeNull();
  });
  it("runs out after ten minutes", () => {
    const k = liveKey(P, peer, 0);
    expect(readKey(P, k, 10 * 60_000 + 1)).toBeNull();
  });
  it("refuses a key that was changed (someone pretending to be another person)", () => {
    const [body, mac] = liveKey(P, peer, 0).split(".");
    const forged = Buffer.from(JSON.stringify({ p: P, peer: { ...peer, name: "Owner", role: "owner" }, exp: 9e15 })).toString("base64url");
    expect(readKey(P, `${forged}.${mac}`, 1)).toBeNull();
    expect(readKey(P, `${body}.${mac.slice(0, -2)}xx`, 1)).toBeNull();
    expect(readKey(P, "nonsense", 1)).toBeNull();
  });
});

describe("listenUrl", () => {
  it("listens on the direct connection, never through the pooler", () => {
    expect(listenUrl()).toBe("postgresql://u:p@ep-cool-1.eu.aws.neon.tech/db");
  });
});
