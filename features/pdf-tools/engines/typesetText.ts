import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import {
  FONT_FILES,
  HEADER_FOOTER_HEIGHT,
  MARGIN_POINTS,
  resolvePageDimensions,
  type Orientation,
  type PageSizeId,
} from "./convertShared";
import { embedPdfFont } from "./pdfFonts";
import { paginateLines, wrapText } from "./textWrap";
import type { PdfOutcome } from "./pdfTypes";

/**
 * Plain-text → PDF typesetting. Word wrap, long-word breaking, custom
 * header/footer or page numbers, and honest font-substitution warnings.
 */

export interface TextPageOptions {
  pageSize: PageSizeId;
  orientation: Orientation;
  margin: "none" | "small" | "medium" | "large";
  fontFamily: "sans" | "serif" | "mono";
  fontSize: number;
  lineSpacing: number;
  headerFooter: "none" | "page-number" | "custom";
  customHeader: string;
  customFooter: string;
}

export const DEFAULT_TEXT_OPTIONS: TextPageOptions = {
  pageSize: "a4",
  orientation: "portrait",
  margin: "medium",
  fontFamily: "mono",
  fontSize: 11,
  lineSpacing: 1.4,
  headerFooter: "page-number",
  customHeader: "",
  customFooter: "",
};

export async function buildTextPdf(
  text: string,
  options: TextPageOptions,
  onProgress?: (percent: number, message?: string) => void
): Promise<PdfOutcome> {
  const warnings: string[] = [];
  if (!text.trim()) throw new Error("Add some text before converting");

  const dimensions = resolvePageDimensions(options.pageSize, options.orientation);
  const margin = MARGIN_POINTS[options.margin];
  const headerText =
    options.headerFooter === "custom" ? options.customHeader?.trim() ?? "" : "";
  const footerText =
    options.headerFooter === "custom" ? options.customFooter?.trim() ?? "" : "";
  const pageNumbers = options.headerFooter === "page-number";
  const topMargin = margin + (headerText ? HEADER_FOOTER_HEIGHT : 0);
  const bottomMargin = margin + (footerText || pageNumbers ? HEADER_FOOTER_HEIGHT : 0);
  const contentWidth = dimensions.width - margin * 2;
  const contentHeight = dimensions.height - topMargin - bottomMargin;

  if (contentWidth <= 24 || contentHeight <= 24) {
    throw new Error("The selected margins leave no room for text");
  }

  const pdf = await PDFDocument.create();
  let font: PDFFont;
  try {
    font = await embedPdfFont(pdf, FONT_FILES[options.fontFamily]);
  } catch {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    warnings.push(
      "The bundled text font could not be loaded; Helvetica was used instead."
    );
  }

  const supported = new Set(font.getCharacterSet());
  let replaced = 0;
  let clean = "";
  for (const char of text.replace(/\r\n?/g, "\n")) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\n") {
      clean += "\n";
    } else if (char === "\t") {
      clean += "    ";
    } else if (code < 32 || code === 0xfeff) {
      continue;
    } else if (supported.has(code)) {
      clean += char;
    } else {
      clean += "?";
      replaced += 1;
    }
  }

  if (replaced > 0) {
    warnings.push(
      `${replaced} character${replaced === 1 ? "" : "s"} could not be represented by the selected font and were replaced with "?".`
    );
  }

  onProgress?.(22, "Measuring text");
  const fontSize = Math.max(8, Math.min(24, options.fontSize));
  const lineHeight = fontSize * Math.max(1, options.lineSpacing);
  const measure = (value: string) => font.widthOfTextAtSize(value, fontSize);
  const lines = wrapText(clean, contentWidth, measure);
  const pages = paginateLines(lines, lineHeight, contentHeight);

  onProgress?.(45, "Writing pages");
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pdf.addPage([dimensions.width, dimensions.height]);
    let baseline = dimensions.height - topMargin - fontSize;
    for (const line of pages[pageIndex]) {
      if (line) {
        page.drawText(line, {
          x: margin,
          y: baseline,
          size: fontSize,
          font,
          color: rgb(0.07, 0.09, 0.13),
        });
      }
      baseline -= lineHeight;
    }

    if (headerText) {
      drawCentered(
        page,
        headerText,
        font,
        dimensions.height - topMargin / 2 - 5,
        dimensions.width,
        warnings
      );
    }
    const footer = footerText
      ? footerText
      : pageNumbers
        ? `Page ${pageIndex + 1} of ${pages.length}`
        : "";
    if (footer) {
      drawCentered(
        page,
        footer,
        font,
        bottomMargin / 2 - 4,
        dimensions.width,
        warnings
      );
    }

    onProgress?.(
      45 + Math.round(((pageIndex + 1) / pages.length) * 45),
      `Writing page ${pageIndex + 1} of ${pages.length}`
    );
  }

  onProgress?.(95, "Finalizing PDF");
  return { bytes: await pdf.save(), warnings };
}

function safeText(text: string, font: PDFFont, warnings?: string[]): string {
  const supported = new Set(font.getCharacterSet());
  let replaced = 0;
  let output = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (supported.has(code)) {
      output += char;
    } else {
      output += "?";
      replaced += 1;
    }
  }
  if (replaced > 0) {
    warnings?.push(
      `${replaced} character${replaced === 1 ? "" : "s"} could not be represented by the selected font and were replaced with "?".`
    );
  }
  return output;
}

export function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  y: number,
  pageWidth: number,
  warnings?: string[]
): void {
  if (!text) return;
  const size = 9;
  const safe = safeText(text, font, warnings);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: Math.max(12, (pageWidth - width) / 2),
    y,
    size,
    font,
    color: rgb(0.42, 0.45, 0.5),
  });
}
