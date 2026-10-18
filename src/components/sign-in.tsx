"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { btn } from "./ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only same-site paths, so a crafted link can't bounce someone elsewhere after sign-in. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/** Google, or a one-time link by email. Both come back to `next`. */
export function SignInPanel({ next, googleLabel = "Continue with Google", emailCta = "Email me a sign-in link" }: { next: string; googleLabel?: string; emailCta?: string }) {
  const methods = useStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState("");
  const valid = EMAIL.test(email.trim());

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-[18px] border border-line bg-sheet p-6 text-center">
        <span className="font-hand text-[32px] leading-none font-bold">Check your inbox.</span>
        <span className="text-[15px] text-mute">
          We sent a sign-in link to <span className="font-medium text-ink">{sentTo}</span>. It works once and expires in 15 minutes.
        </span>
        <button type="button" onClick={() => setSentTo(null)} className="py-2 text-sm font-semibold">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy("email");
        setError("");
        const { error: err } = await authClient.signIn.magicLink({ email: email.trim().toLowerCase(), callbackURL: next });
        setBusy(null);
        if (err) setError(err.message ?? "Couldn't send the link. Try again.");
        else setSentTo(email.trim().toLowerCase());
      }}
    >
      {methods.google && (
        <>
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("google");
              setError("");
              const { error: err } = await authClient.signIn.social({ provider: "google", callbackURL: next });
              if (err) {
                setBusy(null);
                setError(err.message ?? "Google sign-in didn't work. Try the email link.");
              }
            }}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] border border-line bg-sheet text-base font-medium hover:bg-soft disabled:opacity-60"
          >
            <GoogleMark />
            {busy === "google" ? "Opening Google…" : googleLabel}
          </button>
          {methods.email && (
            <div className="flex items-center gap-3 text-[13px] text-mute">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
          )}
        </>
      )}
      {methods.email && (
        <>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Work email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-[52px] rounded-[14px] border-[1.5px] border-ink bg-sheet px-4 text-base font-normal outline-none placeholder:text-mute focus-visible:outline-none"
            />
          </label>
          <button type="submit" disabled={!valid || busy !== null} className={`${btn.primary} disabled:opacity-50`}>
            {busy === "email" ? "Sending…" : emailCta}
          </button>
        </>
      )}
      {!methods.email && !methods.google && (
        <p role="status" className="rounded-[14px] border border-dashed border-line px-4 py-3 text-center text-sm text-mute">
          Sign-in opens shortly. We&apos;re switching on Google sign-in.
        </p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm text-red-text">
          {error}
        </p>
      )}
    </form>
  );
}
