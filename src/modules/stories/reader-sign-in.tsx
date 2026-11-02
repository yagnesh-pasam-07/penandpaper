"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { authClient } from "@/lib/auth-client";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

const WHY = {
  clap: { title: "Sign in to clap", line: "A clap is from a person. Sign in once, and every clap you give is yours, on every device." },
  save: { title: "Sign in to save it", line: "Keep this story for later and find it again on any phone or computer." },
} as const;

type Methods = { google: boolean };
const noop = () => () => {};

/**
 * The sign-in sheet for readers: one big "Continue with Google", and email for
 * people without Google. It comes back to the exact story, where the clap they
 * just gave is waiting. A sheet from the bottom on phones, a card on computers.
 */
export function ReaderSignIn({ reason, onClose }: { reason: keyof typeof WHY; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [methods, setMethods] = useState<Methods | null>(null);
  const here = useSyncExternalStore(noop, () => `${location.pathname}${location.search}`, () => "/stories");
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/stories/sign-in-methods", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Methods) => setMethods(d))
      .catch(() => setMethods({ google: false }));
    sheet.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const google = async () => {
    setBusy(true);
    setError("");
    const { error: err } = await authClient.signIn.social({ provider: "google", callbackURL: here });
    if (err) {
      setBusy(false);
      setError("Google sign-in didn't open. Try again, or use your email.");
    }
  };

  const why = WHY[reason];
  // Rendered on <body>, not where it was opened: the stories header is frosted
  // (backdrop-filter), which makes a "fixed" child sit inside the header's own
  // 65 px strip, so the sheet was centred there and its top (Google) ran off screen.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] font-sans backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-sign-in-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[100dvh] w-full max-w-[420px] flex-col gap-5 overflow-y-auto rounded-t-[24px] border border-line bg-bg px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-left outline-none sm:rounded-[24px] sm:pb-6"
      >
        <span aria-hidden="true" className="mx-auto -mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex flex-col gap-1.5">
          <h2 id="reader-sign-in-title" className="story-serif text-[26px] leading-tight text-ink">
            {why.title}
          </h2>
          <p className="text-[15px] leading-relaxed text-mute">{why.line}</p>
        </div>

        {methods?.google !== false && (
          <button
            type="button"
            onClick={() => void google()}
            disabled={busy || methods === null}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-line bg-sheet text-[16px] font-semibold text-ink shadow-[0_1px_0_var(--line)] hover:bg-soft disabled:opacity-60"
          >
            <GoogleMark />
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
        )}
        <Link href={`/login?next=${encodeURIComponent(here)}`} className="flex h-12 w-full items-center justify-center rounded-2xl text-[15px] font-medium text-ink hover:bg-soft">
          {methods?.google === false ? "Sign in with email" : "Use email instead"}
        </Link>
        {error && (
          <p role="alert" className="text-[13px] text-red-text">
            {error}
          </p>
        )}
        <p className="text-[12px] leading-relaxed text-mute">
          We only use your name to show who loved a story, to the writer. Reading never needs an account.{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
        </p>
        <button type="button" onClick={onClose} className="-mt-2 h-10 text-[14px] text-mute">
          Not now
        </button>
      </div>
    </div>,
    document.body,
  );
}
