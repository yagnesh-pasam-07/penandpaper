/**
 * A Medium post (the HTML in its RSS feed) → our Markdown, with the pictures
 * listed so they can be copied in. Medium's feed HTML is small and regular:
 * <p>, <h3>/<h4>, <blockquote>, <figure><img><figcaption>, <em>, <strong>,
 * <a>, <br>, <hr>, <ul>/<ol>. Anything else is read as plain text.
 */

export type MediumPost = { title: string; link: string; html: string; published: string | null };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** The post id at the end of a Medium address ("…-151312f8b98d"). */
export function mediumPostId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)medium\.com$/.test(u.hostname) && !u.hostname.endsWith(".medium.com")) return null;
    const m = /([0-9a-f]{10,16})$/.exec(u.pathname.replace(/\/+$/, ""));
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** The feed that holds a post: medium.com/feed/@user, or a custom-subdomain feed. */
export function mediumFeedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const at = /^\/(@[A-Za-z0-9._-]+)\//.exec(u.pathname);
    if (u.hostname === "medium.com" && at) return `https://medium.com/feed/${at[1]}`;
    if (u.hostname.endsWith(".medium.com")) return `https://${u.hostname}/feed`;
    return null;
  } catch {
    return null;
  }
}

/** Finds one post in a feed by its id. */
export function postFromFeed(xml: string, id: string): MediumPost | null {
  for (const item of xml.split("<item>").slice(1)) {
    const guid = /<guid[^>]*>([^<]*)<\/guid>/.exec(item)?.[1] ?? "";
    const link = /<link>([^<]*)<\/link>/.exec(item)?.[1] ?? "";
    if (!guid.endsWith(id) && !link.split("?")[0].endsWith(id)) continue;
    const cdata = (tag: string) => new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`).exec(item)?.[1] ?? "";
    return { title: decode(cdata("title")).trim(), link: link.split("?")[0], html: cdata("content:encoded"), published: /<pubDate>([^<]*)<\/pubDate>/.exec(item)?.[1] ?? null };
  }
  return null;
}

/** Inline HTML → our inline Markdown. */
function inlineMd(html: string): string {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (_m, _t, c: string) => (c.trim() ? `**${c.trim()}**` : c))
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (_m, _t, c: string) => (c.trim() ? `*${c.trim()}*` : c))
      .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, c: string) => (/^https?:/i.test(href) ? `[${c}](${decode(href)})` : c))
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

export type Converted = {
  /** Markdown with `{{img:N}}` where picture N goes, so the caller can put its id there. */
  body: string;
  images: { src: string; caption: string }[];
};

/** Post HTML → Markdown with picture placeholders. The tracking pixel is dropped. */
export function htmlToMarkdown(html: string): Converted {
  const images: Converted["images"] = [];
  const blocks: string[] = [];
  const re = /<(figure|p|h[1-6]|blockquote|hr|ul|ol|pre)\b[^>]*>([\s\S]*?)(?:<\/\1>)|<hr\s*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = (m[1] ?? "hr").toLowerCase();
    const inner = m[2] ?? "";
    if (tag === "figure") {
      const src = /<img[^>]*src="([^"]+)"/i.exec(inner)?.[1];
      if (!src || /\/_\/stat\?/.test(src)) continue;
      const cap = inlineMd(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(inner)?.[1] ?? "").replace(/\n+/g, " / ");
      blocks.push(`{{img:${images.length}}}`);
      images.push({ src: decode(src), caption: cap.replace(/^\*(.*)\*$/, "$1") });
    } else if (tag === "hr") blocks.push("---");
    else if (/^h[1-6]$/.test(tag)) {
      const text = inlineMd(inner).replace(/\n+/g, " ");
      if (text) blocks.push(`## ${text}`);
    } else if (tag === "blockquote") {
      const text = inlineMd(inner);
      if (text) blocks.push(text.split("\n").map((l) => `> ${l}`).join("\n"));
    } else if (tag === "ul" || tag === "ol") {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((li, i) => `${tag === "ol" ? `${i + 1}.` : "•"} ${inlineMd(li[1])}`);
      if (items.length) blocks.push(items.join("\n"));
    } else {
      const text = inlineMd(inner);
      if (text) blocks.push(text);
    }
  }
  return { body: blocks.join("\n\n"), images };
}

/** Only Medium's own picture hosts are fetched. */
export function isMediumImage(src: string): boolean {
  try {
    const u = new URL(src);
    return u.protocol === "https:" && (u.hostname === "cdn-images-1.medium.com" || u.hostname === "miro.medium.com");
  } catch {
    return false;
  }
}
