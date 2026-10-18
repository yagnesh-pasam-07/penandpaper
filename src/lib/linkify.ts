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
