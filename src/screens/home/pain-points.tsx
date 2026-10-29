"use client";

import { useEffect, useRef } from "react";

/** The old habit, and what Pen & Paper does instead. */
const POINTS = [
  { old: "Texting yourself on WhatsApp.", fix: "Drop it on a paper." },
  { old: "Forgetting the podcast you meant to watch.", fix: "Paste the link. It becomes a card." },
  { old: "Another empty page in Notion or Keep.", fix: "No folders. No setup. Just space." },
];

/**
 * Three old habits, each struck with the product's red pen as it scrolls into
 * view (once), with the fix written under it. The page is complete without
 * scripts or motion: the strike only animates once this has armed itself, and
 * not at all for people who prefer reduced motion.
 */
export function PainPoints() {
  const root = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = root.current;
    if (!list || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    list.dataset.armed = "true";
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          seen.unobserve(entry.target);
        }
      },
      { threshold: 0.7 },
    );
    list.querySelectorAll("[data-pain]").forEach((el) => seen.observe(el));
    return () => {
      seen.disconnect();
      delete list.dataset.armed;
    };
  }, []);

  return (
    <section aria-labelledby="pain-title" className="mx-auto w-full max-w-[1040px] px-4 py-24 sm:px-8 sm:py-32">
      <h2 id="pain-title" className="sr-only">
        What it replaces
      </h2>
      <ul ref={root} className="flex flex-col gap-24 text-center sm:gap-36">
        {POINTS.map((p) => (
          <li key={p.old} data-pain className="flex flex-col items-center gap-3 sm:gap-5">
            <p className="font-hand text-[34px] leading-tight text-mute sm:text-[56px]">
              <span className="sr-only">Instead of: </span>
              <del className="pain-del">{p.old}</del>
            </p>
            <p className="pain-fix font-hand text-[40px] leading-tight font-bold sm:text-[68px]">
              <span className="sr-only">Do this: </span>
              {p.fix}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
