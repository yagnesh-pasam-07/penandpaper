"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useStore } from "@/lib/store";

const subscribe = (cb: () => void) => useStore.persist.onFinishHydration(cb);

/** True once the saved store has been read from this browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => useStore.persist.hasHydrated(), () => false);
}

/** Mounted once in the root layout: loads the saved store. */
export function StoreBoot() {
  useEffect(() => {
    if (!useStore.persist.hasHydrated()) void useStore.persist.rehydrate();
  }, []);
  return null;
}

/** Renders children only after the store is loaded, so screens never flash empty data. */
export function Hydrated({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-dvh bg-bg" aria-busy="true" />;
  return <>{children}</>;
}
