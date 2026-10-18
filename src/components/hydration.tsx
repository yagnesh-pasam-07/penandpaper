"use client";

import { useEffect, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { CloseIcon } from "./icons";

/** True once the first answer from the server is in. */
export function useHydrated(): boolean {
  return useStore((s) => s.status !== "loading");
}

const POLL_MS = 10_000;

/**
 * Mounted once in the root layout: loads the app state, keeps it fresh while
 * the tab is visible (so the lead sees members strike tasks), and shows errors.
 */
export function StoreBoot() {
  const refresh = useStore((s) => s.refresh);
  const error = useStore((s) => s.error);
  const status = useStore((s) => s.status);
  const dismiss = useStore((s) => s.dismissError);

  useEffect(() => {
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(dismiss, 6000);
    return () => clearTimeout(id);
  }, [error, dismiss]);

  const message = error ?? (status === "offline" ? "Can't reach Pen & Paper right now. Retrying…" : null);
  if (!message) return null;
  return (
    <div role="alert" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg shadow-lg">
      <span className="flex-1">{message}</span>
      {error && (
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="flex size-8 items-center justify-center rounded-full hover:bg-bg/15">
          <CloseIcon size={12} />
        </button>
      )}
    </div>
  );
}

/** Renders children only after the state has loaded, so screens never flash empty data. */
export function Hydrated({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-dvh bg-bg" aria-busy="true" />;
  return <>{children}</>;
}
