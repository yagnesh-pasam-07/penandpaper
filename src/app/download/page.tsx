import type { Metadata } from "next";
import Link from "next/link";
import { Logo, ThemeToggle } from "@/components/ui";
import { DownloadCards } from "./cards";

export const metadata: Metadata = {
  title: "Download · Pen & Paper",
  description: "The Pen & Paper extension for Chrome and Edge, the Mac menu-bar app, and the installable app for Windows: save a highlight, a picture or a thought from anywhere.",
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";

/** Where the Chrome extension and the Mac app are downloaded. Public, so a link from the homepage and from inside the app both work. */
export default function DownloadPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-3 px-4 sm:px-8">
        <Link href="/" aria-label="Pen & Paper home" className={`rounded-sm ${focus}`}>
          <Logo size="sm" />
        </Link>
        <span className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Link href="/drop" className={`flex h-11 items-center rounded-xl px-3 text-[15px] font-medium text-mute hover:bg-soft hover:text-ink ${focus}`}>
            My paper
          </Link>
        </span>
      </nav>
      <main className="mx-auto flex w-full max-w-[880px] flex-col gap-8 px-4 pt-10 pb-24 sm:px-8">
        <header className="flex flex-col gap-3 text-center">
          <h1 className="font-hand text-[52px] leading-none font-bold sm:text-[72px]">Take it with you.</h1>
          <p className="mx-auto max-w-[520px] text-[17px] text-mute">Save a thought, a highlighted post or a picture to your paper without opening Pen &amp; Paper.</p>
        </header>
        <DownloadCards />
        <p className="text-center text-[13px] text-mute">Both are early access. Sign in to Pen &amp; Paper in the same browser before using the extension.</p>
      </main>
    </div>
  );
}
