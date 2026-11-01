import { describe, expect, it } from "vitest";
import { toBlocks, toMarkdown } from "./blocks";
import { isLive, isSlug, parseSources, readingMinutes, seriesSlug, slugify, storyState, uniqueSlug } from "./logic";
import { firstLine, imageLine, inline, parse, safeHref } from "./markdown";
import { htmlToMarkdown, mediumFeedUrl, mediumPostId, postFromFeed } from "./medium";

const now = new Date("2026-11-01T06:00:00Z");
const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("scheduling", () => {
  it("a draft is never live", () => {
    expect(storyState("draft", null, now)).toBe("draft");
    expect(storyState("draft", "2026-10-01T00:00:00Z", now)).toBe("draft");
    expect(isLive("draft", "2026-10-01T00:00:00Z", now)).toBe(false);
  });
  it("published with a time still ahead is scheduled, and not live", () => {
    expect(storyState("published", "2026-11-08T03:30:00Z", now)).toBe("scheduled");
    expect(isLive("published", "2026-11-08T03:30:00Z", now)).toBe(false);
  });
  it("goes live the moment its time comes", () => {
    expect(isLive("published", "2026-11-01T06:00:00Z", now)).toBe(true);
    expect(isLive("published", new Date(now.getTime() - 1), now)).toBe(true);
    expect(isLive("published", new Date(now.getTime() + 1), now)).toBe(false);
  });
  it("published without a time is treated as a draft", () => {
    expect(isLive("published", null, now)).toBe(false);
  });
});

describe("slugs", () => {
  it("reads like the title", () => {
    expect(slugify("The man behind the words")).toBe("the-man-behind-the-words");
    expect(slugify("Death: The Ultimate Truth")).toBe("death-the-ultimate-truth");
    expect(slugify("  Café & Crème — it's 6:30 a.m.!  ")).toBe("cafe-and-creme-its-6-30-a-m");
  });
  it("has a fallback for titles with no Latin letters", () => {
    expect(slugify("మాట వెనుక మనిషి")).toBe("story");
    expect(slugify("")).toBe("story");
  });
  it("is at most 80 characters, cut at a word", () => {
    const s = slugify("a very long title that goes on and on about the sunrise and the sunset and the sea and the hills");
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
    expect(isSlug(s)).toBe(true);
  });
  it("finds the first free one", () => {
    expect(uniqueSlug("death", [])).toBe("death");
    expect(uniqueSlug("death", ["death", "death-2"])).toBe("death-3");
  });
  it("checks hand-written slugs", () => {
    expect(isSlug("ok-slug-2")).toBe(true);
    expect(isSlug("Bad Slug")).toBe(false);
    expect(isSlug("-x")).toBe(false);
  });
});

describe("reading time", () => {
  it("is at least a minute, about 200 words a minute, pictures not counted", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("word ".repeat(1000))).toBe(5);
    expect(readingMinutes(`${"word ".repeat(400)}\n\n${imageLine(ID, "a ".repeat(500))}`)).toBe(2);
  });
  it("counts words in Telugu too", () => {
    expect(readingMinutes("మాట ".repeat(600))).toBe(3);
  });
});

describe("markdown", () => {
  it("reads paragraphs, headings, quotes, breaks and pictures", () => {
    const blocks = parse(`Hello *you*.\nNext line.\n\n## A turn\n\n> Said softly\n\n---\n\n${imageLine(ID, "The sea", "Yagnesh")}`);
    expect(blocks.map((b) => b.t)).toEqual(["p", "h", "quote", "hr", "img"]);
    expect(blocks[4]).toEqual({ t: "img", id: ID, caption: "The sea", credit: "Yagnesh" });
    expect(blocks[0]).toEqual({ t: "p", c: [{ t: "text", v: "Hello " }, { t: "em", c: [{ t: "text", v: "you" }] }, { t: "text", v: "." }, { t: "br" }, { t: "text", v: "Next line." }] });
  });
  it("never makes an unsafe link", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("https://medium.com/x")).toBe("https://medium.com/x");
    expect(inline("[x](javascript:alert(1))")).toEqual([{ t: "text", v: "[x](javascript:alert(1))" }]);
    expect(inline("[x](https://a.b)")).toEqual([{ t: "link", href: "https://a.b", c: [{ t: "text", v: "x" }] }]);
  });
  it("reads a list of lines starting with a dash", () => {
    expect(parse("- **1901**: born\n- [a](https://a.b)")).toEqual([
      { t: "list", items: [[{ t: "strong", c: [{ t: "text", v: "1901" }] }, { t: "text", v: ": born" }], [{ t: "link", href: "https://a.b", c: [{ t: "text", v: "a" }] }]] },
    ]);
  });
  it("italics on each of two lines", () => {
    expect(inline("*one*\n*two*")).toEqual([{ t: "em", c: [{ t: "text", v: "one" }] }, { t: "br" }, { t: "em", c: [{ t: "text", v: "two" }] }]);
  });
  it("gives a plain first line", () => {
    expect(firstLine("## Head\n\nSay a **word** for me.")).toBe("Say a word for me.");
  });
});

