import type { Metadata } from "next";
import { imageTools } from "@/data/imageTools";
import DeveloperToolsHubClient from "@/features/developer-tools/DeveloperToolsHubClient";
import { toolItemListLd, breadcrumbLd, JsonLdScript } from "@/lib/jsonld";
import { OG_IMAGE } from "@/lib/site";
import { toDevToolHubCard } from "@/data/devToolTypes";

/* The hub receives slim card projections — the full registry (FAQs,
 * capabilities, metrics) stays server-side so the client payload stays small. */
const hubCards = imageTools.map(toDevToolHubCard);

export const metadata: Metadata = {
  title: {
    absolute: `Image & Media Tools — ${imageTools.length} Free In-Browser Utilities | Baby Got Tools`,
  },
  description:
    "Compress, resize, convert and clean images right in your browser: WebP/AVIF compression, favicon packages, base64 data URIs, palette extraction and EXIF stripping. Zero uploads.",
  alternates: { canonical: "/image-tools" },
  openGraph: {
    title: "Image & Media Tools — Baby Got Tools",
    description: `${imageTools.length} client-side image utilities — compression, resizing, favicon generation, palette extraction and metadata stripping — running entirely inside your browser.`,
    type: "website",
    url: "/image-tools",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image" },
};

export default function ImageToolsHubPage() {
  return (
    <>
      <JsonLdScript
        node={breadcrumbLd([
          { name: "Home", url: "/" },
          { name: "Image & Media Tools" },
        ])}
      />
      <JsonLdScript
        node={toolItemListLd(
          "Image & Media Tools",
          imageTools.map((t) => ({ title: t.alias ?? t.title, slug: t.slug }))
        )}
      />
      <DeveloperToolsHubClient
        tools={hubCards}
        breadcrumbLabel="Image & Media Tools"
        title="Image & Media Tools"
        intro="Everything you need to make images web-ready without uploading them anywhere: compress to WebP or AVIF with real WASM codecs, resize with aspect-ratio lock, generate complete favicon packages, inline images as base64, extract color palettes, and strip GPS metadata from photos — all executed locally by your browser."
        searchPlaceholder={`Search ${imageTools.length} image tools — try “webp”, “favicon”, “exif”…`}
        searchAriaLabel="Search image tools"
        stats={[
          { label: "ACTIVE UTILITIES", value: String(imageTools.length), icon: "grid_view" },
          { label: "NETWORK LOG", value: "0 requests", icon: "cloud_off" },
          { label: "CODECS", value: "WASM", icon: "memory" },
        ]}
        categories={[]}
        categoryLabel="Image & Media Tools"
        offlineNote={{
          title: "Your images never leave your device",
          body: "Every tool on this hub decodes, edits and re-encodes images through the browser's own Canvas and WebAssembly engines. Open the Network panel while working — you will see zero outbound requests.",
        }}
      />
    </>
  );
}
