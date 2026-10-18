import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: a thought bubble on paper. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F3" }}>
        <svg width="150" height="150" viewBox="0 0 32 32">
          <path
            d="M5.5 13.6C5.5 8.4 10 5 16.2 5c6.3 0 10.8 3.4 10.8 8.4 0 5.3-4.6 8.7-10.6 8.7-1.7 0-3.2-.3-4.5-.8C8.2 20.5 5.5 17.6 5.5 13.6z"
            fill="#FFE48A"
            stroke="#1E1D1A"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="24.6" r="2.1" fill="#FFE48A" stroke="#1E1D1A" strokeWidth="1.3" />
          <circle cx="4.4" cy="28.6" r="1.2" fill="#1E1D1A" />
          <path d="M11.5 11.8h9.6M11.5 15.6h5.8" stroke="#C8382F" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
