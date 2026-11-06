import type { ExtractedTable } from "./convertFromTypes";
import { SCANNED_PDF_MESSAGE } from "./convertFromUtils";

/**
 * Minimal surface of the wasm-bindgen glue module.
 *
 * The high-level `@kreuzberg/wasm` entry point bundles a ~91 MB `.wasm` file
 * and resolves it through computed dynamic imports, which webpack cannot
 * analyse. We load the published glue module from `/kreuzberg/` instead (the
 * wasm-bindgen glue fetches its sibling `.wasm` file itself), keeping the
 * module out of the JS bundle and off the main thread.
 */
interface KreuzbergGlue {
  extractBytes(
    data: Uint8Array,
    mimeType: string,
    config?: unknown
  ): Promise<unknown>;
  initialize_pdfium_render?(
    pdfiumWasmModule: unknown,
    localWasmModule: unknown,
    debug: boolean
  ): boolean;
}

interface PdfiumModule {
  default?: () => Promise<unknown>;
}

export interface ExcelExtractionDeps {
  loadKreuzberg?: () => Promise<KreuzbergGlue>;
}

export interface ExcelExtractionOutput {
  tables: ExtractedTable[];
  warnings: string[];
  pageCount?: number;
  ocrUsed: boolean;
}

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r\n/g, "\n").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringRows(value: unknown): string[][] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.map((row) =>
    (Array.isArray(row) ? row : [row]).map(cleanCell)
  );
}

function parseMarkdownTable(markdown: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || !line.endsWith("|")) continue;
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.replace(/\\\|/g, "|").trim());
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

function normaliseTable(table: unknown, index: number): ExtractedTable | null {
  const record = asRecord(table);
  if (!record) return null;

  let headers = Array.isArray(record.headers)
    ? record.headers.map(cleanCell).filter((cell) => cell.length > 0)
    : [];
  let rows =
    stringRows(record.cells) ??
    stringRows(record.rows) ??
    (typeof record.markdown === "string"
      ? parseMarkdownTable(record.markdown)
      : []);

  rows = rows.filter((row) => row.some((cell) => cell.length > 0));
  if (rows.length === 0) return null;

  if (headers.length > 0) {
    const first = rows[0] ?? [];
    const duplicate =
      first.length === headers.length &&
      first.every((cell, cellIndex) => cell === headers[cellIndex]);
    if (duplicate) rows = rows.slice(1);
  } else if (rows.length > 1) {
    headers = rows[0];
    rows = rows.slice(1);
  }

  if (rows.length === 0) return null;

  const pageNumberRaw = record.pageNumber ?? record.page_number;

  return {
    id: `table-${index + 1}`,
    pageNumber: typeof pageNumberRaw === "number" ? pageNumberRaw : undefined,
    headers: headers.length > 0 ? headers : undefined,
    rows,
  };
}

function metadataPageCount(metadata: unknown): number | undefined {
  const record = asRecord(metadata);
  if (!record) return undefined;
  const value = record.pageCount ?? record.page_count;
  return typeof value === "number" ? value : undefined;
}

function metadataText(result: Record<string, unknown>): string {
  return typeof result.content === "string" ? result.content : "";
}

/**
 * Loads the Kreuzberg glue and its PDFium renderer from stable public paths.
 * The `webpackIgnore` comments keep these as native imports so the ~92 MB of
 * wasm stays out of the JS bundle and is served as static assets.
 *
 * `@kreuzberg/wasm`'s high-level entry point performs the same two steps, but
 * its computed dynamic imports cannot be analysed by webpack. Importing the
 * published glue directly keeps the bundle intact while still initialising
 * PDFium, which is required for PDF (as opposed to image/Office) extraction.
 */
const KREUZBERG_GLUE_URL = "/kreuzberg/kreuzberg_wasm.js";
const PDFIUM_URL = "/kreuzberg/pdfium.js";

let kreuzbergPromise: Promise<KreuzbergGlue> | null = null;

function loadKreuzbergGlue(): Promise<KreuzbergGlue> {
  if (kreuzbergPromise) return kreuzbergPromise;

  kreuzbergPromise = (async () => {
    const [glueModule, pdfiumModule] = (await Promise.all([
      import(/* webpackIgnore: true */ KREUZBERG_GLUE_URL),
      import(/* webpackIgnore: true */ PDFIUM_URL),
    ])) as [KreuzbergGlue, PdfiumModule];

    if (
      typeof pdfiumModule.default !== "function" ||
      typeof glueModule.initialize_pdfium_render !== "function"
    ) {
      throw new Error(
        "The local table engine is missing its PDF renderer. Rebuild the app so the PDFium assets are copied to /public/kreuzberg."
      );
    }

    const pdfium = await pdfiumModule.default();
    const initialised = glueModule.initialize_pdfium_render(
      pdfium,
      glueModule,
      false
    );
    if (!initialised) {
      console.warn("[convert-from] PDFium initialization returned false");
    }

    return glueModule;
  })().catch((error) => {
    // Allow a retry after a transient network/wasm failure.
    kreuzbergPromise = null;
    throw error;
  });

  return kreuzbergPromise;
}

/**
 * Extracts tables from a PDF with Kreuzberg's WASM build.
 *
 * The engine is loaded lazily on first use. OCR is intentionally not offered
 * here: the wasm OCR path needs a separate language pack and is unreliable in
 * workers. Scanned documents are rejected with a pointer to the OCR PDF tool.
 */
export async function extractTablesFromPdf(
  bytes: Uint8Array,
  onProgress?: (progress: {
    phase: string;
    percent: number;
    message?: string;
  }) => void,
  deps: ExcelExtractionDeps = {}
): Promise<ExcelExtractionOutput> {
  const loadKreuzberg = deps.loadKreuzberg ?? loadKreuzbergGlue;

  onProgress?.({
    phase: "preparing",
    percent: 8,
    message: "Loading local table engine (one-time download)",
  });

  let kreuzberg: KreuzbergGlue;
  try {
    kreuzberg = await loadKreuzberg();
  } catch (error) {
    throw new Error(
      `The local table engine could not be loaded: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  onProgress?.({
    phase: "extracting",
    percent: 45,
    message: "Detecting tables",
  });

  let rawResult: unknown;
  try {
    rawResult = await kreuzberg.extractBytes(bytes, "application/pdf", {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no text|scanned|ocr|empty/i.test(message)) {
      throw new Error(SCANNED_PDF_MESSAGE);
    }
    throw error;
  }

  const result = asRecord(rawResult);
  if (!result) {
    throw new Error("The table engine returned an unexpected result");
  }

  onProgress?.({
    phase: "finalizing",
    percent: 88,
    message: "Normalising extracted tables",
  });

  const rawTables = Array.isArray(result.tables) ? result.tables : [];
  const tables = rawTables
    .map((table, index) => normaliseTable(table, index))
    .filter((table): table is ExtractedTable => table !== null);

  if (tables.length === 0) {
    const text = metadataText(result).trim();
    if (text.length < 20) throw new Error(SCANNED_PDF_MESSAGE);
    throw new Error(
      "No tables were detected in this PDF. Only tabular content can be exported."
    );
  }

  const warnings: string[] = [];
  if (tables.some((table) => table.rows.length > 500)) {
    warnings.push(
      "One or more tables are very large. The XLSX export may take a moment to open."
    );
  }

  const pageCount = metadataPageCount(result.metadata);

  return {
    tables,
    warnings,
    pageCount,
    ocrUsed: false,
  };
}
