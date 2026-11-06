import { zipSync } from "fflate";
import type {
  ConvertFromOutcome,
  ConvertFromPreviewImage,
  ConvertFromProgress,
  ConvertFromWorkerRequest,
  ConvertFromWorkerResponse,
  HtmlFromPdfOptions,
  ImageFromPdfOptions,
  MarkdownFromPdfOptions,
  PowerPointFromPdfOptions,
  TextFromPdfOptions,
  WordFromPdfOptions,
} from "./convertFromTypes";
import {
  CONVERT_FROM_MIME,
  SCANNED_PDF_MESSAGE,
  baseNameOf,
  clampQuality,
  clampScale,
  imageExtension,
  imageMimeType,
  resolveSelectedPages,
} from "./convertFromUtils";
import { buildImageDocx, buildTextDocx } from "./docxBuilder";
import { extractTablesFromPdf } from "./excelExtractor";
import { convertPdfToHtml } from "./htmlConverter";
import { convertPdfToMarkdown } from "./markdownConverter";
import { extractTextFromDocument } from "./pdfTextExtractor";
import {
  loadPdfDocument,
  renderPdfPageToImage,
} from "./pdfToImageUtils";
import { buildPptx } from "./pptxBuilder";

type ProgressReporter = (progress: ConvertFromProgress) => void;

function wordOptions(options: Record<string, unknown>): WordFromPdfOptions {
  return {
    mode: options.mode === "text" ? "text" : "layout",
    pageRange: typeof options.pageRange === "string" ? options.pageRange : "all",
  };
}

function imageOptions(options: Record<string, unknown>): ImageFromPdfOptions {
  return {
    format: options.format === "png" ? "png" : "jpeg",
    scale: clampScale(Number(options.scale ?? 2)),
    quality: clampQuality(Number(options.quality ?? 0.9)),
    pageRange: typeof options.pageRange === "string" ? options.pageRange : "all",
  };
}

function powerpointOptions(
  options: Record<string, unknown>
): PowerPointFromPdfOptions {
  const slideSize =
    options.slideSize === "16:9" || options.slideSize === "4:3"
      ? options.slideSize
      : "match";
  const quality =
    options.quality === "low" || options.quality === "medium"
      ? options.quality
      : "high";
  return { slideSize, quality };
}

function markdownOptions(
  options: Record<string, unknown>
): MarkdownFromPdfOptions {
  const chunkBy =
    options.chunkBy === "heading" ||
    options.chunkBy === "page" ||
    options.chunkBy === "token"
      ? options.chunkBy
      : "none";
  return {
    includeMetadata: options.includeMetadata !== false,
    chunkBy,
    maxTokensPerChunk: Math.max(
      100,
      Math.min(4000, Number(options.maxTokensPerChunk ?? 800))
    ),
  };
}

function textOptions(options: Record<string, unknown>): TextFromPdfOptions {
  return {
    pageRange: typeof options.pageRange === "string" ? options.pageRange : "all",
    preserveLineBreaks: options.preserveLineBreaks !== false,
  };
}

function htmlOptions(options: Record<string, unknown>): HtmlFromPdfOptions {
  return {
    includePageNumbers: options.includePageNumbers === true,
    includeCitation: options.includeCitation !== false,
  };
}

function imageOutputName(
  base: string,
  singlePage: boolean,
  pageNumber: number,
  format: "jpeg" | "png"
): string {
  const ext = imageExtension(format);
  return singlePage
    ? `${base}-page-${pageNumber}.${ext}`
    : `${base}-images.zip`;
}

async function previewImage(
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageIndex: number,
  name: string
): Promise<ConvertFromPreviewImage> {
  const image = await renderPdfPageToImage(pdf, pageIndex, {
    scale: 0.35,
    format: "image/jpeg",
    quality: 0.72,
    includeDataUrl: true,
  });
  return {
    name,
    mimeType: "image/jpeg",
    dataUrl: image.dataUrl ?? "",
    width: image.width,
    height: image.height,
  };
}

