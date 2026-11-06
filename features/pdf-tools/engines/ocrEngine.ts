import { createWorker, type Worker as TesseractWorker } from "tesseract.js";
import { getPdfjs } from "./pdfRender";
import * as studio from "./pdfStudio";
import type { OcrOptions, OcrResult, PhaseReporter } from "./pdfTypes";

/**
 * OCR entirely in the browser using Tesseract.js: every page is rasterised
 * at the requested DPI, recognised, and reassembled into a searchable PDF
 * with an invisible text layer. Language data is fetched once and cached
 * by tesseract in IndexedDB; the worker script and wasm core are served
 * from this app's own /public assets (same-origin, version-locked).
 */

function report(
  onPhase: PhaseReporter | undefined,
  phase: Parameters<PhaseReporter>[0]["phase"],
  percent: number,
  message?: string
): void {
  onPhase?.({ phase, percent: Math.max(0, Math.min(100, percent)), message });
}

export async function ocrPdf(
  inputBytes: Uint8Array,
  options: OcrOptions,
  onPhase?: PhaseReporter
): Promise<OcrResult> {
  report(onPhase, "reading", 10, "Loading PDF document...");
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: inputBytes.slice() }).promise;
  const numPages = doc.numPages;

  const ocrPdfPages: Uint8Array[] = [];
  const textAccumulator: string[] = [];
  let copiedPages = 0;

  /**
   * Copies one original page out of the source document.
   *
   * Used as the fallback whenever a page cannot be rasterised or recognised:
   * the naive version just `continue`d, so those pages were silently deleted
   * from the output while the UI claimed the whole document was processed.
   */
  const extractOriginalPage = async (
    pageNumber: number
  ): Promise<Uint8Array | null> => {
    try {
      return await studio.extractPages(inputBytes, pageNumber);
    } catch {
      return null;
    }
  };

  let worker: TesseractWorker | undefined;

  try {
    report(onPhase, "analyzing", 20, "Initializing Tesseract OCR engine...");
    worker = await createWorker(options.language || "eng", undefined, {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract-core",
    });

    for (let i = 1; i <= numPages; i++) {
      const pageProgress = Math.round(((i - 1) / numPages) * 100);
      report(
        onPhase,
        "rasterizing",
        pageProgress,
        `Rendering page ${i} of ${numPages}...`
      );

      const page = await doc.getPage(i);

      if (options.skipPagesWithText) {
        const textContent = await page.getTextContent();
        const textItems = textContent.items
          .map((item: unknown) =>
            item && typeof item === "object" && "str" in item
              ? String((item as { str: unknown }).str)
              : ""
          )
          .join(" ")
          .trim();

        if (textItems.length > 0) {
          const originalPage = await extractOriginalPage(i);
          if (originalPage) {
            textAccumulator.push(
              `--- Page ${i} (Existing Digital Text) ---\n${textItems}`
            );
            ocrPdfPages.push(originalPage);
            copiedPages += 1;
            page.cleanup();
            continue;
          }
          // Could not copy the page as-is; fall through and try OCR instead
          // of dropping it.
        }
      }

      const scale = Math.max(1, (options.dpi || 200) / 72);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        page.cleanup();
        const originalPage = await extractOriginalPage(i);
        if (originalPage) {
          ocrPdfPages.push(originalPage);
          copiedPages += 1;
        }
        continue;
      }

      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();

      report(
        onPhase,
        "recognizing",
        pageProgress,
        `Recognizing text on page ${i} of ${numPages}...`
      );

      const result = await worker.recognize(
        canvas,
        { pdfTitle: `Document - Page ${i}` },
        { pdf: true, text: true }
      );

      if (result.data.text && result.data.text.trim()) {
        textAccumulator.push(`--- Page ${i} ---\n${result.data.text.trim()}`);
      }

      if (result.data.pdf) {
        ocrPdfPages.push(new Uint8Array(result.data.pdf));
      } else {
        const originalPage = await extractOriginalPage(i);
        if (originalPage) {
          ocrPdfPages.push(originalPage);
          copiedPages += 1;
        }
      }
    }
  } finally {
    // Release both the OCR worker and the pdf.js worker even on failure.
    if (worker) await worker.terminate().catch(() => undefined);
    await doc.destroy().catch(() => undefined);
  }

  report(onPhase, "writing", 90, "Assembling searchable PDF...");

  let finalBytes: Uint8Array;
  if (ocrPdfPages.length === 1) {
    finalBytes = ocrPdfPages[0];
  } else if (ocrPdfPages.length > 1) {
    finalBytes = await studio.mergePdfs(ocrPdfPages);
  } else {
    finalBytes = inputBytes;
  }

  report(onPhase, "done", 100, "Done");

  return {
    bytes: finalBytes,
    extractedText: textAccumulator.join("\n\n"),
    copiedPages,
  };
}

export const OCR_LANGUAGES: { id: string; label: string }[] = [
  { id: "eng", label: "English" },
  { id: "spa", label: "Spanish" },
  { id: "fra", label: "French" },
  { id: "deu", label: "German" },
  { id: "ita", label: "Italian" },
  { id: "por", label: "Portuguese" },
  { id: "nld", label: "Dutch" },
  { id: "rus", label: "Russian" },
  { id: "chi_sim", label: "Chinese (Simplified)" },
  { id: "jpn", label: "Japanese" },
  { id: "kor", label: "Korean" },
  { id: "ara", label: "Arabic" },
  { id: "hin", label: "Hindi" },
];
