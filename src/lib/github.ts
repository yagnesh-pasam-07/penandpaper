import "server-only";
import { cacheLife } from "next/cache";

/** The public repository the site links to and counts. */
export const REPO = "yagnesh-pasam-07/penandpaper";
export const REPO_URL = `https://github.com/${REPO}`;

export type Contributor = { login: string; avatar: string; url: string; commits: number };
export type RepoStats = { stars: number; forks: number; contributors: Contributor[] };

/** People who aren't people: bots never show as contributors. */
const isBot = (login: string, type?: string) => type === "Bot" || /\[bot\]$|^dependabot|^github-actions/i.test(login);

/**
 * Stars, forks and the people who contributed, from GitHub's public API.
 * Fetched on the server and cached for an hour, so visitors never call GitHub
 * and the site stays well inside GitHub's limit (60 an hour without a token,
 * 5,000 with GITHUB_TOKEN). If GitHub doesn't answer, null: the page simply
 * leaves the numbers out.
 */
export async function repoStats(): Promise<RepoStats | null> {
  "use cache";
  cacheLife("hours");
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "penandpaper-site" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const [repo, people] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}`, { headers, signal: AbortSignal.timeout(4000) }),
      fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=30`, { headers, signal: AbortSignal.timeout(4000) }),
    ]);
    if (!repo.ok) return null;
    const r = (await repo.json()) as { stargazers_count?: number; forks_count?: number };
    const list = people.ok ? ((await people.json()) as { login: string; avatar_url: string; html_url: string; contributions: number; type?: string }[]) : [];
    return {
      stars: Number(r.stargazers_count ?? 0),
      forks: Number(r.forks_count ?? 0),
      contributors: (Array.isArray(list) ? list : [])
        .filter((c) => c.login && !isBot(c.login, c.type))
        .map((c) => ({ login: c.login, avatar: c.avatar_url, url: c.html_url, commits: c.contributions })),
    };
  } catch {
    return null;
  }
}

/** 1234 → "1.2k", like GitHub shows it. */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}
