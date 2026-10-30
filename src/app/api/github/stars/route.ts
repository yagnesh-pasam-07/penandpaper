import { liveStars } from "@/lib/github";

/**
 * `GET /api/github/stars` → `{ stars }`: the repository's star count, from the
 * server's two-minute cache (never straight from GitHub per visitor). The
 * homepage button asks once after it loads.
 */
export async function GET() {
  const stars = await liveStars();
  if (stars === null) return Response.json({ error: "GitHub didn't answer." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ stars }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
