import Link from "next/link";
import { LINKEDIN_POST_URL, SiteFooter, SiteHeader, siteLink } from "@/components/site";
import { REPO_URL } from "@/lib/github";
import { GitHubMark } from "@/modules/home/open-source";
import { CATEGORY_LABEL, readLabel, storyDate } from "@/modules/stories/logic";
import { publishedStories, type StoryCard } from "@/modules/stories/server";

const link = siteLink;

/** One piece of writing as a line in an index: kind, title, the hook, date and length. */
function Piece({ s, lead = false }: { s: StoryCard; lead?: boolean }) {
  return (
    <li>
      <Link href={`/stories/${s.slug}`} className="group flex flex-col gap-1.5 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-text">
        <span className="font-sans text-[12px] font-semibold tracking-[0.08em] text-red-text uppercase">{CATEGORY_LABEL[s.category]}</span>
        <span className={`story-serif leading-[1.2] text-balance text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 ${lead ? "text-[28px] sm:text-[34px]" : "text-[22px]"}`}>{s.title}</span>
        {s.hook && <span className={`story-serif text-[17px] leading-[1.5] text-mute ${lead ? "" : "line-clamp-2"}`}>{s.hook}</span>}
        <span className="font-sans text-[13px] text-mute">
          {storyDate(s.publishAt)} · {readLabel(s.readingMinutes)}
        </span>
      </Link>
    </li>
  );
}

/** The writing comes first: the newest piece large, a few more as an index, then all of it. */
async function Writing() {
  const list = await publishedStories(5);
  if (!list.length) return null;
  const [lead, ...rest] = list;
  return (
    <section aria-labelledby="writing-title" className="pb-14">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 id="writing-title" className="font-sans text-[12px] font-semibold tracking-[0.16em] text-mute uppercase">
          Latest writing
        </h2>
        <Link href="/stories" className={`font-sans text-[14px] text-ink ${link}`}>
          All writing →
        </Link>
      </div>
      <ul className="divide-y divide-line border-b border-line">
        <Piece s={lead} lead />
        {rest.map((s) => (
          <Piece key={s.id} s={s} />
        ))}
      </ul>
    </section>
  );
}

/** The tool, one line: for when it's your own thoughts, not ours. */
function DeskLine() {
  return (
    <section aria-label="Desk" className="pb-14">
      <Link href="/desk" className="group flex flex-col gap-1 rounded-2xl border border-line bg-sheet p-5 hover:border-line-strong sm:flex-row sm:items-baseline sm:gap-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text">
        <span className="font-hand shrink-0 text-[24px] leading-none font-bold text-ink">
          pen &amp; paper <span className="text-red-text">desk</span>
        </span>
        <span className="flex-1 font-sans text-[15px] leading-relaxed text-mute">I also built a quiet place for your own thoughts. Drop one in a second; it comes back when it matters.</span>
        <span className="font-sans text-[15px] font-medium text-ink group-hover:underline underline-offset-4">Open →</span>
      </Link>
      <p className="mt-4 flex items-center gap-2 font-sans text-[14px] text-mute">
        <GitHubMark size={14} />
        <span>
          Open source.{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={`text-ink ${link}`}>
            Read the code on GitHub
          </a>
        </span>
      </p>
    </section>
  );
}


/** The post's opening, as written. The rest is read on LinkedIn. */
const POST_LEAD = [
  "I build things. After weeks, I'm still the only person using this one. Let me tell you why I built it.",
  "I was never a digital note-taker. Honestly, all those fancy productivity apps never made me productive. I'm a paper person. Ideas, plans, random thoughts at 2am, everything goes in my notebook.",
];
const POST_MORE = [
  "But I can't carry my notebook everywhere. And I'm a forgetter, bro. A movie I want to watch, a place I want to visit, a friend I need to call. If I don't drop it somewhere in 5 seconds, it's gone. I think all of us are like that.",
  "The problem is, most of my life is digital now. I see an Instagram page I love, and I want it on my paper so I can come back to it. Instead I copy the link, paste it somewhere, and never see it again. Every place had a piece of me, and nothing had all of it.",
  "So I started noticing what I loved in each one.",
];

/**
 * Why it exists, in the maker's own post: pinned to the page like an
 * attachment, the opening readable here, "see more" for a little more,
 * and the whole post on LinkedIn.
 */
function MakersPost() {
  return (
    <section aria-labelledby="post-title" className="pb-20 md:pb-28">
      <h2 id="post-title" className="mb-4 font-sans text-[12px] font-semibold tracking-[0.16em] text-mute uppercase">
        Why it exists
      </h2>
      <article className="rounded-2xl border border-line bg-sheet p-5 shadow-[var(--lift)] sm:p-6">
        <header className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 320 px local photo shown small */}
          <img src="/creator.jpg" alt="" width={48} height={48} loading="lazy" className="size-12 shrink-0 rounded-full object-cover ring-1 ring-line" />
          <div className="flex min-w-0 flex-col">
            <span className="font-sans text-[15px] font-semibold text-ink">Yagnesh Pasam</span>
            <span className="truncate font-sans text-[13px] text-mute">Maker of Pen and Paper · on LinkedIn</span>
          </div>
          <LinkedInGlyph />
        </header>
        <div className="mt-4 flex flex-col gap-3 font-sans text-[15px] leading-relaxed text-ink">
          {POST_LEAD.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <details className="group flex flex-col gap-3">
            <summary className="w-fit cursor-pointer list-none font-medium text-mute hover:text-ink group-open:hidden [&::-webkit-details-marker]:hidden">…see more</summary>
            <div className="flex flex-col gap-3">
              {POST_MORE.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          </details>
        </div>
        <a
          href={LINKEDIN_POST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-4 py-3 font-sans text-[14px] text-ink hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text"
        >
          <span className="flex flex-col">
            <span className="font-semibold">I&apos;m still its only user.</span>
            <span className="text-[13px] text-mute">Read the whole post on LinkedIn</span>
          </span>
          <span aria-hidden="true">↗</span>
        </a>
      </article>
    </section>
  );
}

function LinkedInGlyph() {
  return (
    <svg aria-label="LinkedIn" role="img" viewBox="0 0 24 24" width="20" height="20" className="ml-auto shrink-0 text-mute" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}


/**
 * The homepage: writing first. One line of belief, the newest writing as an
 * index, the desk in one line, and the maker's post on why it exists.
 */
export function StoryHome() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[680px] flex-1 flex-col px-5 sm:px-8">
        <section className="flex flex-col gap-4 pt-14 pb-12 sm:pt-24 sm:pb-14">
          <h1 className="story-serif text-[36px] leading-[1.1] tracking-[-0.02em] text-balance text-ink sm:text-[52px]">Your thoughts deserve to be written down.</h1>
          <p className="max-w-[540px] font-sans text-[17px] leading-relaxed text-mute">Essays and true stories by Yagnesh Pasam, on life, death and the people we pass by. Written here first, shared on LinkedIn.</p>
        </section>
        <Writing />
        <DeskLine />
        <MakersPost />
      </main>
      <SiteFooter />
    </div>
  );
}
