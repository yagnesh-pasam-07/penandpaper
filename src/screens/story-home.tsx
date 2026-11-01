import Link from "next/link";
import { ThemeToggle } from "@/components/ui";
import { PenIcon } from "@/components/icons";
import { CATEGORY_LABEL, readLabel } from "@/modules/stories/logic";
import { Picture } from "@/modules/stories/reader";
import { lovedThisMonth, publishedStories, type StoryCard } from "@/modules/stories/server";

const link = "rounded-sm underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";

function Header() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-4 px-5 sm:px-8">
      <Link href="/" aria-label="Pen and Paper, home" className="flex items-center gap-2 text-red-text">
        <PenIcon size={20} />
        <span className="font-hand text-[22px] leading-none font-bold whitespace-nowrap text-ink sm:text-[24px]">pen &amp; paper</span>
      </Link>
      <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 font-sans text-[15px] whitespace-nowrap text-mute sm:gap-1">
        <Link href="/stories" className={`rounded-full px-3 py-2 ${link}`}>
          Stories
        </Link>
        <Link href="/tool" className={`rounded-full px-3 py-2 ${link}`}>
          <span className="max-sm:hidden">The </span>Tool
        </Link>
        <Link href="/about" className={`rounded-full px-3 py-2 max-sm:hidden ${link}`}>
          About
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

/** Who and where, the way a magazine credits a portrait. */
function Byline({ s }: { s: StoryCard }) {
  const who = [s.personName, s.personPlace].filter(Boolean).join(", ");
  return (
    <p className="font-sans text-[13px] tracking-[0.02em] text-mute">
      {who ? <span className="font-medium text-ink">{who}</span> : <span className="font-medium text-ink">{CATEGORY_LABEL[s.category]}</span>}
      <span aria-hidden="true"> · </span>
      {readLabel(s.readingMinutes)}
    </p>
  );
}

