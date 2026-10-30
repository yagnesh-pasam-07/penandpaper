import "server-only";
import dns from "node:dns/promises";

/** How many mail servers a domain has (MX, or an A/AAAA fallback as mail allows); null when DNS can't say. */
export async function mailServers(domain: string): Promise<number | null> {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 2500));
  const ask = (async () => {
    try {
      const mx = await dns.resolveMx(domain);
      if (mx.some((m) => m.exchange && m.exchange !== ".")) return mx.length;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "ENODATA" && code !== "ENOTFOUND") return null;
    }
    // No MX: mail can still go to the domain's own address.
    try {
      return (await dns.resolve4(domain)).length;
    } catch (e) {
      const code = (e as { code?: string }).code;
      return code === "ENODATA" || code === "ENOTFOUND" ? 0 : null;
    }
  })();
  return Promise.race([ask, timeout]);
}
