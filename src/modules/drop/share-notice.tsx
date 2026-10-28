"use client";

import { useEffect, useState, type ReactNode } from "react";

/** A short note across the top after a share, gone by itself after a few seconds. */
export function ShareNotice({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShown(false), 7000);
    return () => clearTimeout(t);
  }, []);
  if (!shown) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-3 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl border border-line bg-sheet px-4 py-2.5 text-sm shadow-[0_18px_40px_-20px_var(--shadow)]">
      {children}
    </div>
  );
}