/** The featured story: a big picture, one line from it in large serif, and the way in. */
function Hero({ s }: { s: StoryCard }) {
  const href = `/stories/${s.slug}`;
  return (
    <section aria-labelledby="hero-title" className="mx-auto grid w-full max-w-[1120px] gap-8 px-0 pt-2 pb-16 sm:px-8 sm:pt-6 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-14 md:pb-24">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="block overflow-hidden bg-soft sm:rounded-md">
        {s.coverId ? (
          <Picture base="/api/stories/media/" id={s.coverId} alt="" sizes="(max-width: 768px) 100vw, 560px" eager className="aspect-[4/5] object-cover md:aspect-[4/5]" />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center text-[64px] text-red-text">✒</div>
        )}
      </Link>
      <div className="flex flex-col gap-6 px-5 sm:px-0">
        <p className="font-sans text-[12px] font-semibold tracking-[0.14em] text-red-text uppercase">The latest story</p>
        <blockquote className="story-serif text-[30px] leading-[1.18] tracking-[-0.01em] text-balance text-ink sm:text-[40px]">
          <span aria-hidden="true" className="text-red-text">“</span>
          {s.quote}
          <span aria-hidden="true" className="text-red-text">”</span>
        </blockquote>
        <div className="flex flex-col gap-2 border-t border-line pt-5">
          <h1 id="hero-title" className="story-serif text-[22px] leading-snug text-ink sm:text-[24px]">
            <Link href={href} className={link}>
              {s.title}
            </Link>
          </h1>
          <Byline s={s} />
        </div>
        <div className="flex flex-wrap items-center gap-3 font-sans">
          <Link href={href} className="flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-bg hover:opacity-90">
            Read the story →
          </Link>
          {s.hasAudio && (
            <Link href={`${href}#listen`} className="flex h-12 items-center gap-2 rounded-full border border-line px-5 text-[15px] font-medium text-ink hover:bg-soft">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3.5 2.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L4.4 1.7a.6.6 0 0 0-.9.5Z" />
              </svg>
              Listen
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** One story in the grid: picture, a line from it, who and where. Like an Instagram grid set as a magazine. */
function StoryTile({ s }: { s: StoryCard }) {
  return (
    <li>
      <Link href={`/stories/${s.slug}`} className="group flex flex-col gap-4">
        {s.coverId ? (
          <>
            <span className="block overflow-hidden rounded-md bg-soft">
              <Picture base="/api/stories/media/" id={s.coverId} alt="" sizes="(max-width: 640px) 100vw, 360px" className="aspect-[4/5] object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            </span>
            <span className="story-serif line-clamp-4 text-[20px] leading-[1.35] text-ink">“{s.quote}”</span>
          </>
        ) : (
          // No picture: the words are the picture, set large on paper, like a quote card.
          <span className="flex aspect-[4/5] flex-col justify-between rounded-md border border-line bg-sheet p-7">
            <span aria-hidden="true" className="story-serif text-[56px] leading-none text-red-text">“</span>
            <span className="story-serif line-clamp-6 text-[26px] leading-[1.3] text-balance text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{s.quote}</span>
            <span className="story-serif text-[16px] text-mute italic">{s.title}</span>
          </span>
        )}
        <Byline s={s} />
      </Link>
    </li>
  );
}

function Divider({ line }: { line: string }) {
  return (
    <p className="story-serif mx-auto max-w-[680px] px-5 py-14 text-center text-[22px] text-mute italic sm:py-20 sm:text-[26px]">
      <span aria-hidden="true" className="mr-3 inline-block h-px w-10 bg-line align-middle" />
      {line}
      <span aria-hidden="true" className="ml-3 inline-block h-px w-10 bg-line align-middle" />
    </p>
  );
}

/** A quiet little sheet: three handwritten thoughts, one struck through in red pen. */
function PaperMock() {
  const note = "rounded-xl px-4 py-2.5 font-note text-[19px] leading-snug text-ink shadow-[0_1px_0_var(--line)]";
  return (
    <div aria-hidden="true" className="canvas-preview relative overflow-hidden rounded-2xl border border-line bg-sheet p-6" data-canvas="dotted">
      <div className="canvas-surface absolute inset-0" />
      <div className="relative flex flex-col items-start gap-4">
        <span className={`${note} -rotate-2 bg-t1`}>call amma tonight</span>
        <span className={`${note} relative ml-10 rotate-1 bg-t3 text-mute`}>
          book the bus
          <span className="absolute inset-x-3 top-1/2 h-[3px] -rotate-2 rounded-full bg-red" />
        </span>
        <span className={`${note} ml-4 -rotate-1 bg-t2`}>write the tea-shop man&apos;s story</span>
      </div>
    </div>
  );
}

function ToolSection() {
  return (
    <section aria-labelledby="tool-title" className="mx-auto grid w-full max-w-[1000px] gap-10 px-5 pb-20 sm:px-8 md:grid-cols-2 md:items-center md:gap-16 md:pb-28">
      <div className="flex flex-col gap-4">
        <p className="font-sans text-[12px] font-semibold tracking-[0.14em] text-mute uppercase">The Tool</p>
        <h2 id="tool-title" className="story-serif text-[34px] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[42px]">
          A quiet place for your thoughts.
        </h2>
        <p className="font-sans text-[17px] leading-relaxed text-mute">Drop a thought in a second. See it again tonight, and on the day it matters.</p>
        <div className="flex flex-wrap items-center gap-4 pt-2 font-sans">
          <Link href="/signup?next=/drop" className="flex h-12 items-center rounded-full bg-red px-6 text-[15px] font-semibold text-on-red hover:brightness-95">
            Start a paper
          </Link>
          <Link href="/tool" className={`text-[15px] text-mute ${link}`}>
            How it works
          </Link>
        </div>
      </div>
      <PaperMock />
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-5 py-10 font-sans text-[13px] text-mute sm:flex-row sm:items-center sm:px-8">
        <p className="story-serif text-[17px] text-ink italic">Every person is a story. We write them down.</p>
        <p className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:ml-auto">
          <a href="https://www.linkedin.com/in/yagneshpasam/" target="_blank" rel="noopener noreferrer" className={link}>
            LinkedIn
          </a>
          <Link href="/stories/rss.xml" className={link}>
            RSS
          </Link>
          <Link href="/privacy" className={link}>
            Privacy
          </Link>
          <span>© Pen and Paper</span>
        </p>
      </div>
    </footer>
  );
}

/**
 * The homepage, story first: a publication about people, with the thinking
 * tool as a quiet room at the back. The featured story is the most loved of
 * the month, else the newest; the grid is the rest, newest first.
 */
export async function StoryHome() {
  const [loved, newest] = await Promise.all([lovedThisMonth(), publishedStories(7)]);
  const lead = loved ?? newest[0] ?? null;
  const more = newest.filter((s) => s.id !== lead?.id).slice(0, 6);
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <Header />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-[1120px] px-5 pt-8 pb-10 text-center sm:px-8 sm:pt-14 sm:pb-14">
          <p className="story-serif text-[34px] leading-[1.1] tracking-[-0.02em] text-balance text-ink sm:text-[56px]">
            Every person is a story.
            <br />
            <span className="text-red-text italic">We write them down.</span>
          </p>
        </section>

        {lead ? (
          <Hero s={lead} />
        ) : (
          <p className="story-serif mx-auto max-w-[560px] px-5 pb-16 text-center text-[20px] text-mute italic">The first story is on its way.</p>
        )}

        {more.length > 0 && (
          <section aria-labelledby="more-title" className="mx-auto w-full max-w-[1120px] px-5 pb-6 sm:px-8">
            <div className="flex items-end justify-between gap-4 border-t border-line pt-8 pb-8">
              <h2 id="more-title" className="story-serif text-[28px] text-ink italic">
                More stories
              </h2>
              <Link href="/stories" className={`font-sans text-[14px] text-mute ${link}`}>
                All stories →
              </Link>
            </div>
            <ul className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((s) => (
                <StoryTile key={s.id} s={s} />
              ))}
            </ul>
          </section>
        )}

        <Divider line="Writers are witnesses." />

        <ToolSection />
      </main>
      <Footer />
    </div>
  );
}
