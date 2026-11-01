"use client";

import { useState, useSyncExternalStore } from "react";

function WhatsAppGlyph() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

/**
 * Share: WhatsApp first (where most stories travel here), then copy the link.
 * Where the phone has its own share sheet, "More" opens it. `compact` is the
 * byline's single icon button.
 */
export function ShareStory({ url, title, compact = false }: { url: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (compact) {
    return (
      <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" title="Share on WhatsApp" className="flex size-10 items-center justify-center rounded-full border border-line text-ink hover:bg-soft">
        <WhatsAppGlyph />
      </a>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 font-sans">
      <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center gap-2 rounded-full bg-[#1f7a4d] px-5 text-[15px] font-semibold text-white hover:brightness-105">
        <WhatsAppGlyph />
        WhatsApp
      </a>
      <button type="button" onClick={() => void copy()} aria-live="polite" className="flex h-11 items-center rounded-full border border-line px-5 text-[15px] font-medium text-ink hover:bg-soft">
        {copied ? "Link copied" : "Copy link"}
      </button>
      <ShareSheet url={url} title={title} />
    </div>
  );
}

function ShareSheet({ url, title }: { url: string; title: string }) {
  const can = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );
  if (!can) return null;
  return (
    <button type="button" onClick={() => void navigator.share({ title, url }).catch(() => {})} className="flex h-11 items-center rounded-full border border-line px-5 text-[15px] font-medium text-ink hover:bg-soft">
      More…
    </button>
  );
}
