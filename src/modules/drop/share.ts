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

/** The search string a share was sent with, so a sign-in can come back to the same share. */
export function shareQuery(fields: ShareFields): string {
  const q = new URLSearchParams();
  for (const key of ["title", "text", "url"] as const) {
    const v = clean(fields[key]);
    if (v) q.set(key, v);
  }
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
