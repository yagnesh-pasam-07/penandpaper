/**
 * Stories, the pure rules: addresses, reading time, and when a story is live.
 * No database and no browser, so they are tested on their own.
 */

export const CATEGORIES = ["human", "history", "art"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABEL: Record<Category, string> = { human: "Human story", history: "History", art: "Art" };

/** Words a minute, read calmly on a phone (slower than the usual 238). */
export const WORDS_PER_MINUTE = 200;

export type StoryState = "draft" | "scheduled" | "published";

/** What the writer sees: draft, scheduled (published, but not yet), or published. */
export function storyState(status: "draft" | "published", publishAt: Date | string | null, now: Date = new Date()): StoryState {
  if (status !== "published" || !publishAt) return "draft";
  return new Date(publishAt).getTime() > now.getTime() ? "scheduled" : "published";
}

/** Whether the public can read it now. */
export function isLive(status: "draft" | "published", publishAt: Date | string | null, now: Date = new Date()): boolean {
  return storyState(status, publishAt, now) === "published";
}

/**
 * "The man behind the words!" → "the-man-behind-the-words". Latin letters and
 * digits only (accents dropped), at most 80 characters, cut at a word. A title
 * with no Latin letters (all Telugu, say) gets "story".
 */
export function slugify(title: string): string {
  const s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) return "story";
  if (s.length <= 80) return s;
  const cut = s.slice(0, 81);
  const at = cut.lastIndexOf("-");
  return (at > 20 ? cut.slice(0, at) : s.slice(0, 80)).replace(/-+$/g, "");
}

/** The first free slug: `base`, then `base-2`, `base-3`… */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Whether a slug is well formed (so a hand-edited one can be checked). */
export function isSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80;
}

/** Minutes to read, at least one; counts words in any script, ignoring Markdown marks and image lines. */
export function readingMinutes(body: string): number {
  const text = body
    .split("\n")
    .filter((l) => !/^\s*!\[/.test(l))
    .join(" ")
    .replace(/[#>*_`~[\]()-]/g, " ");
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** "3 min read". */
export const readLabel = (m: number) => `${m} min read`;

/** "1 Nov 2026" in India's time, the same for every reader. */
export function storyDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** "4:05" for an audio length in seconds. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const LANGUAGES = ["en", "te"] as const;
export type Language = (typeof LANGUAGES)[number];
/** What the switch says, written in the language it switches to. */
export const READ_IN: Record<Language, string> = { en: "Read in English", te: "తెలుగులో చదవండి" };

export type Source = { text: string; href: string | null };

/**
 * The sources box: one per line. A line may end with a web address
 * ("Andhra Pradesh Day — https://en.wikipedia.org/…"), which becomes the link;
 * a line that is only an address shows its site. Blank lines are skipped.
 */
export function parseSources(raw: string): Source[] {
  return raw
    .split("\n")
    .map((l) => l.trim().replace(/^[-•*]\s+/, ""))
    .filter(Boolean)
    .slice(0, 30)
    .map((line) => {
      const m = /(https?:\/\/\S+)\s*$/.exec(line);
      if (!m) return { text: line, href: null };
      const href = m[1];
      const text = line.slice(0, m.index).replace(/[\s—–:-]+$/, "").trim();
      let site = href;
      try {
        site = new URL(href).hostname.replace(/^www\./, "");
      } catch {
        return { text: line, href: null };
      }
      return { text: text || site, href };
    });
}

/** The series page's address part: "The man behind the words" → "the-man-behind-the-words". */
export const seriesSlug = (name: string) => slugify(name);
