/**
 * Rich link previews: which addresses are safe to fetch, what to read out of a
 * page, and the redirect-following loop. Pure: the network (DNS and the HTTP
 * GET) is injected, so none of this touches the internet in tests, and nothing
 * here may be imported by browser code.
 */

export type PreviewData = {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
};

export const PREVIEW_MAX_REDIRECTS = 3;
export const PREVIEW_MAX_BYTES = 1_500_000;
export const PREVIEW_TIMEOUT_MS = 5_000;
const MAX_URL = 2_000;

/* ---------- Addresses ---------- */

type V4 = [number, number, number, number];

function parseIPv4(s: string): V4 | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const n = m.slice(1).map(Number);
  return n.every((x) => x <= 255) ? (n as V4) : null;
}

/** A public, routable IPv4 address: none of the private, loopback, link-local, shared, documentation, benchmarking, multicast or reserved blocks. */
function isPublicIPv4([a, b, c]: V4): boolean {
  if (a === 0 || a === 10 || a === 127) return false; // "this network", private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT (100.64.0.0/10)
  if (a === 169 && b === 254) return false; // link-local, incl. the 169.254.169.254 metadata address
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF protocol assignments, TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return false; // 6to4 relay anycast
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

/** Eight 16-bit groups, or null when it isn't an IPv6 address. Accepts "::" shortening, a trailing dotted IPv4, brackets and a zone id. */
function parseIPv6(input: string): number[] | null {
  let s = input.replace(/^\[|\]$/g, "");
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  if (!s.includes(":")) return null;
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    s = `${s.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const groupsOf = (part: string) => (part === "" ? [] : part.split(":"));
  const head = groupsOf(halves[0]);
  let groups: string[];
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const rest = groupsOf(halves[1]);
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...head, ...Array<string>(fill).fill("0"), ...rest];
  }
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : Number.NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

const embedded = (hi: number, lo: number): V4 => [hi >> 8, hi & 255, lo >> 8, lo & 255];

/** A public IPv6 address. Only global unicast (2000::/3) can be, minus the blocks that embed or reserve something, and mapped, NAT64 and 6to4 forms are judged by the IPv4 address inside them. */
function isPublicIPv6(h: number[]): boolean {
  if (h.slice(0, 5).every((x) => x === 0) && (h[5] === 0xffff || h[5] === 0)) return false; // ::, ::1, IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible
  if (h[0] === 0x64 && h[1] === 0xff9b) return h.slice(2, 6).every((x) => x === 0) && isPublicIPv4(embedded(h[6], h[7])); // NAT64
  if (h[0] === 0x2002) return isPublicIPv4(embedded(h[1], h[2])); // 6to4
  if (h[0] === 0x2001 && h[1] === 0) return false; // Teredo
  if (h[0] === 0x2001 && h[1] === 0x0db8) return false; // documentation
  return (h[0] & 0xe000) === 0x2000; // everything else must be global unicast
}

/** Mapped addresses (::ffff:a.b.c.d) are judged by the IPv4 address inside, so a public one stays usable while 127.0.0.1 in disguise does not. */
function mappedV4(h: number[]): V4 | null {
  return h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff ? embedded(h[6], h[7]) : null;
}

/** Whether an address (IPv4 or IPv6, as text) is a public one that a preview may be fetched from. Anything it can't read is refused. */
export function isPublicIp(address: string): boolean {
  const v4 = parseIPv4(address);
  if (v4) return isPublicIPv4(v4);
  const v6 = parseIPv6(address);
  if (!v6) return false;
  const mapped = mappedV4(v6);
  return mapped ? isPublicIPv4(mapped) : isPublicIPv6(v6);
}

/* ---------- Addresses typed as links ---------- */

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: "invalid" | "scheme" | "credentials" | "port" | "host" | "private" };

const PRIVATE_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".localdomain", ".home.arpa", ".intranet", ".corp", ".private", ".test", ".invalid", ".example"];

/**
 * Whether a link may be fetched: http(s) only, ports 80 and 443 only, no
 * user:password@, and a host that is either a public IP literal or a plain
 * public-looking name (a dot in it, none of the internal-only endings). The URL
 * parser has already turned tricks like http://2130706433, http://0x7f.1 and
 * http://0177.0.0.1 into dotted 127.0.0.1 by the time the host is read here.
 */
export function checkUrl(raw: string): UrlCheck {
  if (!raw || raw.length > MAX_URL) return { ok: false, reason: "invalid" };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "scheme" };
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  if (url.port !== "" && url.port !== "80" && url.port !== "443") return { ok: false, reason: "port" };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, reason: "invalid" };
  if (host.startsWith("[")) return isPublicIp(host) ? { ok: true, url: withoutHash(url) } : { ok: false, reason: "private" };
  const v4 = parseIPv4(host);
  if (v4) return isPublicIPv4(v4) ? { ok: true, url: withoutHash(url) } : { ok: false, reason: "private" };
  if (!/^[a-z0-9.-]+$/.test(host) || !host.includes(".") || host.startsWith(".") || host.includes("..")) return { ok: false, reason: "host" };
  if (host === "localhost" || PRIVATE_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false, reason: "host" };
  return { ok: true, url: withoutHash(url) };
}

function withoutHash(url: URL): URL {
  const out = new URL(url.href);
  out.hash = "";
  return out;
}

/* ---------- Reading a page ---------- */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };

function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,8}));/gi, (whole, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (name) return ENTITIES[name.toLowerCase()] ?? whole;
    const code = dec ? Number(dec) : parseInt(hex ?? "", 16);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
  });
}

function clean(raw: string | undefined | null, max: number): string | null {
  if (!raw) return null;
  const text = decodeEntities(raw).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** The attributes of one tag, names lower-cased. A tolerant scan, not a parser: it never throws on broken markup. */
function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const inner = tag.replace(/^<\w+/, "").replace(/\/?>$/, "");
  for (const m of inner.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!(name in out)) out[name] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

/** An address from a page, made absolute against where the page was found. Only http(s), no credentials. */
function absolute(value: string | undefined, base: string): string | null {
  const text = value ? decodeEntities(value).trim() : "";
  if (!text || text.length > 1_000) return null;
  try {
    const url = new URL(text, base);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** The title, description, picture, site name and icon a page announces about itself (Open Graph first, then Twitter cards, then plain tags). Never returns the markup. */
export function parsePreview(html: string, finalUrl: string, url: string = finalUrl): PreviewData {
  const end = html.search(/<\/head\s*>/i);
  const head = end >= 0 ? html.slice(0, end) : html.slice(0, 400_000);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    const content = a.content;
    if (key && content !== undefined && !(key in meta)) meta[key] = content;
  }
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1];
  let icon: string | undefined;
  let touchIcon: string | undefined;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const rel = (a.rel ?? "").toLowerCase().split(/\s+/);
    if (!a.href) continue;
    if (rel.includes("apple-touch-icon") && !touchIcon) touchIcon = a.href;
    else if (rel.includes("icon") && !icon) icon = a.href;
  }
  const host = hostOf(finalUrl);
  return {
    url,
    finalUrl,
    title: clean(meta["og:title"] ?? meta["twitter:title"] ?? titleTag, 160),
    description: clean(meta["og:description"] ?? meta["twitter:description"] ?? meta.description, 300),
    image: absolute(meta["og:image"] ?? meta["og:image:url"] ?? meta["twitter:image"] ?? meta["twitter:image:src"], finalUrl),
    siteName: clean(meta["og:site_name"] ?? meta["application-name"], 60) ?? host,
    favicon: absolute(icon ?? touchIcon, finalUrl) ?? absolute("/favicon.ico", finalUrl),
  };
}

function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Whether a preview has anything worth showing beyond the link itself. */
export function isUseful(p: Pick<PreviewData, "title" | "image" | "description">): boolean {
  return !!(p.title || p.image);
}

/* ---------- Fetching a page, safely ---------- */

export type ResolvedAddress = { address: string; family: 4 | 6 };

export type PreviewDeps = {
  /** Every address a name resolves to. */
  lookup: (host: string) => Promise<ResolvedAddress[]>;
  /** One GET to exactly this address (the connection is pinned to it), reading at most `maxBytes` of the body and giving up after `timeoutMs`. Rejects with an error named "TimeoutError" when it is too slow. */
  get: (req: { url: URL; ip: ResolvedAddress; timeoutMs: number; maxBytes: number }) => Promise<{ status: number; headers: Record<string, string | undefined>; body: Uint8Array }>;
  now?: () => number;
};

export type PreviewFailure = "unsafe" | "unsupported" | "timeout" | "failed";

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

function decode(body: Uint8Array, contentType: string | undefined): string {
  const label = /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType ?? "")?.[1] ?? "utf-8";
  try {
    return new TextDecoder(label).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/**
 * Fetches a page to read its details: validates the link, resolves the host
 * and refuses it if ANY address is non-public, then talks to the address it
 * just validated (so a name that changes its answer between check and use gets
 * no second chance), follows redirects by hand up to PREVIEW_MAX_REDIRECTS and
 * re-checks every hop the same way, all inside one PREVIEW_TIMEOUT_MS budget.
 */
export async function loadPage(rawUrl: string, deps: PreviewDeps): Promise<{ ok: true; finalUrl: string; html: string } | { ok: false; reason: PreviewFailure }> {
  const now = deps.now ?? Date.now;
  const deadline = now() + PREVIEW_TIMEOUT_MS;
  const first = checkUrl(rawUrl);
  if (!first.ok) return { ok: false, reason: "unsafe" };
  let url = first.url;
  for (let hop = 0; hop <= PREVIEW_MAX_REDIRECTS; hop++) {
    const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
    let addresses: ResolvedAddress[];
    if (parseIPv4(host) || host.includes(":")) {
      addresses = [{ address: host, family: host.includes(":") ? 6 : 4 }];
    } else {
      try {
        addresses = await deps.lookup(host);
      } catch {
        return { ok: false, reason: "failed" };
      }
    }
    if (addresses.length === 0) return { ok: false, reason: "failed" };
    if (!addresses.every((a) => isPublicIp(a.address))) return { ok: false, reason: "unsafe" };
    const left = deadline - now();
    if (left <= 0) return { ok: false, reason: "timeout" };
    let res: Awaited<ReturnType<PreviewDeps["get"]>>;
    try {
      res = await deps.get({ url, ip: addresses[0], timeoutMs: left, maxBytes: PREVIEW_MAX_BYTES });
    } catch (e) {
      return { ok: false, reason: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "failed" };
    }
    if (REDIRECTS.has(res.status)) {
      const location = res.headers.location;
      if (!location || hop === PREVIEW_MAX_REDIRECTS) return { ok: false, reason: "failed" };
      let next: UrlCheck;
      try {
        next = checkUrl(new URL(location, url).href);
      } catch {
        return { ok: false, reason: "failed" };
      }
      if (!next.ok) return { ok: false, reason: "unsafe" };
      url = next.url;
      continue;
    }
    if (res.status < 200 || res.status >= 300) return { ok: false, reason: "failed" };
    const type = (res.headers["content-type"] ?? "").toLowerCase();
    if (!type.startsWith("text/html") && !type.startsWith("application/xhtml+xml")) return { ok: false, reason: "unsupported" };
    return { ok: true, finalUrl: url.href, html: decode(res.body, res.headers["content-type"]) };
  }
  return { ok: false, reason: "failed" };
}

/** A page's preview, or why there isn't one. */
export async function buildPreview(rawUrl: string, deps: PreviewDeps): Promise<{ ok: true; data: PreviewData } | { ok: false; reason: PreviewFailure }> {
  const page = await loadPage(rawUrl, deps);
  if (!page.ok) return page;
  const data = parsePreview(page.html, page.finalUrl, rawUrl.trim());
  return isUseful(data) ? { ok: true, data } : { ok: false, reason: "unsupported" };
}