export async function runConvertFromJob(
  request: Omit<ConvertFromWorkerRequest, "id">,
  onProgress?: ProgressReporter
): Promise<ConvertFromOutcome> {
  const bytes = new Uint8Array(request.bytes);
  const base = baseNameOf(request.fileName);
  const progress: ProgressReporter = (value) => {
    onProgress?.({
      ...value,
      percent: Math.min(99, Math.max(0, Math.round(value.percent))),
    });
  };

  progress({ phase: "reading", percent: 2, message: "Reading PDF" });

  switch (request.tool) {
    case "word": {
      const options = wordOptions(request.options);
      const pdf = await loadPdfDocument(bytes);
      try {
        const pageIndices = resolveSelectedPages(options.pageRange, pdf.numPages);
        if (pageIndices.length === 0) {
          throw new Error("No pages matched the selected page range");
        }

        if (options.mode === "text") {
          progress({
            phase: "extracting",
            percent: 12,
            message: "Extracting editable text",
          });
          const extracted = await extractTextFromDocument(pdf, pageIndices, {
            preserveLineBreaks: true,
            onPageProgress: (completed, total) =>
              progress({
                phase: "extracting",
                percent: 12 + (completed / total) * 70,
                message: `Extracting page ${completed}/${total}`,
              }),
          });
          if (extracted.totalChars === 0) throw new Error(SCANNED_PDF_MESSAGE);
          progress({
            phase: "finalizing",
            percent: 92,
            message: "Building Word document",
          });
          const docx = buildTextDocx(extracted, request.fileName);
          return {
            bytes: docx,
            mimeType: CONVERT_FROM_MIME.word,
            fileName: `${base}.docx`,
            metadata: { pageCount: extracted.pages.length, mode: "text" },
            warnings: extracted.emptyPages.length
              ? [
                  `${extracted.emptyPages.length} page(s) had no extractable text and were left blank.`,
                ]
              : [],
          };
        }

        progress({
          phase: "rendering",
          percent: 8,
          message: "Rendering PDF pages",
        });
        const images = [];
        for (let i = 0; i < pageIndices.length; i++) {
          images.push(
            await renderPdfPageToImage(pdf, pageIndices[i], {
              scale: 2,
              format: "image/jpeg",
              quality: 0.9,
            })
          );
          progress({
            phase: "rendering",
            percent: 8 + ((i + 1) / pageIndices.length) * 72,
            message: `Rendering page ${i + 1}/${pageIndices.length}`,
          });
        }

        progress({
          phase: "finalizing",
          percent: 88,
          message: "Assembling DOCX",
        });
        const docx = buildImageDocx(images, request.fileName);
        return {
          bytes: docx,
          mimeType: CONVERT_FROM_MIME.word,
          fileName: `${base}.docx`,
          metadata: { pageCount: images.length, mode: "layout" },
          warnings: [],
        };
      } finally {
        await pdf.destroy().catch(() => undefined);
      }
    }

    case "excel": {
      const result = await extractTablesFromPdf(bytes, progress);
      progress({
        phase: "finalizing",
        percent: 97,
        message: "Tables ready for preview",
      });
      return {
        mimeType: CONVERT_FROM_MIME.excel,
        fileName: `${base}-tables.xlsx`,
        preview: {
          kind: "tables",
          tables: result.tables,
          sourceName: request.fileName,
          ocrUsed: result.ocrUsed,
          pageCount: result.pageCount,
        },
        metadata: {
          tableCount: result.tables.length,
          pageCount: result.pageCount,
          ocrUsed: result.ocrUsed,
        },
        warnings: result.warnings,
      };
    }

    case "image": {
      const options = imageOptions(request.options);
      const pdf = await loadPdfDocument(bytes);
      try {
        const pageIndices = resolveSelectedPages(options.pageRange, pdf.numPages);
        if (pageIndices.length === 0) {
          throw new Error("No pages matched the selected page range");
        }

        progress({
          phase: "rendering",
          percent: 8,
          message: "Rendering PDF pages",
        });

        const rendered = [];
        for (let i = 0; i < pageIndices.length; i++) {
          rendered.push(
            await renderPdfPageToImage(pdf, pageIndices[i], {
              scale: options.scale,
              format: imageMimeType(options.format),
              quality: options.quality,
            })
          );
          progress({
            phase: "rendering",
            percent: 8 + ((i + 1) / pageIndices.length) * 74,
            message: `Rendering page ${i + 1}/${pageIndices.length}`,
          });
        }

        const previewCount = Math.min(8, pageIndices.length);
        const previews: ConvertFromPreviewImage[] = [];
        for (let i = 0; i < previewCount; i++) {
          previews.push(
            await previewImage(
              pdf,
              pageIndices[i],
              `${base}-page-${pageIndices[i] + 1}.${imageExtension(options.format)}`
            )
          );
        }

        progress({
          phase: "finalizing",
          percent: 88,
          message:
            rendered.length === 1 ? "Finalizing image" : "Packaging ZIP archive",
        });

        const single = rendered.length === 1;
        let outputBytes: Uint8Array;
        let fileName: string;
        if (single) {
          outputBytes = rendered[0].bytes;
          fileName = imageOutputName(
            base,
            true,
            rendered[0].pageNumber,
            options.format
          );
        } else {
          const files: Record<string, Uint8Array> = {};
          for (const image of rendered) {
            files[
              `${base}-page-${image.pageNumber}.${imageExtension(options.format)}`
            ] = image.bytes;
          }
          outputBytes = zipSync(files, { level: 0 });
          fileName = imageOutputName(base, false, 0, options.format);
        }

        return {
          bytes: outputBytes,
          mimeType: single
            ? imageMimeType(options.format)
            : "application/zip",
          fileName,
          preview: {
            kind: "images",
            images: previews,
            totalPages: rendered.length,
            zipped: !single,
          },
          metadata: {
            pageCount: rendered.length,
            format: options.format,
            scale: options.scale,
            zipped: !single,
          },
          warnings:
            rendered.length > 100
              ? [
                  "This PDF has more than 100 pages. High-resolution images can use a lot of memory.",
                ]
              : [],
        };
      } finally {
        await pdf.destroy().catch(() => undefined);
      }
    }

    case "powerpoint": {
      const options = powerpointOptions(request.options);
      const quality =
        options.quality === "high"
          ? { scale: 2.5, quality: 0.92 }
          : options.quality === "medium"
            ? { scale: 1.5, quality: 0.82 }
            : { scale: 1, quality: 0.7 };

      const pdf = await loadPdfDocument(bytes);
      try {
        const pageIndices = Array.from({ length: pdf.numPages }, (_, i) => i);
        progress({
          phase: "rendering",
          percent: 8,
          message: "Rendering slides",
        });

        const images = [];
        for (let i = 0; i < pageIndices.length; i++) {
          images.push(
            await renderPdfPageToImage(pdf, pageIndices[i], {
              scale: quality.scale,
              format: "image/jpeg",
              quality: quality.quality,
            })
          );
          progress({
            phase: "rendering",
            percent: 8 + ((i + 1) / pageIndices.length) * 76,
            message: `Rendering slide ${i + 1}/${pageIndices.length}`,
          });
        }

        progress({
          phase: "finalizing",
          percent: 90,
          message: "Building PowerPoint",
        });
        const pptx = await buildPptx(images, {
          slideSize: options.slideSize,
          title: request.fileName,
        });

        return {
          bytes: pptx,
          mimeType: CONVERT_FROM_MIME.powerpoint,
          fileName: `${base}.pptx`,
          metadata: {
            pageCount: images.length,
            slideSize: options.slideSize,
            quality: options.quality,
          },
          warnings:
            images.length > 100
              ? [
                  "This PDF has more than 100 pages. The PPTX may be large and take longer to open.",
                ]
              : [],
        };
      } finally {
        await pdf.destroy().catch(() => undefined);
      }
    }

    case "markdown": {
      const options = markdownOptions(request.options);
      const result = await convertPdfToMarkdown(
        bytes,
        options,
        request.fileName,
        progress
      );
      progress({
        phase: "finalizing",
        percent: 96,
        message: "Writing Markdown file",
      });
      return {
        bytes: new TextEncoder().encode(result.markdown),
        mimeType: CONVERT_FROM_MIME.markdown,
        fileName: `${base}.md`,
        metadata: result.metadata,
        warnings: result.warnings,
      };
    }

    case "text": {
      const options = textOptions(request.options);
      const pdf = await loadPdfDocument(bytes);
      try {
        const pageIndices = resolveSelectedPages(
          options.pageRange,
          pdf.numPages
        );
        if (pageIndices.length === 0) {
          throw new Error("No pages matched the selected page range");
        }
        const extracted = await extractTextFromDocument(pdf, pageIndices, {
          preserveLineBreaks: options.preserveLineBreaks,
          onPageProgress: (completed, total) =>
            progress({
              phase: "extracting",
              percent: 10 + (completed / total) * 80,
              message: `Extracting page ${completed}/${total}`,
            }),
        });
        if (extracted.totalChars === 0) throw new Error(SCANNED_PDF_MESSAGE);

        progress({
          phase: "finalizing",
          percent: 95,
          message: "Writing text file",
        });
        return {
          bytes: new TextEncoder().encode(extracted.text),
          mimeType: CONVERT_FROM_MIME.text,
          fileName: `${base}.txt`,
          metadata: {
            pageCount: extracted.pages.length,
            charCount: extracted.totalChars,
          },
          warnings: extracted.emptyPages.length
            ? [
                `${extracted.emptyPages.length} page(s) had no extractable text and were skipped.`,
              ]
            : [],
        };
      } finally {
        await pdf.destroy().catch(() => undefined);
      }
    }

    case "html": {
      const options = htmlOptions(request.options);
      const result = await convertPdfToHtml(
        bytes,
        options,
        request.fileName,
        progress
      );
      progress({
        phase: "finalizing",
        percent: 97,
        message: "Writing HTML file",
      });
      return {
        bytes: new TextEncoder().encode(result.html),
        mimeType: CONVERT_FROM_MIME.html,
        fileName: `${base}.html`,
        preview: {
          kind: "html",
          html: result.html,
          title: result.title,
          author: result.author,
        },
        metadata: {
          html: result.html,
          title: result.title,
          author: result.author,
        },
        warnings: result.warnings,
      };
    }

    default:
      throw new Error(`Unsupported conversion tool: ${request.tool}`);
  }
}

