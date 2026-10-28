"use client";

import { useEffect } from "react";
import { applyAppearance, followSystemTheme } from "@/lib/appearance";
import { parseCanvas, parseThemeMode } from "@/lib/canvases";

/** Mounted once in the root layout: "System" follows the OS live. */
export function AppearanceBoot() {
  useEffect(() => followSystemTheme(), []);
  return null;
}

/**
 * Brings this device in line with the choice saved on the account (a new
 * device, or one changed elsewhere). The page already painted from this
 * device's own copy, so a change only shows on the first visit after switching.
 */
export function AppearanceSync({ canvas, theme }: { canvas: string | null; theme: string | null }) {
  useEffect(() => {
    if (canvas || theme) applyAppearance({ ...(canvas ? { canvas: parseCanvas(canvas) } : {}), ...(theme ? { mode: parseThemeMode(theme) } : {}) });
  }, [canvas, theme]);
  return null;
}
