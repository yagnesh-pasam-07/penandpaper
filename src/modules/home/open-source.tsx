import { Suspense } from "react";
import { liveStars, REPO_URL, repoStats } from "@/lib/github";
import { StarCount } from "./star-count";

/** GitHub's mark, in the text colour. */
export function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function Star({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
    </svg>
  );
}

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";

async function NavStars() {
  const stars = await liveStars();
  if (stars === null) return null;
  return (
    <span className="flex items-center gap-1 border-l border-line pl-2">
      <Star size={12} />
      <StarCount initial={stars} />
    </span>
  );
}

/** The header's GitHub button: the mark, and the live star count once GitHub answers. */
export function GitHubButton() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Pen and Paper is open source: star it on GitHub"
      className={`flex h-9 items-center gap-2 rounded-full border border-line bg-sheet px-3 text-[14px] font-medium text-mute hover:bg-soft hover:text-ink ${focus}`}
    >
      <GitHubMark />
      <Suspense fallback={null}>
        <NavStars />
      </Suspense>
    </a>
  );
}

/** One number with its word, in the paper's ink. */
function Figure({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="story-serif text-[34px] leading-none text-ink tabular-nums sm:text-[40px]">{n.toLocaleString("en-IN")}</span>
      <span className="font-sans text-[13px] tracking-[0.08em] text-mute uppercase">{n === 1 ? one : many}</span>
    </span>
  );
}

async function People() {
  const [stats, stars] = await Promise.all([repoStats(), liveStars()]);
  if (!stats) return null;
  const shown = stats.contributors.slice(0, 24);
  const commits = stats.contributors.reduce((sum, c) => sum + c.commits, 0);
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-5 sm:gap-x-14">
        <Figure n={stars ?? stats.stars} one="star" many="stars" />
        <Figure n={stats.contributors.length} one="contributor" many="contributors" />
        <Figure n={commits} one="commit" many="commits" />
        <Figure n={stats.forks} one="fork" many="forks" />
      </div>
      {shown.length > 0 && (
        <ul className="flex flex-wrap items-center justify-center gap-y-2" aria-label="Contributors">
          {shown.map((c) => (
            <li key={c.login} className="-ml-2 first:ml-0">
              <a href={c.url} target="_blank" rel="noopener noreferrer" title={`${c.login} · ${c.commits} ${c.commits === 1 ? "commit" : "commits"}`} className={`block rounded-full ${focus}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- GitHub's own avatar CDN, already sized */}
                <img src={`${c.avatar}&s=88`} alt={c.login} width={44} height={44} loading="lazy" className="size-11 rounded-full bg-soft ring-2 ring-bg transition-transform hover:-translate-y-0.5 motion-reduce:transition-none" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * "Open source": Pen and Paper's code is public. Live stars, contributors,
 * commits and forks from GitHub (cached on the server, so visitors never call
 * GitHub), the people who made it, and a way to join them. If GitHub doesn't
 * answer, the numbers are left out and the invitation stays.
 */
export function OpenSource() {
  return (
    <section aria-labelledby="open-title" className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-8 px-5 pb-20 text-center sm:px-8 md:pb-28">
      <div className="flex flex-col items-center gap-2">
        <h2 id="open-title" className="font-hand text-[34px] leading-none font-bold text-ink sm:text-[40px]">
          pen &amp; paper is <span className="text-red-text">open source</span>
        </h2>
        <p className="story-serif max-w-[520px] text-[17px] leading-snug text-mute">Every line of it is public. Read the code, suggest an idea, or send a fix. These are the people who made it.</p>
      </div>
      <Suspense fallback={<div className="h-24" aria-hidden="true" />}>
        <People />
      </Suspense>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={`inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 font-sans text-[15px] font-semibold text-bg hover:opacity-90 ${focus}`}>
          <GitHubMark size={18} />
          Star on GitHub
        </a>
        <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer" className={`inline-flex h-12 items-center rounded-full border border-line bg-sheet px-6 font-sans text-[15px] font-medium text-ink hover:bg-soft ${focus}`}>
          Become a contributor
        </a>
      </div>
    </section>
  );
}
