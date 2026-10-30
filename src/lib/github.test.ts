import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

describe("compact", () => {
  it("writes counts the way GitHub does", async () => {
    const { compact } = await import("./github");
    expect(compact(0)).toBe("0");
    expect(compact(999)).toBe("999");
    expect(compact(1000)).toBe("1k");
    expect(compact(1234)).toBe("1.2k");
    expect(compact(15400)).toBe("15k");
  });
});

describe("repoStats", () => {
  it("reads stars and people, and leaves bots out", async () => {
    const { repoStats } = await import("./github");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/contributors?per_page=30")
          ? Response.json([
              { login: "asha", avatar_url: "https://a/1", html_url: "https://github.com/asha", contributions: 12, type: "User" },
              { login: "dependabot[bot]", avatar_url: "https://a/2", html_url: "x", contributions: 3, type: "Bot" },
            ])
          : Response.json({ stargazers_count: 42, forks_count: 5 }),
      ),
    );
    const s = await repoStats();
    expect(s).toEqual({ stars: 42, forks: 5, contributors: [{ login: "asha", avatar: "https://a/1", url: "https://github.com/asha", commits: 12 }] });
    vi.unstubAllGlobals();
  });
  it("is null when GitHub doesn't answer", async () => {
    const { repoStats } = await import("./github");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    expect(await repoStats()).toBeNull();
    vi.unstubAllGlobals();
  });
});
