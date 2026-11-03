/**
 * Story Studio's pure rules: where a reader came from, what counts as a
 * person (not a bot), the WhatsApp message, and the numbers the writer sees.
 * No database, no browser: tested on their own.
 */

export const CHANNELS = ["whatsapp", "instagram", "copy", "native", "x", "other"] as const;
export type Channel = (typeof CHANNELS)[number];
export const SOURCES = ["whatsapp", "instagram", "google", "home", "stories", "social", "direct", "other"] as const;
export type Source = (typeof SOURCES)[number];
export const EVENT_KINDS = ["view", "read", "listen", "share", "depth"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: "WhatsApp", instagram: "Instagram", copy: "Copied link", native: "Phone share", x: "X", other: "Other" };
export const SOURCE_LABEL: Record<Source, string> = { whatsapp: "WhatsApp", instagram: "Instagram", google: "Google", home: "Pen & Paper home", stories: "Stories page", social: "Other social", direct: "Direct / unknown", other: "Other sites" };

/**
 * Where a reader came from: the `?s=` our share links carry first (WhatsApp
 * strips the referrer, so we tag our own links), then the referrer's host.
 */
export function sourceOf(tag: string | null | undefined, referrer: string | null | undefined, ownHost: string): Source {
  const t = (tag ?? "").toLowerCase();
  if (t === "wa" || t === "whatsapp") return "whatsapp";
  if (t === "ig" || t === "instagram") return "instagram";
  if (t === "x") return "social";
  if (!referrer) return "direct";
  let host = "";
  let path = "";
  try {
    const u = new URL(referrer);
    host = u.hostname.replace(/^www\./, "");
    path = u.pathname;
  } catch {
    return "direct";
  }
  if (host === ownHost) return path.startsWith("/stories") ? "stories" : "home";
  if (/(^|\.)whatsapp\.(com|net)$/.test(host) || host === "wa.me") return "whatsapp";
  if (/(^|\.)instagram\.com$/.test(host) || host === "l.instagram.com") return "instagram";
  if (/(^|\.)google\.[a-z.]+$/.test(host) || host === "news.google.com") return "google";
  if (/(^|\.)(facebook|fb|t|twitter|x|linkedin|lnkd|reddit|threads)\.(com|me|in|net|co|org)$/.test(host) || host === "lnkd.in" || host === "t.co") return "social";
  return "other";
}

/** Link-preview fetchers, crawlers and headless browsers: never counted as readers. */
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|skype|preview|embedly|quora|pinterest|vkshare|headless|lighthouse|pagespeed|curl|wget|python|node-fetch|axios|go-http|java\//i;
export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT.test(userAgent);
}

export function deviceOf(userAgent: string | null | undefined): "phone" | "desktop" {
  return /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent ?? "") ? "phone" : "desktop";
}

/** The warm line a WhatsApp share starts with, unless the writer set one. */
export const DEFAULT_SHARE_LINE = "I read this and thought of you.";

/**
 * The message a reader sends on WhatsApp: a personal line, the title and its
 * hook, then the link (tagged so we know it came from WhatsApp).
 */
export function whatsappText(p: { line?: string; title: string; hook?: string; url: string }): string {
  const line = (p.line ?? "").trim() || DEFAULT_SHARE_LINE;
  const hook = (p.hook ?? "").trim();
  return [line, "", `*${p.title.trim()}*`, ...(hook ? [hook] : []), "", tagged(p.url, "wa")].join("\n");
}

/** A share link with where it went, so the visit it brings is counted there. */
export function tagged(url: string, s: "wa" | "ig" | "x" | "link"): string {
  return `${url}${url.includes("?") ? "&" : "?"}s=${s}`;
}

export type Totals = {
  views: number;
  readers: number;
  reads: number;
  listens: number;
  shares: number;
  byChannel: Record<string, number>;
  bySource: Record<string, number>;
  byDevice: Record<string, number>;
};

/** Read-through: of the people who opened it, how many reached the end. 0–100. */
export function readThrough(t: Pick<Totals, "readers" | "reads">): number {
  return t.readers ? Math.min(100, Math.round((t.reads / t.readers) * 100)) : 0;
}

/** Shares per 100 readers: how much a story travels. */
export function shareRate(t: Pick<Totals, "readers" | "shares">): number {
  return t.readers ? Math.round((t.shares / t.readers) * 1000) / 10 : 0;
}

