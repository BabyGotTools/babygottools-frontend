import type {
  FlattenOptions as StudioFlattenOptions,
  PdfInfo,
  PdfToolkit,
} from "pdfstudio";
import type { FlattenOptions } from "./pdfTypes";

/**
 * The only module in the app that touches `pdfstudio` (qpdf WASM).
 *
 * Everything else goes through this file, so swapping the engine is a
 * single-file change. Nothing outside here should know that qpdf exists.
 *
 * The module itself is NOT bundled: pdfstudio's dist contains Emscripten
 * glue with Node-only dynamic imports behind an environment guard
 * (`node:module` in the glue, `node:fs/promises` for `file:` URLs in the
 * runner). Webpack constant-folds those specifiers and refuses to build,
 * even though the branches can never execute in a browser. So the dist is
 * vendored verbatim into /public/pdfstudio (mirroring node_modules/
 * pdfstudio/dist, see its README) and loaded here as a native ES module
 * with webpackIgnore — byte-for-byte the code the smoke tests exercise
 * under Node, loaded only when a qpdf-backed tool is actually opened.
 */

type StudioModule = typeof import("pdfstudio");

const STUDIO_MODULE_URL = "/pdfstudio/index.js";

let studioPromise: Promise<StudioModule> | null = null;

/** Load the vendored pdfstudio dist once; failures are never cached. */
function loadStudio(): Promise<StudioModule> {
  if (!studioPromise) {
    studioPromise = import(/* webpackIgnore: true */ STUDIO_MODULE_URL).catch(
      (error: unknown) => {
        studioPromise = null;
        throw error;
      }
    );
  }
  return studioPromise;
}

let toolkitPromise: Promise<PdfToolkit> | null = null;

/** The wasm is fetched + compiled once and shared by every operation. */
export function getToolkit(): Promise<PdfToolkit> {
  if (!toolkitPromise) {
    toolkitPromise = loadStudio()
      .then((studio) => studio.createPdfToolkit())
      .catch((error: unknown) => {
        // Do not cache a failed initialisation, or the worker is bricked.
        toolkitPromise = null;
        throw error;
      });
  }
  return toolkitPromise;
}

/** True when the document needs a password before qpdf will touch it. */
export async function isPasswordProtected(bytes: Uint8Array): Promise<boolean> {
  const pdf = await getToolkit();
  return pdf.requiresPassword(bytes);
}

export async function isEncrypted(bytes: Uint8Array): Promise<boolean> {
  const pdf = await getToolkit();
  return pdf.isEncrypted(bytes);
}

export async function getInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const pdf = await getToolkit();
  return pdf.getInfo(bytes);
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const pdf = await getToolkit();
  return pdf.pageCount(bytes);
}

/** Copy a 1-indexed page selection out into its own document. */
export async function extractPages(
  bytes: Uint8Array,
  pages: number
): Promise<Uint8Array> {
  const pdf = await getToolkit();
  return pdf.extractPages(bytes, { pages });
}

/**
 * Rebuild a damaged cross-reference table and recover what qpdf can.
 *
 * Second strategy when qpdf's own recovery gives up (its scanner needs the
 * `trailer` keyword, which a truncation can cut away): pdf-lib reparses the
 * intact object body without needing the original xref/trailer and writes a
 * fresh document. Only when both strategies fail is the qpdf error surfaced.
 */
export async function repair(bytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await getToolkit();
  try {
    return await pdf.repair(bytes);
  } catch (qpdfError) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
        updateMetadata: false,
      });
      if (doc.getPageCount() > 0) return await doc.save();
    } catch {
      // Fall through and report the primary (qpdf) failure honestly.
    }
    throw qpdfError;
  }
}

/** Restructure for byte-range streaming ("fast web view"). */
export async function linearize(bytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await getToolkit();
  return pdf.linearize(bytes);
}

/**
 * Validate structure by re-inspecting the file after a transform: a document
 * that qpdf re-wrote must still expose a page count and a PDF version.
 */
