import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

describe("parseFrom", () => {
  it("splits a name and an address", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://u:p@h/d");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(40));
    const { parseFrom } = await import("./email");
    expect(parseFrom("Pen & Paper <hello@x.com>")).toEqual({ name: "Pen & Paper", email: "hello@x.com" });
    expect(parseFrom('"Pen & Paper" <hello@x.com>')).toEqual({ name: "Pen & Paper", email: "hello@x.com" });
    expect(parseFrom("hello@x.com")).toEqual({ email: "hello@x.com" });
  });
});
