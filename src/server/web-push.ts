import "server-only";
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";

/**
 * Web Push with no package: the message is encrypted for the browser
 * (RFC 8291, aes128gcm) and the request is signed with the site's VAPID key
 * (RFC 8292), using only Node's crypto. Every push service (Chrome's FCM,
 * Mozilla, Apple) takes the same request.
 */

export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  return createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, length);
}

/**
 * Encrypts `plaintext` for one browser (RFC 8291). `local` and `salt` are only
 * passed by tests, to check against the RFC's worked example.
 */
export function encrypt(
  plaintext: Buffer,
  sub: PushSubscription["keys"],
  test?: { localPrivate: Buffer; salt: Buffer },
): Buffer {
  const uaPublic = fromB64u(sub.p256dh);
  const authSecret = fromB64u(sub.auth);
  const ecdh = createECDH("prime256v1");
  if (test) ecdh.setPrivateKey(test.localPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = test?.salt ?? randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(authSecret, shared, keyInfo, 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);

  // One record: the message, then the 0x02 "last record" delimiter.
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/** The VAPID `Authorization` header for one push service: a short-lived ES256 JWT, signed with the site's key. */
export function vapidAuth(endpoint: string, vapid: VapidKeys, now: Date = new Date()): string {
  const aud = new URL(endpoint).origin;
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud, exp: Math.floor(now.getTime() / 1000) + 12 * 3600, sub: vapid.subject })));
  const pub = fromB64u(vapid.publicKey);
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: vapid.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: "jwk",
  });
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64u(signature)}, k=${vapid.publicKey}`;
}

/** The site's VAPID keys from the environment, or null when push isn't set up. */
export function vapidFromEnv(): VapidKeys | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:yagneshpasam0@gmail.com" };
}

/** Only real push services, over https: the endpoint comes from the browser, so it is checked before we call it. */
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

/**
 * Sends one push. "gone" means the browser unsubscribed (404/410): the caller
 * forgets it. A message lives up to a day, so a phone that's off gets it later.
 */
export async function sendPush(sub: PushSubscription, payload: object, vapid: VapidKeys): Promise<"sent" | "gone" | "failed"> {
  if (!isPushEndpoint(sub.endpoint)) return "gone";
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuth(sub.endpoint, vapid),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(24 * 3600),
        Urgency: "normal",
      },
      body: new Uint8Array(encrypt(Buffer.from(JSON.stringify(payload)), sub.keys)),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
