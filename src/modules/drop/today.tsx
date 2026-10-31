"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HandText } from "@/components/canvas/thought-bubble";
import { CloseIcon } from "@/components/icons";
import { TZ_COOKIE } from "./tonight";
import type { RecallState } from "./recall-server";
import { keepWorker, playRecallSound } from "./recall-client";

/** The browser's zone, sent so "after 9 AM" means their 9 AM. */
const zone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
};

/**
 * Thought of the Day: the first time the paper opens after the person's
 * recall time, one past thought greets them full screen, on a fresh sheet,
 * like a letter from their past self, with the signature sound. Two choices:
 * Use it (it goes onto today's paper) or Tomorrow (it comes back later). A
 * quiet "Show another" allows up to three a day, so it never becomes a feed.
 * Opening it on one device marks the day seen everywhere.
 */
export function TodayThought({ force = false, onUsed }: { force?: boolean; onUsed: (paperId: string, newId: string) => void }) {
  const [state, setState] = useState<RecallState | null>(null);
  const [leaving, setLeaving] = useState<"use" | "tomorrow" | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const shown = useRef(false);

  const load = useCallback(async (asked: boolean) => {
    try {
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(zone())}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
    const res = await fetch(`/api/drop/today?tz=${encodeURIComponent(zone())}${asked ? "&force=1" : ""}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const next = (await res.json()) as RecallState;
    if (!next.thought) return;
    setState(next);
    // The sound once a day, when it arrives on its own (not when asked for).
    if (next.sound && !shown.current) playRecallSound();
    shown.current = true;
  }, []);

  useEffect(() => {
    keepWorker();
    // After this render, not during it.
    const first = setTimeout(() => void load(force), 0);
    // A notification tapped while the paper is open: show it now.
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "pp-today") void load(true);
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    // Back to the tab after their time has passed: greet then.
    const onVisible = () => document.visibilityState === "visible" && !shown.current && void load(false);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [force, load]);

  const thoughtId = state?.thought?.id;
  useEffect(() => {
    if (thoughtId) dialog.current?.focus();
  }, [thoughtId]);

  const act = async (action: "use" | "tomorrow" | "another" | "seen") => {
    const t = state?.thought;
    if (!t || busy) return;
    setBusy(true);
    const res = await fetch("/api/drop/today", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thoughtId: t.id, action }) }).catch(() => null);
    setBusy(false);
    if (action === "another") {
      const next = res?.ok ? ((await res.json()) as RecallState) : null;
      setState(next?.thought ? next : null);
      return;
    }
    if (action === "use" || action === "tomorrow") {
      setLeaving(action);
      const body = action === "use" && res?.ok ? ((await res.json()) as { paperId: string | null; newId: string | null }) : null;
      setTimeout(() => {
        setState(null);
        setLeaving(null);
        if (body?.paperId && body.newId) onUsed(body.paperId, body.newId);
      }, 420);
      return;
    }
    setState(null);
  };

  if (!state?.thought) return null;
  const t = state.thought;

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="today-title"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") void act("seen");
        else if (e.key.toLowerCase() === "u" && !e.metaKey && !e.ctrlKey) void act("use");
        else if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey) void act("tomorrow");
      }}
      className="scrim-bg fixed inset-0 z-[70] flex items-center justify-center p-4 outline-none sm:p-8"
    >
      <article
        className={`canvas-surface relative flex max-h-[92dvh] w-full max-w-[640px] flex-col gap-6 overflow-auto rounded-[22px] border border-line bg-sheet px-6 pt-8 pb-6 shadow-[0_40px_80px_-40px_var(--shadow)] sm:px-12 sm:pt-12 sm:pb-8 ${
          leaving === "use" ? "today-use" : leaving === "tomorrow" ? "today-later" : "today-in"
        }`}
      >
        <button type="button" onClick={() => void act("seen")} aria-label="Close" title="Close (Esc)" className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-mute hover:bg-soft hover:text-ink">
          <CloseIcon size={13} />
        </button>
        <header className="flex flex-col gap-1.5">
          <h2 id="today-title" className="font-hand text-[30px] leading-none font-bold sm:text-[36px]">
            Your thought for today
          </h2>
          <p className="text-[14px] text-mute">
            {t.ago}
            {t.paperName?.trim() ? (
              <>
                {" "}
                · on <span className="text-ink">{t.paperName}</span>
              </>
            ) : null}
          </p>
        </header>

        {t.image && (
          // eslint-disable-next-line @next/next/no-img-element -- a small data URL the person pasted
          <img src={t.image} alt={t.text ? `Picture: ${t.text}` : "A picture you kept"} className="max-h-[40dvh] w-full rounded-xl bg-soft object-contain shadow-[inset_0_0_0_1px_var(--line)]" />
        )}
        {t.text && (
          <p className="hand font-note text-[26px] leading-snug break-words whitespace-pre-wrap text-ink sm:text-[32px]">
            <HandText text={t.text} seed={t.createdAt} />
          </p>
        )}

        <footer className="flex flex-col gap-3 pt-2">
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("use")}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red text-[16px] font-semibold text-on-red hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text disabled:opacity-60"
            >
              Use it <kbd className="rounded bg-on-red/20 px-1.5 font-sans text-[11px] max-sm:hidden">U</kbd>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("tomorrow")}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-[16px] font-semibold text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text disabled:opacity-60"
            >
              Tomorrow <kbd className="rounded bg-soft px-1.5 font-sans text-[11px] text-mute max-sm:hidden">T</kbd>
            </button>
          </div>
          <p className="flex items-center justify-between text-[13px] text-mute">
            <span>Use it puts it on today&apos;s paper. Tomorrow brings it back later.</span>
            {state.left > 0 && (
              <button type="button" disabled={busy} onClick={() => void act("another")} className="shrink-0 font-medium underline-offset-2 hover:text-ink hover:underline">
                Show another
              </button>
            )}
          </p>
        </footer>
      </article>
    </div>
  );
}
