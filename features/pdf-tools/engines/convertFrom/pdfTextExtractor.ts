import type { PDFDocumentProxy } from "pdfjs-dist";
import { SCANNED_PDF_MESSAGE, resolveSelectedPages } from "./convertFromUtils";
import { loadPdfDocument } from "./pdfToImageUtils";

export interface TextLine {
  text: string;
  y: number;
  x: number;
  fontSize: number;
}

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
  charCount: number;
  lineCount: number;
  lines?: TextLine[];
}

export interface ExtractedText {
  text: string;
  pages: ExtractedPageText[];
  emptyPages: number[];
  totalChars: number;
}

interface TextItemLike {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

function itemText(item: TextItemLike): string {
  return typeof item.str === "string" ? item.str : "";
}

function itemX(item: TextItemLike): number {
  return item.transform?.[4] ?? 0;
}

function itemY(item: TextItemLike): number {
  return item.transform?.[5] ?? 0;
}

function itemFontSize(item: TextItemLike): number {
  const height = Math.abs(item.height ?? 0);
  if (height > 0.5) return height;
  const transform = item.transform ?? [];
  const scale = Math.hypot(transform[2] ?? 0, transform[3] ?? 0);
  return scale > 0.5 ? scale : 10;
}

/**
 * Groups positioned text runs into visual lines.
 *
 * `getTextContent()` returns runs in content-stream order, which is not always
 * reading order (especially for multi-column PDFs). Sorting by y then x and
 * clustering with a font-relative tolerance gives stable, readable output
 * without pulling in a layout engine.
 */
export function groupTextItemsIntoLines(items: TextItemLike[]): TextLine[] {
  const usable = items.filter((item) => itemText(item).trim().length > 0);
  const lines: Array<{
    y: number;
    x: number;
    fontSize: number;
    items: Array<{ item: TextItemLike; x: number; width: number }>;
  }> = [];

  for (const item of usable) {
    const y = itemY(item);
    const fontSize = itemFontSize(item);
    const tolerance = Math.max(1.2, fontSize * 0.4);
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= tolerance);
    if (!line) {
      line = { y, x: itemX(item), fontSize, items: [] };
      lines.push(line);
    }
    line.fontSize = Math.max(line.fontSize, fontSize);
    line.items.push({
      item,
      x: itemX(item),
      width: Math.abs(item.width ?? 0),
    });
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const sorted = line.items.sort((a, b) => a.x - b.x);
      let text = "";
      let previousEnd: number | null = null;

      for (const entry of sorted) {
        const value = itemText(entry.item);
        if (previousEnd !== null) {
          const gap = entry.x - previousEnd;
          const needsSpace =
            gap > line.fontSize * 0.18 &&
            !text.endsWith(" ") &&
            !value.startsWith(" ");
          if (needsSpace) text += " ";
        }
        text += value;
        previousEnd = entry.x + entry.width;
      }

      return {
        text: text.replace(/\s+/g, " ").trim(),
        y: line.y,
        x: line.x,
        fontSize: line.fontSize,
      };
    })
    .filter((line) => line.text.length > 0);
}

function joinLines(lines: TextLine[], preserveLineBreaks: boolean): string {
  if (lines.length === 0) return "";
  if (!preserveLineBreaks) return lines.map((line) => line.text).join(" ");

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i].text;
    const next = lines[i + 1]?.text;
    if (next && /[a-z]-$/.test(current) && /^[a-z]/.test(next)) {
      // Rejoin words hyphenated across a visual line break.
      out.push(current.slice(0, -1) + next);
      i++;
      continue;
    }
    out.push(current);
  }
  return out.join("\n");
}

export interface ExtractTextFromDocumentOptions {
  preserveLineBreaks?: boolean;
  onPageProgress?: (completed: number, total: number) => void;
}

export async function extractTextFromDocument(
  pdf: Pick<PDFDocumentProxy, "getPage">,
  pageIndices: number[],
  options: ExtractTextFromDocumentOptions = {}
): Promise<ExtractedText> {
  const preserveLineBreaks = options.preserveLineBreaks ?? true;
  const pages: ExtractedPageText[] = [];
  const emptyPages: number[] = [];

  for (let i = 0; i < pageIndices.length; i++) {
    const pageIndex = pageIndices[i];
    const page = await pdf.getPage(pageIndex + 1);
    let lines: TextLine[] = [];
    try {
      const content = await page.getTextContent();
      lines = groupTextItemsIntoLines(
        content.items as unknown as TextItemLike[]
      );
    } finally {
      page.cleanup();
    }

    const text = joinLines(lines, preserveLineBreaks);
    const charCount = text.replace(/\s/g, "").length;
    if (charCount === 0) emptyPages.push(pageIndex + 1);
    pages.push({
      pageNumber: pageIndex + 1,
      text,
      charCount,
      lineCount: lines.length,
      lines,
    });
    options.onPageProgress?.(i + 1, pageIndices.length);
  }

  const text = pages
    .map((page) => page.text)
    .filter((value) => value.length > 0)
    .join(preserveLineBreaks ? "\n\n" : "\n\n");

  return {
    text,
    pages,
    emptyPages,
    totalChars: pages.reduce((sum, page) => sum + page.charCount, 0),
  };
}

export interface ExtractPdfTextOptions {
  pageRange?: string;
  preserveLineBreaks?: boolean;
  onProgress?: (completed: number, total: number) => void;
}

export async function extractPdfText(
  bytes: Uint8Array,
  options: ExtractPdfTextOptions = {}
): Promise<ExtractedText> {
  const pdf = await loadPdfDocument(bytes);
  try {
    const pageIndices = resolveSelectedPages(
      options.pageRange ?? "all",
      pdf.numPages
    );
    if (pageIndices.length === 0) {
      throw new Error("No pages matched the selected page range");
    }

    const result = await extractTextFromDocument(pdf, pageIndices, {
      preserveLineBreaks: options.preserveLineBreaks,
      onPageProgress: options.onProgress,
    });

    if (result.totalChars === 0) {
      throw new Error(SCANNED_PDF_MESSAGE);
    }

    return result;
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}
