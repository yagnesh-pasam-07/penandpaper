"use client";

import { useRouter } from "next/navigation";
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

const FIELD =
  "h-[52px] w-full rounded-[14px] border-[1.5px] border-ink bg-sheet px-4 text-base font-normal outline-none placeholder:text-mute focus-visible:outline-none";

/** Better Auth's error codes, in plain words. */
function friendly(code: string | undefined, message: string | undefined, mode: "signup" | "login"): string {
  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "There's already an account with that email. Log in instead.";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "That password is too long (128 characters at most).";
    case "INVALID_EMAIL":
      return "That doesn't look like an email address.";
    default:
      if (message?.toLowerCase().includes("too many")) return "Too many tries. Wait a minute and try again.";
      return mode === "signup" ? "Couldn't create your account. Try again." : "Couldn't log you in. Try again.";
  }
}

/**
 * Sign up or log in with email and password; Google and the email link show
 * above it when they're set up. All of them come back to `next`.
 */
export function SignInPanel({ next, mode: startMode, switchInline = false }: { next: string; mode: "signup" | "login"; switchInline?: boolean }) {
  const router = useRouter();
  const methods = useStore((s) => s.signIn);
  const refresh = useStore((s) => s.refresh);
  const [mode, setMode] = useState(startMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"google" | "password" | "link" | null>(null);
  const [error, setError] = useState("");
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const signup = mode === "signup";
  const cleanEmail = email.trim().toLowerCase();
  const ready = EMAIL.test(cleanEmail) && password.length >= 8 && (!signup || name.trim().length > 0);

  const done = async () => {
    await refresh();
    router.replace(next);
    router.refresh();
  };

  if (linkSentTo) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-[18px] border border-line bg-sheet p-6 text-center">
        <span className="font-hand text-[32px] leading-none font-bold">Check your inbox.</span>
        <span className="text-[15px] text-mute">
          We sent a sign-in link to <span className="font-medium text-ink">{linkSentTo}</span>. It works once and expires in 15 minutes.
        </span>
        <button type="button" onClick={() => setLinkSentTo(null)} className="py-2 text-sm font-semibold">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
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
                setError(err.message ?? "Google sign-in didn't work. Use your email and password.");
              }
            }}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] border border-line bg-sheet text-base font-medium hover:bg-soft disabled:opacity-60"
          >
            <GoogleMark />
            {busy === "google" ? "Opening Google…" : signup ? "Sign up with Google" : "Log in with Google"}
          </button>
          <div className="flex items-center gap-3 text-[13px] text-mute">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form
        className="flex flex-col gap-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready || busy) return;
          setBusy("password");
          setError("");
          const { error: err } = signup
            ? await authClient.signUp.email({ name: name.trim(), email: cleanEmail, password, callbackURL: next })
            : await authClient.signIn.email({ email: cleanEmail, password, callbackURL: next });
          if (err) {
            setBusy(null);
            setError(friendly(err.code, err.message, mode));
            return;
          }
          await done();
        }}
      >
        {signup && (
          <label className="flex flex-col gap-2 text-sm font-medium">
            Your name
            <input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Asha" maxLength={80} className={FIELD} />
          </label>
        )}
        <label className="flex flex-col gap-2 text-sm font-medium">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Password
          <span className="relative flex">
            <input
              type={show ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={signup ? "At least 8 characters" : ""}
              className={`${FIELD} pr-20`}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-2 my-auto h-9 rounded-[10px] px-3 text-sm font-medium text-mute hover:bg-soft hover:text-ink"
            >
              {show ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        <button type="submit" disabled={!ready || busy !== null} className={`${btn.primary} disabled:opacity-50`}>
          {busy === "password" ? (signup ? "Creating your account…" : "Logging in…") : signup ? "Create account" : "Log in"}
        </button>
      </form>

      {methods.email && (
        <button
          type="button"
          disabled={!EMAIL.test(cleanEmail) || busy !== null}
          onClick={async () => {
            setBusy("link");
            setError("");
            const { error: err } = await authClient.signIn.magicLink({ email: cleanEmail, callbackURL: next });
            setBusy(null);
            if (err) setError(err.message ?? "Couldn't send the link. Try again.");
            else setLinkSentTo(cleanEmail);
          }}
          className="text-sm font-medium text-mute hover:text-ink disabled:opacity-50"
        >
          {busy === "link" ? "Sending…" : "Email me a sign-in link instead"}
        </button>
      )}

      {error && (
        <p role="alert" className="text-center text-sm text-red-text">
          {error}
        </p>
      )}

      {switchInline && (
        <p className="text-center text-[15px] text-mute">
          {signup ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(signup ? "login" : "signup");
              setError("");
            }}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            {signup ? "Log in" : "Create an account"}
          </button>
        </p>
      )}
    </div>
  );
}
