"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

/** How long Space has to stay down before it means "listen" rather than "a space". */
export const HOLD_MS = 350;

type Voice = { supported: boolean; start: () => void; stop: () => void; state: { kind: string } };

/**
 * Hold Space to talk, in a text box, the way Claude's CLI does it: a tap types
 * a space as usual; held, it starts listening, takes back the spaces the key
 * repeat already typed, and on release the words go in at the cursor (the
 * caller's onText does that). Wire `onKeyDown` and `onKeyUp` on the textarea.
 */
export function useHoldToTalk(voice: Voice, area: React.RefObject<HTMLTextAreaElement | null>, setText: (fn: (t: string) => string) => void) {
  const held = useRef<{ at: number; from: number; talking: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  });

  // Let go anywhere (the window lost focus, the box closed): stop and keep what was heard.
  useEffect(() => {
    const letGo = () => {
      const h = held.current;
      if (!h) return;
      clearTimeout(h.timer);
      if (h.talking) voiceRef.current.stop();
      held.current = null;
    };
    window.addEventListener("blur", letGo);
    return () => {
      window.removeEventListener("blur", letGo);
      letGo();
    };
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (e.key !== " " || e.metaKey || e.ctrlKey || e.altKey || !voiceRef.current.supported) return false;
    const h = held.current;
    if (h?.talking) {
      // Already listening: swallow the repeats.
      e.preventDefault();
      return true;
    }
    if (h) return false;
    const el = area.current;
    const from = el?.selectionStart ?? 0;
    held.current = {
      at: Date.now(),
      from,
      talking: false,
      timer: setTimeout(() => {
        const now = held.current;
        if (!now) return;
        now.talking = true;
        // Take back the spaces typed while it was only a key held down.
        const cur = area.current;
        const to = cur?.selectionStart ?? now.from;
        if (to > now.from) {
          setText((t) => t.slice(0, now.from) + t.slice(to));
          requestAnimationFrame(() => cur?.setSelectionRange(now.from, now.from));
        }
        voiceRef.current.start();
      }, HOLD_MS),
    };
    return false;
  };

  const onKeyUp = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== " ") return;
    const h = held.current;
    if (!h) return;
    clearTimeout(h.timer);
    if (h.talking) {
      e.preventDefault();
      voiceRef.current.stop();
    }
    held.current = null;
  };

  return { onKeyDown, onKeyUp };
}
