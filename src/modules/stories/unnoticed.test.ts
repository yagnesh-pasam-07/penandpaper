import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
import { mergePosts, rating, shelvesOf, short, shortcode, splitCaption, toPosts } from "./unnoticed";

describe("shortcode", () => {
  it("reads a post's code from the addresses people paste", () => {
    expect(shortcode("https://www.instagram.com/p/DfRAHymlMQP/?hl=en&img_index=1")).toBe("DfRAHymlMQP");
    expect(shortcode("https://instagram.com/reel/Abc_12-x/")).toBe("Abc_12-x");
    expect(shortcode("https://www.instagram.com/unnoticed.moment/p/DfRAHymlMQP/")).toBe("DfRAHymlMQP");
  });
  it("refuses anything else", () => {
    for (const u of ["https://www.instagram.com/unnoticed.moment/", "https://evil.com/p/DfRAHymlMQP/", "javascript:alert(1)", "https://www.instagram.com/p/a/"]) expect(shortcode(u)).toBeNull();
  });
});

describe("posts", () => {
  const raw = (id: string, code: string, at: string, type = "IMAGE") => ({ id, caption: "Line one\nmore words #telugu #funny", media_type: type, media_url: "https://cdn/x.jpg", thumbnail_url: "https://cdn/t.jpg", permalink: `https://www.instagram.com/p/${code}/`, timestamp: at });
  it("keeps a video's cover as its picture", () => {
    const [p] = toPosts([raw("1", "AAAAAA", "2026-11-01T10:00:00+0000", "VIDEO")]);
    expect(p).toMatchObject({ kind: "video", image: "https://cdn/t.jpg", video: "https://cdn/x.jpg", code: "AAAAAA" });
  });
  it("adds pinned posts Instagram didn't return, once each, in front", () => {
    const api = toPosts([raw("1", "AAAAAA", "2026-11-01T10:00:00+0000")]);
    const all = mergePosts(api, ["https://www.instagram.com/p/AAAAAA/?hl=en", "https://www.instagram.com/p/BBBBBB/", "https://www.instagram.com/p/BBBBBB/?img_index=2"]);
    expect(all.map((p) => p.code)).toEqual(["BBBBBB", "AAAAAA"]);
  });
  it("works with no token: just the pinned ones", () => {
    expect(mergePosts(null, ["https://www.instagram.com/p/CCCCCC/"]).map((p) => p.code)).toEqual(["CCCCCC"]);
  });
  it("drops hashtags from the end of a caption and splits off the title", () => {
    expect(splitCaption("Ammamma vs WiFi\nshe won #telugu #comedy")).toEqual({ title: "Ammamma vs WiFi", rest: "she won" });
  });
});

describe("shelves and rating", () => {
  const p = (code: string, likes: number | null, comments = 0, caption = "") => ({ id: code, code, kind: "image" as const, caption, image: null, video: null, link: "", at: "", likes, comments, shelves: shelvesOf(caption) });
  it("puts a post on a shelf by its hashtags, in English or Telugu", () => {
    expect(shelvesOf("Ammamma and the remote #family #Relatable")).toEqual(["humans", "behaviour"]);
    expect(shelvesOf("వాన #ప్రకృతి")).toEqual(["nature"]);
    expect(shelvesOf("no tags here")).toEqual([]);
  });
  it("rates out of 10 against the page's own best, comments worth more than hearts", () => {
    const all = [p("a", 1000, 0), p("b", 250, 0), p("c", 100, 50), p("d", null)];
    expect(rating(all[0], all)).toBe(10);
    expect(rating(all[1], all)).toBe(5);
    expect(rating(all[2], all)).toBe(5);
    expect(rating(all[3], all)).toBeNull();
  });
  it("shows counts the way Instagram does", () => {
    expect([short(34), short(1234), short(15_400), short(2_300_000)]).toEqual(["34", "1.2k", "15k", "2.3M"]);
  });
});
