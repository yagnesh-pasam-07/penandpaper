import { describe, expect, it } from "vitest";
import { averageRead, biggestDrop, daily, deviceOf, duration, isBot, mean, median, readThrough, retention, shareRate, sourceOf, tagged, whatsappText } from "./reach";

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

describe("attention", () => {
  it("retention counts everyone who opened, including those who saw no block", () => {
    // 4 opened; one left at the top (no depth row), others reached blocks 0, 2 and 4 of 5
    expect(retention([0, 2, 4], 5, 4)).toEqual([75, 50, 50, 25, 25]);
  });
  it("depth beyond the last block is clamped; empty stories give zeros", () => {
    expect(retention([99], 3, 1)).toEqual([100, 100, 100]);
    expect(retention([], 3, 0)).toEqual([0, 0, 0]);
    expect(retention([1], 0, 1)).toEqual([]);
  });
  it("finds the paragraph where most people leave", () => {
    expect(biggestDrop([100, 90, 50, 45])).toEqual({ after: 1, lost: 40 });
    expect(biggestDrop([100, 100])).toBeNull();
    expect(biggestDrop([])).toBeNull();
  });
  it("median is a typical reader, not the tab left open", () => {
    expect(median([30, 40, 7200])).toBe(40);
    expect(median([10, 20])).toBe(15);
    expect(median([])).toBe(0);
  });
  it("average read is each reader's share of the story, averaged", () => {
    expect(averageRead([3, 1], 4)).toBe(75);
    expect(averageRead([99, -1], 4)).toBe(50);
    expect(averageRead([], 4)).toBe(0);
    expect(averageRead([2], 0)).toBe(0);
  });
  it("mean is the plain average", () => {
    expect(mean([30, 60])).toBe(45);
    expect(mean([])).toBe(0);
  });
  it("durations read like a person says them", () => {
    expect(duration(45)).toBe("45 s");
    expect(duration(200)).toBe("3 min 20 s");
    expect(duration(180)).toBe("3 min");
  });
});
