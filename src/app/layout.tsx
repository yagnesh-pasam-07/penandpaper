import type { Metadata, Viewport } from "next";
import { Caveat, Gurajada, Instrument_Sans, JetBrains_Mono, Kalam } from "next/font/google";
import { AppearanceBoot } from "@/components/appearance";
import { StoreBoot } from "@/components/hydration";
import "./globals.css";

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Handwriting for other scripts, so Hindi and Telugu thoughts stay handwritten.
// Only their own script subsets: the browser fetches them when those letters appear.
// Kalam: the notes' handwriting (most legible at 18–24px), Latin and Devanagari.
const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin", "devanagari"],
  weight: ["300", "400", "700"],
});

const gurajada = Gurajada({
  variable: "--font-gurajada",
  subsets: ["telugu"],
  weight: "400",
  preload: false,
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Pen & Paper",
  description: "Plan the day, on paper. Drop thoughts, give them a time, hand them to your team.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#151412" },
  ],
};

// Runs before first paint, so nothing flashes: the saved theme mode (light, dark or
// system, which follows the OS) and the saved canvas. Keys match src/lib/canvases.ts.
const themeScript = `(function(){try{var d=document.documentElement,m=localStorage.getItem("pp-theme"),c=localStorage.getItem("pp-canvas");if(m!=="light"&&m!=="dark")m="system";var t=m==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;d.setAttribute("data-theme",t);d.setAttribute("data-theme-mode",m);d.setAttribute("data-canvas",c==="ruled"||c==="grid"?c:"dotted")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-theme-mode="system"
      data-canvas="dotted"
      suppressHydrationWarning
      className={`${instrument.variable} ${caveat.variable} ${kalam.variable} ${gurajada.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Browser extensions often add attributes to <body>; don't treat that as a hydration error. */}
      <body className="min-h-full bg-bg text-ink" suppressHydrationWarning>
        <StoreBoot />
        <AppearanceBoot />
        {/* Grain for pencil strokes (used only on pencil ideas). */}
        <svg aria-hidden="true" width="0" height="0" className="absolute">
          <filter id="pencil-grain">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="3" result="g" />
            <feDisplacementMap in="SourceGraphic" in2="g" scale="0.9" />
          </filter>
        </svg>
        {children}
      </body>
    </html>
  );
}
