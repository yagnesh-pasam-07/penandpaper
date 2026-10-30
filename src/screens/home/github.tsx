import { Suspense } from "react";
import { compact, REPO_URL, repoStats } from "@/lib/github";

/** GitHub's mark, in the text colour. */
export function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function Star() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
    </svg>
  );
}

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";

async function StarCount() {
  const stats = await repoStats();
  if (!stats) return null;
  return (
    <span className="flex items-center gap-1 border-l border-line pl-2 tabular-nums">
      <Star />
      {compact(stats.stars)}
    </span>
  );
}

/** The nav's GitHub button: the mark, and the live star count once GitHub answers. */
export function GitHubButton() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Pen & Paper on GitHub"
      className={`flex h-9 items-center gap-2 rounded-xl border border-line bg-sheet px-2.5 text-[14px] font-medium text-mute hover:bg-soft hover:text-ink ${focus}`}
    >
      <GitHubMark />
      <span className="max-sm:hidden">Star</span>
      <Suspense fallback={null}>
        <StarCount />
      </Suspense>
    </a>
  );
}

async function People() {
  const stats = await repoStats();
  if (!stats) return null;
  const shown = stats.contributors.slice(0, 24);
  return (
    <div className="flex flex-col items-center gap-5">
      <ul className="flex flex-wrap items-center justify-center gap-y-2">
        {shown.map((c) => (
          <li key={c.login} className="-ml-2 first:ml-0">
            <a href={c.url} target="_blank" rel="noopener noreferrer" title={`${c.login} · ${c.commits} ${c.commits === 1 ? "commit" : "commits"}`} className={`block rounded-full ${focus}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- GitHub's own avatar CDN, already sized */}
              <img src={`${c.avatar}&s=88`} alt={c.login} width={44} height={44} loading="lazy" className="size-11 rounded-full bg-soft ring-2 ring-bg transition-transform hover:-translate-y-0.5 motion-reduce:transition-none" />
            </a>
          </li>
        ))}
      </ul>
      <p className="text-[14px] text-mute tabular-nums">
        <Star /> <span className="font-semibold text-ink">{stats.stars.toLocaleString()}</span> {stats.stars === 1 ? "star" : "stars"}
        <span aria-hidden="true"> · </span>
        <span className="font-semibold text-ink">{stats.contributors.length}</span> {stats.contributors.length === 1 ? "contributor" : "contributors"}
        <span aria-hidden="true"> · </span>
        <span className="font-semibold text-ink">{stats.forks.toLocaleString()}</span> {stats.forks === 1 ? "fork" : "forks"}
      </p>
    </div>
  );
}

/** Built in the open: the people who made it, and a way to join them. */
export function OpenSource() {
  return (
    <section aria-labelledby="open-title" className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-7 px-4 py-20 text-center sm:px-8">
      <span className="flex flex-col items-center gap-3">
        <h2 id="open-title" className="font-hand text-[40px] leading-none font-bold sm:text-[52px]">
          Built in the open.
        </h2>
        <p className="max-w-[500px] text-[17px] text-mute">Pen &amp; Paper is open source. Read the code, suggest an idea, or send a fix. These are the people who made it.</p>
      </span>
      <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
        <People />
      </Suspense>
      <span className="flex flex-col items-center gap-3 sm:flex-row">
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={`inline-flex h-12 items-center gap-2 rounded-[14px] bg-ink px-5 text-[15px] font-semibold text-bg hover:opacity-90 ${focus}`}>
          <GitHubMark size={18} />
          Star on GitHub
        </a>
        <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer" className={`inline-flex h-12 items-center rounded-[14px] border border-line bg-sheet px-5 text-[15px] font-medium hover:bg-soft ${focus}`}>
          Become a contributor
        </a>
      </span>
    </section>
  );
}
