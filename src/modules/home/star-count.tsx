"use client";

import { useEffect, useState } from "react";

const compact = (n: number) => (n < 1000 ? String(n) : `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`);

/**
 * The star count in the GitHub button: the number the page was built with,
 * then the live one, asked once from our own /api/github/stars after the page
 * loads (so a cached page still shows a new star within minutes).
 */
export function StarCount({ initial }: { initial: number | null }) {
  const [stars, setStars] = useState(initial);
  useEffect(() => {
    let live = true;
    fetch("/api/github/stars")
      .then((r) => (r.ok ? (r.json() as Promise<{ stars: number }>) : null))
      .then((d) => {
        if (live && d && typeof d.stars === "number") setStars(d.stars);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (stars === null) return null;
  return <span className="tabular-nums">{compact(stars)}</span>;
}
