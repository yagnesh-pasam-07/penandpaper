/**
 * Is this an email address someone can actually receive mail at? Pure parts
 * (shape, typos, throwaway domains) are tested; the DNS check is injected.
 */

/** Big providers' common misspellings → the real domain, so we can say "Did you mean …?". */
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmaill.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "iclud.com": "icloud.com",
  "icloud.co": "icloud.com",
};

/** Throwaway inboxes: an account on one can't be reached tomorrow. */
const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "tempmail.dev",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "throwawaymail.com",
  "fakeinbox.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "burnermail.io",
]);

/** Domains reserved for examples and tests: no one receives mail there. */
const RESERVED = /(^|\.)(example\.(com|org|net)|test|invalid|localhost|local)$/;

const SHAPE = /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,}$/;

export type EmailProblem = { reason: "shape" | "typo" | "disposable" | "reserved" | "no-mail"; message: string; suggestion?: string };

/** The domain part, lower-cased. */
export function domainOf(email: string): string {
  return email.trim().toLowerCase().split("@").pop() ?? "";
}

/** What's wrong with the address on sight, or null. No network. */
export function emailProblem(raw: string): EmailProblem | null {
  const email = raw.trim().toLowerCase();
  if (!SHAPE.test(email)) return { reason: "shape", message: "That doesn't look like an email address." };
  const domain = domainOf(email);
  const fix = TYPOS[domain];
  if (fix) {
    const suggestion = `${email.slice(0, email.lastIndexOf("@"))}@${fix}`;
    return { reason: "typo", message: `Did you mean ${suggestion}?`, suggestion };
  }
  if (DISPOSABLE.has(domain)) return { reason: "disposable", message: "Use an inbox you'll keep. Throwaway addresses can't get your sign-in links." };
  if (RESERVED.test(domain)) return { reason: "reserved", message: "That address can't receive email. Use your real one." };
  return null;
}

/**
 * The full check: the above, then whether the domain can receive mail at all
 * (it has MX records, or at least an address). `resolve` answers how many mail
 * servers a domain has; if DNS itself fails, the address is given the benefit
 * of the doubt rather than locking someone out.
 */
export async function checkEmail(raw: string, resolve: (domain: string) => Promise<number | null>): Promise<EmailProblem | null> {
  const seen = emailProblem(raw);
  if (seen) return seen;
  const found = await resolve(domainOf(raw)).catch(() => null);
  if (found === 0) return { reason: "no-mail", message: `${domainOf(raw)} can't receive email. Check the spelling.` };
  return null;
}