export async function validateOutput(
  bytes: Uint8Array
): Promise<{ ok: boolean; pageCount: number; pdfVersion: string }> {
  const info = await getInfo(bytes);
  return {
    ok: info.pageCount > 0 && Boolean(info.pdfVersion),
    pageCount: info.pageCount,
    pdfVersion: info.pdfVersion,
  };
}

/**
 * Bake annotation and form-field appearances into page content.
 *
 * This is the one operation where pdfstudio genuinely beats pdf-lib: pdf-lib's
 * `form.flatten()` only touches AcroForm fields and leaves highlights, notes
 * and stamps as live annotations.
 */
export async function flatten(
  bytes: Uint8Array,
  options: FlattenOptions
): Promise<Uint8Array> {
  const pdf = await getToolkit();
  // qpdf bakes form fields and annotations in one pass; "print" keeps
  // screen-only annotations (e.g. widgets) out where the caller asked for
  // forms only.
  const mode: StudioFlattenOptions["annotations"] =
    options.forms && !options.annotations ? "print" : "all";
  return pdf.flatten(bytes, { annotations: mode });
}

/**
 * Lossless structural optimisation: recompress streams and pack objects into
 * object streams. Image data is never resampled, so this is safe for any PDF.
 *
 * Note this can legitimately return a *larger* file -- an already-optimised
 * document has nothing left to gain and object-stream packing adds a small
 * fixed overhead. Callers must compare sizes and keep the smaller result.
 */
export async function compressLossless(
  bytes: Uint8Array,
  options: { compressionLevel?: number; objectStreams?: boolean } = {}
): Promise<Uint8Array> {
  const pdf = await getToolkit();
  return pdf.compress(bytes, {
    compressionLevel: options.compressionLevel ?? 9,
    objectStreams: options.objectStreams ?? true,
  });
}

/** Strip the document information dictionary (author, title, producer, dates). */
export async function stripMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await getToolkit();
  return pdf.raw([bytes], ["--remove-metadata", "--", "$in0", "$out"]);
}

export async function listAttachments(
  bytes: Uint8Array
): Promise<{ name: string; filename?: string }[]> {
  const pdf = await getToolkit();
  return pdf.listAttachments(bytes);
}

/**
 * Remove every embedded file.
 *
 * qpdf has no "drop all attachments" flag, so this lists then removes one at a
 * time. A missing name is not an error: two attachments can share a name
 * across nested trees, and removing twice should be a no-op rather than a
 * failure.
 */
export async function removeAllAttachments(
  bytes: Uint8Array
): Promise<Uint8Array> {
  let current = bytes;

  for (let pass = 0; pass < 10; pass++) {
    const attachments = await listAttachments(current);
    if (attachments.length === 0) break;

    let removedAny = false;
    const pdf = await getToolkit();
    for (const attachment of attachments) {
      try {
        current = await pdf.removeAttachment(current, { name: attachment.name });
        removedAny = true;
      } catch {
        // Leave this one; keep processing the rest.
      }
    }
    // Bail out rather than loop forever on a document qpdf cannot clean.
    if (!removedAny) break;
  }

  return current;
}

export async function mergePdfs(
  sources: ReadonlyArray<Uint8Array>
): Promise<Uint8Array> {
  const pdf = await getToolkit();
  return pdf.merge(sources.map((data) => ({ data })));
}

/** Rasterize a set of JPEG pages into a PDF at the DPI they were rendered at. */
export async function jpegPagesToPdf(
  pages: Uint8Array[],
  dpi: number
): Promise<Uint8Array> {
  const studio = await loadStudio();
  return studio.imagesToPdf(pages, { dpi });
}

/** Translate a raw engine failure into an operator-friendly sentence. */
export function describeStudioError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (message.includes("password") || message.includes("encrypt")) {
    return "This document is password-protected. Unlock it in the original app first, then run this tool.";
  }
  if (message.includes("damaged") || message.includes("corrupt")) {
    return "The file is damaged beyond what this engine can reconstruct — recovery is honestly reported as failed rather than producing a placebo download.";
  }
  if (message.includes("memory") || message.includes("allocation")) {
    return "The browser ran out of memory. Try a smaller file or close other tabs.";
  }
  return raw || "The PDF engine failed for an unknown reason.";
}
