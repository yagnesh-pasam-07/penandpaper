import "server-only";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import type { PreviewDeps, ResolvedAddress } from "./preview";

const USER_AGENT = "PenAndPaperBot/1.0 (+link preview)";

function timeoutError(): Error {
  const e = new Error("The page took too long.");
  e.name = "TimeoutError";
  return e;
}

/**
 * The real network for link previews. The connection goes to the address that
 * was just checked (the `lookup` hook answers with that one address and
 * nothing else), while the Host header and TLS name stay the site's own, so a
 * name that changes its DNS answer after the check can't redirect the request
 * to somewhere private. No cookies are sent, compression is understood, and
 * the body is cut off at `maxBytes` after decompression.
 */
export const netDeps: PreviewDeps = {
  async lookup(host) {
    const found = await dns.lookup(host, { all: true, verbatim: true });
    return found.map((a): ResolvedAddress => ({ address: a.address, family: a.family === 6 ? 6 : 4 }));
  },
  get({ url, ip, timeoutMs, maxBytes }) {
    return new Promise((resolve, reject) => {
      const secure = url.protocol === "https:";
      const hostname = url.hostname.replace(/^\[|\]$/g, "");
      let settled = false;
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      const req = (secure ? https : http).request(
        {
          host: hostname,
          port: url.port ? Number(url.port) : secure ? 443 : 80,
          path: `${url.pathname}${url.search}`,
          method: "GET",
          agent: false,
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html,application/xhtml+xml;q=0.9,image/webp,image/*;q=0.8,*/*;q=0.1",
            "Accept-Language": "en;q=0.9,*;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
          },
          ...(secure ? { servername: hostname } : {}),
          lookup: (_host, options, callback) => {
            const answer = { address: ip.address, family: ip.family };
            if ((options as { all?: boolean }).all) (callback as unknown as (e: null, a: unknown[]) => void)(null, [answer]);
            else callback(null, answer.address, answer.family);
          },
        },
        (res) => {
          const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
          let stream: Readable = res;
          if (encoding === "gzip" || encoding === "x-gzip") stream = res.pipe(zlib.createGunzip());
          else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
          else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());
          const headers: Record<string, string | undefined> = {};
          for (const [k, v] of Object.entries(res.headers)) headers[k] = Array.isArray(v) ? v[0] : v;
          const status = res.statusCode ?? 0;
          // A redirect or an error has nothing we want to read.
          if (status < 200 || status >= 300) {
            res.destroy();
            done(() => resolve({ status, headers, body: new Uint8Array() }));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          const finish = () => done(() => resolve({ status, headers, body: Buffer.concat(chunks) }));
          stream.on("data", (chunk: Buffer) => {
            const room = maxBytes - size;
            if (room <= 0) return;
            chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
            size += Math.min(chunk.length, room);
            if (size >= maxBytes) {
              res.destroy();
              finish();
            }
          });
          stream.on("end", finish);
          stream.on("error", () => (size > 0 ? finish() : done(() => reject(new Error("The page couldn't be read.")))));
          res.on("error", () => (size > 0 ? finish() : done(() => reject(new Error("The page couldn't be read.")))));
        },
      );
      const timer = setTimeout(() => {
        req.destroy();
        done(() => reject(timeoutError()));
      }, timeoutMs);
      req.on("error", (e) => done(() => reject(e)));
      req.end();
    });
  },
};
