import type { ReamConvertOptions } from "reamkit";
import { parsePageRanges } from "./pageMath";
import {
  HEADER_FOOTER_HEIGHT,
  MARGIN_POINTS,
  resolvePageDimensions,
  vendoredFontFetch,
  type PageSizeId,
  type Orientation,
} from "./convertShared";
import type { PdfOutcome, PhaseReporter } from "./pdfTypes";

/**
 * Office → PDF conversion (Word .docx, Excel .xlsx, PowerPoint .pptx)
 * via reamkit's WASM parsers. Fonts are served from the vendored /fonts
 * files (see convertShared.VENDORED_FONT_PATHS) so conversion never
 * touches the network.
 */

export type OfficeTool = "word" | "excel" | "powerpoint";

export interface WordOptions {
  pageSize: PageSizeId;
  orientation: Orientation;
  margin: keyof typeof MARGIN_POINTS;
  preserveHeadersFooters: boolean;
  includeComments: boolean;
}

export interface ExcelOptions {
  pageSize: PageSizeId;
  orientation: Orientation;
  sheets: string[];
  includeGridlines: boolean;
  fitToWidth: boolean;
  includeSheetNames: boolean;
}

export interface PowerPointOptions {
  pageSize: Exclude<PageSizeId, "auto">;
  slideRange: string;
}

/** Ream's mutable flow tree, narrowed to the fields we may delete. */
interface MutableFlow {
  comments?: unknown;
  headersFooters?: unknown;
  sections?: Array<{
    properties?: {
      pageSize?: {
        width: number;
        height: number;
        orientation?: "portrait" | "landscape";
      };
    };
  }>;
  section?: {
    pageSize?: {
      width: number;
      height: number;
      orientation?: "portrait" | "landscape";
    };
  };
}

interface MutableSheet {
  name: string;
  hidden?: boolean;
  grid: {
    printOptions?: { gridLines?: boolean };
    fitToPage?: boolean;
    pageSetup?: {
      fitToWidth?: number;
      fitToHeight?: number;
      orientation?: "portrait" | "landscape" | "default";
    };
    headerFooter?: { oddHeader?: string; oddFooter?: string };
  };
}

interface MutableSheetDoc {
  sheets: MutableSheet[];
}

function addLossWarnings(warnings: string[], losses: readonly string[]): void {
  const seen = new Set(warnings);
  for (const loss of losses) {
    if (seen.has(loss)) continue;
    seen.add(loss);
    warnings.push(loss);
    if (warnings.length >= 20) {
      warnings.push("Further conversion notes were omitted.");
      return;
    }
  }
}

function escapeSheetHeader(name: string): string {
  return name.replace(/&/g, "&&");
}

function wordRenderOptions(
  options: WordOptions,
  sourceSize?: { width: number; height: number }
): { pageWidth?: number; pageHeight?: number } {
  if (options.pageSize === "auto" && options.orientation === "auto") return {};
  const orientation =
    options.orientation === "auto"
      ? sourceSize && sourceSize.width > sourceSize.height
        ? "landscape"
        : "portrait"
      : options.orientation;
  const dimensions = resolvePageDimensions(options.pageSize, orientation, sourceSize);
  return { pageWidth: dimensions.width, pageHeight: dimensions.height };
}

function excelRenderOptions(
  options: ExcelOptions,
  sheets: MutableSheet[]
): { pageWidth?: number; pageHeight?: number } {
  const sourceOrientation =
    sheets.find((sheet) => !sheet.hidden)?.grid.pageSetup?.orientation ===
    "landscape"
      ? "landscape"
      : "portrait";

  if (options.pageSize === "auto" && options.orientation === "auto") return {};

  const orientation =
    options.orientation === "auto" ? sourceOrientation : options.orientation;
  const dimensions = resolvePageDimensions(
    options.pageSize === "auto" ? "a4" : options.pageSize,
    orientation
  );
  return { pageWidth: dimensions.width, pageHeight: dimensions.height };
}

function powerPointRenderOptions(
  options: PowerPointOptions
): { pageWidth?: number; pageHeight?: number } {
  const dimensions = resolvePageDimensions(options.pageSize, "landscape");
  return { pageWidth: dimensions.width, pageHeight: dimensions.height };
}

async function extractSlideRange(
  bytes: Uint8Array,
  range: string
): Promise<{ bytes: Uint8Array; warning?: string }> {
  if (!range.trim() || /^all$/i.test(range.trim())) return { bytes };

  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(bytes);
  const total = source.getPageCount();
  const indices = parsePageRanges(range, total);

  if (indices.length === 0) {
    throw new Error(
      `No slides match "${range}". The presentation has ${total} slide${total === 1 ? "" : "s"}.`
    );
  }
  if (indices.length === total) return { bytes };

  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, indices);
  pages.forEach((page) => output.addPage(page));
  return {
    bytes: await output.save(),
    warning: `Included ${indices.length} of ${total} slides.`,
  };
}

