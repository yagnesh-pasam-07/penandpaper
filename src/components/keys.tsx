"use client";

import { keysFor, usePlatform } from "@/lib/platform";

/** Real keycaps, in the visitor's own keys: pass the shortcut the Mac way (⌥ ⇧ ⌘) and Windows sees Alt, Shift, Ctrl. */
export function Keys({ keys }: { keys: string[] }) {
  const shown = keysFor(keys, usePlatform());
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {shown.map((k, i) => (
        <kbd key={`${k}-${i}`} className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line border-b-2 bg-sheet px-1.5 text-[13px] leading-none text-ink">
          {k}
        </kbd>
      ))}
    </span>
  );
}
