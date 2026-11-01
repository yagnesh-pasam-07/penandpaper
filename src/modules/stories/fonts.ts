import { Newsreader, Noto_Serif_Telugu } from "next/font/google";

/**
 * The stories' type: Newsreader, a serif drawn for long reading on screens
 * (its optical sizes keep 20px body text open and 48px titles tight), and Noto
 * Serif Telugu for Telugu lines, fetched only when those letters appear.
 * Only story pages load them; the app keeps its own fonts.
 */
const newsreader = Newsreader({ variable: "--font-story", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], display: "swap" });
const telugu = Noto_Serif_Telugu({ variable: "--font-story-te", subsets: ["telugu"], weight: ["400", "600"], preload: false, display: "swap" });

export const storyFonts = `${newsreader.variable} ${telugu.variable}`;
