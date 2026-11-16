/**
 * JSON-LD structured-data builders.
 *
 * Rules enforced here (mirrors Google's structured-data guidelines):
 * - Only factual, registry-derived data. No invented ratings, reviews,
 *   authorship, dates, offers or claims.
 * - Every page validates as standalone JSON (safe `JSON.stringify` output).
 */

import type { DevTool, ToolFaq } from "@/data/devToolTypes";
import type { PdfTool } from "@/data/pdfToolTypes";
import { SITE_NAME, SITE_URL, absoluteUrl } from "./site";

type Json = Record<string, unknown>;

/** Brand organization (no logo: none exists as a routable image asset yet). */
export function organizationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "Free, privacy-first online tools — PDF utilities, developer formatters, converters and everyday micro-tasks, executed in the browser.",
  };
}

/** Sitewide WebSite node. No SearchAction: search is client-side filtering
 *  of an on-page list, not a crawlable query endpoint. */
export function websiteLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "en",
  };
}

/** BreadcrumbList from ordered {name, url} pairs (url omitted for the last item). */
export function breadcrumbLd(items: { name: string; url?: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.url ? { item: absoluteUrl(item.url) } : {}),
    })),
  };
}

/** FAQPage built from the tool registry FAQs (matches the rendered Q&A markup). */
export function faqLd(faqs: ToolFaq[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

/** WebApplication for an online tool. Free of charge: a $0 offer reflects the
 *  real pricing (free, no accounts) without implying ratings or reviews. */
function webApplicationLd(
  name: string,
  slug: string,
  description: string,
  applicationCategory: string
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    url: absoluteUrl(`/tools/${slug}`),
    description,
    applicationCategory,
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires a modern web browser with JavaScript enabled.",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function devToolSchemas(tool: DevTool): Json[] {
  const name = tool.alias ?? tool.title;
  return [
    breadcrumbLd([{ name: "Home", url: "/" }, ...toolCategoryTrail(tool), { name }]),
    faqLd(tool.faqs),
    webApplicationLd(name, tool.slug, tool.desc, applicationCategoryFor(tool.category)),
  ];
}

/** Middle breadcrumb for a registry tool, matching the visible breadcrumb bar. */
export function toolCategoryTrail(tool: Pick<DevTool, "category">): { name: string; url?: string }[] {
  switch (tool.category) {
    case "image":
      return [{ name: "Image & Media Tools", url: "/image-tools" }];
    case "text":
      return [{ name: "Text & Writing Tools", url: "/text-tools" }];
    case "utility":
      // QR/password tools live on the homepage Popular Tools grid.
      return [{ name: "Popular Tools", url: "/#popular" }];
    default:
      return [{ name: "Developer Tools", url: "/developer-tools" }];
  }
}

function applicationCategoryFor(category: DevTool["category"]): string {
  if (category === "image") return "MultimediaApplication";
  if (category === "utility") return "UtilitiesApplication";
  return "DeveloperApplication";
}

export function pdfToolSchemas(tool: PdfTool): Json[] {
  const name = tool.alias ?? tool.title;
  return [
    breadcrumbLd([
      { name: "Home", url: "/" },
      { name: "PDF & Document Tools", url: "/tools/pdf" },
      { name },
    ]),
    faqLd(tool.faqs),
    webApplicationLd(name, tool.slug, tool.desc, "UtilitiesApplication"),
  ];
}

/** ItemList of tools rendered by a category hub page. */
export function toolItemListLd(
  listName: string,
  items: { title: string; slug: string }[]
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    itemListElement: items.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/tools/${tool.slug}`),
      name: tool.title,
    })),
  };
}

/**
 * Renders one <script type="application/ld+json"> per schema object.
 *
 * Defense-in-depth: JSON.stringify output is escaped (`<` → `\u003c`, plus
 * line separators) so structured data can never break out of the script
 * context, even if registry data ever contains user-supplied text.
 */
function jsonForScript(node: Json): string {
  return JSON.stringify(node)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLdScript({ node }: { node: Json }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonForScript(node) }}
    />
  );
}
