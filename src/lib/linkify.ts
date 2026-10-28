/** Splitting text so web links render as links. */

export type TextPart = { kind: "text"; value: string } | { kind: "link"; value: string; href: string };

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}])/gi;

/** Splits text so links can render as links. Only http(s) links are ever made. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: "text", value: text.slice(last, start) });
    const value = match[0];
    parts.push({ kind: "link", value, href: value.toLowerCase().startsWith("www.") ? `https://${value}` : value });
    last = start + value.length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

const YT_ID = /^[\w-]{11}$/;

/** The video id in a YouTube link (watch, youtu.be, shorts, embed, live), or null. */
export function youtubeId(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [kind, rest] = url.pathname.split("/").filter(Boolean);
    id = kind === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live", "v"].includes(kind) ? (rest ?? null) : null;
  }
  return id && YT_ID.test(id) ? id : null;
}

/** The first YouTube video linked in some text, if any. */
export function firstYoutube(text: string): { id: string; href: string } | null {
  for (const part of linkify(text)) {
    if (part.kind !== "link") continue;
    const id = youtubeId(part.href);
    if (id) return { id, href: part.href };
  }
  return null;
}

/** The first link in some text, taken apart for a preview: the site (no "www."), and its path without the leading slash or a trailing one. */
export function firstLink(text: string): { href: string; host: string; path: string } | null {
  for (const part of linkify(text)) {
    if (part.kind !== "link") continue;
    try {
      const url = new URL(part.href);
      return { href: part.href, host: url.hostname.replace(/^www\./, ""), path: decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "") };
    } catch {
      continue;
    }
  }
  return null;
}

/** Whether a note is nothing but one YouTube link (so the preview can stand in for the raw address). */
export function isOnlyYoutube(text: string): boolean {
  const parts = linkify(text).filter((p) => p.kind === "link" || p.value.trim() !== "");
  return parts.length === 1 && parts[0].kind === "link" && youtubeId(parts[0].href) !== null;
}
