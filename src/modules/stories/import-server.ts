import "server-only";
import sharp from "sharp";
import { imageLine } from "./markdown";
import { htmlToMarkdown, isMediumImage, mediumFeedUrl, mediumPostId, postFromFeed } from "./medium";
import { createStory, PART_CHARS, putMediaPart, saveStory, startMedia } from "./server";

/** https on medium.com or one of its subdomains (pictures, feeds), nothing else. */
function onMedium(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "medium.com" || u.hostname.endsWith(".medium.com"));
  } catch {
    return false;
  }
}

/** Fetches from Medium, following up to three redirects, each one checked to stay on Medium's own hosts. */
async function get(url: string, hops = 3): Promise<Response> {
  const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "PenAndPaper/1.0 (+stories import)" } });
  const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
  if (!next) return res;
  const to = new URL(next, url).toString();
  if (hops <= 0 || !onMedium(to)) throw new Error("Redirected off Medium.");
  return get(to, hops - 1);
}

/** Copies one Medium picture into the story, as WebP at most 2000px wide. */
async function copyImage(storyId: string, src: string): Promise<string | null> {
  if (!isMediumImage(src)) return null;
  try {
    const res = await get(src.replace("/max/1024/", "/max/2000/"));
    if (!res.ok) return null;
    const img = sharp(Buffer.from(await res.arrayBuffer()));
    const out = await img.resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const data = out.data.toString("base64");
    const parts = Math.max(1, Math.ceil(data.length / PART_CHARS));
    const id = await startMedia(storyId, { kind: "image", contentType: "image/webp", size: out.data.length, parts, width: out.info.width, height: out.info.height });
    for (let n = 0; n < parts; n++) await putMediaPart(id, n, data.slice(n * PART_CHARS, (n + 1) * PART_CHARS));
    return id;
  } catch {
    return null;
  }
}

/**
 * Imports a Medium post into a new draft: the words as our Markdown, every
 * picture copied in (so nothing depends on Medium later), the first one as the
 * cover, and "First published on medium.com" at the end. Reads only the
 * author's public RSS feed, which carries the full post.
 */
export async function importMedium(authorId: string, url: string): Promise<{ id: string } | { error: string }> {
  if (!onMedium(url)) return { error: "Paste the address of a Medium post." };
  const postId = mediumPostId(url);
  const feedUrl = mediumFeedUrl(url);
  if (!postId || !feedUrl) return { error: "Paste the address of a Medium post." };
  const feed = await get(feedUrl).catch(() => null);
  if (!feed?.ok) return { error: "Medium didn't answer. Try again in a minute." };
  const post = postFromFeed(await feed.text(), postId);
  if (!post) return { error: "That post isn't in the author's feed (Medium's feed holds the last 10 posts)." };
  const { body, images } = htmlToMarkdown(post.html);
  const id = await createStory(authorId, { title: post.title, originalUrl: post.link });
  const ids = await Promise.all(images.map((im) => copyImage(id, im.src)));
  // A first picture before any words becomes the cover.
  let md = body;
  let cover: { id: string; caption: string } | null = null;
  if (md.startsWith("{{img:0}}") && ids[0]) {
    cover = { id: ids[0], caption: images[0].caption };
    md = md.replace(/^\{\{img:0\}\}\s*/, "");
  }
  md = md.replace(/\{\{img:(\d+)\}\}/g, (_m, n: string) => (ids[+n] ? imageLine(ids[+n]!, images[+n].caption) : ""));
  md = md.replace(/\n{3,}/g, "\n\n").trim();
  await saveStory(id, { body: md, coverMediaId: cover?.id ?? null, coverCaption: cover?.caption ?? "" });
  return { id };
}
