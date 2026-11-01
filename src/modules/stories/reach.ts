/**
 * Story Studio's pure rules: where a reader came from, what counts as a
 * person (not a bot), the WhatsApp message, and the numbers the writer sees.
 * No database, no browser: tested on their own.
 */

export const CHANNELS = ["whatsapp", "instagram", "copy", "native", "x", "other"] as const;
export type Channel = (typeof CHANNELS)[number];
export const SOURCES = ["whatsapp", "instagram", "google", "home", "stories", "social", "direct", "other"] as const;
export type Source = (typeof SOURCES)[number];
export const EVENT_KINDS = ["view", "read", "listen", "share"] as const;
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
