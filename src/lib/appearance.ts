"use client";

import { useSyncExternalStore } from "react";
import { CANVAS_KEY, DEFAULT_CANVAS, DEFAULT_THEME_MODE, THEME_KEY, parseCanvas, parseThemeMode, resolveTheme, type CanvasId, type ThemeMode } from "./canvases";

const EVENT = "pp-appearance";

const dark = () => matchMedia("(prefers-color-scheme: dark)");

function root() {
  return document.documentElement;
}

/** Paints a choice on <html> (the same attributes the inline script sets before first paint). */
function paint(canvas: CanvasId, mode: ThemeMode) {
  root().setAttribute("data-canvas", canvas);
  root().setAttribute("data-theme-mode", mode);
  root().setAttribute("data-theme", resolveTheme(mode, dark().matches));
  window.dispatchEvent(new Event(EVENT));
}

export function readCanvas(): CanvasId {
  return parseCanvas(root().getAttribute("data-canvas"));
}

export function readThemeMode(): ThemeMode {
  return parseThemeMode(root().getAttribute("data-theme-mode"));
}

/** Applies and remembers a choice on this device (the account copy is saved separately). */
export function applyAppearance(next: { canvas?: CanvasId; mode?: ThemeMode }) {
  const canvas = next.canvas ?? readCanvas();
  const mode = next.mode ?? readThemeMode();
  try {
    localStorage.setItem(CANVAS_KEY, canvas);
    localStorage.setItem(THEME_KEY, mode);
  } catch {}
  paint(canvas, mode);
}

/** Saves the choice on the account; a signed-out visit just keeps its device copy. */
export async function saveAppearance(next: { canvas?: CanvasId; theme?: ThemeMode }): Promise<void> {
  try {
    await fetch("/api/drop/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  } catch {}
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useCanvas(): CanvasId {
  return useSyncExternalStore(subscribe, readCanvas, () => DEFAULT_CANVAS);
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, readThemeMode, () => DEFAULT_THEME_MODE);
}

/** Keeps "System" live: follows the OS when it flips between light and dark. */
export function followSystemTheme(): () => void {
  const query = dark();
  const onChange = () => {
    if (readThemeMode() === "system") paint(readCanvas(), "system");
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
