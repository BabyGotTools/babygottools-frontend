import { getPdfjs } from "./pdfRender";
import * as studio from "./pdfStudio";
import type {
  CompressOptions,
  PhaseProgress,
  PdfOutcome,
  PhaseReporter,
  SizeLine,
} from "./pdfTypes";
import {
  buildSizeLines,
  computeStats,
  PROFILE_JPEG_QUALITY,
  type OptimizeStats,
} from "./optimizeUtils";

/**
 * Compresses a PDF in the browser using either structural stream
 * recompression (lossless — always safe) or intelligent raster resampling
 * and quantization when the user opts into downsampling.
 */

export interface CompressResult extends PdfOutcome {
  stats: OptimizeStats;
  sizeLines: SizeLine[];
  rasterized: boolean;
  originalSize: number;
  outputSize: number;
}

function report(
  onPhase: PhaseReporter | undefined,
  phase: PhaseProgress["phase"],
  percent: number,
  message?: string
): void {
  onPhase?.({ phase, percent: Math.max(0, Math.min(100, percent)), message });
}

export async function compressPdf(
  inputBytes: Uint8Array,
  options: CompressOptions,
  onPhase?: PhaseReporter
): Promise<CompressResult> {
  const originalSize = inputBytes.byteLength;

  // 1. Structural-only run: pure stream recompression & object packing.
  //    Image data is never resampled, so this is safe for any PDF.
  if (!options.downsample) {
    report(onPhase, "analyzing", 20, "Analyzing PDF structure...");
    report(
      onPhase,
      "rebuilding",
      50,
      "Recompressing streams and packing object streams..."
    );
    let result: Uint8Array = options.recompressStreams
      ? await studio.compressLossless(inputBytes, {
          compressionLevel: 9,
          objectStreams: true,
        })
      : inputBytes.slice();

    if (options.stripMetadata) {
      result = await studio.stripMetadata(result);
    }

    report(onPhase, "writing", 100, "Done");
    // Lossless should never bloat the document; if output grew, retain input.
    // An explicit metadata-stripping request wins over the size heuristic,
    // otherwise the checkbox would silently do nothing when stripping cannot
    // offset the structural overhead.
    if (options.stripMetadata || result.byteLength < originalSize) {
      return finish(result, { rasterized: false, jpegTotal: 0, originalSize });
    }
    return finish(inputBytes, { rasterized: false, jpegTotal: 0, originalSize });
  }

  // 2. Raster path: render each page at the requested DPI and re-embed.
  const quality = PROFILE_JPEG_QUALITY[options.profile];
  const grayscale = options.grayscale;

  report(onPhase, "reading", 10, "Loading PDF pages...");
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: inputBytes.slice() }).promise;
  const numPages = doc.numPages;

  report(
    onPhase,
    "rasterizing",
    0,
    `Compressing ${numPages} page${numPages === 1 ? "" : "s"}...`
  );
  const jpegPages: Uint8Array[] = [];
  let jpegTotal = 0;

  // Render at the effective DPI the user picked (72 = scale 1). The old
  // clamp of 2.5 silently capped "300 DPI" runs at 180 DPI.
  const scale = Math.max(0.5, Math.min(4.5, options.dpi / 72));

  try {
    for (let i = 1; i <= numPages; i++) {
      const pageProgress = Math.round(((i - 1) / numPages) * 100);
      report(
        onPhase,
        "rasterizing",
        pageProgress,
        `Optimizing page ${i} of ${numPages}...`
      );

      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        page.cleanup();
        continue;
      }

      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();

      if (grayscale) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let p = 0; p < data.length; p += 4) {
          const gray =
            0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
          data[p] = gray;
          data[p + 1] = gray;
          data[p + 2] = gray;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );

      if (blob) {
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        jpegTotal += bytes.byteLength;
        jpegPages.push(bytes);
      }
    }
  } finally {
    // Always release the pdf.js worker, even when rendering throws midway.
    await doc.destroy().catch(() => undefined);
  }

  if (jpegPages.length === 0) {
    const fallback = await studio.compressLossless(inputBytes);
    report(onPhase, "writing", 100, "Done");
    return finish(fallback, { rasterized: false, jpegTotal: 0, originalSize });
  }

  report(onPhase, "rebuilding", 75, "Assembling optimized document...");
  // Embed the rasters at the DPI they were rendered at so each PDF page
  // keeps its original physical size (a fixed 72 DPI inflates pages).
  let optimized = await studio.jpegPagesToPdf(
    jpegPages,
    Math.round(72 * scale)
  );

  report(onPhase, "rebuilding", 90, "Applying stream compression...");
  optimized = await studio.compressLossless(optimized, {
    compressionLevel: 9,
    objectStreams: true,
  });

  if (options.stripMetadata) {
    optimized = await studio.stripMetadata(optimized);
  }

  report(onPhase, "writing", 100, "Done");
  return finish(optimized, { rasterized: true, jpegTotal, originalSize });
}

function finish(
  bytes: Uint8Array,
  meta: {
    rasterized: boolean;
    jpegTotal: number;
    originalSize: number;
  }
): CompressResult {
  const outputSize = bytes.byteLength;
  const stats = computeStats(meta.originalSize, outputSize);
  const sizeLines = buildSizeLines(
    meta.rasterized,
    meta.originalSize,
    outputSize,
    meta.jpegTotal
  );
  const warnings: string[] = [];
  if (meta.rasterized) {
    warnings.push(
      "Pages were rasterised: text is no longer selectable. Turn off downsampling for a lossless structural pass."
    );
  }
  if (stats.bytesSaved < 0) {
    warnings.push(
      "The output is slightly larger than the input — this is normal for files that were already optimised."
    );
  }
  return {
    bytes,
    warnings,
    stats,
    sizeLines,
    rasterized: meta.rasterized,
    originalSize: meta.originalSize,
    outputSize,
  };
}
