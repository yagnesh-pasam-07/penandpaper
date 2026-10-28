"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_THOUGHT } from "./logic";

/** How long "Saved" stays before the window is closed. */
const CLOSE_AFTER_MS = 900;

/**
 * The quick box: type, Enter saves (Shift+Enter is a new line), Esc closes.
 * After a save it says where it went and closes the window; a browser only
 * lets a script close a window it opened, so when the window is still here a
 * moment later it says it can be closed by hand.
 */
export function QuickCapture({ paperName }: { paperName: string | null }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // One id per thought, so a retry after a dropped connection is still one note.
  const attempt = useRef(`cap-${crypto.randomUUID()}`);

  useEffect(() => box.current?.focus(), []);

  useEffect(() => {
    if (saved === null) return;
    const close = setTimeout(() => window.close(), CLOSE_AFTER_MS);
    const check = setTimeout(() => setStuck(true), CLOSE_AFTER_MS + 500);
    return () => {
      clearTimeout(close);
      clearTimeout(check);
    };
  }, [saved]);

  async function save() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/drop/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: attempt.current, text }),
      });
      if (res.status === 401) {
        // A full load on purpose: the session is gone, so nothing on screen should survive.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login?next=/capture";
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string; paperName?: string | null };
      if (!res.ok) throw new Error(body.error ?? "Couldn't save that thought.");
      setSaved(body.paperName ?? "your paper");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that thought.");
    } finally {
      setBusy(false);
    }
  }

  if (saved !== null) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col items-center justify-center gap-2 bg-bg px-6 text-center text-ink">
        <p role="status" className="font-hand text-[32px] leading-none font-bold">
          Saved to {saved}
        </p>
        <p className="text-sm text-mute">{stuck ? "You can close this window." : "Closing…"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-2 bg-bg p-3 text-ink">
      <label htmlFor="quick-thought" className="text-[13px] font-medium text-mute">
        {paperName ? `To \u201c${paperName}\u201d` : "To your latest paper"}
      </label>
      <textarea
        id="quick-thought"
        ref={box}
        value={text}
        maxLength={MAX_THOUGHT}
        placeholder="Type a thought. Enter saves."
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            window.close();
          }
        }}
        className="min-h-0 flex-1 resize-none rounded-xl border border-line bg-sheet p-3 font-note text-[19px] leading-snug outline-none focus:border-red-text"
      />
      <p role="status" className="min-h-5 text-[13px] text-red-text">
        {error}
      </p>
    </main>
  );
}
