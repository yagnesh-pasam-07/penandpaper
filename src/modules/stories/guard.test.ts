import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const gate = { admin: null as null | { id: string; role: "admin" }, open: false };
vi.mock("@/modules/studio/gate", () => ({
  studioAdmin: async () => gate.admin,
  studioOpen: async () => gate.open,
}));
const { requireWriter, storyWriter } = await import("./guard");

describe("who may write stories (checked on the server)", () => {
  beforeEach(() => {
    gate.admin = null;
    gate.open = false;
  });
  it("nobody signed out, and no ordinary user", async () => {
    expect(await storyWriter()).toBeNull();
    await expect(requireWriter()).rejects.toThrow();
  });
  it("not an admin without the Studio passcode", async () => {
    gate.admin = { id: "a", role: "admin" };
    expect(await storyWriter()).toBeNull();
    await expect(requireWriter()).rejects.toThrow();
  });
  it("the admin with Studio open", async () => {
    gate.admin = { id: "a", role: "admin" };
    gate.open = true;
    expect(await storyWriter()).toEqual(gate.admin);
    await expect(requireWriter()).resolves.toEqual(gate.admin);
  });
});
