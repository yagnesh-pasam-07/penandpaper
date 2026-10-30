import { describe, expect, it } from "vitest";
import { buildCaptureText, canInject, captureEndpoint, chooseSurface, loginUrl, MAX_THOUGHT, newThoughtId, pictureUrl, queuedMessage, saveOutcome, withPage } from "./capture.js";

describe("newThoughtId", () => {
  it("is one the site accepts, and different each time", () => {
    const a = newThoughtId();
    const b = newThoughtId();
    expect(a).toMatch(/^[a-z0-9-]{6,40}$/);
    expect(a).not.toBe(b);
  });
  it("keeps to 40 characters whatever the uuid looks like", () => {
    expect(newThoughtId(() => "X".repeat(80))).toHaveLength(40);
    expect(newThoughtId(() => "ABC-123")).toBe("ext-abc-123");
  });
});

describe("captureEndpoint and loginUrl", () => {
  it("point at the chosen server", () => {
    expect(captureEndpoint("http://localhost:3000")).toBe("http://localhost:3000/api/drop/capture");
    expect(loginUrl("http://localhost:3000")).toBe("http://localhost:3000/login?next=/capture");
  });
  it("fall back to the real site for an unusable address", () => {
    expect(captureEndpoint("javascript:alert(1)")).toBe("https://penandpaper-app.vercel.app/api/drop/capture");
    expect(loginUrl(undefined)).toBe("https://penandpaper-app.vercel.app/login?next=/capture");
  });
});

describe("buildCaptureText", () => {
  it("title, selected words and address, each on a line", () => {
    expect(buildCaptureText({ title: "Sales talk", text: "worth a watch", url: "https://youtu.be/abc" })).toBe("Sales talk\nworth a watch\nhttps://youtu.be/abc");
  });
  it("leaves out what repeats", () => {
    expect(buildCaptureText({ title: "Hello", text: "Hello", url: "" })).toBe("Hello");
    expect(buildCaptureText({ title: "", text: "see https://a.co/x", url: "https://a.co/x" })).toBe("see https://a.co/x");
    expect(buildCaptureText({ title: "https://a.co/x", text: "", url: "https://a.co/x" })).toBe("https://a.co/x");
  });
  it("is empty when there is nothing, and cut to the length of a thought", () => {
    expect(buildCaptureText({})).toBe("");
    expect(buildCaptureText({ text: "x".repeat(MAX_THOUGHT + 500) })).toHaveLength(MAX_THOUGHT);
  });
});

describe("canInject and chooseSurface", () => {
  it("draws the box on ordinary pages", () => {
    for (const u of ["https://example.com/a?b=1", "http://localhost:3000/drop", "https://youtu.be/abc"]) expect(canInject(u)).toBe(true);
  });
  it("not where a browser refuses scripts", () => {
    const blocked = [
      "chrome://extensions",
      "chrome://newtab/",
      "edge://settings",
      "about:blank",
      "view-source:https://example.com",
      "file:///Users/me/a.html",
      "chrome-extension://abc/page.html",
      "https://chromewebstore.google.com/detail/x",
      "https://chrome.google.com/webstore/detail/x",
      "https://microsoftedge.microsoft.com/addons/detail/x",
      "https://example.com/paper.PDF",
      "",
      undefined,
      "not a url",
    ];
    for (const u of blocked) expect(canInject(u)).toBe(false);
  });
  it("uses the window when asked to, or when the page can't take the box", () => {
    expect(chooseSurface({ mode: "overlay", url: "https://example.com" })).toBe("overlay");
    expect(chooseSurface({ mode: undefined, url: "https://example.com" })).toBe("overlay");
    expect(chooseSurface({ mode: "window", url: "https://example.com" })).toBe("window");
    expect(chooseSurface({ mode: "overlay", url: "chrome://newtab/" })).toBe("window");
    expect(chooseSurface({ mode: "overlay", url: "https://example.com", chromeFocused: false })).toBe("window");
    expect(chooseSurface({ mode: "overlay", url: "https://example.com", chromeFocused: true })).toBe("overlay");
  });
});

describe("saveOutcome", () => {
  it("saved: names the paper, or says 'your paper'", () => {
    expect(saveOutcome(200, { paperName: " Ideas " })).toEqual({ kind: "saved", message: "Saved to Ideas" });
    expect(saveOutcome(200, { paperName: null })).toEqual({ kind: "saved", message: "Saved to your paper" });
  });
  it("signed out: asks to sign in", () => {
    expect(saveOutcome(401).kind).toBe("signin");
  });
  it("errors say what to do", () => {
    expect(saveOutcome(400, { error: "Write something first." }).message).toBe("Write something first.");
    expect(saveOutcome(400, {}).message).toBe("Write something first.");
    expect(saveOutcome(403).kind).toBe("error");
    expect(saveOutcome(0).message).toMatch(/connection/);
    expect(saveOutcome(500).message).toMatch(/Try again/);
  });
});

describe("withPage", () => {
  const page = { title: "Sales talk", url: "https://youtu.be/abc123XYZ_0" };
  it("the words, then the page's title and address", () => {
    expect(withPage("worth a watch", page)).toBe("worth a watch\nSales talk\nhttps://youtu.be/abc123XYZ_0");
  });
  it("leaves out what repeats and anything that isn't a web address", () => {
    expect(withPage("see Sales talk", page)).toBe("see Sales talk\nhttps://youtu.be/abc123XYZ_0");
    expect(withPage("link: https://youtu.be/abc123XYZ_0", { url: page.url })).toBe("link: https://youtu.be/abc123XYZ_0");
    expect(withPage("hi", { title: "T", url: "javascript:alert(1)" })).toBe("hi\nT");
    expect(withPage("hi", {})).toBe("hi");
  });
  it("keeps the address whole and lets the typed words give way", () => {
    const out = withPage("x".repeat(MAX_THOUGHT), page);
    expect(out.length).toBeLessThanOrEqual(MAX_THOUGHT);
    expect(out.endsWith("https://youtu.be/abc123XYZ_0")).toBe(true);
  });
});

describe("queuedMessage", () => {
  it("says what to do about it", () => {
    expect(queuedMessage(401)).toMatch(/Sign in/);
    expect(queuedMessage(0)).toMatch(/will sync/);
    expect(queuedMessage(503)).toMatch(/will sync/);
  });
});

describe("pictureUrl", () => {
  it("keeps a web address", () => {
    expect(pictureUrl("https://img.example.com/a.jpg?w=800")).toBe("https://img.example.com/a.jpg?w=800");
  });
  it("leaves out inline pictures and junk", () => {
    for (const v of ["data:image/png;base64,AA", "blob:https://x.com/1", "javascript:alert(1)", "", undefined, `https://a.co/${"x".repeat(4000)}`]) expect(pictureUrl(v)).toBe("");
  });
});

describe("saveOutcome with a picture", () => {
  it("says when the picture couldn't come along", () => {
    expect(saveOutcome(200, { paperName: "Ideas", imageSkipped: true }).message).toBe("Saved to Ideas, without the picture");
    expect(saveOutcome(200, { paperName: "Ideas" }).message).toBe("Saved to Ideas");
  });
});
