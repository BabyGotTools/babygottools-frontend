import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * pdfjs-dist is ~1MB of JavaScript. Importing it statically put it in the
 * initial bundle of every tool route (page counts, thumbnails, previews all
 * live in this module) even though the first real use is only after a file is
 * chosen. The first function that needs pdf.js pays for the chunk instead.
 */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/**
 * Loads pdfjs-dist once and configures its worker source.
 *
 * Exported so services that need `getDocument` (compress, OCR) go through the
 * same initialisation. They previously imported pdfjs-dist directly and called
 * `getDocument` without ever setting `GlobalWorkerOptions.workerSrc`, which
 * makes pdf.js throw on a fresh page load.
 */
export function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      // The worker file is served from /public (same-origin, version-locked
      // with the installed package) instead of a CDN.
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export interface PdfPageInfo {
  index: number;
  width: number;
  height: number;
}

export interface PdfDocInfo {
  pageCount: number;
  pages: PdfPageInfo[];
  title?: string;
  author?: string;
}

/**
 * Parsed pdf.js documents, keyed by an owner-supplied key.
 *
 * The map holds *promises* rather than resolved documents: a 100-page grid
 * mounts 100 thumbnails at once, and without this every one of them started
 * its own parse before the first had a chance to finish (each parse after the
 * first was then orphaned and never destroyed). The owning tool passes a
 * stable key (the file id) and calls `destroyPdfDocument()` when done.
 */
const documentCache = new Map<string, Promise<PDFDocumentProxy>>();

export async function loadPdfDocument(
  file: File | ArrayBuffer
): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  return pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
}

/**
 * Returns a shared parse of `file`, caching it under `cacheKey`.
 * Falls back to a one-off parse if no key is supplied.
 */
export async function getCachedDocument(
  cacheKey: string | null,
  file: File | ArrayBuffer
): Promise<PDFDocumentProxy> {
  if (!cacheKey) return loadPdfDocument(file);

  const cached = documentCache.get(cacheKey);
  if (cached) return cached;

  const pending = loadPdfDocument(file).catch((error: unknown) => {
    // Never leave a rejected promise in the cache, or every future call for
    // this key fails with the same error without retrying.
    documentCache.delete(cacheKey);
    throw error;
  });

  documentCache.set(cacheKey, pending);
  return pending;
}

export async function destroyPdfDocument(cacheKey: string): Promise<void> {
  const pending = documentCache.get(cacheKey);
  if (!pending) return;
  documentCache.delete(cacheKey);
  await pending.then((doc) => doc.destroy()).catch(() => undefined);
}

export function destroyAllPdfDocuments(): void {
  for (const key of Array.from(documentCache.keys())) {
    void destroyPdfDocument(key);
  }
}

/** Cheap page count. Returns 0 when the document cannot be parsed. */
export async function getPdfPageCount(
  file: File | ArrayBuffer
): Promise<number> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
    .promise;
  const { numPages } = doc;
  await doc.destroy().catch(() => undefined);
  return numPages;
}

/** True when the document requires a password to open. */
export async function isEncrypted(file: File | ArrayBuffer): Promise<boolean> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  try {
    const doc = await pdfjs
      .getDocument({ data: new Uint8Array(arrayBuffer.slice()) })
      .promise;
    await doc.destroy().catch(() => undefined);
    return false;
  } catch (error) {
    const name = (error as { name?: string }).name ?? "";
    const message = error instanceof Error ? error.message : String(error);
    return (
      name === "PasswordException" ||
      /password/i.test(message) ||
      /encrypted/i.test(message)
    );
  }
}

export async function getPdfInfo(
  file: File | ArrayBuffer
): Promise<PdfDocInfo> {
  const pdf = await loadPdfDocument(file);
  try {
    const pageCount = pdf.numPages;
    const pages: PdfPageInfo[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      pages.push({
        index: i - 1,
        width: viewport.width,
        height: viewport.height,
      });
      page.cleanup();
    }

    const metadata = await pdf.getMetadata();
    const info = metadata?.info as Record<string, string> | undefined;

    return {
      pageCount,
      pages,
      title: info?.Title || undefined,
      author: info?.Author || undefined,
    };
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}

async function renderPage(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  maxDimension: number,
  rotation: number
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageIndex + 1);
  const unscaled = page.getViewport({ scale: 1, rotation });
  const scale = Math.min(
    maxDimension / unscaled.width,
    maxDimension / unscaled.height
  );
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const context = canvas.getContext("2d");
  if (!context) {
    page.cleanup();
    throw new Error("Canvas 2D context is unavailable");
  }

  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas;
}

export async function renderPageToDataURL(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  maxDimension: number = 200,
  rotation: number = 0
): Promise<string> {
  const canvas = await renderPage(pdf, pageIndex, maxDimension, rotation);
  return canvas.toDataURL("image/png");
}

/**
 * Renders one page to a canvas the caller owns (used by OCR rasterization,
 * which needs the live canvas rather than a data URL).
 */
export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  scale: number = 1,
  rotation: number = 0
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const context = canvas.getContext("2d");
  if (!context) {
    page.cleanup();
    throw new Error("Canvas 2D context is unavailable");
  }

  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas;
}

/**
 * Triggers a browser download for generated bytes.
 *
 * The object URL is revoked on a macrotask: revoking it synchronously after
 * `click()` aborts the download in Firefox and Safari.
 */
export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mimeType = "application/pdf"
): void {
  // Copy into a standalone buffer: a Uint8Array can be a view onto a larger
  // ArrayBuffer, which would leak the surplus into the download.
  const blob = new Blob([bytes.slice()], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Opens bytes in a new tab (Quick View). Caller revokes the returned URL. */
export function openBytesInNewTab(
  bytes: Uint8Array,
  mimeType = "application/pdf"
): string {
  const blob = new Blob([bytes.slice()], { type: mimeType });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}

/** Builds the download name for a transformed document. */
export function outputFilename(
  originalName: string,
  suffix: string,
  extension = "pdf"
): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "document";
  return `${base}-${suffix}.${extension}`;
}
