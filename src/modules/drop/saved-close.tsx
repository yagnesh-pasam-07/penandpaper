"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** How long the confirmation stays before the extension's window is closed. */
const CLOSE_AFTER_MS = 1200;

/**
 * "Saved to …" in the extension's small window, which closes itself. A browser
 * only lets a script close a window it opened (or one with a single history
 * entry), so when the window is still here a moment later it says it can be
 * closed by hand instead.
 */
export function SavedClose({ name, href }: { name: string | null; href: string }) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const close = setTimeout(() => window.close(), CLOSE_AFTER_MS);
    const check = setTimeout(() => setStuck(true), CLOSE_AFTER_MS + 500);
    return () => {
      clearTimeout(close);
      clearTimeout(check);
    };
  }, []);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-ink">
      <p role="status" className="font-hand text-[34px] leading-none font-bold">
        {name ? `Saved to ${name}` : "Saved"}
      </p>
      <p className="text-sm text-mute">{stuck ? "You can close this window." : "Closing…"}</p>
      <Link href={href} className="rounded-xl border border-line bg-sheet px-4 py-2 text-sm font-semibold hover:bg-soft">
        Open my paper
      </Link>
    </main>
  );
}
