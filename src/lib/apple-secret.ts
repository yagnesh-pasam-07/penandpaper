import "server-only";
import { importPKCS8, SignJWT } from "jose";

/** Apple accepts a client secret for at most six months; this one is made fresh for 150 days. */
const LIFETIME_S = 150 * 24 * 60 * 60;

/**
 * Sign in with Apple has no fixed client secret: it is a short JWT signed with
 * the .p8 key from Apple Developer (Keys → Sign in with Apple). Made when the
 * server starts, so it never has to be renewed by hand. The key may be pasted
 * with real newlines or with "\n".
 */
export async function appleClientSecret(o: { clientId: string; teamId: string; keyId: string; privateKey: string }): Promise<string> {
  const key = await importPKCS8(o.privateKey.replace(/\\n/g, "\n").trim(), "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: o.keyId })
    .setIssuer(o.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + LIFETIME_S)
    .setAudience("https://appleid.apple.com")
    .setSubject(o.clientId)
    .sign(key);
}
