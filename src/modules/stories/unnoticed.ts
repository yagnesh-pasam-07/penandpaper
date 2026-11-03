import "server-only";
import { cacheLife, cacheTag } from "next/cache";

/**
 * "Unnoticed", by Pen & Paper: short pieces for the Telugu audience, humans,
 * nature and how people behave, told for a laugh. They live on Instagram
 * (@unnoticed.moment); this reads them from Instagram's own API so the site
 * shows every post without copying anything by hand.
 *
 * Instagram has no public "read anyone's posts" API. The account must be a
 * Professional (Creator or Business) account, and it needs a token from Meta's
 * "Instagram API with Instagram Login" for that same account:
 *   INSTAGRAM_TOKEN  a long-lived token (60 days; refreshed below while the site is used).
 * Without it the page still works: it says where to find the posts.
 */
export const UNNOTICED = { handle: "unnoticed.moment", url: "https://www.instagram.com/unnoticed.moment/" } as const;
export const UNNOTICED_TAG = "unnoticed";

/**
 * Posts picked by hand, newest first: they show at once, token or not, through
 * Instagram's own embed. Paste a post's address here to add it (the ?hl=… and
 * img_index bits are ignored). With INSTAGRAM_TOKEN set, every post comes in
 * by itself and these just make sure nothing listed is missed.
 */
export const PINNED: string[] = [
  "https://www.instagram.com/p/DfRAHymlMQP/",
  "https://www.instagram.com/p/DfQyL-TGGP3/",
  "https://www.instagram.com/p/DfPd70ClC6F/",
  "https://www.instagram.com/p/DfOrzOxlFkJ/",
  "https://www.instagram.com/p/DfMdY1TFH7l/",
];

