import { describe, expect, it } from "vitest";
import { buildCaptureUrl, buildShareUrl, DEFAULT_SERVER, LOCAL_SERVER, normalizeServer, pickShare } from "./share-url.js";

describe("normalizeServer", () => {
  it("keeps the origin of an https address", () => {
    expect(normalizeServer("https://penandpaper-app.vercel.app/drop?x=1")).toBe("https://penandpaper-app.vercel.app");
    expect(normalizeServer("  https://example.com:8443/  ")).toBe("https://example.com:8443");
  });
  it("adds https to a bare host", () => {
    expect(normalizeServer("example.com")).toBe("https://example.com");
  });
  it("allows http only for this computer", () => {
    expect(normalizeServer("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeServer("http://127.0.0.1:3000/x")).toBe("http://127.0.0.1:3000");
    expect(normalizeServer("http://example.com")).toBeNull();
  });
  it("refuses anything that isn't a web address", () => {
    for (const v of ["javascript:alert(1)", "ftp://example.com", "data:text/html,hi", "", "   ", null, undefined, "https://"]) expect(normalizeServer(v)).toBeNull();
  });
});

describe("pickShare", () => {
  const tab = { title: "Sales talk", url: "https://youtu.be/abc123XYZ_0" };
  it("page: title, link and whatever is selected", () => {
    expect(pickShare("page", tab, {}, "worth a watch")).toEqual({ title: "Sales talk", text: "worth a watch", url: tab.url });
    expect(pickShare("page", tab)).toEqual({ title: "Sales talk", text: "", url: tab.url });
  });
  it("selection: the selected words from the menu, with the page", () => {
    expect(pickShare("selection", tab, { selectionText: "a line" })).toEqual({ title: "Sales talk", text: "a line", url: tab.url });
  });
  it("link: just the link that was clicked", () => {
    expect(pickShare("link", tab, { linkUrl: "https://example.com/a" })).toEqual({ title: "", text: "", url: "https://example.com/a" });
    expect(pickShare("link", tab, { linkUrl: "javascript:alert(1)" }).url).toBe("");
  });
  it("image: its address, or the page when it has none (an inline picture)", () => {
    expect(pickShare("image", tab, { srcUrl: "https://example.com/p.png" }).url).toBe("https://example.com/p.png");
    expect(pickShare("image", tab, { srcUrl: "data:image/png;base64,AAAA" })).toEqual({ title: "Sales talk", text: "", url: tab.url });
  });
  it("leaves out an address that isn't http(s), as on chrome:// pages", () => {
    expect(pickShare("page", { title: "Extensions", url: "chrome://extensions" }).url).toBe("");
  });
});

describe("buildCaptureUrl", () => {
  it("is the quick box on the chosen server, marked from=ext", () => {
    expect(buildCaptureUrl(DEFAULT_SERVER)).toBe("https://penandpaper-app.vercel.app/capture?from=ext");
    expect(buildCaptureUrl(LOCAL_SERVER)).toBe("http://localhost:3000/capture?from=ext");
  });
  it("falls back to the default server for an unusable one", () => {
    expect(buildCaptureUrl("javascript:alert(1)")).toBe("https://penandpaper-app.vercel.app/capture?from=ext");
  });
});

describe("buildShareUrl", () => {
  it("makes the address of the saving window, marked from=ext", () => {
    const u = new URL(buildShareUrl(DEFAULT_SERVER, { title: "T & U", text: "hi there", url: "https://example.com/a?b=1&c=2" }));
    expect(u.origin).toBe("https://penandpaper-app.vercel.app");
    expect(u.pathname).toBe("/share");
    expect(u.searchParams.get("title")).toBe("T & U");
    expect(u.searchParams.get("text")).toBe("hi there");
    expect(u.searchParams.get("url")).toBe("https://example.com/a?b=1&c=2");
    expect(u.searchParams.get("from")).toBe("ext");
  });
  it("uses the local server when asked", () => {
    expect(buildShareUrl(LOCAL_SERVER, { text: "x" })).toBe("http://localhost:3000/share?text=x&from=ext");
  });
  it("falls back to the default server for an unusable one", () => {
    expect(buildShareUrl("javascript:alert(1)", { text: "x" }).startsWith(`${DEFAULT_SERVER}/share?`)).toBe(true);
  });
  it("leaves out empty fields and non-web links", () => {
    expect(buildShareUrl(DEFAULT_SERVER, { title: " ", text: "", url: "javascript:alert(1)" })).toBe(`${DEFAULT_SERVER}/share?from=ext`);
  });
  it("keeps every field under the length the site accepts (4000)", () => {
    const u = new URL(buildShareUrl(DEFAULT_SERVER, { title: "t".repeat(9000), text: "w".repeat(9000), url: `https://example.com/${"p".repeat(9000)}` }));
    for (const k of ["title", "text"]) expect(u.searchParams.get(k).length).toBeLessThanOrEqual(3900);
    expect(u.searchParams.get("url") ?? "").toBe("");
  });
});
