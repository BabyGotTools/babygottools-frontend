import { PDFDocument } from "pdf-lib";
import * as studio from "./pdfStudio";
import { getPdfjs } from "./pdfRender";
import type { FlattenOptions, PdfOutcome, PhaseReporter } from "./pdfTypes";

/**
 * Flatten forms and/or annotations so every appearance is baked into page
 * content. qpdf does the baking in one pass; the rasterize mode is an
 * explicit opt-in full-page rasterization (destroys the text layer).
 */

export interface FlattenReport {
  fieldCount: number;
  annotationCount: number;
  /** Both got baked together because qpdf handles them in one pass. */
  bakedBothTogether: boolean;
  rasterized: boolean;
}

function report(
  onPhase: PhaseReporter | undefined,
  phase: Parameters<PhaseReporter>[0]["phase"],
  percent: number,
  message?: string
): void {
  onPhase?.({ phase, percent: Math.max(0, Math.min(100, percent)), message });
}

export async function countFlattenable(
  bytes: Uint8Array
): Promise<{ fieldCount: number; annotationCount: number }> {
  try {
    const source = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    let fieldCount = 0;
    try {
      fieldCount = source.getForm().getFields().length;
    } catch {
      fieldCount = 0;
    }
    let annotationCount = 0;
    for (const page of source.getPages()) {
      annotationCount += page.node.Annots()?.size() ?? 0;
    }
    return { fieldCount, annotationCount };
  } catch {
    return { fieldCount: 0, annotationCount: 0 };
  }
}

export async function flattenPdf(
  bytes: Uint8Array,
  options: FlattenOptions,
  onPhase?: PhaseReporter
): Promise<PdfOutcome & { report: FlattenReport }> {
  const { fieldCount, annotationCount } = await countFlattenable(bytes);

  // Full rasterization: an explicit opt-in that destroys the text layer.
  if (options.rasterize) {
    report(onPhase, "reading", 10, "Loading PDF pages...");
    const pdfjs = await getPdfjs();
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    const numPages = doc.numPages;
    const pages: Uint8Array[] = [];
    let total = 0;

    try {
      for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          page.cleanup();
          continue;
        }
        report(
          onPhase,
          "rasterizing",
          Math.round(((i - 1) / numPages) * 80),
          `Rasterizing page ${i} of ${numPages}...`
        );
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.9)
        );
        if (blob) {
          const data = new Uint8Array(await blob.arrayBuffer());
          total += data.byteLength;
          pages.push(data);
        }
      }
    } finally {
      await doc.destroy().catch(() => undefined);
    }

    if (pages.length === 0) {
      throw new Error("No pages could be rendered for rasterization");
    }

    report(onPhase, "rebuilding", 90, "Assembling raster document...");
    const bytesOut = await studio.jpegPagesToPdf(pages, 144);
    report(onPhase, "done", 100, "Done");
    return {
      bytes: bytesOut,
      report: {
        fieldCount,
        annotationCount,
        bakedBothTogether: true,
        rasterized: true,
      },
      warnings: [
        "The text layer was destroyed by rasterization — the output is page images only.",
      ],
    };
  }

  report(onPhase, "analyzing", 30, "Baking appearances into page content...");
  const flattened = await studio.flatten(bytes, options);
  report(onPhase, "writing", 100, "Done");

  const warnings: string[] = [];
  if (options.forms && options.annotations) {
    // Fine — user asked for both.
  } else if (options.annotations && !options.forms) {
    if (fieldCount > 0) {
      warnings.push(
        `Form fields were flattened too: the engine bakes annotations and AcroForm widgets in a single pass.`
      );
    }
  } else if (options.forms && !options.annotations) {
    if (annotationCount > fieldCount) {
      warnings.push(
        "Screen-only annotations (highlights, notes with no print appearance) stay live in 'forms only' mode."
      );
    }
  }
  if (fieldCount === 0 && annotationCount === 0) {
    warnings.push(
      "No form fields or annotations were found — the document was re-saved as-is."
    );
  }

  return {
    bytes: flattened,
    report: {
      fieldCount,
      annotationCount,
      bakedBothTogether:
        options.forms !== options.annotations &&
        options.annotations === true,
      rasterized: false,
    },
    warnings,
  };
}
