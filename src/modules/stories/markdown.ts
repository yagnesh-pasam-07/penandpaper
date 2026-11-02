/**
 * The little Markdown a story is written in, read into blocks (never HTML, so
 * nothing a writer types can run on a reader's page):
 *
 *   ## A heading            > a pull quote          ---  (a quiet break)
 *   - a list item (each line that starts with "- ")
 *   ![caption](media:<id> "artist")  a picture on its own line, its caption and who made it
 *   *italic*  **bold**  [a link](https://…)
 *
 * A blank line starts a new paragraph; a single line break stays a line break.
 */

export type Inline = { t: "text"; v: string } | { t: "em"; c: Inline[] } | { t: "strong"; c: Inline[] } | { t: "link"; href: string; c: Inline[] } | { t: "br" };

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; c: Inline[] }
  | { t: "quote"; c: Inline[] }
  | { t: "hr" }
  | { t: "list"; items: Inline[][] }
  | { t: "img"; id: string; caption: string; credit: string };

const IMG = /^!\[([^\]]*)\]\(media:([0-9a-f-]{36})(?:\s+"([^"]*)")?\)\s*$/i;

/** Only web and mail links; anything else (javascript:, data:) stays plain text. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\/[^\s]+$/i.test(h) || /^mailto:[^\s]+$/i.test(h)) return h;
  if (/^\/[^\s/][^\s]*$/.test(h) || h === "/") return h;
  return null;
}

/** *em*, **strong**, [link](href) and line breaks, inside one block. */
export function inline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\n") {
      flush();
      out.push({ t: "br" });
      i++;
      continue;
    }
    if (ch === "\\" && i + 1 < src.length && "*_[]\\".includes(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (src.startsWith("**", i)) {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "strong", c: inline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (ch === "*" || ch === "_") {
      const end = src.indexOf(ch, i + 1);
      if (end > i + 1 && src[i + 1] !== " " && src[end - 1] !== " ") {
        flush();
        out.push({ t: "em", c: inline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (ch === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(src.slice(i));
      const href = m && safeHref(m[2]);
      if (m && href) {
        flush();
        out.push({ t: "link", href, c: inline(m[1]) });
        i += m[0].length;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** A story's body as blocks. */
export function parse(body: string): Block[] {
  const blocks: Block[] = [];
  const chunks = body.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const raw of chunks) {
    const chunk = raw.replace(/^\n+|\s+$/g, "");
    if (!chunk.trim()) continue;
    // A picture may sit on its own line inside a chunk: split around it.
    const lines = chunk.split("\n");
    let para: string[] = [];
    const flushPara = () => {
      const text = para.join("\n").trim();
      para = [];
      if (!text) return;
      if (/^(-{3,}|\*{3,})$/.test(text)) blocks.push({ t: "hr" });
      else if (/^#{1,3}\s/.test(text)) blocks.push({ t: "h", c: inline(text.replace(/^#{1,3}\s+/, "").replace(/\n/g, " ")) });
      else if (text.startsWith(">")) blocks.push({ t: "quote", c: inline(text.replace(/^>\s?/gm, "")) });
      else if (text.split("\n").every((l) => /^[-•]\s+/.test(l))) blocks.push({ t: "list", items: text.split("\n").map((l) => inline(l.replace(/^[-•]\s+/, ""))) });
      else blocks.push({ t: "p", c: inline(text) });
    };
    for (const line of lines) {
      const img = IMG.exec(line.trim());
      if (img) {
        flushPara();
        blocks.push({ t: "img", id: img[2].toLowerCase(), caption: img[1].trim(), credit: (img[3] ?? "").trim() });
      } else para.push(line);
    }
    flushPara();
  }
  return blocks;
}

/** The Markdown line for a picture. */
export function imageLine(id: string, caption = "", credit = ""): string {
  const clean = (v: string) => v.replace(/[\]\n"]/g, " ").trim();
  return `![${clean(caption)}](media:${id}${credit.trim() ? ` "${clean(credit)}"` : ""})`;
}

/** The ids of every picture a body uses, in order. */
export function mediaIds(body: string): string[] {
  return parse(body).flatMap((b) => (b.t === "img" ? [b.id] : []));
}

/** Plain text of the first paragraph, for a description when there's no hook. */
export function firstLine(body: string, max = 160): string {
  const plain = (c: Inline[]): string => c.map((n) => (n.t === "text" ? n.v : n.t === "br" ? " " : plain(n.c))).join("");
  const p = parse(body).find((b) => b.t === "p");
  const text = p && p.t === "p" ? plain(p.c).replace(/\s+/g, " ").trim() : "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** The story's first pull quote (a "> " line), as plain text: what a card or the homepage quotes. Empty when there is none. */
export function pullQuote(body: string, max = 200): string {
  const plain = (c: Inline[]): string => c.map((n) => (n.t === "text" ? n.v : n.t === "br" ? " " : plain(n.c))).join("");
  const q = parse(body).find((b) => b.t === "quote");
  const text = q && q.t === "quote" ? plain(q.c).replace(/\s+/g, " ").trim() : "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Plain text of one block, for a short preview (Studio's attention chart). */
export function blockText(b: Block, max = 140): string {
  const flat = (c: Inline[]): string => c.map((n) => (n.t === "text" ? n.v : n.t === "br" ? " " : "c" in n ? flat(n.c) : "")).join("");
  const t = b.t === "img" ? b.caption : b.t === "hr" ? "· · ·" : b.t === "list" ? b.items.map(flat).join(" · ") : flat(b.c);
  const one = t.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}
