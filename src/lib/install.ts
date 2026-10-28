"use client";

import { useSyncExternalStore } from "react";

/** Chrome's "install this app" event; not in lib.dom. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Holder = Window & { __ppInstall?: InstallEvent | null };

/** Set by the inline script in the root layout, which catches `beforeinstallprompt` before the page is ready. */
export const INSTALL_EVENT = "pp-install";

function holder(): Holder {
  return window as Holder;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(INSTALL_EVENT, onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    window.removeEventListener(INSTALL_EVENT, onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

/** Whether the app is already running as an installed app. */
function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Whether this browser is offering to install the app right now (and it isn't installed yet). */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !!holder().__ppInstall && !standalone(),
    () => false,
  );
}

/** Asks the browser to show its install dialog. */
export async function promptInstall(): Promise<void> {
  const event = holder().__ppInstall;
  if (!event) return;
  holder().__ppInstall = null;
  window.dispatchEvent(new Event(INSTALL_EVENT));
  await event.prompt();
  await event.userChoice.catch(() => null);
}
