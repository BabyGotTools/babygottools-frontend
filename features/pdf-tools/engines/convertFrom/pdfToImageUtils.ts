import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { RenderedPageImage } from "./convertFromTypes";
import { bytesToDataUrl, clampQuality, clampScale } from "./convertFromUtils";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/**
 * Loads pdfjs-dist once and points it at the local worker copied to /public.
 * The worker is already running inside a Web Worker for conversion jobs;
 * pdf.js supports spawning its own nested worker from there.
 */
export function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function loadPdfDocument(
  bytes: Uint8Array
): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  // pdf.js may transfer/detach the input buffer. Keep the caller's copy intact.
  const data = new Uint8Array(bytes);
  return pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
}

export type CanvasLike = HTMLCanvasElement | OffscreenCanvas;

export function createCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    return canvas;
  }
  throw new Error("No canvas implementation is available in this environment");
}

function context2d(canvas: CanvasLike): CanvasRenderingContext2D {
  const context = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) throw new Error("Canvas 2D context is unavailable");
  return context as unknown as CanvasRenderingContext2D;
}

export interface RenderPageOptions {
  scale?: number;
  format?: "image/jpeg" | "image/png";
  quality?: number;
  includeDataUrl?: boolean;
}

async function canvasToBlob(
  canvas: CanvasLike,
  type: string,
  quality: number
): Promise<Blob> {
  if ("convertToBlob" in canvas && typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not encode the rendered page"));
      },
      type,
      quality
    );
  });
}

export async function canvasToImageBytes(
  canvas: CanvasLike,
  format: "image/jpeg" | "image/png",
  quality: number
): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas, format, clampQuality(quality));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Renders one PDF page to an image. Pure enough to unit test with a fake
 * `PDFDocumentProxy`; the canvas comes from jsdom in tests.
 */
export async function renderPdfPageToImage(
  pdf: Pick<PDFDocumentProxy, "getPage">,
  pageIndex: number,
  options: RenderPageOptions = {}
): Promise<RenderedPageImage> {
  const scale = clampScale(options.scale ?? 2);
  const format = options.format ?? "image/jpeg";
  const quality = clampQuality(options.quality ?? 0.9);

  const page = (await pdf.getPage(pageIndex + 1)) as PDFPageProxy;
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale });
  const width = Math.max(1, Math.ceil(viewport.width));
  const height = Math.max(1, Math.ceil(viewport.height));

  const canvas = createCanvas(width, height);
  const context = context2d(canvas);

  // JPEG has no alpha channel; without an explicit white fill, transparent
  // areas encode as black.
  if (format === "image/jpeg") {
    context.save();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  try {
    await page.render({
      canvasContext: context,
      viewport,
      background: "#ffffff",
    } as never).promise;
  } finally {
    page.cleanup();
  }

  const bytes = await canvasToImageBytes(canvas, format, quality);
  return {
    pageNumber: pageIndex + 1,
    mimeType: format,
    bytes,
    width,
    height,
    pageWidth: baseViewport.width,
    pageHeight: baseViewport.height,
    ...(options.includeDataUrl
      ? { dataUrl: bytesToDataUrl(bytes, format) }
      : {}),
  };
}

export async function renderPdfPages(
  pdf: Pick<PDFDocumentProxy, "getPage">,
  pageIndices: number[],
  options: RenderPageOptions = {},
  onProgress?: (completed: number, total: number) => void
): Promise<RenderedPageImage[]> {
  const rendered: RenderedPageImage[] = [];
  for (let i = 0; i < pageIndices.length; i++) {
    rendered.push(await renderPdfPageToImage(pdf, pageIndices[i], options));
    onProgress?.(i + 1, pageIndices.length);
  }
  return rendered;
}

export interface TextLayerReport {
  hasText: boolean;
  totalChars: number;
  pagesWithText: number;
  sampledPages: number;
  pageCount: number;
}

/**
 * Cheap text-layer probe used to route scanned PDFs to a clear error before a
 * converter produces an empty document.
 */
export async function detectPdfTextLayer(
  bytes: Uint8Array,
  sampleLimit = 5
): Promise<TextLayerReport> {
  const pdf = await loadPdfDocument(bytes);
  try {
    const pageCount = pdf.numPages;
    const sampled: number[] = [];
    const step = Math.max(1, Math.floor(pageCount / Math.max(1, sampleLimit)));
    for (let page = 1; page <= pageCount && sampled.length < sampleLimit; page += step) {
      sampled.push(page);
    }
    if (sampled[sampled.length - 1] !== pageCount && sampled.length < sampleLimit) {
      sampled.push(pageCount);
    }

    let totalChars = 0;
    let pagesWithText = 0;

    for (const pageNumber of sampled) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const chars = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join("")
          .replace(/\s/g, "").length;
        totalChars += chars;
        if (chars >= 20) pagesWithText++;
      } finally {
        page.cleanup();
      }
    }

    return {
      hasText: totalChars >= 20 && pagesWithText > 0,
      totalChars,
      pagesWithText,
      sampledPages: sampled.length,
      pageCount,
    };
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}
