import type { Metadata } from "next";
import { PDF_TOOLS } from "@/data/pdfTools";
import PdfHubClient from "@/features/pdf-tools/PdfHubClient";
import { toolItemListLd, breadcrumbLd, JsonLdScript } from "@/lib/jsonld";
import { OG_IMAGE } from "@/lib/site";
import { toPdfToolHubCard } from "@/data/pdfToolTypes";

/* The hub receives slim card projections — the full registry (FAQs,
 * capabilities, engine specs) stays server-side so the client payload stays small. */
const hubCards = PDF_TOOLS.map(toPdfToolHubCard);

export const metadata: Metadata = {
  title: {
    absolute: `PDF & Document Tools — ${PDF_TOOLS.length} Free In-Browser Utilities | Baby Got Tools`,
  },
  description:
    "The document workshop: merge, split, compress, OCR, convert and repair PDFs, or export to Word, Excel and JPG. All processed locally, zero uploads.",
  alternates: { canonical: "/tools/pdf" },
  openGraph: {
    title: "PDF & Document Tools — Baby Got Tools",
    description: `${PDF_TOOLS.length} client-side PDF utilities — converters to and from PDF, page operations, optimization and security — running entirely inside your browser sandbox.`,
    type: "website",
    url: "/tools/pdf",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image" },
};

export default function PdfToolsHubPage() {
  return (
    <>
      <JsonLdScript
        node={breadcrumbLd([
          { name: "Home", url: "/" },
          { name: "PDF & Document Tools" },
        ])}
      />
      <JsonLdScript
        node={toolItemListLd(
          "PDF & Document Tools",
          PDF_TOOLS.map((t) => ({ title: t.alias ?? t.title, slug: t.slug }))
        )}
      />
      <PdfHubClient tools={hubCards} />
    </>
  );
}