declare const WorkerGlobalScope: (abstract new () => object) | undefined;

function isWorkerScope(): boolean {
  return (
    typeof WorkerGlobalScope !== "undefined" &&
    typeof globalThis !== "undefined" &&
    globalThis instanceof WorkerGlobalScope
  );
}

if (isWorkerScope()) {
  const ctx = globalThis as unknown as {
    postMessage: (
      message: ConvertFromWorkerResponse,
      transfer?: Transferable[]
    ) => void;
    onmessage:
      | ((event: MessageEvent<ConvertFromWorkerRequest>) => void)
      | null;
  };

  ctx.onmessage = async (event: MessageEvent<ConvertFromWorkerRequest>) => {
    const { id, ...request } = event.data;
    try {
      const outcome = await runConvertFromJob(request, (progress) => {
        ctx.postMessage({ type: "progress", id, progress });
      });

      if (outcome.preview && !outcome.bytes) {
        ctx.postMessage({
          type: "preview",
          id,
          preview: outcome.preview,
          warnings: outcome.warnings,
        });
        return;
      }

      const output = outcome.bytes ?? new Uint8Array();
      ctx.postMessage(
        {
          type: "done",
          id,
          bytes: output,
          mimeType: outcome.mimeType,
          fileName: outcome.fileName,
          metadata: outcome.metadata,
          warnings: outcome.warnings,
          preview: outcome.preview,
        },
        [output.buffer]
      );
    } catch (error) {
      ctx.postMessage({
        type: "error",
        id,
        message: error instanceof Error ? error.message : "Conversion failed",
      });
      console.error("[convert-from] worker conversion failed:", error);
    }
  };
}
