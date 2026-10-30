/** Small line drawings for where Pen & Paper runs. No server-only imports, so client components can use them too. */

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Three small line drawings in the ink colour, each with one red mark. */
export function Glyph({ kind }: { kind: "web" | "mac" | "chrome" }) {
  return (
    <svg aria-hidden="true" width="64" height="44" viewBox="0 0 64 44" className="text-ink/75">
      {kind === "web" && (
        <>
          <rect x="6" y="6" width="52" height="32" rx="5" {...stroke} />
          <path d="M6 14h52" {...stroke} />
          <path d="M18 27c4-6 8-6 12 0s8 6 14-2" className="text-red-text" {...stroke} />
        </>
      )}
      {kind === "mac" && (
        <>
          <rect x="4" y="5" width="56" height="9" rx="2" {...stroke} />
          <path d="M10 9.5h6M22 9.5h6" {...stroke} />
          <path d="M47 7.8l3 3.4m0-3.4l-3 3.4" className="text-red-text" {...stroke} />
          <rect x="14" y="22" width="36" height="16" rx="4" {...stroke} />
        </>
      )}
      {kind === "chrome" && (
        <>
          <path d="M8 36V12a4 4 0 0 1 4-4h16v6a4 4 0 1 0 8 0V8h16a4 4 0 0 1 4 4v24z" {...stroke} />
          <path d="M26 28l4 4 8-9" className="text-red-text" {...stroke} />
        </>
      )}
    </svg>
  );
}