/** A post's short code from any of its addresses (/p/…, /reel/…, with or without ?hl=…), or null if it isn't one. */
export function shortcode(url: string): string | null {
  const m = /^https:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})\/?(?:[?#].*)?$/.exec(url.trim());
  return m ? m[1] : null;
}

export type Post = {
  id: string;
  kind: "image" | "video" | "carousel";
  caption: string;
  /** What to show: the picture, or a video's cover frame. Instagram's CDN, signed; it changes, so it's re-read hourly. */
  image: string | null;
  /** The post's short code: what Instagram's embed is built from. */
  code: string;
  /** A reel's playable file, when Instagram gives one. */
  video: string | null;
  link: string;
  at: string;
  /** Hearts and comments on Instagram (only with the token; null for a pinned post). What ranks the shelves. */
  likes: number | null;
  comments: number | null;
  /** Which shelves it sits on, from its hashtags. */
  shelves: Shelf[];
};

/**
 * The shelves, like Netflix rows: one post connects with one person, the next
 * with someone else. A post goes on a shelf when its caption carries one of
 * its tags (English or Telugu), so tagging on Instagram is all it takes.
 */
export const SHELVES = [
  { key: "humans", title: "Manushulu", sub: "people, as they are", tags: ["humans", "human", "people", "family", "amma", "nanna", "friends", "manushulu", "మనుషులు"] },
  { key: "behaviour", title: "Alavaatlu", sub: "the little things we all do", tags: ["behaviour", "behavior", "habits", "relatable", "middleclass", "alavaatlu", "అలవాట్లు"] },
  { key: "nature", title: "Prakruti", sub: "nature, noticed", tags: ["nature", "rain", "sky", "trees", "animals", "village", "prakruti", "ప్రకృతి"] },
] as const;
export type Shelf = (typeof SHELVES)[number]["key"];

/** The shelves a caption puts a post on, from its hashtags. */
export function shelvesOf(caption: string): Shelf[] {
  const tags = new Set([...caption.matchAll(/#([\p{L}\p{M}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase()));
  return SHELVES.filter((sh) => sh.tags.some((t) => tags.has(t))).map((sh) => sh.key);
}

type Raw = { id: string; caption?: string; media_type?: string; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp?: string; like_count?: number; comments_count?: number };

/** Instagram's answer as posts: unknown kinds and posts without a link are left out. */
export function toPosts(rows: Raw[]): Post[] {
  return rows
    .filter((r) => r.id && r.permalink && shortcode(r.permalink))
    .map((r) => {
      const kind = r.media_type === "VIDEO" ? "video" : r.media_type === "CAROUSEL_ALBUM" ? "carousel" : "image";
      const safe = (u?: string) => (u && u.startsWith("https://") ? u : null);
      return {
        id: r.id,
        kind,
        caption: (r.caption ?? "").trim(),
        image: kind === "video" ? safe(r.thumbnail_url) : safe(r.media_url),
        video: kind === "video" ? safe(r.media_url) : null,
        code: shortcode(r.permalink!)!,
        link: r.permalink!,
        at: r.timestamp ? new Date(r.timestamp).toISOString() : new Date(0).toISOString(),
        likes: typeof r.like_count === "number" ? r.like_count : null,
        comments: typeof r.comments_count === "number" ? r.comments_count : null,
        shelves: shelvesOf(r.caption ?? ""),
      };
    });
}

/** A caption's first line as its title, and the rest; hashtags at the end are dropped (they're for Instagram, not readers). */
export function splitCaption(caption: string): { title: string; rest: string } {
  const clean = caption.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, "").trim();
  const [first = "", ...more] = clean.split(/\n+/);
  return { title: first.trim(), rest: more.join("\n").trim() };
}

const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
const PAGES = 5;

/**
 * Every post, newest first (up to 5 pages of 50). Cached for an hour on the
 * server, so a busy day costs Instagram one call an hour, far inside its limit.
 * Null when there's no token or Instagram doesn't answer: the page says so quietly.
 */
export async function unnoticedPosts(): Promise<Post[] | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(UNNOTICED_TAG);
  const token = process.env.INSTAGRAM_TOKEN?.trim();
  if (!token) return null;
  try {
    const out: Raw[] = [];
    let next: string | null = `https://graph.instagram.com/me/media?fields=${FIELDS}&limit=50&access_token=${encodeURIComponent(token)}`;
    for (let i = 0; next && i < PAGES; i++) {
      const res: Response = await fetch(next, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) {
        console.error("unnoticed: Instagram said", res.status);
        return out.length ? toPosts(out) : null;
      }
      const body = (await res.json()) as { data?: Raw[]; paging?: { next?: string } };
      out.push(...(body.data ?? []));
      next = body.paging?.next?.startsWith("https://graph.instagram.com/") ? body.paging.next : null;
    }
    void refreshToken(token);
    return toPosts(out).sort((a, b) => b.at.localeCompare(a.at));
  } catch (e) {
    console.error("unnoticed: Instagram didn't answer", e);
    return null;
  }
}

/**
 * Keeps the long-lived token alive: Instagram extends it another 60 days when
 * asked (at most once a day, and only once it is a day old). The new token is
 * the same string, so nothing needs saving; if Meta ever returns a different
 * one, the log says to update INSTAGRAM_TOKEN.
 */
async function refreshToken(token: string): Promise<void> {
  "use cache";
  cacheLife("days");
  try {
    const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return;
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (body.access_token && body.access_token !== token) console.warn("unnoticed: Instagram issued a new token; update INSTAGRAM_TOKEN on Vercel.");
  } catch {}
}

/**
 * What the page shows, newest first: every post from Instagram when the token
 * is set, plus any pinned post it didn't return (each once). Pinned posts have
 * no caption or date of their own here: Instagram's embed draws them.
 */
export function mergePosts(fromApi: Post[] | null, pinned: string[] = PINNED): Post[] {
  const seen = new Set((fromApi ?? []).map((p) => p.code));
  const extra: Post[] = [];
  for (const url of pinned) {
    const code = shortcode(url);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    extra.push({ id: code, code, kind: "image", caption: "", image: null, video: null, link: `https://www.instagram.com/p/${code}/`, at: "", likes: null, comments: null, shelves: [] });
  }
  // Pinned ones are listed newest first and have no date, so they keep their order; dated ones sort by date.
  return fromApi?.length ? [...extra, ...fromApi] : extra;
}

/**
 * Like IMDB's rating: how loved a post is against the account's own posts, out
 * of 10, so it means the same whether the page has 500 followers or 50,000.
 * Hearts count once, comments three times (saying something is more than a tap).
 * 10 is the most-loved post; null without numbers.
 */
export function rating(post: Post, all: Post[]): number | null {
  const score = (p: Post) => (p.likes === null ? null : p.likes + 3 * (p.comments ?? 0));
  const mine = score(post);
  const best = Math.max(0, ...all.map((p) => score(p) ?? 0));
  if (mine === null || best <= 0) return null;
  // A square root, so one viral post doesn't make every other post look like a 1.
  return Math.max(1, Math.round(Math.sqrt(mine / best) * 100) / 10);
}

/** "1.2k", "34": a count as Instagram shows it. */
export function short(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
