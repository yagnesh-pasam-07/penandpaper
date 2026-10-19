import { ImageResponse } from "next/og";

export const alt = "Pen & Paper: a paper with three notes, one struck out in red";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview: a sheet of paper with three notes, one crossed out with a red pen. */
export default function OpengraphImage() {
  const note = (text: string, bg: string, rotate: number, struck = false) => (
    <div style={{ display: "flex", position: "relative", padding: "26px 40px", borderRadius: 26, background: bg, transform: `rotate(${rotate}deg)`, fontSize: 46, color: struck ? "#8a857c" : "#1f2433" }}>
      {text}
      {struck ? <div style={{ position: "absolute", left: 30, right: 30, top: "55%", height: 5, borderRadius: 5, background: "#d4483d", transform: "rotate(-2deg)" }} /> : null}
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FAF8F3", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 34, color: "#C8382F", fontWeight: 700 }}>pen &amp; paper</div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#1f2433", marginTop: 18, letterSpacing: -2 }}>Empty your head onto paper.</div>
        <div style={{ display: "flex", gap: 34, marginTop: 70, alignItems: "center" }}>
          {note("call amma", "#FFF1BF", -3)}
          {note("book the dentist", "#D8E8FA", 2, true)}
          {note("weekend photo walk", "#D9F0DF", -1)}
        </div>
      </div>
    ),
    size,
  );
}
