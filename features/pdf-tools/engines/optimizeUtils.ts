import type { CompressProfile, PhaseProgress, SizeLine } from "./pdfTypes";

/**
 * Pure helpers for the optimize/OCR tools — side-effect free, no wasm, no
 * DOM. Unit-testable in a plain node environment.
 */

/* --------------------------------- stats --------------------------------- */

export interface OptimizeStats {
  originalSize: number;
  outputSize: number;
  bytesSaved: number;
  percentSaved: number;
}

export function computeStats(
  originalSize: number,
  outputSize: number
): OptimizeStats {
  const bytesSaved = originalSize - outputSize;
  return {
    originalSize,
    outputSize,
    bytesSaved,
    percentSaved:
      originalSize === 0
        ? 0
        : Math.round((bytesSaved / originalSize) * 1000) / 10,
  };
}

export interface StatsVerdict {
  tone: "good" | "neutral" | "warn";
  headline: string;
  detail: string;
}

/**
 * Turns raw size numbers into an honest sentence.
 *
 * Negative savings are normal and must not be dressed up: linearisation adds
 * a hint stream, and a lossless pass over an already-optimised file can grow
 * it.
 */
export function describeSavings(stats: OptimizeStats): StatsVerdict {
  const saved = formatBytes(Math.abs(stats.bytesSaved));

  if (stats.percentSaved > 0.5) {
    return {
      tone: "good",
      headline: `Saved ${stats.percentSaved}%`,
      detail: `${formatBytes(stats.originalSize)} → ${formatBytes(stats.outputSize)} (${saved} smaller)`,
    };
  }

  if (stats.percentSaved >= -0.5) {
    return {
      tone: "neutral",
      headline: "No size change",
      detail: `${formatBytes(stats.originalSize)} → ${formatBytes(stats.outputSize)}`,
    };
  }

  return {
    tone: "warn",
    headline: `File is ${Math.abs(stats.percentSaved)}% larger`,
    detail: `${formatBytes(stats.originalSize)} → ${formatBytes(stats.outputSize)} (${saved} larger). This is normal for this operation.`,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/* -------------------------------- progress ------------------------------- */

/**
 * Maps a phase onto a fixed [start, end] span of the overall 0-100 bar.
 *
 * Fixed spans (rather than additive weights) keep the bar monotonic even
 * when phases interleave, as OCR does (rasterizing -> recognizing per page).
 * With the old weight model the very first recognizing update computed 150%
 * and the bar sat pinned at 100% for the whole run.
 */
const PHASE_RANGE: Record<PhaseProgress["phase"], [number, number]> = {
  reading: [0, 5],
  analyzing: [5, 15],
  rebuilding: [15, 85],
  rasterizing: [15, 85],
  recognizing: [15, 85],
  writing: [85, 100],
  done: [100, 100],
};

export function toOverallProgress(update: PhaseProgress): number {
  const [start, end] = PHASE_RANGE[update.phase];
  const local = Math.min(100, Math.max(0, update.percent)) / 100;
  return Math.min(100, Math.max(0, Math.round(start + (end - start) * local)));
}

export const PHASE_LABELS: Record<PhaseProgress["phase"], string> = {
  reading: "Reading file",
  analyzing: "Analyzing document",
  rebuilding: "Rebuilding document",
  rasterizing: "Rendering pages",
  recognizing: "Recognizing text",
  writing: "Writing output",
  done: "Done",
};

/* ------------------------------- compress UI ------------------------------ */

export const PROFILE_LABELS: Record<CompressProfile, string> = {
  extreme: "Extreme",
  balanced: "Balanced",
  prepress: "Prepress",
};

export const PROFILE_DESCRIPTIONS: Record<CompressProfile, string> = {
  extreme: "Renders pages at 72 DPI with strong JPEG compression. Smallest file; expect visible softness and loss of the text layer.",
  balanced: "Renders every page to a JPEG at up to 150 DPI. Big savings on scans; text becomes part of the image and is no longer selectable.",
  prepress: "Renders at up to 300 DPI with light JPEG compression. Keeps print-grade detail; savings are smaller.",
};

/** Quality per profile; the DPI default the workspace offers alongside it. */
export const PROFILE_JPEG_QUALITY: Record<CompressProfile, number> = {
  extreme: 0.5,
  balanced: 0.75,
  prepress: 0.85,
};

export const DEFAULT_DPI_BY_PROFILE: Record<CompressProfile, number> = {
  extreme: 72,
  balanced: 150,
  prepress: 300,
};

/**
 * Component Byte Breakdown rows for the output card.
 *
 * When pages were rasterised the whole original content stream is replaced
 * by page images, so "before" is honestly the full original file; the
 * structure line covers the qpdf wrapper around them. A lossless run has no
 * meaningful component split, so it reports a single structure line.
 */
export function buildSizeLines(
  rasterized: boolean,
  originalSize: number,
  outputSize: number,
  jpegTotal: number
): SizeLine[] {
  if (rasterized) {
    const structure = Math.max(0, outputSize - jpegTotal);
    return [
      { label: "Page rasters (JPEG)", before: originalSize, after: jpegTotal },
      { label: "Structure & streams", before: 0, after: structure },
    ];
  }
  return [{ label: "Document structure", before: originalSize, after: outputSize }];
}

/* -------------------------------- misc ----------------------------------- */

/** Files above this get a heads-up before a multi-minute operation starts. */
export const LARGE_FILE_WARN_BYTES = 50 * 1024 * 1024;

export function isLargeFile(bytes: number): boolean {
  return bytes > LARGE_FILE_WARN_BYTES;
}

/**
 * qpdf strips the document information dictionary but leaves creation and
 * modification dates, so callers decide whether to touch them.
 */
export function shouldWarnAboutJsRemoval(): string {
  return "JavaScript and launch actions are not removed by the lossless pass. Use the Sanitize PDF tool to strip active content before distributing a document.";
}
