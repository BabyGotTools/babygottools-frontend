import { PDFDocument, PDFDict, PDFName } from "pdf-lib";
import * as studio from "./pdfStudio";
import type {
  PdfOutcome,
  SanitizeInspectResult,
  SanitizeOptions,
} from "./pdfTypes";

/**
 * Metadata & active-content sanitizer.
 *
 * Inspection reads the real structures (Info dictionary, XMP Metadata,
 * JavaScript name tree, OpenAction, annotations, attachments). The removal
 * pass is a structural rebuild-copy: pages are copied into a fresh document
 * so every document-level tree (Info, XMP, Names/JavaScript, OpenAction,
 * EmbeddedFiles, AcroForm stub) is dropped by construction, then the chosen
 * page-level structures are cleared explicitly.
 */

const INFO_KEYS = [
  "Title",
  "Author",
  "Subject",
  "Keywords",
  "Creator",
  "Producer",
  "CreationDate",
  "ModDate",
];

export async function inspectPdf(
  bytes: Uint8Array
): Promise<SanitizeInspectResult & { pageCount: number }> {
  const source = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const catalog = source.catalog;
  const infoFields: { label: string; value: string }[] = [];
  const getters: [string, () => string | Date | undefined][] = [
    ["Title", () => source.getTitle()],
    ["Author", () => source.getAuthor()],
    ["Subject", () => source.getSubject()],
    ["Keywords", () => source.getKeywords()],
    ["Creator", () => source.getCreator()],
    ["Producer", () => source.getProducer()],
    ["Created", () => source.getCreationDate()],
    ["Modified", () => source.getModificationDate()],
  ];
  for (const [label, get] of getters) {
    try {
      const value = get();
      const text =
        value instanceof Date ? value.toISOString() : value?.trim() ?? "";
      if (text) infoFields.push({ label, value: text });
    } catch {
      // Field absent — nothing to report.
    }
  }

  const hasXmp = catalog.has(PDFName.of("Metadata"));

  const names = catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  const hasJavaScript = Boolean(
    names?.get(PDFName.of("JavaScript")) ?? catalog.has(PDFName.of("AA"))
  );

  const hasOpenAction = catalog.has(PDFName.of("OpenAction"));

  let annotationCount = 0;
  for (const page of source.getPages()) {
    annotationCount += page.node.Annots()?.size() ?? 0;
  }

  let attachmentNames: string[] = [];
  try {
    const attachments = await studio.listAttachments(bytes);
    attachmentNames = attachments.map((a) => a.name);
  } catch {
    // Inspection is best-effort: encrypted or exotic files still get the
    // pdf-lib findings above.
  }

  return {
    pageCount: source.getPageCount(),
    infoFields,
    hasXmp,
    hasJavaScript,
    hasOpenAction,
    attachmentNames,
    annotationCount,
  };
}

export async function sanitizePdf(
  bytes: Uint8Array,
  options: SanitizeOptions
): Promise<PdfOutcome> {
  const source = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  if (source.isEncrypted) {
    throw new Error(
      "This document is password-protected. Unlock it in the original app first, then sanitize it."
    );
  }

  const warnings: string[] = [];
  const output = await PDFDocument.create();
  const copied = await output.copyPages(
    source,
    source.getPages().map((_, index) => index)
  );
  for (const page of copied) {
    output.addPage(page);
  }

  if (options.annotations) {
    let removed = 0;
    for (const page of output.getPages()) {
      const annots = page.node.Annots();
      if (annots) {
        removed += annots.size();
        page.node.delete(PDFName.of("Annots"));
      }
    }
    if (removed > 0) {
      warnings.push(`Removed ${removed} annotation${removed === 1 ? "" : "s"} (including form widgets).`);
    }
  }

  if (options.javascript) {
    for (const page of output.getPages()) {
      page.node.delete(PDFName.of("AA"));
    }
    warnings.push("Document-level JavaScript and launch actions were dropped by the rebuild.");
  }

  if (options.info) {
    const infoRef = output.context.trailerInfo.Info;
    const infoDict = infoRef
      ? output.context.lookupMaybe(infoRef, PDFDict)
      : undefined;
    if (infoDict) {
      for (const key of INFO_KEYS) infoDict.delete(PDFName.of(key));
    }
    warnings.push("Document information fields were cleared.");
  }

  if (options.xmp) {
    output.catalog.delete(PDFName.of("Metadata"));
  }

  if (options.attachments) {
    const cleaned = await studio.removeAllAttachments(await output.save());
    warnings.push("Embedded file attachments were removed.");
    return { bytes: cleaned, warnings };
  }

  return { bytes: await output.save(), warnings };
}
