import { describe, expect, it } from "vitest";
import { daily, deviceOf, isBot, readThrough, shareRate, sourceOf, tagged, whatsappText } from "./reach";

const own = "penandpaper-app.vercel.app";

describe("where a reader came from", () => {
  it("our own share tag wins (WhatsApp strips the referrer)", () => {
    expect(sourceOf("wa", null, own)).toBe("whatsapp");
    expect(sourceOf("ig", "https://www.google.com/", own)).toBe("instagram");
  });
  it("then the referrer", () => {
    expect(sourceOf(null, "https://www.google.co.in/", own)).toBe("google");
    expect(sourceOf(null, "https://l.instagram.com/?u=x", own)).toBe("instagram");
    expect(sourceOf(null, "https://web.whatsapp.com/", own)).toBe("whatsapp");
    expect(sourceOf(null, "https://t.co/abc", own)).toBe("social");
    expect(sourceOf(null, `https://${own}/`, own)).toBe("home");
    expect(sourceOf(null, `https://${own}/stories`, own)).toBe("stories");
    expect(sourceOf(null, "https://example.org/x", own)).toBe("other");
  });
  it("no referrer and no tag is direct", () => {
    expect(sourceOf(null, "", own)).toBe("direct");
    expect(sourceOf(undefined, "not a url", own)).toBe("direct");
  });
});

describe("people, not bots", () => {
  it("drops link-preview fetchers and crawlers", () => {
    expect(isBot("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
    expect(isBot("")).toBe(true);
  });
  it("keeps real browsers", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    expect(isBot(iphone)).toBe(false);
    expect(deviceOf(iphone)).toBe("phone");
    expect(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130")).toBe("desktop");
  });
});

describe("the WhatsApp message", () => {
  it("a warm line, the title, the hook, a tagged link", () => {
    expect(whatsappText({ title: "The man behind the words", hook: "58 days.", url: "https://x.app/stories/a" })).toBe("I read this and thought of you.\n\n*The man behind the words*\n58 days.\n\nhttps://x.app/stories/a?s=wa");
  });
  it("the writer's own line when set", () => {
    expect(whatsappText({ line: "Hey, read this one.", title: "T", url: "https://x.app/s" }).split("\n")[0]).toBe("Hey, read this one.");
  });
  it("tags links once", () => {
    expect(tagged("https://x.app/a", "ig")).toBe("https://x.app/a?s=ig");
    expect(tagged("https://x.app/a?y=1", "wa")).toBe("https://x.app/a?y=1&s=wa");
  });
});

describe("the writer's numbers", () => {
  it("read-through and share rate", () => {
    expect(readThrough({ readers: 200, reads: 90 })).toBe(45);
    expect(readThrough({ readers: 0, reads: 0 })).toBe(0);
    expect(shareRate({ readers: 200, shares: 7 })).toBe(3.5);
  });
  it("fills empty days with zero", () => {
    const out = daily([{ day: "2026-11-01", views: 5 }], 3, new Date("2026-11-01T06:00:00Z"));
    expect(out).toEqual([
      { day: "2026-10-30", views: 0 },
      { day: "2026-10-31", views: 0 },
      { day: "2026-11-01", views: 5 },
    ]);
  });
});

import { clapsToAdd, MAX_CLAPS, shortCount } from "./reach";

describe("claps", () => {
  it("adds what's asked, up to 50 per reader", () => {
    expect(clapsToAdd(0, 3)).toBe(3);
    expect(clapsToAdd(48, 5)).toBe(2);
    expect(clapsToAdd(MAX_CLAPS, 1)).toBe(0);
    expect(clapsToAdd(0, 500)).toBe(50);
  });
  it("never takes claps away", () => {
    expect(clapsToAdd(10, -4)).toBe(0);
    expect(clapsToAdd(10, 2.9)).toBe(2);
  });
  it("short counts", () => {
    expect(shortCount(999)).toBe("999");
    expect(shortCount(1200)).toBe("1.2K");
    expect(shortCount(3000)).toBe("3K");
    expect(shortCount(15400)).toBe("15K");
  });
});
