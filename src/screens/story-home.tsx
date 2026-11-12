import Link from "next/link";
import { ThemeToggle } from "@/components/ui";
import { PenIcon } from "@/components/icons";

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
        <ThemeToggle />
      </nav>
    </header>
  );
}

const POST_URL = "https://lnkd.in/p/duJgX2QJ";

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
          href={POST_URL}
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

/** One column of footer links under a small heading. */
function FooterTab({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-2.5">
      <span className="text-[12px] font-semibold tracking-[0.14em] text-ink uppercase">{title}</span>
      {children}
    </nav>
  );
}

/** Everything else lives down here, in three short tabs, so the page above stays quiet. */
function Footer() {
  const out = { target: "_blank", rel: "noopener noreferrer", className: `w-fit ${link}` } as const;
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-2 gap-8 px-5 py-12 font-sans text-[14px] text-mute sm:grid-cols-4 sm:px-8">
        <p className="story-serif col-span-2 text-[18px] leading-snug text-ink italic sm:col-span-1">Your thoughts deserve to be written down.</p>
        <FooterTab title="Products">
          <Link href="/stories" className={`w-fit ${link}`}>Stories</Link>
          <Link href="/desk" className={`w-fit ${link}`}>Desk</Link>
          <Link href="/stories/unnoticed" className={`w-fit ${link}`}>Unnoticed</Link>
          <Link href="/stories/rss.xml" className={`w-fit ${link}`}>RSS</Link>
        </FooterTab>
        <FooterTab title="Pen and Paper">
          <Link href="/about" className={`w-fit ${link}`}>About</Link>
          <a href="https://www.instagram.com/unnoticed.moment/" {...out}>Instagram</a>
          <a href={POST_URL} {...out}>LinkedIn post</a>
        </FooterTab>
        <FooterTab title="Small print">
          <Link href="/privacy" className={`w-fit ${link}`}>Privacy</Link>
          <Link href="/credits" className={`w-fit ${link}`}>Photo credits</Link>
          <span>© Pen and Paper</span>
        </FooterTab>
      </div>
    </footer>
  );
}

/**
 * The homepage, kept as plain as a notice board: one line of belief, and the
 * maker's post on why it exists. Stories and Desk are in the header and the
 * footer; everything else is in the footer.
 */
export function StoryHome() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <Header />
      <main className="mx-auto flex w-full max-w-[680px] flex-1 flex-col px-5 sm:px-8">
        <section className="flex flex-col gap-4 pt-14 pb-12 sm:pt-24 sm:pb-16">
          <h1 className="story-serif text-[36px] leading-[1.1] tracking-[-0.02em] text-balance text-ink sm:text-[52px]">Your thoughts deserve to be written down.</h1>
          <p className="max-w-[520px] font-sans text-[17px] leading-relaxed text-mute">Real stories of real people, to read or listen to. And a quiet desk for your own thoughts.</p>
        </section>
        <MakersPost />
      </main>
      <Footer />
    </div>
  );
}
