import type { MetadataRoute } from "next";
import { SHARE_IMAGE_TYPES } from "@/modules/drop/share";

/**
 * Makes Pen & Paper installable and a place to share to: a link, some words or a
 * picture from another app lands on the paper touched last (see src/app/share).
 * Colours are the light-theme tokens in globals.css.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/drop",
    name: "Pen & Paper",
    short_name: "Pen & Paper",
    description: "Drop every thought onto paper.",
    start_url: "/drop",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#faf8f3",
    categories: ["productivity"],
    icons: [
      { src: "/pwa/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New thought", short_name: "Write", description: "Open the writer on your latest paper", url: "/drop?write=1", icons: [{ src: "/pwa/icon/192", sizes: "192x192", type: "image/png" }] },
      { name: "Library", description: "All your papers", url: "/drop/library", icons: [{ src: "/pwa/icon/192", sizes: "192x192", type: "image/png" }] },
    ],
    // Multipart so a picture can come along with the words.
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "image", accept: [...SHARE_IMAGE_TYPES] }],
      },
    },
  };
}