describe("editor blocks", () => {
  it("round-trips Markdown", () => {
    const md = `First *para*\nwith a break.\n\n## Heading\n\n> One\n> Two\n\n---\n\n${imageLine(ID, "Sea", "Me")}\n\nLast.`;
    let k = 0;
    expect(toMarkdown(toBlocks(md, () => `k${k++}`))).toBe(md);
  });
  it("drops empty paragraphs and keeps a paragraph that looks like a heading a paragraph", () => {
    const md = toMarkdown([
      { key: "a", t: "p", text: "" },
      { key: "b", t: "p", text: "# not a heading" },
    ]);
    expect(parse(md).map((b) => b.t)).toEqual(["p"]);
  });
  it("keeps a list as one block through the editor", () => {
    const md = "Before.\n\n- one\n- two\n\nAfter.";
    let k = 0;
    expect(toMarkdown(toBlocks(md, () => `k${k++}`))).toBe(md);
  });
  it("an empty story is one empty paragraph", () => {
    expect(toBlocks("")).toHaveLength(1);
  });
});

describe("Medium import", () => {
  it("finds the post and its feed from its address", () => {
    const url = "https://medium.com/@yagneshpasam0/death-the-ultimate-truth-151312f8b98d";
    expect(mediumPostId(url)).toBe("151312f8b98d");
    expect(mediumFeedUrl(url)).toBe("https://medium.com/feed/@yagneshpasam0");
    expect(mediumPostId("https://example.com/x-151312f8b98d")).toBeNull();
  });
  it("reads one post from a feed", () => {
    const xml = `<rss><channel><item><title><![CDATA[Death: The Ultimate Truth]]></title><link>https://medium.com/@y/death-151312f8b98d?source=rss</link><guid isPermaLink="false">https://medium.com/p/151312f8b98d</guid><pubDate>Mon, 27 Oct 2026 10:00:00 GMT</pubDate><content:encoded><![CDATA[<p>Hi</p>]]></content:encoded></item></channel></rss>`;
    expect(postFromFeed(xml, "151312f8b98d")).toEqual({ title: "Death: The Ultimate Truth", link: "https://medium.com/@y/death-151312f8b98d", html: "<p>Hi</p>", published: "Mon, 27 Oct 2026 10:00:00 GMT" });
    expect(postFromFeed(xml, "aaaaaaaaaaaa")).toBeNull();
  });
  it("turns post HTML into Markdown with picture slots", () => {
    const html = `<figure><img alt="" src="https://cdn-images-1.medium.com/max/1024/1*a.jpeg" /><figcaption><em>One sunrise, one sunset.</em></figcaption></figure><blockquote>Life is beautiful.</blockquote><p>We are <strong>born</strong> &amp; we <em>grow</em>.</p><figure><img src="https://cdn-images-1.medium.com/max/1024/1*b.jpeg" /><figcaption>Line one<br> line two</figcaption></figure><img src="https://medium.com/_/stat?event=x" width="1" height="1" alt="">`;
    const out = htmlToMarkdown(html);
    expect(out.body).toBe("{{img:0}}\n\n> Life is beautiful.\n\nWe are **born** & we *grow*.\n\n{{img:1}}");
    expect(out.images).toEqual([
      { src: "https://cdn-images-1.medium.com/max/1024/1*a.jpeg", caption: "One sunrise, one sunset." },
      { src: "https://cdn-images-1.medium.com/max/1024/1*b.jpeg", caption: "Line one / line two" },
    ]);
  });
});

describe("sources and series", () => {
  it("reads one source a line, with or without a link", () => {
    expect(
      parseSources("- Andhra Pradesh Day — https://en.wikipedia.org/wiki/Andhra_Pradesh_Day\n\nThe Hindu archives, 16 Dec 1952\nhttps://thenewsminute.com/x"),
    ).toEqual([
      { text: "Andhra Pradesh Day", href: "https://en.wikipedia.org/wiki/Andhra_Pradesh_Day" },
      { text: "The Hindu archives, 16 Dec 1952", href: null },
      { text: "thenewsminute.com", href: "https://thenewsminute.com/x" },
    ]);
  });
  it("never links anything but http(s)", () => {
    expect(parseSources("Bad javascript:alert(1)")).toEqual([{ text: "Bad javascript:alert(1)", href: null }]);
  });
  it("a series has a readable address", () => {
    expect(seriesSlug("The man behind the words")).toBe("the-man-behind-the-words");
  });
});
