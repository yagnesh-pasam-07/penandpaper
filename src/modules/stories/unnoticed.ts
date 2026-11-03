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


/**
 * The catalogue: each post written down once, like a library card. The cover
 * is the post's first slide, kept in /public/unnoticed (Instagram's own picture
 * links expire within days). To add one: save its first slide as
 * public/unnoticed/<code>.webp (720 px wide) and add an entry here, newest first.
 */
export type Entry = {
  code: string;
  /** The words on the slide, in the post's own two lines. */
  title: [string, string];
  /** The little note on the slide ("manalo okadu", "on time."), if any. */
  aside?: string;
  /** Its chapter on the slide ("01 — The wish"), if any. */
  chapter?: string;
  /** The caption, as posted, without hashtags. */
  caption: string;
  shelves: Shelf[];
  /** What it's about, for the entry page (one line). */
  logline: string;
  /** Width / height of the cover. */
  ratio: number;
};

export const CATALOGUE: Entry[] = [
  {
    code: "DfSFR6gGC1Y",
    title: ["Roju anta varsham padithe,", "ela untundo telusa?"],
    aside: "Varsham ishtam unna vallaki matrame.",
    chapter: "For rain lovers",
    caption: "A whole day of rain.\nBlanket. Chai. Amma's food. Window seat.\nThat's enough for this life. 🌧️\nSend this to the one you thought of today.",
    shelves: ["nature", "humans"],
    logline: "A grey city through a window, and a whole day of rain. Blanket, chai, amma's food: enough for this life.",
    ratio: 720 / 901,
  },
  {
    code: "DfRAHymlMQP",
    title: ["Nannu kuda", "layoff chesendi ra."],
    aside: "manalo okadu",
    chapter: "The wish",
    caption: "Praying for a layoff. Scared of the EMI. 🙃\nEvery corporate guy's 9 AM, in 8 slides.\nSend this to the colleague who says \"I'll resign next month\" every month. 👇",
    shelves: ["behaviour", "humans"],
    logline: "A night bus, a tired head, and the one prayer every corporate guy whispers: please, let them fire me. (Then the EMI remembers him.)",
    ratio: 720 / 900,
  },
  {
    code: "DfQyL-TGGP3",
    title: ["Lechava?", "Sooryudu vachesadu."],
    aside: "on time.",
    chapter: "The morning",
    caption: "Good morning 🌞\nRaatri 2 ki \"repatinunchi start\" anukunnav.\nPodduna snooze kottav.\nSooryudu matram on time. ☀️",
    shelves: ["nature", "behaviour"],
    logline: "At 2 AM you swore it starts tomorrow. At 7 you hit snooze. The sun, as usual, showed up on time.",
    ratio: 720 / 900,
  },
  {
    code: "DfPd70ClC6F",
    title: ["Neeku ee gorre ki", "theda ledu."],
    aside: "nuvvu",
    chapter: "The flock",
    caption: "Idhi ela miss ayyav?",
    shelves: ["nature", "humans"],
    logline: "A shepherd, a road full of sheep, and the scooters stuck behind them. Spot yourself in the flock.",
    ratio: 720 / 900,
  },
  {
    code: "DfOrzOxlFkJ",
    title: ["Jeetham vachindi.", "Vachinatte vellipoyindi."],
    caption: "situation rn 🥲",
    shelves: ["behaviour", "humans"],
    logline: "Salary day, a street corner, and a man watching the month's money leave as fast as it came.",
    ratio: 720 / 900,
  },
  {
    code: "DfMdY1TFH7l",
    title: ["November 1st ochchesindi.", "Inka em peekaledu."],
    caption: "Depressionnnnnn....",
    shelves: ["behaviour", "humans"],
    logline: "A tiffin centre, a clock on the wall, and a man realising the year is almost over and the list isn't.",
    ratio: 720 / 965,
  },
];

/** The cover's address on our own site. */
export const coverOf = (code: string) => `/unnoticed/${code}.webp`;

/** The catalogue, newest first, each numbered in the order it was posted. */
export function catalogue(): (Entry & { no: number })[] {
  return CATALOGUE.map((e, i) => ({ ...e, no: CATALOGUE.length - i }));
}

/** One entry, or null. */
export function entry(code: string) {
  return catalogue().find((e) => e.code === code) ?? null;
}

/** Posts picked by hand: the catalogue, for the embed fallback and the API merge. */
export const PINNED: string[] = CATALOGUE.map((e) => `https://www.instagram.com/p/${e.code}/`);

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
