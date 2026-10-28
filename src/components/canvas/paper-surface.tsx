import type { ReactNode } from "react";

/** The dotted sheet thoughts land on. */
export function PaperSurface({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <section aria-label={label} className={`canvas-surface rounded-[22px] p-4 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}
