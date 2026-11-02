import Link from "next/link";
import { ThemeToggle } from "@/components/ui";
import { PenIcon } from "@/components/icons";
import { TimelineStrip } from "@/modules/home/timeline-strip";
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
        <Link href="/desk" className={`rounded-full px-3 py-2 ${link}`}>
          Desk
        </Link>
        <Link href="/about" className={`rounded-full px-3 py-2 max-sm:hidden ${link}`}>
          About
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

/** A product's name under the parent: "pen & paper" in ink, the product in red. */
function Wordmark({ product }: { product: string }) {
  return (
    <span className="font-hand text-[26px] leading-none font-bold">
      pen &amp; paper <span className="text-red-text">{product}</span>
    </span>
  );
}

/** A quiet little sheet: three handwritten thoughts, one struck through in red pen. */
function PaperMock() {
  const note = "rounded-xl px-4 py-2.5 font-note text-[19px] leading-snug text-ink shadow-[0_1px_0_var(--line)]";
  return (
    <div aria-hidden="true" className="canvas-preview relative aspect-[4/3] overflow-hidden rounded-md border border-line bg-sheet p-6" data-canvas="dotted">
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

/** The two products, as two equal doors under one belief. */
function Doors({ lead }: { lead: StoryCard | null }) {
  const door = "group flex flex-col gap-5 rounded-2xl border border-line bg-sheet p-5 shadow-[var(--lift)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong sm:p-7";
  return (
    <section aria-label="Pen and Paper" className="mx-auto grid w-full max-w-[1120px] gap-5 px-5 pb-16 sm:px-8 md:grid-cols-2 md:gap-8 md:pb-24">
      <Link href="/stories" className={door}>
        <span className="block overflow-hidden rounded-md bg-soft">
          {lead?.coverId ? (
            <Picture base="/api/stories/media/" id={lead.coverId} alt="" sizes="(max-width: 768px) 100vw, 540px" eager className="aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          ) : (
            <span className="flex aspect-[4/3] items-center justify-center text-[56px] text-red-text">“</span>
          )}
        </span>
        <span className="flex flex-col gap-2">
          <Wordmark product="stories" />
          <span className="story-serif text-[24px] leading-snug text-ink">Real people, written down.</span>
          <span className="font-sans text-[15px] leading-relaxed text-mute">Short, true stories of ordinary lives, history and art. Read one on the way, or listen.</span>
        </span>
        <span className="mt-auto font-sans text-[15px] font-semibold text-ink">Read stories →</span>
      </Link>
      <Link href="/desk" className={door}>
        <PaperMock />
        <span className="flex flex-col gap-2">
          <Wordmark product="desk" />
          <span className="story-serif text-[24px] leading-snug text-ink">A quiet place for your own thoughts.</span>
          <span className="font-sans text-[15px] leading-relaxed text-mute">Drop a thought in a second. See it on one paper. It comes back when it matters.</span>
        </span>
        <span className="mt-auto font-sans text-[15px] font-semibold text-ink">Open your desk →</span>
      </Link>
    </section>
  );
}

/** Who is behind it: a real person, in his own words. */
function FounderNote() {
  return (
    <section aria-labelledby="founder-title" className="mx-auto w-full max-w-[720px] px-5 pb-20 sm:px-8 md:pb-28">
      <div className="flex flex-col items-start gap-5 border-t border-line pt-10 sm:flex-row sm:gap-7">
        {/* eslint-disable-next-line @next/next/no-img-element -- a 320 px local photo shown small */}
        <img src="/creator.jpg" alt="Yagnesh Pasam" width={72} height={72} loading="lazy" className="size-[72px] shrink-0 rounded-full object-cover ring-1 ring-line" />
        <div className="flex flex-col gap-3">
          <h2 id="founder-title" className="sr-only">
            Why Pen and Paper
          </h2>
          <p className="story-serif text-[20px] leading-[1.6] text-ink">
            Hi, I&apos;m Yagnesh. I love making things, and nothing has shaped me more than a pen and paper. I believe writers are the original thinkers. Everything else is a summary.
          </p>
          <p className="story-serif text-[20px] leading-[1.6] text-ink">Pen and Paper is a quality space for writers and for thoughts. This is just the beginning.</p>
          <Link href="/about" className={`font-sans text-[14px] font-medium text-mute ${link}`}>
            Why I started Pen and Paper →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-5 py-10 font-sans text-[13px] text-mute sm:flex-row sm:items-center sm:px-8">
        <p className="story-serif text-[17px] text-ink italic">Your thoughts deserve to be written down.</p>
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
          <Link href="/credits" className={link}>
            Photo credits
          </Link>
          <span>© Pen and Paper</span>
        </p>
      </div>
    </footer>
  );
}

/**
 * The homepage: the parent brand and its belief, then its two products as
 * two equal doors (Stories, Desk), then the person behind it.
 */
export async function StoryHome() {
  const [loved, newest] = await Promise.all([lovedThisMonth(), publishedStories(1)]);
  const lead = loved ?? newest[0] ?? null;
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <Header />
      <main className="flex flex-1 flex-col">
        <section className="relative isolate flex w-full flex-col items-center gap-4 px-5 pt-10 pb-12 text-center sm:px-8 sm:pt-16 sm:pb-16">
          <TimelineStrip />
          <p className="font-sans text-[12px] font-semibold tracking-[0.16em] text-red-text uppercase">Pen and Paper</p>
          <h1 className="story-serif max-w-[820px] text-[38px] leading-[1.08] tracking-[-0.02em] text-balance text-ink sm:text-[60px]">Your thoughts deserve to be written down.</h1>
          <p className="max-w-[520px] font-sans text-[17px] leading-relaxed text-mute sm:text-[19px]">Other people&apos;s, in our stories. Your own, on your desk.</p>        </section>

        <Doors lead={lead} />

        <FounderNote />
      </main>
      <Footer />
    </div>
  );
}
