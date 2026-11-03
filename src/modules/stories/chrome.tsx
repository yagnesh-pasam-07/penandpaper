import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, ThemeToggle } from "@/components/ui";
import { ReaderAccount } from "./reader-account";

/** The stories' own header: the brand, "Stories", and the theme. No app chrome, no sign-up nag. */
export function StoriesHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur-md">
      <nav aria-label="Stories" className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-3 px-4 sm:px-8">
        {/* One name, one hand: "pen & paper stories", the last word in red. */}
        <span className="flex items-center gap-2">
          <Link href="/" aria-label="Pen & Paper home" className="rounded-sm">
            <Logo size="sm" />
          </Link>
          <Link href="/stories" className="font-hand text-2xl font-bold text-red-text hover:underline hover:decoration-2 hover:underline-offset-4">
            stories
          </Link>
        </span>
        <span className="ml-auto flex items-center gap-1">
          {/* The short pieces, from Instagram. */}
          <Link href="/stories/unnoticed" className="font-hand rounded-lg px-2.5 py-1 text-[20px] text-ink hover:bg-soft">
            unnoticed
          </Link>
          <ThemeToggle />
          <ReaderAccount />
        </span>
      </nav>
    </header>
  );
}

export function StoriesFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-8 text-[13px] text-mute sm:flex-row sm:items-center sm:px-8">
        <span className="story-serif text-[16px] text-ink italic">Real stories, read slowly.</span>
        <span className="flex gap-5 sm:ml-auto">
          <Link href="/stories/rss.xml" className="hover:text-ink">
            RSS
          </Link>
          <Link href="/" className="hover:text-ink">
            Pen &amp; Paper
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
        </span>
      </div>
    </footer>
  );
}

export function StoriesShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <StoriesHeader />
      <main className="flex-1">{children}</main>
      <StoriesFooter />
    </div>
  );
}
