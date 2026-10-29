import { describe, expect, it, vi } from "vitest";
import { buildPreview, checkUrl, isPublicIp, loadPage, parsePreview, PREVIEW_MAX_REDIRECTS, type PreviewDeps, type ResolvedAddress } from "./preview";

const ok = (raw: string) => checkUrl(raw).ok;
const why = (raw: string) => {
  const c = checkUrl(raw);
  return c.ok ? "ok" : c.reason;
};

describe("isPublicIp", () => {
  it("accepts ordinary public addresses", () => {
    for (const a of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "100.63.255.255", "100.128.0.1", "2606:4700:4700::1111", "2a00:1450:4009:81f::200e"]) expect(isPublicIp(a)).toBe(true);
  });
  it("refuses private, loopback, link-local, shared and reserved IPv4", () => {
    for (const a of ["0.0.0.0", "10.1.2.3", "127.0.0.1", "127.255.255.254", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "100.127.255.255", "192.0.0.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.5", "224.0.0.1", "240.0.0.1", "255.255.255.255"]) expect(isPublicIp(a)).toBe(false);
  });
  it("refuses IPv6 loopback, unspecified, unique-local, link-local, multicast and documentation", () => {
    for (const a of ["::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "fe80::1%en0", "ff02::1", "2001:db8::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2", "100::1"]) expect(isPublicIp(a)).toBe(false);
  });
  it("judges IPv4-mapped, NAT64 and 6to4 addresses by the IPv4 inside", () => {
    expect(isPublicIp("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicIp("::ffff:7f00:1")).toBe(false);
    expect(isPublicIp("::ffff:169.254.169.254")).toBe(false);
    expect(isPublicIp("::ffff:10.0.0.1")).toBe(false);
    expect(isPublicIp("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicIp("64:ff9b::7f00:1")).toBe(false);
    expect(isPublicIp("64:ff9b::808:808")).toBe(true);
    expect(isPublicIp("2002:7f00:1::")).toBe(false);
    expect(isPublicIp("2002:808:808::")).toBe(true);
    expect(isPublicIp("::127.0.0.1")).toBe(false);
  });
  it("refuses anything it can't read", () => {
    for (const a of ["", "nope", "999.1.1.1", "1.2.3", "1:2:3", "::g", "1::2::3", "12345::1"]) expect(isPublicIp(a)).toBe(false);
  });
});

describe("checkUrl", () => {
  it("accepts ordinary public http(s) links and drops the #fragment", () => {
    expect(ok("https://stripe.com/blog")).toBe(true);
    expect(ok("http://example.org/a?b=1")).toBe(true);
    expect(ok("https://www.paulgraham.com/greatwork.html")).toBe(true);
    const c = checkUrl("https://a.example.org/x#section");
    expect(c.ok && c.url.href).toBe("https://a.example.org/x");
    expect(ok("https://8.8.8.8/")).toBe(true);
    expect(ok("https://[2606:4700:4700::1111]/")).toBe(true);
  });
  it("refuses other schemes, bad input and very long links", () => {
    expect(why("ftp://example.org/")).toBe("scheme");
    expect(why("file:///etc/passwd")).toBe("scheme");
    expect(why("javascript:alert(1)")).toBe("scheme");
    expect(why("data:text/html,hi")).toBe("scheme");
    expect(why("not a url")).toBe("invalid");
    expect(why("")).toBe("invalid");
    expect(why(`https://example.org/${"a".repeat(2100)}`)).toBe("invalid");
  });
  it("refuses user:password@ links, including the '@' trick that hides the real host", () => {
    expect(why("https://user:pass@example.org/")).toBe("credentials");
    expect(why("https://user@example.org/")).toBe("credentials");
    // The real host here is 127.0.0.1, not example.org.
    expect(why("http://example.org@127.0.0.1/")).toBe("credentials");
    expect(why("http://example.org%2f@127.0.0.1/")).not.toBe("ok");
  });
  it("allows only ports 80 and 443", () => {
    expect(ok("http://example.org:80/")).toBe(true);
    expect(ok("https://example.org:443/")).toBe(true);
    expect(why("http://example.org:8080/")).toBe("port");
    expect(why("https://example.org:3000/")).toBe("port");
    expect(why("http://example.org:22/")).toBe("port");
    expect(why("http://localhost:3000")).not.toBe("ok");
  });
  it("refuses loopback and private IPv4 literals, even written as decimal, hex or octal", () => {
    for (const u of ["http://127.0.0.1/", "http://2130706433/", "http://0x7f.1/", "http://0x7f000001/", "http://0177.0.0.1/", "http://127.1/", "http://017700000001/", "http://10.0.0.1/", "http://192.168.0.1/", "http://169.254.169.254/latest/meta-data/", "http://100.64.0.1/", "http://0.0.0.0/", "http://3232235777/"]) {
      expect(ok(u), u).toBe(false);
    }
  });
  it("refuses IPv6 literals that are loopback, private, or mapped private addresses", () => {
    for (const u of ["http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/", "http://[fe80::1]/", "http://[fd00::1]/", "http://[::]/", "http://[::ffff:169.254.169.254]/"]) {
      expect(ok(u), u).toBe(false);
    }
  });
  it("refuses localhost and internal-only names", () => {
    for (const u of ["http://localhost/", "http://LOCALHOST/", "http://localhost./", "http://app.localhost/", "http://printer.local/", "http://metadata.google.internal/", "http://db.internal/", "http://router.lan/", "http://nas.home.arpa/", "http://intranet/", "http://server/", "http://foo.test/", "http://a..b.com/"]) {
      expect(ok(u), u).toBe(false);
    }
  });
});

describe("parsePreview", () => {
  const url = "https://blog.example.com/posts/hello";
  it("prefers Open Graph, then Twitter, then plain tags", () => {
    const html = `<html><head><title>Plain title</title>
      <meta name="description" content="Plain description">
      <meta name="twitter:title" content="Twitter title"><meta name="twitter:description" content="Twitter description"><meta name="twitter:image" content="/tw.png">
      <meta property="og:title" content="OG title"><meta property="og:description" content="OG description"><meta property="og:image" content="https://cdn.example.com/og.png">
      <meta property="og:site_name" content="Example Blog"></head><body>x</body></html>`;
    const p = parsePreview(html, url);
    expect(p.title).toBe("OG title");
    expect(p.description).toBe("OG description");
    expect(p.image).toBe("https://cdn.example.com/og.png");
    expect(p.siteName).toBe("Example Blog");
  });
  it("falls back to Twitter tags, then <title> and the meta description", () => {
    expect(parsePreview(`<head><meta name="twitter:title" content="T"><meta name="twitter:image" content="/tw.png"></head>`, url)).toMatchObject({ title: "T", image: "https://blog.example.com/tw.png" });
    expect(parsePreview(`<head><title>  Just a\n title </title><meta name="description" content="Words"></head>`, url)).toMatchObject({ title: "Just a title", description: "Words", image: null });
  });
  it("decodes entities, collapses whitespace and limits lengths", () => {
    const p = parsePreview(`<head><meta property="og:title" content="Tom &amp; Jerry &#8212; the &quot;best&quot; &#x1F600; &nbsp;ever"><meta property="og:description" content="${"word ".repeat(200)}"></head>`, url);
    expect(p.title).toBe('Tom & Jerry — the "best" 😀 ever');
    expect(p.description!.length).toBeLessThanOrEqual(300);
    expect(p.description!.endsWith("…")).toBe(true);
  });
  it("resolves relative pictures and icons against the page, and keeps http(s) only", () => {
    const p = parsePreview(`<head><meta property="og:title" content="x"><meta property="og:image" content="../img/cover.jpg"><link rel="shortcut icon" href="/static/icon.png"></head>`, "https://blog.example.com/a/b/c");
    expect(p.image).toBe("https://blog.example.com/a/img/cover.jpg");
    expect(p.favicon).toBe("https://blog.example.com/static/icon.png");
    expect(parsePreview(`<head><meta property="og:title" content="x"><meta property="og:image" content="javascript:alert(1)"></head>`, url).image).toBeNull();
    expect(parsePreview(`<head><meta property="og:title" content="x"><meta property="og:image" content="data:image/png;base64,AAAA"></head>`, url).image).toBeNull();
    expect(parsePreview(`<head><meta property="og:title" content="x"><meta property="og:image" content="https://u:p@evil.example/x.png"></head>`, url).image).toBeNull();
  });
  it("falls back to /favicon.ico and to the host as the site name", () => {
    const p = parsePreview(`<head><title>x</title></head>`, "https://www.example.com/a");
    expect(p.favicon).toBe("https://www.example.com/favicon.ico");
    expect(p.siteName).toBe("example.com");
  });
  it("reads single-quoted, unquoted and reordered attributes, and uses the first of repeated tags", () => {
    const p = parsePreview(`<head><meta content='Single' property='og:title'><meta property=og:title content=Second><meta content=Unquoted property=og:description></head>`, url);
    expect(p.title).toBe("Single");
    expect(p.description).toBe("Unquoted");
  });
  it("survives malformed markup, stops at </head>, and never returns markup", () => {
    const p = parsePreview(`<head><meta property="og:title" content="Fine"><meta property="og:description" content="<script>alert(1)</script>"><title>unclosed`, url);
    expect(p.title).toBe("Fine");
    const body = parsePreview(`<head><title>Head</title></head><body><meta property="og:title" content="From body"></body>`, url);
    expect(body.title).toBe("Head");
    expect(() => parsePreview("<<<<>>>> <meta", url)).not.toThrow();
    expect(JSON.stringify(parsePreview("<head><title>a</title></head><body>SECRET BODY</body>", url))).not.toContain("SECRET BODY");
  });
});

/* A fake network: names → addresses, and addresses/URLs → canned replies. */
type Reply = { status: number; headers?: Record<string, string>; body?: string };
function fake(names: Record<string, string[]>, replies: Record<string, Reply>, clock?: () => number) {
  const calls: { url: string; ip: string }[] = [];
  const deps: PreviewDeps = {
    now: clock,
    lookup: vi.fn(async (host: string): Promise<ResolvedAddress[]> => {
      const found = names[host];
      if (!found) throw new Error("ENOTFOUND");
      return found.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
    }),
    get: vi.fn(async ({ url, ip }) => {
      calls.push({ url: url.href, ip: ip.address });
      const r = replies[url.href];
      if (!r) throw new Error("no reply");
      return { status: r.status, headers: { "content-type": "text/html; charset=utf-8", ...r.headers }, body: new TextEncoder().encode(r.body ?? "") };
    }),
  };
  return { deps, calls };
}

const PAGE = `<head><meta property="og:title" content="Hello"><meta property="og:image" content="/c.png"></head>`;

describe("loadPage", () => {
  it("connects to the address it validated, not whatever the name says later", async () => {
    const { deps, calls } = fake({ "blog.example.com": ["93.184.216.34"] }, { "https://blog.example.com/a": { status: 200, body: PAGE } });
    const r = await loadPage("https://blog.example.com/a#x", deps);
    expect(r.ok && r.finalUrl).toBe("https://blog.example.com/a");
    expect(calls).toEqual([{ url: "https://blog.example.com/a", ip: "93.184.216.34" }]);
  });
  it("refuses a name when ANY of its addresses is not public", async () => {
    const { deps, calls } = fake({ "evil.example.com": ["93.184.216.34", "127.0.0.1"] }, {});
    expect(await loadPage("https://evil.example.com/", deps)).toEqual({ ok: false, reason: "unsafe" });
    const v6 = fake({ "evil2.example.com": ["93.184.216.34", "::1"] }, {});
    expect(await loadPage("https://evil2.example.com/", v6.deps)).toEqual({ ok: false, reason: "unsafe" });
    const mapped = fake({ "evil3.example.com": ["::ffff:169.254.169.254"] }, {});
    expect(await loadPage("https://evil3.example.com/", mapped.deps)).toEqual({ ok: false, reason: "unsafe" });
    expect(calls).toEqual([]);
  });
  it("refuses unsafe links without any network at all", async () => {
    const { deps } = fake({}, {});
    for (const u of ["http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest", "http://localhost:3000", "http://2130706433/", "ftp://example.org/"]) {
      expect(await loadPage(u, deps)).toEqual({ ok: false, reason: "unsafe" });
    }
    expect(deps.lookup).not.toHaveBeenCalled();
    expect(deps.get).not.toHaveBeenCalled();
  });
  it("follows redirects by hand and checks every hop", async () => {
    const { deps, calls } = fake(
      { "a.example.com": ["93.184.216.34"], "b.example.com": ["93.184.216.35"] },
      { "https://a.example.com/": { status: 301, headers: { location: "https://b.example.com/next" } }, "https://b.example.com/next": { status: 200, body: PAGE } },
    );
    const r = await loadPage("https://a.example.com/", deps);
    expect(r.ok && r.finalUrl).toBe("https://b.example.com/next");
    expect(calls.map((c) => c.ip)).toEqual(["93.184.216.34", "93.184.216.35"]);
  });
  it("resolves relative redirects against the current page", async () => {
    const { deps } = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/x/y": { status: 302, headers: { location: "../z" } }, "https://a.example.com/z": { status: 200, body: PAGE } });
    const r = await loadPage("https://a.example.com/x/y", deps);
    expect(r.ok && r.finalUrl).toBe("https://a.example.com/z");
  });
  it("refuses a redirect to a private address or an internal name", async () => {
    for (const target of ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data/", "http://localhost/", "http://[::1]/", "file:///etc/passwd", "http://a.example.com:8080/"]) {
      const { deps } = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/": { status: 302, headers: { location: target } } });
      expect(await loadPage("https://a.example.com/", deps), target).toEqual({ ok: false, reason: "unsafe" });
    }
  });
  it("refuses a redirect to a name that resolves privately (the second hop is looked up again)", async () => {
    const { deps } = fake({ "a.example.com": ["93.184.216.34"], "sneaky.example.com": ["10.0.0.5"] }, { "https://a.example.com/": { status: 302, headers: { location: "https://sneaky.example.com/" } } });
    expect(await loadPage("https://a.example.com/", deps)).toEqual({ ok: false, reason: "unsafe" });
  });
  it(`stops after ${PREVIEW_MAX_REDIRECTS} redirects`, async () => {
    const replies: Record<string, Reply> = {};
    for (let i = 0; i < 6; i++) replies[`https://a.example.com/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
    const { deps, calls } = fake({ "a.example.com": ["93.184.216.34"] }, replies);
    expect(await loadPage("https://a.example.com/0", deps)).toEqual({ ok: false, reason: "failed" });
    expect(calls).toHaveLength(PREVIEW_MAX_REDIRECTS + 1);
    // Exactly the limit is fine.
    const ok3 = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/0": { status: 302, headers: { location: "/1" } }, "https://a.example.com/1": { status: 302, headers: { location: "/2" } }, "https://a.example.com/2": { status: 302, headers: { location: "/3" } }, "https://a.example.com/3": { status: 200, body: PAGE } });
    expect((await loadPage("https://a.example.com/0", ok3.deps)).ok).toBe(true);
  });
  it("reports non-HTML, errors, empty redirects and unknown hosts without throwing", async () => {
    const { deps } = fake({ "a.example.com": ["93.184.216.34"] }, {
      "https://a.example.com/pdf": { status: 200, headers: { "content-type": "application/pdf" } },
      "https://a.example.com/img": { status: 200, headers: { "content-type": "image/png" } },
      "https://a.example.com/404": { status: 404 },
      "https://a.example.com/500": { status: 500 },
      "https://a.example.com/loop": { status: 302 },
      "https://a.example.com/xhtml": { status: 200, headers: { "content-type": "application/xhtml+xml" }, body: PAGE },
    });
    expect(await loadPage("https://a.example.com/pdf", deps)).toEqual({ ok: false, reason: "unsupported" });
    expect(await loadPage("https://a.example.com/img", deps)).toEqual({ ok: false, reason: "unsupported" });
    expect(await loadPage("https://a.example.com/404", deps)).toEqual({ ok: false, reason: "failed" });
    expect(await loadPage("https://a.example.com/500", deps)).toEqual({ ok: false, reason: "failed" });
    expect(await loadPage("https://a.example.com/loop", deps)).toEqual({ ok: false, reason: "failed" });
    expect((await loadPage("https://a.example.com/xhtml", deps)).ok).toBe(true);
    expect(await loadPage("https://nope.example.com/", deps)).toEqual({ ok: false, reason: "failed" });
  });
  it("gives up inside the time budget", async () => {
    let t = 1_000;
    const slow: PreviewDeps = {
      now: () => t,
      lookup: async () => {
        t += 6_000; // DNS ate the whole 5 seconds
        return [{ address: "93.184.216.34", family: 4 }];
      },
      get: vi.fn(),
    };
    expect(await loadPage("https://a.example.com/", slow)).toEqual({ ok: false, reason: "timeout" });
    expect(slow.get).not.toHaveBeenCalled();
    const timedOut: PreviewDeps = { lookup: async () => [{ address: "93.184.216.34", family: 4 }], get: async () => { throw Object.assign(new Error("slow"), { name: "TimeoutError" }); } };
    expect(await loadPage("https://a.example.com/", timedOut)).toEqual({ ok: false, reason: "timeout" });
  });
  it("decodes the page with the charset it announces", async () => {
    const { deps } = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/": { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: `<head><title>Café — తెలుగు</title></head>` } });
    const r = await loadPage("https://a.example.com/", deps);
    expect(r.ok && r.html).toContain("Café — తెలుగు");
  });
});

describe("buildPreview", () => {
  it("returns the details of a good page and nothing useful-less", async () => {
    const good = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/p": { status: 200, body: PAGE } });
    const r = await buildPreview("https://a.example.com/p", good.deps);
    expect(r.ok && r.data).toMatchObject({ url: "https://a.example.com/p", title: "Hello", image: "https://a.example.com/c.png" });
    const bare = fake({ "a.example.com": ["93.184.216.34"] }, { "https://a.example.com/p": { status: 200, body: "<head></head><body>app shell</body>" } });
    expect(await buildPreview("https://a.example.com/p", bare.deps)).toEqual({ ok: false, reason: "unsupported" });
  });
});
