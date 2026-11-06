/**
 * Site-wide SEO configuration — single source of truth for canonical URLs.
 *
 * The production domain can be overridden with NEXT_PUBLIC_SITE_URL (maximum
 * once, no trailing slash). The default keeps the domain already documented
 * in the sitemap/robots: https://babygottools.com
 *
 * If the real deployment domain differs, set NEXT_PUBLIC_SITE_URL in the
 * frontend hosting provider's environment (e.g. Vercel project settings).
 */
export const SITE_NAME = "Baby Got Tools";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://babygottools.com"
).replace(/\/+$/, "");

export const TAGLINE = "Every Tool You Need. All in One Place.";

/** Absolute URL for a path like "/tools/json-formatter". */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Shared Open Graph image (rendered by app/opengraph-image.tsx).
 *  Pages that define their own `openGraph` object must include it explicitly,
 *  because a segment-level openGraph overrides the file-convention default. */
export const OG_IMAGE = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: "Baby Got Tools — free, browser-based online tools",
};
