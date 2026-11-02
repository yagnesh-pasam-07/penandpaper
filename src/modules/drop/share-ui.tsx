"use client";

import { useEffect, useRef, useState } from "react";
import { call } from "./chrome";

type State = { people: { email: string; name: string | null; createdAt: string }[]; publicToken: string | null };

/**
 * Share, top right on the paper: one small sheet with two parts.
 * Invite people (private, read-only: they sign in with that email) and
 * Anyone with the link (public, read-only, off by default).
 */
export function ShareButton({ paperId }: { paperId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-soft hover:text-ink ${open ? "bg-soft text-ink" : "text-mute"}`}
      >
        Share
      </button>
      {open && <ShareSheet paperId={paperId} onClose={() => setOpen(false)} />}
    </span>
  );
}

export function ShareSheet({ paperId, onClose, initialEmail = "" }: { paperId: string; onClose: () => void; initialEmail?: string }) {
  const [state, setState] = useState<State | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void call<State>(`/api/drop/papers/${paperId}/share`).then(setState).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [paperId]);
  useEffect(() => {
    const off = (e: PointerEvent) => card.current && !card.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", off, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", off, true);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const send = async (body: object) => {
    setBusy(true);
    setError("");
    try {
      setState(await call<State>(`/api/drop/papers/${paperId}/share`, { method: "POST", body: JSON.stringify(body) }));
      // "@" suggestions pick up the change.
      window.dispatchEvent(new Event("pp-shared"));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const link = state?.publicToken ? `${location.origin}/p/${state.publicToken}` : "";

  return (
    <div
      ref={card}
      role="dialog"
      aria-label="Share this paper"
      data-no-pan=""
      onKeyDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute top-full right-0 z-50 mt-2 w-[340px] rounded-2xl border border-line bg-raised p-4 text-left shadow-[0_18px_40px_-18px_var(--shadow)]"
    >
      <p className="mb-1 text-[15px] font-semibold text-ink">Share this paper</p>
      <p className="mb-3 text-[13px] text-mute">People you share with can look, not change anything.</p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (email.trim() && (await send({ invite: email.trim() }))) setEmail("");
        }}
        className="mb-2 flex gap-2"
      >
        <label htmlFor="share-email" className="sr-only">
          Email
        </label>
        <input
          id="share-email"
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-sheet px-2.5 text-[14px] text-ink placeholder:text-mute"
        />
        <button type="submit" disabled={busy || !email.trim()} className="h-9 rounded-[10px] bg-ink px-3 text-sm font-semibold text-bg disabled:opacity-40">
          Invite
        </button>
      </form>
      {state && state.people.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1">
          {state.people.map((p) => (
            <li key={p.email} className="flex items-center gap-2 rounded-lg px-1 py-1 text-[13px]">
              <span className="flex size-6 items-center justify-center rounded-full bg-soft text-[11px] font-semibold text-mute uppercase">{p.email[0]}</span>
              <span className="min-w-0 flex-1 truncate text-ink">
                {p.name ? (
                  <>
                    {p.name} <span className="text-mute">{p.email}</span>
                  </>
                ) : (
                  p.email
                )}
              </span>
              <span className="text-graphite">can view</span>
              <button type="button" onClick={() => void send({ remove: p.email })} aria-label={`Stop sharing with ${p.email}`} className="rounded-md px-1.5 text-mute hover:bg-red-soft hover:text-red-text">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <label className="flex items-center gap-3">
          <span className="flex-1">
            <span className="block text-[14px] font-medium text-ink">Anyone with the link</span>
            <span className="block text-[12px] text-mute">{link ? "Can view, no sign-in. Turn off to stop it at once." : "Off. Only you and the people above."}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={!!state?.publicToken}
            disabled={busy || !state}
            onChange={(e) => void send({ link: e.target.checked })}
            className="size-5 accent-[var(--red)]"
          />
        </label>
        {link && (
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={link} aria-label="Public link" onFocus={(e) => e.target.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-sunken px-2 font-mono text-[12px] text-mute" />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="h-9 rounded-[10px] border border-line-strong px-3 text-sm font-medium text-ink hover:bg-soft"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        {link && (
          <button type="button" onClick={() => void send({ link: true, reset: true })} className="mt-1.5 text-[12px] text-mute underline-offset-2 hover:text-ink hover:underline">
            Make a new link (the old one stops working)
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-red-text">
          {error}
        </p>
      )}
    </div>
  );
}
