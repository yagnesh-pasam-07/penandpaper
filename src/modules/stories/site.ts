/** The site's public address, for links that leave the page (share, RSS, sitemap). */
export function siteUrl(): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.BETTER_AUTH_URL ?? (prod ? `https://${prod}` : "http://localhost:3000")).replace(/\/+$/, "");
}
