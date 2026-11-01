/**
 * The editor's view of a story: a list of blocks the writer types into
 * directly (paragraphs, headings, quotes, pictures, breaks), and back to the
 * Markdown that is saved. Inline marks (*italic*, **bold**, links) stay as
 * typed inside a block. Pure, so the round trip is tested.
 */

import { imageLine } from "./markdown";

export type EditBlock =
  | { key: string; t: "p" | "h" | "quote"; text: string }
  | { key: string; t: "hr" }
  | { key: string; t: "img"; id: string; caption: string; credit: string };

let n = 0;
/** A key for a new block (only needs to be unique on this page). */
export const newKey = () => `b${Date.now().toString(36)}${(n++).toString(36)}`;

const IMG = /^!\[([^\]]*)\]\(media:([0-9a-f-]{36})(?:\s+"([^"]*)")?\)\s*$/i;

/** Markdown → blocks (the same rules as markdown.ts parse, keeping the raw text). */
export function toBlocks(body: string, key: () => string = newKey): EditBlock[] {
  const out: EditBlock[] = [];
  for (const raw of body.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    let para: string[] = [];
    const flush = () => {
      const text = para.join("\n").replace(/^\n+|\s+$/g, "");
      para = [];
      if (!text.trim()) return;
      if (/^(-{3,}|\*{3,})$/.test(text.trim())) out.push({ key: key(), t: "hr" });
      else if (/^#{1,3}\s/.test(text)) out.push({ key: key(), t: "h", text: text.replace(/^#{1,3}\s+/, "").replace(/\n/g, " ") });
      else if (text.startsWith(">")) out.push({ key: key(), t: "quote", text: text.replace(/^>\s?/gm, "") });
      else out.push({ key: key(), t: "p", text });
    };
    for (const line of raw.split("\n")) {
      const m = IMG.exec(line.trim());
      if (m) {
        flush();
        out.push({ key: key(), t: "img", id: m[2].toLowerCase(), caption: m[1].trim(), credit: (m[3] ?? "").trim() });
      } else para.push(line);
    }
    flush();
  }
  return out.length ? out : [{ key: key(), t: "p", text: "" }];
}

/** Blocks → Markdown. Empty paragraphs are dropped. */
export function toMarkdown(blocks: EditBlock[]): string {
  return blocks
    .flatMap((b) => {
      if (b.t === "hr") return ["---"];
      if (b.t === "img") return [imageLine(b.id, b.caption, b.credit)];
      const text = b.text.replace(/\s+$/g, "");
      if (!text.trim()) return [];
      // A typed blank line would split the block when read back: keep it one block.
      const one = text.replace(/\n\s*\n/g, "\n");
      if (b.t === "h") return [`## ${one.replace(/\n/g, " ")}`];
      if (b.t === "quote") return [one.split("\n").map((l) => `> ${l}`).join("\n")];
      // A paragraph that would read back as a heading, quote or picture starts with an invisible space instead.
      if (/^(#{1,3}\s|>|-{3,}$|\*{3,}$)/.test(one) || IMG.test(one.trim())) return [`\u200b${one}`];
      return [one];
    })
    .join("\n\n");
}
