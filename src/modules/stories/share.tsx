"use client";

import { useState, useSyncExternalStore } from "react";
import { tagged, whatsappText, type Channel } from "./reach";
import { track } from "./track";

function WhatsAppGlyph() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

function InstagramGlyph() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export type ShareInfo = { slug: string; url: string; title: string; hook: string; line: string };

const noop = () => () => {};

/**
 * Share, WhatsApp first: a warm line ("I read this and thought of you."),
 * the title and hook, and the link. Instagram: a 1080×1920 story card, sent
 * straight to Instagram through the phone's share sheet (downloaded on a
 * computer). Then copy the link, and the phone's own sheet. Every share is
 * counted for the writer's Story Studio; readers never see counts.
 */
export function ShareStory({ info, compact = false }: { info: ShareInfo; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState<"idle" | "making" | "saved">("idle");
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const wa = `https://wa.me/?text=${encodeURIComponent(whatsappText({ line: info.line, title: info.title, hook: info.hook, url: info.url }))}`;
  const count = (channel: Channel) => track(info.slug, "share", { channel });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tagged(info.url, "link"));
      count("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const instagram = async () => {
    setCard("making");
    try {
      const res = await fetch(`/stories/${info.slug}/card`);
      const blob = await res.blob();
      const file = new File([blob], `${info.slug}.jpg`, { type: "image/jpeg" });
      count("instagram");
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        // A phone: the share sheet, where Instagram (Story or post) is one tap.
        await navigator.share({ files: [file], title: info.title, url: tagged(info.url, "ig") }).catch(() => {});
        setCard("idle");
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setCard("saved");
        setTimeout(() => setCard("idle"), 4000);
      }
    } catch {
      setCard("idle");
    }
  };

  if (compact) {
    return (
      <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => count("whatsapp")} aria-label="Share on WhatsApp" title="Share on WhatsApp" className="flex size-10 items-center justify-center rounded-full border border-line text-ink hover:bg-soft">
        <WhatsAppGlyph />
      </a>
    );
  }

  const pill = "flex h-11 items-center gap-2 rounded-full px-5 text-[15px] font-medium";
  return (
    <div className="flex flex-col items-center gap-2 font-sans">
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => count("whatsapp")} className={`${pill} bg-[#1f7a4d] font-semibold text-white hover:brightness-105`}>
          <WhatsAppGlyph />
          WhatsApp
        </a>
        <button type="button" onClick={() => void instagram()} disabled={card === "making"} className={`${pill} border border-line text-ink hover:bg-soft disabled:opacity-60`}>
          <InstagramGlyph />
          {card === "making" ? "Making the card…" : "Instagram"}
        </button>
        <button type="button" onClick={() => void copy()} aria-live="polite" className={`${pill} border border-line text-ink hover:bg-soft`}>
          {copied ? "Link copied" : "Copy link"}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() =>
              void navigator
                .share({ title: info.title, text: info.line || undefined, url: info.url })
                .then(() => count("native"))
                .catch(() => {})
            }
            className={`${pill} border border-line text-ink hover:bg-soft`}
          >
            More…
          </button>
        )}
      </div>
      {card === "saved" && <p className="text-[13px] text-mute">Card saved. Post it to your Instagram Story from your phone.</p>}
    </div>
  );
}
