import { ImageResponse } from "next/og";

/** The install icons: "192" and "512" fill the square like the home-screen icon; "maskable" keeps the pen inside the safe zone that Android crops to a circle or squircle. */
const KINDS = { "192": { px: 192, mark: 0.73 }, "512": { px: 512, mark: 0.73 }, maskable: { px: 512, mark: 0.52 } } as const;

export function generateStaticParams() {
  return Object.keys(KINDS).map((kind) => ({ kind }));
}

export async function GET(_request: Request, ctx: RouteContext<"/pwa/icon/[kind]">) {
  const { kind } = await ctx.params;
  const spec = KINDS[kind as keyof typeof KINDS];
  if (!spec) return new Response("Not found", { status: 404 });
  const mark = Math.round(spec.px * spec.mark);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F3" }}>
        <svg width={mark} height={mark} viewBox="0 0 28 28" fill="none" stroke="#C8382F" strokeLinecap="round" strokeLinejoin="round">
          <g transform="rotate(38 14.5 13)">
            <path d="M14.3 25.2C12.9 22.3 9.7 17.9 9.4 13.4L9.8 6.6C11.3 5.7 17.3 5.6 18.9 6.5L19.3 13.1C19.1 17.7 15.8 22.2 14.3 25.2Z" strokeWidth="1.9" />
            <path d="M14.3 24.6L14.25 16.7" strokeWidth="1.5" />
            <circle cx="14.25" cy="14.9" r="1.35" strokeWidth="1.5" />
            <path d="M9.7 9.7C12.4 8.9 16.2 8.9 19 9.6" strokeWidth="1.5" />
          </g>
          <path d="M3.2 25.4C4.6 24.3 5.6 25.9 7 25.1C8 24.5 8.6 24.9 9.4 25.3" strokeWidth="1.5" />
        </svg>
      </div>
    ),
    { width: spec.px, height: spec.px },
  );
}
