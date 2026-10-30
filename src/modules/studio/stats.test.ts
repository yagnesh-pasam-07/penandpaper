import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ httpDb: {} }));
vi.mock("@/modules/drop/server", () => ({ dropZone: () => "UTC" }));

describe("sourceOf", () => {
  it("reads where a thought came from out of its id", async () => {
    const { sourceOf } = await import("./stats");
    expect(sourceOf("ext-1f2e")).toBe("extension");
    expect(sourceOf("mac-abc")).toBe("mac");
    expect(sourceOf("cap-abc")).toBe("quick");
    expect(sourceOf("share-abc")).toBe("share");
    expect(sourceOf("k3j2h1abc")).toBe("canvas");
  });
});
