/**
 * Shared helpers for the Convert-from-PDF engine family. Ported from the
 * i love pdf project; the page-range parser comes from the shared
 * `../pageMath` module so both suites interpret ranges identically.
 */
import type { PdfPhase } from "../pdfTypes";
import { parsePageRanges } from "../pageMath";
import type {
  ConvertFromTool,
  ImageOutputFormat,
  MarkdownChunkBy,
  SlideSize,
} from "./convertFromTypes";

export const CONVERT_FROM_MAX_FILE_SIZE = 150 * 1024 * 1024;
export const CONVERT_FROM_MAX_SCALE = 3;
export const CONVERT_FROM_MAX_PAGES_WARNING = 100;

export const SCANNED_PDF_MESSAGE =
  "This PDF appears to be a scanned image. OCR is not supported for this tool. Please use the OCR PDF tool first.";

export const CONVERT_FROM_TOOL_NAMES: Record<ConvertFromTool, string> = {
  word: "PDF to Word",
  excel: "PDF to Excel",
  image: "PDF to JPG / PNG",
  powerpoint: "PDF to PowerPoint",
  markdown: "PDF to Markdown",
  text: "PDF to Text",
  html: "PDF to HTML",
};

export const CONVERT_FROM_EXTENSIONS: Record<ConvertFromTool, string> = {
  word: "docx",
  excel: "xlsx",
  image: "zip",
  powerpoint: "pptx",
  markdown: "md",
  text: "txt",
  html: "html",
};

export const CONVERT_FROM_MIME: Record<ConvertFromTool, string> = {
  word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  image: "application/zip",
  powerpoint:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  markdown: "text/markdown",
  text: "text/plain",
  html: "text/html",
};

export const CHUNK_BY_LABELS: Record<MarkdownChunkBy, string> = {
  none: "Single document",
  heading: "By heading",
  page: "By page",
  token: "By token budget",
};

export const SLIDE_SIZE_LABELS: Record<SlideSize, string> = {
  match: "Match PDF aspect ratio",
  "16:9": "Widescreen (16:9)",
  "4:3": "Standard (4:3)",
};

export function baseNameOf(name: string): string {
  const base = name.split(/[\\/]/).pop() || name;
  const dot = base.lastIndexOf(".");
  if (dot > 0) return base.slice(0, dot);
  return base || "document";
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || extensionOf(file.name) === ".pdf"
  );
}

export function validatePdfFile(file: File): string | null {
  if (file.size === 0) return `${file.name}: the file is empty`;
  if (file.size > CONVERT_FROM_MAX_FILE_SIZE) {
    return `${file.name}: exceeds the 150 MB limit`;
  }
  if (!isPdfFile(file)) return `${file.name}: choose a PDF file`;
  return null;
}

export function resolveSelectedPages(
  pageRange: string,
  totalPages: number
): number[] {
  const trimmed = pageRange.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  return parsePageRanges(trimmed, totalPages);
}

export function describePageRange(
  selectedPages: number[],
  totalPages: number
): string {
  if (selectedPages.length === totalPages) return "All pages";
  if (selectedPages.length === 0) return "No pages selected";
  if (selectedPages.length === 1) return `Page ${selectedPages[0] + 1}`;
  return `${selectedPages.length} pages selected`;
}

export function imageExtension(format: ImageOutputFormat): "jpg" | "png" {
  return format === "jpeg" ? "jpg" : "png";
}

export function imageMimeType(format: ImageOutputFormat): "image/jpeg" | "image/png" {
  return format === "jpeg" ? "image/jpeg" : "image/png";
}

export function outputNameFor(
  tool: ConvertFromTool,
  baseName: string,
  options?: {
    pageCount?: number;
    format?: ImageOutputFormat;
    singlePage?: number;
  }
): string {
  const base = baseNameOf(baseName);
  switch (tool) {
    case "word":
      return `${base}.docx`;
    case "excel":
      return `${base}-tables.xlsx`;
    case "image": {
      const ext = imageExtension(options?.format ?? "jpeg");
      if (options?.singlePage !== undefined) {
        return `${base}-page-${options.singlePage + 1}.${ext}`;
      }
      return `${base}-images.zip`;
    }
    case "powerpoint":
      return `${base}.pptx`;
    case "markdown":
      return `${base}.md`;
    case "text":
      return `${base}.txt`;
    case "html":
      return `${base}.html`;
    default:
      return `${base}.bin`;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function describeConvertFromError(
  error: unknown,
  tool: ConvertFromTool
): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (message.includes("scanned") || message.includes("no extractable text")) {
    return SCANNED_PDF_MESSAGE;
  }
  if (message.includes("password") || message.includes("encrypted")) {
    return "This PDF is password-protected. Remove the password in its original app, then try again.";
  }
  if (message.includes("out of memory") || message.includes("allocation failed")) {
    return "The browser ran out of memory. Try a smaller page range, lower image quality, or close other tabs.";
  }
  if (message.includes("no tables")) {
    return "No tables were detected in this PDF. For scanned documents, run the OCR PDF tool first, then convert the searchable PDF here.";
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return "The conversion took too long and was stopped. Try a smaller page range or close other tabs.";
  }
  if (message.includes("worker")) {
    return "The local conversion worker could not start. Reload the page and try again. Nothing was uploaded.";
  }

  return raw || `${CONVERT_FROM_TOOL_NAMES[tool]} failed`;
}

/** Downloads bytes with the correct MIME type and revokes the object URL. */
export function downloadFileBytes(
  bytes: Uint8Array,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([bytes.slice()], { type: mimeType });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking synchronously aborts downloads in Firefox and Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

export function safeSheetName(name: string, index: number): string {
  const cleaned = name
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return cleaned || `Table ${index + 1}`;
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 2;
  return Math.min(CONVERT_FROM_MAX_SCALE, Math.max(0.25, scale));
}

export function clampQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 0.9;
  return Math.min(1, Math.max(0.5, quality));
}

export function truncateMiddle(value: string, maxLength = 48): string {
  if (value.length <= maxLength) return value;
  const keep = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

/* ------------------------- progress phase mapping ------------------------- */

/**
 * Converter progress phases (preparing / rendering / extracting / converting /
 * finalizing…) mapped onto the shared PdfPhase vocabulary used by every
 * workspace's progress bar and status chips.
 */
const CONVERT_FROM_TO_PDF_PHASE: Record<string, PdfPhase> = {
  reading: "reading",
  preparing: "reading",
  rendering: "rasterizing",
  rasterizing: "rasterizing",
  extracting: "analyzing",
  converting: "analyzing",
  finalizing: "writing",
};

export function toPdfPhase(phase: string): PdfPhase {
  return CONVERT_FROM_TO_PDF_PHASE[phase] ?? "analyzing";
}
