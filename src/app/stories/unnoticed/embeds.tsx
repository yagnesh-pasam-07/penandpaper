"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

/**
 * Posts shown with Instagram's own embed: works for any public post with no
 * token. Instagram's script turns each blockquote into the post (picture,
 * caption, likes). Loaded once, only on this page, after it's on screen.
 */
export function InstagramEmbeds({ codes }: { codes: string[] }) {
  useEffect(() => {
    if (window.instgrm) {
      window.instgrm.Embeds.process();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    s.onload = () => window.instgrm?.Embeds.process();
    document.body.appendChild(s);
  }, [codes]);

  return (
    <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {codes.map((code, i) => (
        <li key={code} className="relative bg-sheet p-2.5 shadow-[0_14px_28px_-16px_var(--shadow)] ring-1 ring-line" style={{ transform: `rotate(${((i % 3) - 1) * 0.5}deg)` }}>
          <span aria-hidden="true" className="absolute -top-2.5 left-1/2 z-10 h-5 w-16 -translate-x-1/2 rotate-[-3deg] bg-[color-mix(in_srgb,var(--sheet)_55%,#e9dcae)] opacity-90 shadow-sm" />
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={`https://www.instagram.com/p/${code}/?utm_source=ig_embed`}
            data-instgrm-version="14"
            style={{ margin: 0, minWidth: 0, maxWidth: "100%", width: "100%", background: "var(--sheet)", border: 0 }}
          >
            <a href={`https://www.instagram.com/p/${code}/`} target="_blank" rel="noopener" className="font-hand block p-6 text-center text-[20px] text-ink">
              Open this one on Instagram ↗
            </a>
          </blockquote>
        </li>
      ))}
    </ul>
  );
}
