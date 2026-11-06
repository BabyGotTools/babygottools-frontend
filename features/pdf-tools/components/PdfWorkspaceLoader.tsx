"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ComponentType } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";

/**
 * Maps a PDF tool slug to its lazily-bundled workspace. Every workspace pulls
 * its own WASM/WASM-adjacent engine (pdf-lib, pdfjs, tesseract, reamkit, …),
 * so each route only ships the code it actually runs.
 */
const LOADERS: Record<string, ComponentType<{ tool: PdfTool }>> = {
  "image-to-pdf": dynamic(() => import("../workspaces/ImageToPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "word-to-pdf": dynamic(() => import("../workspaces/WordToPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "excel-to-pdf": dynamic(() => import("../workspaces/ExcelToPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "powerpoint-to-pdf": dynamic(() => import("../workspaces/PowerPointToPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "html-to-pdf": dynamic(() => import("../workspaces/HtmlToPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "text-to-pdf": dynamic(() => import("../workspaces/TextToPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "markdown-to-pdf": dynamic(() => import("../workspaces/MarkdownToPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "merge-pdf": dynamic(() => import("../workspaces/MergePdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "insert-pages": dynamic(() => import("../workspaces/InsertPagesWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "split-pdf": dynamic(() => import("../workspaces/SplitPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "extract-pages": dynamic(() => import("../workspaces/ExtractPagesWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "organize-pdf": dynamic(() => import("../workspaces/OrganizePdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "delete-pages": dynamic(() => import("../workspaces/DeletePagesWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "rotate-pages": dynamic(() => import("../workspaces/RotatePagesWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "n-up-pdf": dynamic(() => import("../workspaces/NUpPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "add-blank-page": dynamic(() => import("../workspaces/AddBlankPageWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "compress-pdf": dynamic(() => import("../workspaces/CompressPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "linearize-pdf": dynamic(() => import("../workspaces/LinearizePdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "ocr-pdf": dynamic(() => import("../workspaces/OcrPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "repair-pdf": dynamic(() => import("../workspaces/RepairPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "flatten-pdf": dynamic(() => import("../workspaces/FlattenPdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "sanitize-pdf": dynamic(() => import("../workspaces/SanitizePdfWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "pdf-to-word": dynamic(() => import("../workspaces/PdfToWordWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "pdf-to-excel": dynamic(() => import("../workspaces/PdfToExcelWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "pdf-to-jpg": dynamic(() => import("../workspaces/PdfToJpgWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "pdf-to-powerpoint": dynamic(() => import("../workspaces/PdfToPowerPointWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "pdf-to-markdown": dynamic(() => import("../workspaces/PdfToMarkdownWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "pdf-to-text": dynamic(() => import("../workspaces/PdfToTextWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
  "pdf-to-html": dynamic(() => import("../workspaces/PdfToHtmlWorkspace"), {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  }),
};

/** Placeholder matching the workspace grid footprint while the chunk loads. */
function WorkspaceSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md animate-pulse" aria-busy="true">
      <div className="lg:col-span-7 flex flex-col gap-space-sm">
        <div className="h-40 rounded-xl bg-surface-container-low" />
        <div className="h-64 rounded-xl bg-surface-container-low" />
      </div>
      <div className="lg:col-span-5 flex flex-col gap-space-sm">
        <div className="h-72 rounded-xl bg-surface-container-low" />
      </div>
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}

export default function PdfWorkspaceLoader({ slug, tool }: { slug: string; tool: PdfTool }) {
  const Workspace = useMemo(() => LOADERS[slug], [slug]);
  if (!Workspace) return null;
  return <Workspace tool={tool} />;
}
