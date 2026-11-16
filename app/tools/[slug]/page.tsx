import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolPageShell from "@/components/tools/ToolPageShell";
import ToolWorkspaceLoader from "@/components/tools/ToolWorkspaceLoader";
import { devTools } from "@/data/devTools";
import type { DevTool } from "@/data/devToolTypes";
import { textTools } from "@/data/textTools";
import { imageTools } from "@/data/imageTools";
import { utilityTools } from "@/data/utilityTools";
import { PDF_TOOLS, pdfToolBySlug } from "@/data/pdfTools";
import PdfToolShell from "@/features/pdf-tools/components/PdfToolShell";
import { SEO_BY_SLUG } from "@/data/seoTitles";
import { OG_IMAGE } from "@/lib/site";
import PdfWorkspaceLoader from "@/features/pdf-tools/components/PdfWorkspaceLoader";

export function generateStaticParams() {
  return [
    ...devTools.map((tool) => ({ slug: tool.slug })),
    ...textTools.map((tool) => ({ slug: tool.slug })),
    ...imageTools.map((tool) => ({ slug: tool.slug })),
    ...utilityTools.map((tool) => ({ slug: tool.slug })),
    ...PDF_TOOLS.map((tool) => ({ slug: tool.slug })),
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool =
    devTools.find((t) => t.slug === slug) ??
    textTools.find((t) => t.slug === slug) ??
    imageTools.find((t) => t.slug === slug) ??
    utilityTools.find((t) => t.slug === slug) ??
    pdfToolBySlug(slug);
  if (!tool) return { title: { absolute: "Tool not found — Baby Got Tools" } };
  const fallbackTitle = `${tool.alias ?? tool.title} — Free Online Tool`;
  const curated = SEO_BY_SLUG[tool.slug];
  const title = curated?.title ?? fallbackTitle;
  const description = curated?.description ?? tool.desc;
  return {
    title,
    description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/tools/${tool.slug}`,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // PDF & Document Tools route through their own shell (Stitch compress-pdf layout).
  const pdfTool = pdfToolBySlug(slug);
  if (pdfTool) {
    return (
      <PdfToolShell tool={pdfTool}>
        <PdfWorkspaceLoader slug={slug} tool={pdfTool} />
      </PdfToolShell>
    );
  }
  const tool =
    devTools.find((t) => t.slug === slug) ??
    textTools.find((t) => t.slug === slug) ??
    imageTools.find((t) => t.slug === slug) ??
    utilityTools.find((t) => t.slug === slug);
  if (!tool) notFound();
  return (
    <ToolPageShell tool={tool}>
      {/* Workspaces load lazily per slug — see ToolWorkspaceLoader. */}
      <ToolWorkspaceLoader slug={slug} tool={tool} />
    </ToolPageShell>
  );
}