/** Header/footer spacing helpers shared with the text converters. */
export function headerFooterMargins(
  margin: keyof typeof MARGIN_POINTS,
  headerText: string,
  footerText: string,
  pageNumbers: boolean
): { topMarginPt: number; bottomMarginPt: number } {
  const marginPt = MARGIN_POINTS[margin];
  return {
    topMarginPt: marginPt + (headerText ? HEADER_FOOTER_HEIGHT : 0),
    bottomMarginPt: marginPt + (footerText || pageNumbers ? HEADER_FOOTER_HEIGHT : 0),
  };
}

export interface OfficeJob {
  tool: OfficeTool;
  bytes: Uint8Array;
  fileName: string;
  options: WordOptions | ExcelOptions | PowerPointOptions;
}

export async function buildOfficePdf(
  job: OfficeJob,
  onProgress?: PhaseReporter,
  onSimpleProgress?: (percent: number, message?: string) => void
): Promise<PdfOutcome> {
  const report = onProgress
    ? (phase: Parameters<PhaseReporter>[0]["phase"], percent: number, message?: string) =>
        onProgress({ phase, percent, message })
    : onSimpleProgress
      ? (phase: string, percent: number, message?: string) => {
          void phase;
          onSimpleProgress(percent, message);
        }
      : undefined;

  report?.("reading", 8, "Reading document");
  const { Ream, formatLoss } = await import("reamkit");
  const doc = Ream.parse(job.bytes);
  const warnings: string[] = [];

  let sheets: MutableSheet[] = [];
  if (job.tool === "word") {
    const flow = doc.flow as unknown as MutableFlow;
    const options = job.options as WordOptions;
    if (!options.preserveHeadersFooters) {
      delete flow.headersFooters;
    }
    if (!options.includeComments) {
      delete flow.comments;
    }
  }

  if (job.tool === "excel") {
    const options = job.options as ExcelOptions;
    const sheetDoc = doc.sheet as unknown as MutableSheetDoc | undefined;
    if (!sheetDoc) {
      throw new Error("This workbook does not contain any readable sheets");
    }

    sheets = sheetDoc.sheets;
    const selected = options.sheets;
    if (selected.length > 0) {
      const available = new Set(sheets.map((sheet) => sheet.name));
      const missing = selected.filter((name) => !available.has(name));
      if (missing.length > 0) {
        throw new Error(`Sheet not found: ${missing.join(", ")}`);
      }
      sheets = sheets.filter((sheet) => selected.includes(sheet.name));
      sheetDoc.sheets = sheets;
    }

    if (sheets.length === 0) {
      throw new Error("Select at least one sheet to convert");
    }

    for (const sheet of sheets) {
      const grid = sheet.grid;
      sheet.grid = {
        ...grid,
        printOptions: {
          ...grid.printOptions,
          gridLines: options.includeGridlines,
        },
        ...(options.fitToWidth
          ? {
              fitToPage: true,
              pageSetup: {
                ...grid.pageSetup,
                fitToWidth: 1,
                fitToHeight: 0,
              },
            }
          : {}),
        ...(options.includeSheetNames
          ? {
              headerFooter: {
                ...grid.headerFooter,
                oddHeader: `&C${escapeSheetHeader(sheet.name)}`,
              },
            }
          : {}),
      };
    }
  }

  let renderDims: { pageWidth?: number; pageHeight?: number } = {};
  if (job.tool === "word") {
    const flow = doc.flow as unknown as MutableFlow;
    const sourceSize =
      flow.sections?.[0]?.properties?.pageSize ?? flow.section?.pageSize;
    renderDims = wordRenderOptions(job.options as WordOptions, sourceSize);
  } else if (job.tool === "excel") {
    renderDims = excelRenderOptions(job.options as ExcelOptions, sheets);
  } else {
    renderDims = powerPointRenderOptions(job.options as PowerPointOptions);
  }

  const renderOptions: ReamConvertOptions = {
    fontFetch: vendoredFontFetch,
    // Spreadsheet grid mutations live on doc.sheet; Ream re-projects that tree
    // only when a file name or reference date is supplied.
    ...(job.tool === "excel" ? { fileName: job.fileName } : {}),
    ...renderDims,
  };

  report?.("rebuilding", 28, "Converting layout");
  const result = await doc.convertWithReport("pdf", renderOptions);
  report?.("writing", 90, "Finalizing PDF");

  let bytes = result.bytes;
  const losses = result.losses.map((loss) => formatLoss(loss));
  addLossWarnings(warnings, losses);

  if (job.tool === "powerpoint") {
    const ranged = await extractSlideRange(
      bytes,
      (job.options as PowerPointOptions).slideRange
    );
    bytes = ranged.bytes;
    if (ranged.warning) warnings.push(ranged.warning);
  }

  if (job.tool === "excel" && (job.options as ExcelOptions).includeSheetNames) {
    warnings.push("Sheet names were added as centered print headers.");
  }

  report?.("done", 100, "Done");
  return { bytes, warnings };
}

/** Lists the readable sheet names of a workbook so the UI can render pickers. */
export async function listWorkbookSheets(bytes: Uint8Array): Promise<string[]> {
  const { Ream } = await import("reamkit");
  const doc = Ream.parse(bytes);
  const sheetDoc = doc.sheet as unknown as MutableSheetDoc | undefined;
  if (!sheetDoc) {
    throw new Error("This workbook does not contain any readable sheets");
  }
  return sheetDoc.sheets.map((sheet) => sheet.name);
}
