import { PDF_MAX_BYTES, PDF_MAX_TOTAL_BYTES } from "./pdfTypes";

/**
 * File-signature (magic-byte) validation.
 *
 * Extensions are advisory only — malware routinely hides behind a friendly
 * name — so every accepted file is additionally checked against its real
 * leading bytes before any engine parses it. All functions are pure and
 * DOM-free so they can be unit-tested directly.
 */

export type SniffKind =
  | "pdf"
  | "jpeg"
  | "png"
  | "webp"
  | "heic"
  | "gif"
  | "bmp"
  | "tiff"
  | "ooxml"
  | "zip"
  | "svg"
  | "text"
  | "unknown";

export const IMAGE_MAX_BYTES = 40 * 1024 * 1024;
export const OFFICE_MAX_BYTES = 80 * 1024 * 1024;
export const TEXT_MAX_BYTES = 10 * 1024 * 1024;

function startsWith(bytes: Uint8Array, magic: number[], offset = 0): boolean {
  if (bytes.length < offset + magic.length) return false;
  return magic.every((value, index) => bytes[offset + index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/** Reads the container brand of an ISO-BMFF file (ftyp box). */
function ftypBrand(bytes: Uint8Array): string | null {
  if (!asciiAt(bytes, 4, "ftyp")) return null;
  let brand = "";
  for (let i = 8; i < 12; i++) brand += String.fromCharCode(bytes[i]);
  return brand.toLowerCase();
}

export function sniffSignature(
  bytes: Uint8Array,
  fileName = ""
): SniffKind {
  const head = bytes.subarray(0, 1024);
  const textHead = new TextDecoder("utf-8", { fatal: false }).decode(
    head.subarray(0, 512)
  );

  if (asciiAt(head, 0, "%PDF-")) return "pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "png";
  if (asciiAt(head, 0, "RIFF") && asciiAt(head, 8, "WEBP")) return "webp";
  if (asciiAt(head, 0, "GIF8")) return "gif";
  if (startsWith(bytes, [0x42, 0x4d])) return "bmp";
  if (
    startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])
  )
    return "tiff";

  const brand = ftypBrand(head);
  if (brand) {
    if (["heic", "heix", "hevc", "mif1", "msf1", "heif"].includes(brand))
      return "heic";
    if (brand === "avif") return "webp"; // raster image family, handled alike
  }

  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    const extension = fileName.toLowerCase().split(".").pop() ?? "";
    return ["docx", "xlsx", "pptx", "doc", "xls", "ppt"].includes(extension)
      ? "ooxml"
      : "zip";
  }

  const lowerName = fileName.toLowerCase();
  if (
    lowerName.endsWith(".svg") &&
    /<svg[\s>]/i.test(textHead)
  )
    return "svg";

  // Text heuristics: no NUL bytes in the first 512 and mostly printable.
  let printable = 0;
  for (let i = 0; i < head.length; i++) {
    if (head[i] === 0) {
      printable = -1;
      break;
    }
    const code = head[i];
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code < 127) || code >= 128)
      printable += 1;
  }
  if (printable >= 0 && printable / Math.max(1, head.length) > 0.9) return "text";

  return "unknown";
}

export interface FileCheck {
  ok: boolean;
  reason?: string;
  kind: SniffKind;
}

function overLimit(size: number, limit: number): string | null {
  return size > limit
    ? `This file is ${(size / 1024 / 1024).toFixed(0)} MB; the limit for this tool is ${(limit / 1024 / 1024).toFixed(0)} MB.`
    : null;
}

/** PDF tool input: real %PDF signature + shared size caps. */
export function checkPdfFile(
  file: Pick<File, "name" | "size">,
  head: Uint8Array
): FileCheck {
  const sizeReason = overLimit(file.size, PDF_MAX_BYTES);
  if (sizeReason) return { ok: false, reason: sizeReason, kind: "pdf" };

  const kind = sniffSignature(head, file.name);
  if (kind !== "pdf") {
    return {
      ok: false,
      kind,
      reason:
        "This file is not a real PDF — its bytes do not start with a %PDF signature. Renaming a file does not change its type.",
    };
  }
  return { ok: true, kind };
}

/** Image inputs for Image-to-PDF. */
export function checkImageFile(
  file: Pick<File, "name" | "size">,
  head: Uint8Array
): FileCheck {
  const sizeReason = overLimit(file.size, IMAGE_MAX_BYTES);
  if (sizeReason) return { ok: false, reason: sizeReason, kind: "unknown" };

  const kind = sniffSignature(head, file.name);
  if (["jpeg", "png", "webp", "heic", "gif", "bmp", "tiff"].includes(kind)) {
    return { ok: true, kind };
  }
  if (kind === "svg") {
    return {
      ok: false,
      kind,
      reason:
        "SVG is a vector format — rasterise it to PNG/JPG first, then add it here.",
    };
  }
  return {
    ok: false,
    kind,
    reason: "This file is not a recognised image (JPG, PNG, WebP, HEIC, GIF, BMP or TIFF).",
  };
}

/** Office inputs (docx/xlsx/pptx are zip containers with known extensions). */
export function checkOfficeFile(
  file: Pick<File, "name" | "size">,
  head: Uint8Array
): FileCheck {
  const sizeReason = overLimit(file.size, OFFICE_MAX_BYTES);
  if (sizeReason) return { ok: false, reason: sizeReason, kind: "unknown" };

  const kind = sniffSignature(head, file.name);
  if (kind === "ooxml") return { ok: true, kind };
  if (kind === "zip") {
    return {
      ok: false,
      kind,
      reason:
        "This is a generic ZIP archive, not an Office document. Add a real .docx, .xlsx or .pptx file.",
    };
  }
  if (kind === "pdf") {
    return {
      ok: false,
      kind,
      reason: "This file is already a PDF — the Office converters take .docx/.xlsx/.pptx sources.",
    };
  }
  const legacy = /\.(doc|xls|ppt)$/i.test(file.name);
  return {
    ok: false,
    kind,
    reason: legacy
      ? "Legacy .doc/.xls/.ppt binaries are not supported in-browser. Save the file as .docx/.xlsx/.pptx and try again."
      : "This file is not a real Office document — its bytes are not an OOXML (zip) container.",
  };
}

/** Text-ish inputs (txt/md/html/csv) with a text-content check. */
export function checkTextishFile(
  file: Pick<File, "name" | "size">,
  head: Uint8Array
): FileCheck {
  const sizeReason = overLimit(file.size, TEXT_MAX_BYTES);
  if (sizeReason) return { ok: false, reason: sizeReason, kind: "unknown" };

  const kind = sniffSignature(head, file.name);
  if (kind === "text" || kind === "svg") {
    return { ok: true, kind };
  }
  return {
    ok: false,
    kind,
    reason: "This file does not look like plain text (its bytes include binary data).",
  };
}

/** Aggregate total-size guard for multi-file tools. */
export function totalBytesTooLarge(totalBytes: number): boolean {
  return totalBytes > PDF_MAX_TOTAL_BYTES;
}
