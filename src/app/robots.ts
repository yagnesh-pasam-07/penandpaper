import type { MetadataRoute } from "next";
import { siteUrl } from "@/modules/stories/site";

/** Public pages may be indexed; private papers, Studio and the API may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/drop", "/studio", "/api/", "/settings", "/tonight", "/rewind", "/capture", "/share"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
