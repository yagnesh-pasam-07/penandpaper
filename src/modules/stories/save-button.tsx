"use client";

import { useEffect, useState } from "react";
import { ReaderSignIn } from "./reader-sign-in";

function BookmarkGlyph({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M6 3.5h12a.5.5 0 0 1 .5.5v16.6a.4.4 0 0 1-.64.32L12 16.5l-5.86 4.42A.4.4 0 0 1 5.5 20.6V4a.5.5 0 0 1 .5-.5Z" />
    </svg>
  );
}

/** Save for later: a bookmark in the byline. Signing in is asked for the first time; the list lives at /stories/saved. */
export function SaveButton({ slug }: { slug: string }) {
  const [saved, setSaved] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch(`/api/stories/save?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { saved: boolean; signedIn: boolean }) => {
        if (!live) return;
        setSaved(d.saved);
        setSignedIn(d.signedIn);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug]);

  const toggle = async () => {
    if (!signedIn) return setAsking(true);
    const next = !saved;
    setSaved(next);
    const r = await fetch("/api/stories/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, saved: next }) }).catch(() => null);
    if (!r?.ok) setSaved(!next);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={saved}
        aria-label={saved ? "Saved for later (tap to remove)" : "Save for later"}
        title={saved ? "Saved" : "Save for later"}
        className={`flex size-10 items-center justify-center rounded-full border ${saved ? "border-ink bg-ink text-bg" : "border-line text-ink hover:bg-soft"}`}
      >
        <BookmarkGlyph filled={saved} />
      </button>
      {asking && <ReaderSignIn reason="save" onClose={() => setAsking(false)} />}
    </>
  );
}
