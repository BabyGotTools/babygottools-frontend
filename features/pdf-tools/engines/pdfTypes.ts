/**
 * Shared types for the PDF tool engines — the contracts between the
 * engines, the Web Worker wrappers and the React workspaces.
 *
 * Nothing here imports an engine: workspaces can pull this module into a
 * route bundle without dragging pdf-lib/pdf.js/qpdf along.
 */

/** One produced output file (PDF or archive) plus honest conversion notes. */
export interface PdfOutcome {
  bytes: Uint8Array;
  warnings: string[];
}

/** Engine phases shared by optimize/OCR pipelines. */
export type PdfPhase =
  | "reading"
  | "analyzing"
  | "rasterizing"
  | "recognizing"
  | "rebuilding"
  | "writing"
  | "done";

export interface PhaseProgress {
  phase: PdfPhase;
  percent: number;
  message?: string;
}

export type PhaseReporter = (update: PhaseProgress) => void;

/* ------------------------------ compression ------------------------------ */

/** Registry hero copy names the profiles Extreme / Balanced / Prepress. */
export type CompressProfile = "extreme" | "balanced" | "prepress";

export interface CompressOptions {
  profile: CompressProfile;
  /** Downsample embedded raster images at the profile DPI. */
  downsample: boolean;
  /** Target DPI when downsample applies (extreme 72, balanced 150, prepress 300). */
  dpi: number;
  grayscale: boolean;
  /** Re-deflate streams and pack object streams (always safe, lossless). */
  recompressStreams: boolean;
  stripMetadata: boolean;
}

/** Per-stream size accounting shown in the output card's breakdown table. */
export interface SizeLine {
  label: string;
  before: number;
  after: number;
}

/* -------------------------------- flatten -------------------------------- */

export interface FlattenOptions {
  /** Bake AcroForm field appearances into page content. */
  forms: boolean;
  /** Bake annotation appearances (stamps, ink, highlights). */
  annotations: boolean;
  /** Full page rasterization (destroys the text layer — explicit opt-in). */
  rasterize: boolean;
}

/* -------------------------------- sanitize ------------------------------- */

export interface SanitizeInspectResult {
  infoFields: { label: string; value: string }[];
  hasXmp: boolean;
  hasJavaScript: boolean;
  hasOpenAction: boolean;
  attachmentNames: string[];
  annotationCount: number;
}

export interface SanitizeOptions {
  info: boolean;
  xmp: boolean;
  javascript: boolean;
  openActions: boolean;
  attachments: boolean;
  annotations: boolean;
}

/* ---------------------------------- OCR ---------------------------------- */

export interface OcrOptions {
  language: string;
  dpi: number;
  /** Copy pages that already contain digital text instead of OCR-ing them. */
  skipPagesWithText: boolean;
}

export interface OcrResult {
  bytes: Uint8Array;
  extractedText: string;
  /** Pages that kept their original appearance (already digital / fallback). */
  copiedPages: number;
}

/* --------------------------------- files --------------------------------- */

/** UI-side metadata for a loaded document (parsed, never assumed). */
export interface LoadedPdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  /** First parse failure, if the document could not be opened at all. */
  error?: string;
  encrypted?: boolean;
}

export const PDF_MAX_BYTES = 250 * 1024 * 1024;
export const PDF_MAX_TOTAL_BYTES = 500 * 1024 * 1024;
