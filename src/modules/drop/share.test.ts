import { describe, expect, it } from "vitest";
import { MAX_THOUGHT } from "./logic";
import { buildShareText, captureText, cleanUrl, isSameSite, pictureDataUrl, shareId, shareQuery, shareSource } from "./share";

describe("cleanUrl", () => {
  it("keeps http and https addresses exactly as sent", () => {
    expect(cleanUrl("https://youtu.be/abc123XYZ_0?si=x")).toBe("https://youtu.be/abc123XYZ_0?si=x");
    expect(cleanUrl("http://example.com")).toBe("http://example.com");
    expect(cleanUrl("  https://example.com  ")).toBe("https://example.com");
  });
  it("drops anything that isn't a web address", () => {
    for (const v of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.com", "mailto:a@b.co", "example.com", "https://a b.com", "", "   ", null, undefined]) {
      expect(cleanUrl(v)).toBeNull();
    }
  });
});

describe("buildShareText", () => {
  it("puts title, text and link on separate lines", () => {
    expect(buildShareText({ title: "Sales talk", text: "worth a watch", url: "https://youtu.be/abc" })).toBe("Sales talk\nworth a watch\nhttps://youtu.be/abc");
  });
  it("doesn't repeat a link that is already in the text (Android sends it there)", () => {
    expect(buildShareText({ text: "look https://example.com/a", url: "https://example.com/a" })).toBe("look https://example.com/a");
    expect(buildShareText({ text: "https://example.com/a" })).toBe("https://example.com/a");
  });
  it("doesn't repeat a title that is the text, or inside it", () => {
    expect(buildShareText({ title: "Hello", text: "Hello" })).toBe("Hello");
    expect(buildShareText({ title: "Hello", text: "Hello there" })).toBe("Hello there");
  });
  it("leaves out a link that isn't http(s)", () => {
    expect(buildShareText({ text: "note", url: "javascript:alert(1)" })).toBe("note");
  });
  it("handles missing and blank fields", () => {
    expect(buildShareText({})).toBe("");
    expect(buildShareText({ title: "  ", text: "\n", url: " " })).toBe("");
    expect(buildShareText({ url: "https://example.com" })).toBe("https://example.com");
  });
  it("trims to the length of a thought", () => {
    const long = "word ".repeat(1000);
    const out = buildShareText({ text: long });
    expect(out.length).toBeLessThanOrEqual(MAX_THOUGHT);
    expect(out.length).toBeGreaterThan(MAX_THOUGHT - 10);
  });
  it("turns CRLF into plain new lines", () => {
    expect(buildShareText({ text: "a\r\nb" })).toBe("a\nb");
  });
});

describe("shareQuery", () => {
  it("keeps only the filled fields, so a sign-in can come back to the same share", () => {
    expect(shareQuery({ title: "T", text: "", url: "https://example.com" })).toBe("title=T&url=https%3A%2F%2Fexample.com");
    expect(shareQuery({})).toBe("");
  });
});

describe("captureText", () => {
  it("tidies a typed thought and cuts it to the length of a thought", () => {
    expect(captureText("  hello\r\nworld  ")).toBe("hello\nworld");
    expect(captureText("x".repeat(5000))?.length).toBe(MAX_THOUGHT);
  });
  it("is nothing for empty or non-text input", () => {
    for (const v of ["", "   \n ", null, undefined, 3, {}]) expect(captureText(v)).toBeNull();
  });
});

describe("isSameSite", () => {
  const origin = "https://penandpaper-app.vercel.app";
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
  it("accepts only a same-origin request when the browser says where it came from", () => {
    expect(isSameSite(headers({ "sec-fetch-site": "same-origin" }), origin)).toBe(true);
    for (const site of ["cross-site", "same-site", "none"]) expect(isSameSite(headers({ "sec-fetch-site": site, origin }), origin)).toBe(false);
  });
  it("without that header, the Origin must be this site's", () => {
    expect(isSameSite(headers({ origin }), origin)).toBe(true);
    expect(isSameSite(headers({ origin: "https://evil.example" }), origin)).toBe(false);
    expect(isSameSite(headers({}), origin)).toBe(false);
  });
});

describe("shareSource", () => {
  it("only the browser extension's exact word counts", () => {
    expect(shareSource("ext")).toBe("ext");
    for (const v of ["EXT", "ext ", "extension", "", null, undefined, "<script>"]) expect(shareSource(v)).toBeNull();
  });
  it("is kept through a sign-in so the share finishes in the extension's window", () => {
    expect(shareQuery({ text: "hi" }, "ext")).toBe("text=hi&from=ext");
    expect(shareQuery({ text: "hi" })).toBe("text=hi");
  });
});

describe("shareId", () => {
  const at = new Date("2026-10-29T10:00:00Z");
  it("is the same for the same share by the same person in the same five minutes", () => {
    expect(shareId("u1", "hi", null, at)).toBe(shareId("u1", "hi", null, new Date(at.getTime() + 60_000)));
  });
  it("differs by person, words, picture and time", () => {
    const base = shareId("u1", "hi", null, at);
    expect(shareId("u2", "hi", null, at)).not.toBe(base);
    expect(shareId("u1", "hey", null, at)).not.toBe(base);
    expect(shareId("u1", "hi", "data:image/png;base64,AA", at)).not.toBe(base);
    expect(shareId("u1", "hi", null, new Date(at.getTime() + 6 * 60_000))).not.toBe(base);
  });
  it("fits the id format thoughts use", () => {
    expect(shareId("u1", "hi", null, at)).toMatch(/^[a-z0-9-]{6,40}$/);
  });
});

describe("pictureDataUrl", () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  it("makes a data URL for the picture types we keep", () => {
    expect(pictureDataUrl("image/png", bytes, 1000)).toBe("data:image/png;base64,AQIDBA==");
  });
  it("refuses other types and anything over the limit", () => {
    expect(pictureDataUrl("image/svg+xml", bytes, 1000)).toBeNull();
    expect(pictureDataUrl("text/html", bytes, 1000)).toBeNull();
    expect(pictureDataUrl("image/png", bytes, 10)).toBeNull();
  });
});
