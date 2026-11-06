/**
 * Shared types for the "Convert from PDF" engine family, ported from the
 * i love pdf project. Everything here runs in the browser. The worker request
 * carries raw bytes — the hook reads them before posting so the worker never
 * needs file-system access.
 */

export type ConvertFromTool =
  | "word"
  | "excel"
  | "image"
  | "powerpoint"
  | "markdown"
  | "text"
  | "html";

export interface ConvertFromProgress {
  phase: string;
  percent: number;
  message?: string;
}

export interface ConvertFromRequest {
  tool: ConvertFromTool;
  file: File;
  options: Record<string, unknown>;
}

export interface ConvertFromResult {
  success: boolean;
  bytes?: Uint8Array;
  blob?: Blob;
  error?: string;
  metadata?: Record<string, unknown>;
  /** Non-fatal notices surfaced in the result panel. */
  warnings?: string[];
}

/** A table extracted by the local Kreuzberg WASM engine, normalised for preview + XLSX export. */
export interface ExtractedTable {
  id: string;
  pageNumber?: number;
  headers?: string[];
  rows: string[][];
}

/** Small preview image rendered alongside a multi-page image conversion. */
export interface ConvertFromPreviewImage {
  name: string;
  mimeType: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ImagePreviewData {
  kind: "images";
  images: ConvertFromPreviewImage[];
  totalPages: number;
  zipped: boolean;
}

export interface TablePreviewData {
  kind: "tables";
  tables: ExtractedTable[];
  sourceName: string;
  ocrUsed: boolean;
  pageCount?: number;
}

export interface HtmlPreviewData {
  kind: "html";
  html: string;
  title?: string;
  author?: string;
}

export type ConvertFromPreview =
  | ImagePreviewData
  | TablePreviewData
  | HtmlPreviewData;

export interface WordFromPdfOptions {
  mode: "layout" | "text";
  pageRange: string;
}

export type ImageOutputFormat = "jpeg" | "png";

export interface ImageFromPdfOptions {
  format: ImageOutputFormat;
  /** Rendering scale (1, 1.5, 2, 3). */
  scale: number;
  /** JPEG quality 0.5–1.0; ignored for PNG. */
  quality: number;
  pageRange: string;
}

export type SlideSize = "match" | "16:9" | "4:3";
export type PptxQuality = "high" | "medium" | "low";

export interface PowerPointFromPdfOptions {
  slideSize: SlideSize;
  quality: PptxQuality;
}

export type MarkdownChunkBy = "none" | "heading" | "page" | "token";

export interface MarkdownFromPdfOptions {
  includeMetadata: boolean;
  chunkBy: MarkdownChunkBy;
  maxTokensPerChunk: number;
}

export interface TextFromPdfOptions {
  pageRange: string;
  preserveLineBreaks: boolean;
}

export interface HtmlFromPdfOptions {
  includePageNumbers: boolean;
  includeCitation: boolean;
}

/** Message sent to `convertFromWorker.ts`. */
export interface ConvertFromWorkerRequest {
  id: string;
  tool: ConvertFromTool;
  bytes: ArrayBuffer;
  fileName: string;
  options: Record<string, unknown>;
}

export interface RenderedPageImage {
  pageNumber: number;
  mimeType: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  /** Original page size in PDF points. */
  pageWidth: number;
  pageHeight: number;
  /** Optional inline preview (small thumbnails only). */
  dataUrl?: string;
}

export type ConvertFromWorkerResponse =
  | { type: "progress"; id: string; progress: ConvertFromProgress }
  | {
      type: "preview";
      id: string;
      preview: ConvertFromPreview;
      warnings?: string[];
    }
  | {
      type: "done";
      id: string;
      bytes: Uint8Array;
      mimeType: string;
      fileName: string;
      metadata?: Record<string, unknown>;
      warnings?: string[];
      preview?: ConvertFromPreview;
    }
  | { type: "error"; id: string; message: string };

export interface ConvertFromOutcome {
  bytes?: Uint8Array;
  mimeType: string;
  fileName: string;
  metadata?: Record<string, unknown>;
  preview?: ConvertFromPreview;
  warnings: string[];
}
