import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ui";
import { PenIcon } from "@/components/icons";
import { REPO_URL } from "@/lib/github";
import { GitHubButton } from "@/modules/home/open-source";

/**
 * The public site's one frame, the same on every page (home, writing, a
 * piece, about, desk): the logo, Writing and Desk, GitHub with its stars,
 * the theme. The footer splits the same way. Pages add their own control on
 * the right (a reader's account, Sign in) through `end`.
 */

export const LINKEDIN_POST_URL = "https://lnkd.in/p/duJgX2QJ";
export const INSTAGRAM_URL = "https://www.instagram.com/unnoticed.pnp/";

export const siteLink = "rounded-sm underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";

export function SiteHeader({ end, sticky = false }: { end?: ReactNode; sticky?: boolean }) {
  return (
    <header className={sticky ? "sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur-md" : ""}>
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="Pen and Paper, home" className="flex items-center gap-2 text-red-text">
          <PenIcon size={20} />
          <span className="font-hand text-[22px] leading-none font-bold whitespace-nowrap text-ink sm:text-[24px]">pen &amp; paper</span>
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 font-sans text-[15px] whitespace-nowrap text-mute sm:gap-1">
          <Link href="/stories" className={`rounded-full px-3 py-2 ${siteLink}`}>
            Writing
          </Link>
          <Link href="/desk" className={`rounded-full px-3 py-2 ${siteLink}`}>
            Desk
          </Link>
          <span className="ml-1 max-sm:hidden">
            <GitHubButton />
          </span>
          <ThemeToggle />
          {end}
        </nav>
      </div>
    </header>
  );
}

function FooterTab({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-2.5">
      <span className="text-[12px] font-semibold tracking-[0.14em] text-ink uppercase">{title}</span>
      {children}
    </nav>
  );
}

export function SiteFooter() {
  const out = { target: "_blank", rel: "noopener noreferrer", className: `w-fit ${siteLink}` } as const;
  const inn = `w-fit ${siteLink}`;
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-2 gap-8 px-5 py-12 font-sans text-[14px] text-mute sm:grid-cols-4 sm:px-8">
        <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
          <p className="story-serif text-[18px] leading-snug text-ink italic">Your thoughts deserve to be written down.</p>
          <span>© Pen and Paper</span>
        </div>
        <FooterTab title="Writing">
          <Link href="/stories" className={inn}>All writing</Link>
          <a href={INSTAGRAM_URL} {...out}>Instagram @unnoticed.pnp</a>
          <Link href="/stories/rss.xml" className={inn}>RSS</Link>
        </FooterTab>
        <FooterTab title="Desk">
          <Link href="/desk" className={inn}>Open your desk</Link>
          <Link href="/download" className={inn}>Apps &amp; extension</Link>
        </FooterTab>
        <FooterTab title="Pen and Paper">
          <Link href="/about" className={inn}>About</Link>
          <a href={REPO_URL} {...out}>GitHub (open source)</a>
          <a href={LINKEDIN_POST_URL} {...out}>LinkedIn post</a>
          <Link href="/privacy" className={inn}>Privacy</Link>
          <Link href="/credits" className={inn}>Photo credits</Link>
        </FooterTab>
      </div>
    </footer>
  );
}