/** Fills the days with no events with zero, oldest first, for a chart. */
export function daily(rows: { day: string; views: number }[], days: number, today: Date): { day: string; views: number }[] {
  const by = new Map(rows.map((r) => [r.day, r.views]));
  const out: { day: string; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    out.push({ day: key, views: by.get(key) ?? 0 });
  }
  return out;
}

/** Most claps one reader can give one story (like Medium): enough to say "a lot", not enough to rig the ranking. */
export const MAX_CLAPS = 50;

/** How many of `asked` new claps count, given what this reader already gave. Never negative. */
export function clapsToAdd(already: number, asked: number): number {
  const a = Math.max(0, Math.floor(already));
  const n = Math.max(0, Math.min(Math.floor(asked), MAX_CLAPS));
  return Math.max(0, Math.min(n, MAX_CLAPS - a));
}

/** "1.2K" for big numbers, the way people read counts on a phone. */
export function shortCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(n / 1000)}K`;
}

/* ---------- Attention: how far people read, and for how long ---------- */

/** A reader's furthest point in a story: the last block seen (0-based), and active seconds. */
export type Depth = { block: number; seconds: number };

/** Active reading caps at 2 hours: a tab left open overnight is not attention. */
export const MAX_ACTIVE_SECONDS = 7200;

/**
 * The retention curve: for each block, the share of readers (0–100) who
 * reached it. `depths` is each reader's furthest block. Readers with no depth
 * row (opened, then left before the first block came into view) count as 0%
 * reach beyond the top, so the curve starts from everyone who opened it.
 */
export function retention(depths: number[], blockCount: number, openers: number): number[] {
  const total = Math.max(openers, depths.length);
  if (!total || blockCount <= 0) return Array.from({ length: Math.max(0, blockCount) }, () => 0);
  const reached = new Array<number>(blockCount).fill(0);
  for (const d of depths) {
    const last = Math.min(Math.max(Math.floor(d), -1), blockCount - 1);
    for (let i = 0; i <= last; i++) reached[i]++;
  }
  return reached.map((n) => Math.round((n / total) * 100));
}

/**
 * Where the story loses the most people: the block after which the biggest
 * share of readers stopped, and that share (percentage points). Null when the
 * curve is flat or empty.
 */
export function biggestDrop(curve: number[]): { after: number; lost: number } | null {
  let best: { after: number; lost: number } | null = null;
  for (let i = 0; i < curve.length - 1; i++) {
    const lost = curve[i] - curve[i + 1];
    if (lost > 0 && (!best || lost > best.lost)) best = { after: i, lost };
  }
  return best;
}

/** The middle value: a typical reader, not skewed by one tab left open. */
export function median(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

/**
 * Average percentage read (YouTube's "average percentage viewed"): each
 * tracked reader's furthest block as a share of the story, averaged.
 */
export function averageRead(depths: number[], blockCount: number): number {
  if (!depths.length || blockCount <= 0) return 0;
  const sum = depths.reduce((t, d) => t + Math.min(Math.max(Math.floor(d) + 1, 0), blockCount) / blockCount, 0);
  return Math.round((sum / depths.length) * 100);
}

/** The plain mean, for "average attention" beside the median. */
export function mean(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}

/** "3 min 20 s", "45 s": how long people actually read. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/**
 * One live story's readers, as the writer compares stories: everyone who
 * opened it, how many of them in its first 7 days, how many got past the
 * opening (reached the third paragraph), finished it, and had already read
 * another story first (came back).
 */
export type StoryNumbers = { id: string; readers: number; week1: number; pastOpening: number; finished: number; returning: number };

/** n of d as a whole percent; 0 when there's nobody. */
export const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/** Stories with fewer readers than this say more about chance than about the writing, so they don't set "your usual". */
export const USUAL_MIN_READERS = 10;

/**
 * "Your usual": the median of the writer's other stories, for one measure.
 * Null until there are at least two other stories with enough readers to compare with,
 * so a story is never judged against one other story or a handful of friends.
 */
export function usual(others: StoryNumbers[], measure: (s: StoryNumbers) => number): number | null {
  const fair = others.filter((s) => s.readers >= USUAL_MIN_READERS);
  return fair.length >= 2 ? median(fair.map(measure)) : null;
}
