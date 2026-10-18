import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the fountain-pen nib on paper. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F3" }}>
        <svg width="132" height="132" viewBox="0 0 28 28" fill="none" stroke="#C8382F" strokeLinecap="round" strokeLinejoin="round">
          <g transform="rotate(38 14.5 13)">
            <path
              d="M14.3 25.2C12.9 22.3 9.7 17.9 9.4 13.4L9.8 6.6C11.3 5.7 17.3 5.6 18.9 6.5L19.3 13.1C19.1 17.7 15.8 22.2 14.3 25.2Z"
              strokeWidth="1.9"
            />
            <path d="M14.3 24.6L14.25 16.7" strokeWidth="1.5" />
            <circle cx="14.25" cy="14.9" r="1.35" strokeWidth="1.5" />
            <path d="M9.7 9.7C12.4 8.9 16.2 8.9 19 9.6" strokeWidth="1.5" />
          </g>
          <path d="M3.2 25.4C4.6 24.3 5.6 25.9 7 25.1C8 24.5 8.6 24.9 9.4 25.3" strokeWidth="1.5" />
        </svg>
      </div>
    ),
    size,
  );
}
