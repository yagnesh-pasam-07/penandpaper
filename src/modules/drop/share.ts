import { createHash } from "node:crypto";
import { MAX_THOUGHT } from "./logic";

/** What the phone's share sheet hands over: any of the three can be missing or empty. */
export type ShareFields = { title?: string | null; text?: string | null; url?: string | null };

/** The longest field read at all; anything past it is cut before it is worked on. */
const FIELD_MAX = 4000;

/** The pictures a share can carry. */
export const SHARE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

function clean(value: string | null | undefined): string {
  return (value ?? "").slice(0, FIELD_MAX).replace(/\r\n?/g, "\n").trim();
}

/** The link as sent, only if it is an http(s) address; anything else (javascript:, data:, junk) is nothing. */
export function cleanUrl(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw || /\s/.test(raw)) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

/**
 * One thought from a share: the title, the text and the link, each on its own
 * line, leaving out what repeats. Android often puts the link inside the text
 * (and sends no `url`), and some apps send the same words as title and text.
 * Cut to MAX_THOUGHT.
 */
export function buildShareText(fields: ShareFields): string {
  const title = clean(fields.title);
  const text = clean(fields.text);
  const url = cleanUrl(fields.url);
  const lines: string[] = [];
  if (title && title !== text && !text.includes(title)) lines.push(title);
  if (text) lines.push(text);
  if (url && !text.includes(url) && !title.includes(url)) lines.push(url);
  return lines.join("\n").slice(0, MAX_THOUGHT).trim();
}

/** A thought typed into the quick box: tidied and cut to the length of a thought, or null when it is empty. */
export function captureText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n?/g, "\n").trim().slice(0, MAX_THOUGHT).trim();
  return text || null;
}

/**
 * Whether a request to save a quick thought came from this site's own page.
 * A page on another site can't send `Sec-Fetch-Site: same-origin`; when a
 * browser sends no such header at all, the `Origin` must be this site's.
 */
export function isSameSite(headers: { get(name: string): string | null }, origin: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  return headers.get("origin") === origin;
}

/**
 * Whether the request was sent by a browser extension: its `Origin` is the
 * extension's own (`chrome-extension://<id>`, `moz-extension://<id>`). A browser
 * sets `Origin` itself and a web page can't change it, so no website can pass
 * as an extension. This only says where the request came from; the caller
 * still has to be signed in, which for an extension means the browser sent the
 * user's session cookie (it does for hosts the extension has permission for).
 */
export function isExtensionOrigin(headers: { get(name: string): string | null }): boolean {
  return /^(chrome|moz)-extension:\/\/[a-z0-9-]+$/i.test(headers.get("origin") ?? "");
}

/** Who may save a quick thought: this site's own page, or the browser extension. */
export function canCapture(headers: { get(name: string): string | null }, origin: string): boolean {
  return isSameSite(headers, origin) || isExtensionOrigin(headers);
}

/** Where a share came from, besides a phone's share sheet: the browser extension says `from=ext`. */
export type ShareSource = "ext";

/** The source a share names, or null: only the exact word the extension sends counts. */
export function shareSource(value: string | null | undefined): ShareSource | null {
  return value === "ext" ? "ext" : null;
}

/** The search string a share was sent with, so a sign-in can come back to the same share. */
export function shareQuery(fields: ShareFields, from: ShareSource | null = null): string {
  const q = new URLSearchParams();
  for (const key of ["title", "text", "url"] as const) {
    const v = clean(fields[key]);
    if (v) q.set(key, v);
  }
  if (from) q.set("from", from);
  return q.toString();
}

/**
 * The same share made twice (a reload, a double tap, a sign-in that comes back
 * to it) must be one note: its id is made from who shared what, in the same
 * five minutes, and a note saved under an id already there is simply returned.
 */
export function shareId(userId: string, text: string, image: string | null, at: Date = new Date()): string {
  const bucket = Math.floor(at.getTime() / (5 * 60_000));
  const hash = createHash("sha256").update(`${userId}\n${bucket}\n${text}\n${image ?? ""}`).digest("hex");
  return `share-${hash.slice(0, 24)}`;
}

/** A picture from the share as a data URL, or null when it isn't a picture we keep or is too big. */
export function pictureDataUrl(type: string, bytes: Uint8Array, maxChars: number): string | null {
  if (!(SHARE_IMAGE_TYPES as readonly string[]).includes(type)) return null;
  const url = `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  return url.length <= maxChars ? url : null;
}
