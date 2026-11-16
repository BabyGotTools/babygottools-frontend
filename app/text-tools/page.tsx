import type { Metadata } from "next";
import { textTools } from "@/data/textTools";
import DeveloperToolsHubClient from "@/features/developer-tools/DeveloperToolsHubClient";
import { toolItemListLd, breadcrumbLd, JsonLdScript } from "@/lib/jsonld";
import { OG_IMAGE } from "@/lib/site";
import { toDevToolHubCard } from "@/data/devToolTypes";

/* The hub receives slim card projections — the full registry (FAQs,
 * capabilities, metrics) stays server-side so the client payload stays small. */
const hubCards = textTools.map(toDevToolHubCard);

export const metadata: Metadata = {
  title: {
    absolute: `Text & Writing Tools — ${textTools.length} Free Live Utilities | Baby Got Tools`,
  },
  description:
    "Count words, convert letter case, diff two drafts, de-duplicate lists, generate lorem ipsum, preview Markdown and find hidden Unicode characters — instantly, in your browser.",
  alternates: { canonical: "/text-tools" },
  openGraph: {
    title: "Text & Writing Tools — Baby Got Tools",
    description: `${textTools.length} live text utilities — counters, case converters, diffs, dedupe, lorem ipsum, Markdown preview and invisible-character scanning — all running inside your browser.`,
    type: "website",
    url: "/text-tools",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image" },
};

export default function TextToolsHubPage() {
  return (
    <>
      <JsonLdScript
        node={breadcrumbLd([
          { name: "Home", url: "/" },
          { name: "Text & Writing Tools" },
        ])}
      />
      <JsonLdScript
        node={toolItemListLd(
          "Text & Writing Tools",
          textTools.map((t) => ({ title: t.alias ?? t.title, slug: t.slug }))
        )}
      />
      <DeveloperToolsHubClient
        tools={hubCards}
        breadcrumbLabel="Text & Writing Tools"
        title="Text & Writing Tools"
        intro="Editorial helpers that react as you type: live word and character counters, a twelve-mode case converter, a real Myers text diff, list de-duplication, lorem ipsum generation, a sanitized Markdown live preview and an invisible-Unicode detector. Nothing you paste is ever sent to a server."
        searchPlaceholder={`Search ${textTools.length} text tools — try “case”, “diff”, “counter”…`}
        searchAriaLabel="Search text tools"
        stats={[
          { label: "ACTIVE UTILITIES", value: String(textTools.length), icon: "grid_view" },
          { label: "NETWORK LOG", value: "0 requests", icon: "cloud_off" },
          { label: "PROCESSING", value: "Live", icon: "bolt" },
        ]}
        categories={[]}
        categoryLabel="Text & Writing Tools"
        offlineNote={{
          title: "Your drafts stay in this tab",
          body: "Every tool on this hub transforms text with pure in-browser string processing — no editors, no uploads, no server round-trips. Close the tab and everything is gone.",
        }}
      />
    </>
  );
}
