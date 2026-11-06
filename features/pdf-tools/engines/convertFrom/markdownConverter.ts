import type { ConversionProgress, ConversionResult } from "@pdf2md/core";
import type { MarkdownFromPdfOptions } from "./convertFromTypes";
import {
  SCANNED_PDF_MESSAGE,
} from "./convertFromUtils";
import { detectPdfTextLayer, type TextLayerReport } from "./pdfToImageUtils";

export interface MarkdownConversionDeps {
  detectTextLayer?: (bytes: Uint8Array) => Promise<TextLayerReport>;
  loadCore?: () => Promise<typeof import("@pdf2md/core")>;
}

export interface MarkdownConversionOutput {
  markdown: string;
  metadata: Record<string, unknown>;
  warnings: string[];
}

function yamlValue(value: unknown): string {
  if (value === undefined || value === null) return '""';
  return JSON.stringify(String(value));
}

function frontMatter(
  metadata: Record<string, unknown>,
  sourceName: string,
  pageCount?: number
): string {
  const lines = ["---"];
  if (metadata.title) lines.push(`title: ${yamlValue(metadata.title)}`);
  if (metadata.author) lines.push(`author: ${yamlValue(metadata.author)}`);
  if (metadata.subject) lines.push(`subject: ${yamlValue(metadata.subject)}`);
  if (Array.isArray(metadata.keywords) && metadata.keywords.length > 0) {
    lines.push("keywords:");
    for (const keyword of metadata.keywords) {
      lines.push(`  - ${yamlValue(keyword)}`);
    }
  }
  lines.push(`source: ${yamlValue(sourceName)}`);
  if (pageCount) lines.push(`pages: ${pageCount}`);
  lines.push("generator: PDF Intelligence Platform");
  lines.push("---", "");
  return lines.join("\n");
}

function chunkedMarkdown(
  result: ConversionResult,
  chunkBy: MarkdownFromPdfOptions["chunkBy"]
): string {
  if (!result.chunks || result.chunks.length === 0) return result.markdown;

  return result.chunks
    .map((chunk, index) => {
      const pages =
        chunk.pageStart === chunk.pageEnd
          ? `page ${chunk.pageStart}`
          : `pages ${chunk.pageStart}–${chunk.pageEnd}`;
      const path =
        chunk.sectionPath && chunk.sectionPath.length > 0
          ? ` · ${chunk.sectionPath.join(" › ")}`
          : "";
      return `<!-- chunk ${index + 1} · ${pages} · ${chunkBy}${path} -->\n\n${chunk.markdown.trim()}`;
    })
    .join("\n\n---\n\n");
}

function progressPercent(progress: ConversionProgress): number {
  if (progress.stage === "loading") return 8;
  if (progress.stage === "parsing") {
    if (progress.totalPages <= 0) return 20;
    return 10 + (progress.currentPage / progress.totalPages) * 70;
  }
  if (progress.stage === "structuring") return 88;
  return 94;
}

/**
 * Converts a text-based PDF to Markdown with @pdf2md/core.
 *
 * @pdf2md/core resolves its pdf.js worker through an npm override (pdf.js
 * v6.2.108 — the patched release). The worker source is pointed at the
 * matching local copy (`/pdf.worker.v6.min.mjs`) so no CDN is contacted.
 */
export async function convertPdfToMarkdown(
  bytes: Uint8Array,
  options: MarkdownFromPdfOptions,
  sourceName: string,
  onProgress?: (progress: { phase: string; percent: number; message?: string }) => void,
  deps: MarkdownConversionDeps = {}
): Promise<MarkdownConversionOutput> {
  const detect = deps.detectTextLayer ?? detectPdfTextLayer;
  onProgress?.({
    phase: "preparing",
    percent: 4,
    message: "Checking the PDF text layer",
  });

  const report = await detect(bytes);
  if (!report.hasText) throw new Error(SCANNED_PDF_MESSAGE);

  const loadCore =
    deps.loadCore ?? (() => import("@pdf2md/core"));
  onProgress?.({
    phase: "converting",
    percent: 8,
    message: "Preparing Markdown converter",
  });

  const core = await loadCore();
  try {
    const pdfjs = await core.getPdfjs();
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.v6.min.mjs";
  } catch {
    // getDocument will still fall back to pdf.js' fake worker if this fails.
  }

  // The text-layer check above uses pdf.js v4, whose fake-worker fallback
  // installs its message handler on `globalThis.pdfjsWorker`. @pdf2md/core's
  // pdf.js (v6, overridden) checks that same global before loading its own
  // worker, and a v4 handler is rejected with "API version does not match
  // Worker version". Clear it so v6 loads the matching
  // `/pdf.worker.v6.min.mjs` instead.
  delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;

  const result = await core.convert(bytes.slice().buffer, {
    includeMetadata: options.includeMetadata,
    outputFormat: options.chunkBy === "none" ? "markdown" : "json",
    ...(options.chunkBy !== "none"
      ? {
          chunkBy: options.chunkBy,
          maxTokensPerChunk: options.maxTokensPerChunk,
        }
      : {}),
    yamlFrontMatter: false,
    onProgress: (progress) => {
      onProgress?.({
        phase: "converting",
        percent: progressPercent(progress),
        message:
          progress.stage === "parsing" && progress.totalPages > 0
            ? `Analyzing page ${progress.currentPage}/${progress.totalPages}`
            : "Building structured Markdown",
      });
    },
  });

  const errorMessage = result.messages?.find(
    (message) => message.severity === "error"
  )?.message;
  if (result.status === "failed" || (!result.markdown && errorMessage)) {
    throw new Error(errorMessage || "Markdown conversion failed");
  }

  let markdown = result.markdown.trim();
  if (!markdown) {
    throw new Error(SCANNED_PDF_MESSAGE);
  }

  if (options.includeMetadata) {
    const metadata: Record<string, unknown> = {
      ...(result.metadata ?? {}),
    };
    markdown = `${frontMatter(metadata, sourceName, result.stats?.pageCount)}\n${markdown}`;
  }

  if (options.chunkBy !== "none") {
    markdown = chunkedMarkdown(result, options.chunkBy);
    if (options.includeMetadata) {
      markdown = `${frontMatter(
        { ...(result.metadata ?? {}) },
        sourceName,
        result.stats?.pageCount
      )}\n${markdown}`;
    }
  }

  const warnings = (result.messages ?? [])
    .filter((message) => message.severity === "warning")
    .map((message) => message.message);

  return {
    markdown: markdown.endsWith("\n") ? markdown : `${markdown}\n`,
    metadata: {
      ...(result.metadata ?? {}),
      pageCount: result.stats?.pageCount,
      wordCount: result.stats?.wordCount,
      chunkCount: result.chunks?.length,
    },
    warnings,
  };
}
