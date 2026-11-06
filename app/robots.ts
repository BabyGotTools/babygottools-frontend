import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Versioned platform API (opt-in usage counters, feedback, clipboard
        // relay, PDF analytics). Public pages must never accidentally block
        // CSS/JS/fonts, so only the API surface is disallowed here.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
