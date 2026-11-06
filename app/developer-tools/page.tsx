import type { Metadata } from "next";
import { devTools } from "@/data/devTools";
import DeveloperToolsHubClient from "@/features/developer-tools/DeveloperToolsHubClient";
import { toolItemListLd, breadcrumbLd, JsonLdScript } from "@/lib/jsonld";
import { OG_IMAGE } from "@/lib/site";
import { toDevToolHubCard } from "@/data/devToolTypes";

/* The hub receives slim card projections — the full registry (FAQs,
 * capabilities, metrics) stays server-side so the client payload stays small. */
const hubCards = devTools.map(toDevToolHubCard);

export const metadata: Metadata = {
  title: {
    absolute: `Developer Tools Hub — ${devTools.length} Free Client-Side Utilities | Baby Got Tools`,
  },
  description:
    "The Baby Got Tools developer console: JSON, SQL, JWT, UUID, cron, diff and more. Every tool runs fully client-side — zero uploads, zero telemetry.",
  alternates: { canonical: "/developer-tools" },
  openGraph: {
    title: "Developer Tools Hub — Baby Got Tools",
    description: `${devTools.length} utilities for formatters, encoders, generators, parsers and security auditing — all running inside your browser.`,
    type: "website",
    url: "/developer-tools",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image" },
};

export default function DeveloperToolsHubPage() {
  return (
    <>
      <JsonLdScript
        node={breadcrumbLd([
          { name: "Home", url: "/" },
          { name: "Developer Tools" },
        ])}
      />
      <JsonLdScript
        node={toolItemListLd(
          "Developer Tools Hub",
          devTools.map((t) => ({ title: t.alias ?? t.title, slug: t.slug }))
        )}
      />
      <DeveloperToolsHubClient tools={hubCards} />
    </>
  );
}
