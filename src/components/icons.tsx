type IconProps = { size?: number; className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Fountain-pen nib with a little ink at the tip, drawn slightly uneven on purpose. */
export function PenIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className={className} {...stroke}>
      <g transform="rotate(38 14.5 13)">
        <path
          d="M14.3 25.2C12.9 22.3 9.7 17.9 9.4 13.4L9.8 6.6C11.3 5.7 17.3 5.6 18.9 6.5L19.3 13.1C19.1 17.7 15.8 22.2 14.3 25.2Z"
          strokeWidth={1.9}
        />
        <path d="M14.3 24.6L14.25 16.7" strokeWidth={1.5} />
        <circle cx="14.25" cy="14.9" r="1.35" strokeWidth={1.5} />
        <path d="M9.7 9.7C12.4 8.9 16.2 8.9 19 9.6" strokeWidth={1.5} />
      </g>
      <path d="M3.2 25.4C4.6 24.3 5.6 25.9 7 25.1C8 24.5 8.6 24.9 9.4 25.3" strokeWidth={1.5} />
    </svg>
  );
}

export function BackIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" strokeWidth={1.8} {...stroke}>
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

export function ChevronIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" strokeWidth={1.8} {...stroke}>
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

export function ArrowIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" strokeWidth={1.8} {...stroke}>
      <path d="M2 8h11M9 4l4 4-4 4" />
    </svg>
  );
}

export function CheckIcon({ size = 12, strokeWidth = 2.2 }: IconProps & { strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" strokeWidth={strokeWidth} {...stroke}>
      <path d="M2.5 6.2l2.3 2.3 4.7-5" />
    </svg>
  );
}

export function PlusIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" strokeWidth={2} {...stroke}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" strokeWidth={1.8} {...stroke}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

export function CaretIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" strokeWidth={1.8} {...stroke}>
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

export function CloseIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" strokeWidth={1.8} {...stroke}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function SunIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" strokeWidth={1.6} {...stroke}>
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" strokeWidth={1.6} {...stroke}>
      <path d="M16.5 12.2A7 7 0 1 1 7.8 3.5a5.6 5.6 0 0 0 8.7 8.7z" />
    </svg>
  );
}

/** Hand-drawn circle with a tick, used on every "done" moment. */
export function BigCheck({ size = 130 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" fill="none" aria-hidden="true" className="text-green">
      <circle cx="70" cy="70" r="62" className="fill-green-soft" />
      <path d="M14 74c6-34 40-62 78-52 30 8 46 42 34 72-12 30-56 42-86 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M44 72l18 18 36-40" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NotebookIcon() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true" className="text-mute">
      <rect x="22" y="10" width="76" height="76" rx="6" stroke="currentColor" strokeWidth="1.8" transform="rotate(-4 60 48)" />
      <path d="M34 34h44M34 48h36M34 62h28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" transform="rotate(-4 60 48)" />
      <path d="M86 70l18-18 6 6-18 18-8 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function PaperPlaneIcon() {
  return (
    <svg width="132" height="96" viewBox="0 0 132 96" fill="none" aria-hidden="true" className="text-red-text">
      <path d="M10 52L118 10 92 84 62 62z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M118 10L62 62l-6 24 6-24" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M6 78c10-4 22-4 30 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 6" />
    </svg>
  );
}


/** A wooden pencil: ideas, kept loose. */
export function PencilIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.7} {...stroke}>
      <path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" />
      <path d="M13.8 6.8l3.4 3.4" />
      <path d="M4 20l4.6-1.2" />
    </svg>
  );
}

/** A small calendar page: when it's for. */
export function WhenIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.8} {...stroke}>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" />
    </svg>
  );
}
