"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ReaderSignIn } from "./reader-sign-in";

/**
 * The reader in the stories header: "Sign in" when signed out (the same
 * Google sheet as claps); their initial when signed in, opening Saved and
 * Sign out. Fetched after the page shows, so the stories stay cached and fast.
 */
export function ReaderAccount() {
  const [me, setMe] = useState<{ name: string } | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/stories/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { name: string } | null) => setMe(d))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  if (me === undefined) return <span className="size-9" aria-hidden="true" />;
  if (!me)
    return (
      <>
        <button type="button" onClick={() => setAsking(true)} className="h-9 rounded-full px-3.5 font-sans text-[14px] font-medium text-ink hover:bg-soft">
          Sign in
        </button>
        {asking && <ReaderSignIn reason="clap" onClose={() => setAsking(false)} />}
      </>
    );
  return (
    <div ref={box} className="relative font-sans">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Signed in as ${me.name}`} className="flex size-9 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-bg">
        {me.name.trim().charAt(0).toUpperCase() || "·"}
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-40 flex w-56 flex-col rounded-2xl border border-line bg-sheet p-1.5 shadow-[0_16px_40px_-16px_var(--shadow)]">
          <span className="px-3 py-2 text-[13px] text-mute">{me.name}</span>
          <Link href="/stories/saved" className="rounded-xl px-3 py-2.5 text-[15px] text-ink hover:bg-soft">
            Saved stories
          </Link>
          <Link href="/drop" className="rounded-xl px-3 py-2.5 text-[15px] text-ink hover:bg-soft">
            Your paper
          </Link>
          <button
            type="button"
            onClick={async () => {
              await authClient.signOut();
              location.reload();
            }}
            className="rounded-xl px-3 py-2.5 text-left text-[15px] text-mute hover:bg-soft hover:text-ink"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
