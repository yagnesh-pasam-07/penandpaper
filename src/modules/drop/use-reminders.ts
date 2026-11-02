"use client";

import { useEffect, useRef } from "react";
import type { Thought } from "./logic";

/**
 * While a paper is open, its reminders go off on the minute: a toast (and the
 * browser's own notification if the tab is hidden and notifications are
 * allowed). The daily jobs on the server cover the times the paper is closed;
 * each reminder fires once per tab session.
 */
export function useReminders(thoughts: Thought[], onRemind: (t: Thought) => void) {
  const fired = useRef(new Set<string>());
  const latest = useRef({ thoughts, onRemind });
  useEffect(() => {
    latest.current = { thoughts, onRemind };
  });
  useEffect(() => {
    const started = Date.now();
    const tick = () => {
      const now = Date.now();
      for (const t of latest.current.thoughts) {
        if (!t.dueAt || !t.dueHasTime || t.status !== "open") continue;
        const at = new Date(t.dueAt).getTime();
        const key = `${t.id}@${t.dueAt}`;
        // Only times that come due while this tab is open (older ones were the server's to send).
        if (at > now || at < started - 60_000 || fired.current.has(key)) continue;
        fired.current.add(key);
        latest.current.onRemind(t);
        if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Reminder", { body: t.text, tag: `pp-remind-${t.id}` });
          } catch {}
        }
      }
    };
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, []);
}
