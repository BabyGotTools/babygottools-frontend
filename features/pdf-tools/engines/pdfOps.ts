import { PDFDocument, degrees, rgb } from "pdf-lib";
import {
  A4_HEIGHT,
  A4_WIDTH,
  NUP_LAYOUTS,
  computeNUpPlacement,
  parsePageRanges,
  type NUpOrder,
  type PagesPerSheet,
} from "./pageMath";

/**
 * Every pdf-lib page operation in one dispatcher, shared by the Web Worker
 * message handler and the main-thread fallback so the two cannot drift apart.
 * Ported from the proven client-side engine (pdf intelligence platform).
 */

export type OperationType =
  | "merge"
  | "split"
  | "organize"
  | "extract"
  | "delete"
  | "rotate"
  | "nup"
  | "addblank"
  | "insert";

export type ProgressReporter = (progress: number) => void;

export interface MergePayload {
  files: ArrayBuffer[];
}
export interface SplitPayload {
  file: ArrayBuffer;
  ranges: string;
}
export interface OrganizePayload {
  file: ArrayBuffer;
  /** Source page indices, in output order. */
  order: number[];
  /**
   * Clockwise degrees to add per *source* page index. Rotation and reordering
   * happen in a single pass so a requested order is never discarded.
   */
  rotations?: Record<number, number>;
}
export interface PageSelectionPayload {
  file: ArrayBuffer;
  selectedPages: number[];
}
export interface RotatePayload {
  file: ArrayBuffer;
  /**
   * Clockwise degrees to add per zero-based page index. Lets a single run
   * apply different angles to different pages, and lets accumulated rotations
   * (e.g. 3x 90 degrees) be sent as one absolute delta.
   */
  rotations: Record<number, number>;
}
export interface NUpPayload {
  file: ArrayBuffer;
  pagesPerSheet: PagesPerSheet;
  orientation: "portrait" | "landscape";
  order: NUpOrder;
  /** Sheet margins in points (applied symmetrically). */
  marginPt?: number;
  /** Gutter between cells in points. */
  gutterPt?: number;
  /** Draw hairline frames around placed pages. */
  frames?: boolean;
}
export interface AddBlankPayload {
  file: ArrayBuffer;
  insertPositions: number[];
  /** Force a paper size instead of A4 ("match" uses the neighbouring page). */
  pageSize?: { width: number; height: number } | "match";
}
export interface InsertPayload {
  baseFile: ArrayBuffer;
  insertFile: ArrayBuffer;
  insertPosition: number;
}

export type OperationPayloadMap = {
  merge: MergePayload;
  split: SplitPayload;
  organize: OrganizePayload;
  extract: PageSelectionPayload;
  delete: PageSelectionPayload;
  rotate: RotatePayload;
  nup: NUpPayload;
  addblank: AddBlankPayload;
  insert: InsertPayload;
};

export interface WorkerMessage<K extends OperationType = OperationType> {
  type: K;
  payload: OperationPayloadMap[K];
  id: string;
}

export interface WorkerResponse {
  id: string;
  type: OperationType;
  success: boolean;
  data?: Uint8Array;
  error?: string;
  progress?: number;
}

/**
 * Wraps a caller-supplied progress reporter so that it only fires when the
 * rounded percentage actually changes. Without this, a 1000-page document
 * posts 1000 messages, most of which carry the same value.
 */
function createThrottledReporter(
  onProgress: ProgressReporter | undefined
): ProgressReporter | undefined {
  if (!onProgress) return undefined;
  let last = -1;
  return (progress: number) => {
    const rounded = Math.min(100, Math.max(0, Math.round(progress)));
    if (rounded !== last) {
      last = rounded;
      onProgress(rounded);
    }
  };
}

export async function mergePdfs(
  files: ArrayBuffer[],
  onProgress?: ProgressReporter
): Promise<Uint8Array> {
  if (files.length === 0) throw new Error("No files supplied to merge");

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const pdf = await PDFDocument.load(files[i]);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
    onProgress?.(((i + 1) / files.length) * 100);
  }

  return mergedPdf.save();
}

export async function splitPdf(
  file: ArrayBuffer,
  ranges: string,
  onProgress?: ProgressReporter
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(file);
  const pageIndices = parsePageRanges(ranges, pdf.getPageCount());
  if (pageIndices.length === 0) {
    throw new Error("No pages matched the supplied ranges");
  }

  const newPdf = await PDFDocument.create();
  const copied = await newPdf.copyPages(pdf, pageIndices);
  copied.forEach((page) => newPdf.addPage(page));

  onProgress?.(100);
  return newPdf.save();
}

/**
 * Reorders, rotates and/or deletes pages in a single pass.
 *
 * `order` holds *source* page indices; deletions are expressed by simply
 * omitting an index, so deleting a page never shifts the remaining indices
 * the way remapping an array position would.
 */
export async function organizePdf(
  file: ArrayBuffer,
  order: number[],
  rotations: Record<number, number> = {},
  onProgress?: ProgressReporter
): Promise<Uint8Array> {
  if (order.length === 0) throw new Error("No pages left to write");

  const pdf = await PDFDocument.load(file);
  const totalPages = pdf.getPageCount();

  const valid = [...new Set(order)].filter(
    (index) => Number.isInteger(index) && index >= 0 && index < totalPages
  );

  if (valid.length === 0) throw new Error("Page order contained no valid pages");

  const newPdf = await PDFDocument.create();

  for (let i = 0; i < valid.length; i++) {
    const sourceIndex = valid[i];
    const [page] = await newPdf.copyPages(pdf, [sourceIndex]);

    const delta = rotations[sourceIndex];
    if (delta !== undefined && Number.isFinite(delta) && delta % 360 !== 0) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((((current + delta) % 360) + 360) % 360));
    }

    newPdf.addPage(page);
    onProgress?.(((i + 1) / valid.length) * 100);
  }

  return newPdf.save();
}

export async function extractPages(
  file: ArrayBuffer,
  selectedPages: number[],
  onProgress?: ProgressReporter
): Promise<Uint8Array> {
  const pages = normaliseSelection(selectedPages);
  if (pages.length === 0) throw new Error("No pages selected to extract");

  const pdf = await PDFDocument.load(file);
  const newPdf = await PDFDocument.create();

  const copied = await newPdf.copyPages(pdf, pages);
  copied.forEach((page) => newPdf.addPage(page));

  onProgress?.(100);
  return newPdf.save();
}

export async function deletePages(
  file: ArrayBuffer,
  selectedPages: number[],
  onProgress?: ProgressReporter
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(file);
  const totalPages = pdf.getPageCount();
  const deleteSet = new Set(selectedPages);

  const keep = Array.from({ length: totalPages }, (_, i) => i).filter(
    (i) => !deleteSet.has(i)
  );

  if (keep.length === 0) {
    throw new Error("Cannot delete every page in the document");
  }

  const newPdf = await PDFDocument.create();
  for (let i = 0; i < keep.length; i++) {
    const [page] = await newPdf.copyPages(pdf, [keep[i]]);
    newPdf.addPage(page);
    onProgress?.(((i + 1) / keep.length) * 100);
  }

  return newPdf.save();
}

/**
 * Applies a per-page clockwise rotation delta. Deltas are added to whatever
 * `/Rotate` the source page already carries, so repeated applications
 * accumulate correctly and a delta of 0 is a no-op.
 */
export async function rotatePages(
  file: ArrayBuffer,
  rotations: Record<number, number>,
  onProgress?: ProgressReporter
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(file);
  const totalPages = pdf.getPageCount();

  const deltas = Object.entries(rotations)
    .map(([index, deg]) => ({ index: Number(index), degrees: deg }))
    .filter(
      ({ index, degrees }) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < totalPages &&
        Number.isFinite(degrees) &&
        degrees % 360 !== 0
    );

  if (deltas.length === 0) throw new Error("No pages need rotating");

  const deltaByPage = new Map(deltas.map(({ index, degrees }) => [index, degrees]));

  for (let i = 0; i < totalPages; i++) {
    const delta = deltaByPage.get(i);
    if (delta !== undefined) {
      const page = pdf.getPage(i);
      const current = page.getRotation().angle;
      page.setRotation(degrees((((current + delta) % 360) + 360) % 360));
    }
    onProgress?.(((i + 1) / totalPages) * 100);
  }

  return pdf.save();
}

export async function nUpPdf(
  file: ArrayBuffer,
  pagesPerSheet: PagesPerSheet,
  orientation: "portrait" | "landscape",
  order: NUpOrder,
  onProgress?: ProgressReporter,
  options: { marginPt?: number; gutterPt?: number; frames?: boolean } = {}
): Promise<Uint8Array> {
  const layout = NUP_LAYOUTS[pagesPerSheet];
  if (!layout) throw new Error(`Unsupported pages-per-sheet value: ${pagesPerSheet}`);

  const pdf = await PDFDocument.load(file);
  const totalPages = pdf.getPageCount();
  if (totalPages === 0) throw new Error("Document has no pages");

  // Placement comes from the shared resolver so the in-app preview and the
  // generated PDF are guaranteed to agree.
  const placement = computeNUpPlacement(pagesPerSheet, order, totalPages);

  const newPdf = await PDFDocument.create();
  const { cols, rows } = layout;

  const margin = Math.max(0, options.marginPt ?? 0);
  const gutter = Math.max(0, options.gutterPt ?? 0);

  const pageWidth = orientation === "landscape" ? A4_HEIGHT : A4_WIDTH;
  const pageHeight = orientation === "landscape" ? A4_WIDTH : A4_HEIGHT;
  const innerWidth = pageWidth - margin * 2;
  const innerHeight = pageHeight - margin * 2;
  const cellWidth = (innerWidth - gutter * (cols - 1)) / cols;
  const cellHeight = (innerHeight - gutter * (rows - 1)) / rows;

  for (let sheetStart = 0; sheetStart < totalPages; sheetStart += pagesPerSheet) {
    const newPage = newPdf.addPage([pageWidth, pageHeight]);

    for (const cell of placement) {
      if (cell.pageIndex < sheetStart || cell.pageIndex >= sheetStart + pagesPerSheet) {
        continue;
      }
      const pageIndex = cell.pageIndex;
      const [sourcePage] = await newPdf.copyPages(pdf, [pageIndex]);

      // pdf-lib's `drawPage` ignores the source page's /Rotate, so capture it,
      // clear it, and re-apply it explicitly via the `rotate` draw option.
      const sourceRotation = ((sourcePage.getRotation().angle % 360) + 360) % 360;
      sourcePage.setRotation(degrees(0));

      // pdf-lib cannot embed a page with no content stream, and its internal
      // __awaiter wrapper does not surface that as a rejected promise, so the
      // check has to happen up front rather than in a catch block.
      if (sourcePage.node.Contents() === undefined) {
        onProgress?.(((pageIndex + 1) / totalPages) * 100);
        continue;
      }

      const embeddedPage = await newPdf.embedPage(sourcePage);
      const { width, height } = sourcePage.getSize();

      const isQuarterTurn = sourceRotation === 90 || sourceRotation === 270;
      const visualWidth = isQuarterTurn ? height : width;
      const visualHeight = isQuarterTurn ? width : height;

      const scale = Math.min(cellWidth / visualWidth, cellHeight / visualHeight);

      const cellX = margin + cell.col * (cellWidth + gutter);
      const cellY = pageHeight - margin - (cell.row + 1) * cellHeight - cell.row * gutter;

      // `drawPage` rotates about the (x, y) anchor, so anchoring at the visual
      // centre of the cell keeps the rotated page centred in that cell.
      const anchorX = cellX + cellWidth / 2;
      const anchorY = cellY + cellHeight / 2;

      newPage.drawPage(embeddedPage, {
        x: anchorX - (width * scale) / 2,
        y: anchorY - (height * scale) / 2,
        xScale: scale,
        yScale: scale,
        rotate: degrees(sourceRotation),
      });

      if (options.frames) {
        newPage.drawRectangle({
          x: cellX,
          y: cellY,
          width: cellWidth,
          height: cellHeight,
          borderColor: rgb(0.78, 0.78, 0.78),
          borderWidth: 0.5,
          opacity: 0,
          borderOpacity: 1,
        });
      }

      onProgress?.(((pageIndex + 1) / totalPages) * 100);
    }
  }

  return newPdf.save();
}

export async function addBlankPage(
  file: ArrayBuffer,
  insertPositions: number[],
  onProgress?: ProgressReporter,
  pageSize: { width: number; height: number } | "match" = "match"
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(file);
  const totalPages = pdf.getPageCount();

  const positions = [...new Set(insertPositions)].sort((a, b) => a - b);
  if (positions.length === 0) throw new Error("No blank page positions supplied");

  // Insert back-to-front so earlier indices stay valid as the document grows.
  for (let i = positions.length - 1; i >= 0; i--) {
    const pos = Math.min(Math.max(positions[i], 0), totalPages);
    let size: [number, number];
    if (pageSize === "match") {
      const neighbour = pdf.getPage(Math.min(pos, totalPages - 1));
      const { width, height } = neighbour.getSize();
      size = [width, height];
    } else {
      size = [pageSize.width, pageSize.height];
    }
    pdf.insertPage(pos, size);
    onProgress?.(((positions.length - i) / positions.length) * 100);
  }

  return pdf.save();
}

export async function insertPages(
  baseFile: ArrayBuffer,
  insertFile: ArrayBuffer,
  insertPosition: number,
  onProgress?: ProgressReporter
): Promise<Uint8Array> {
  const basePdf = await PDFDocument.load(baseFile);
  const insertPdf = await PDFDocument.load(insertFile);
  const basePages = basePdf.getPageCount();
  const insertPagesCount = insertPdf.getPageCount();

  if (insertPagesCount === 0) throw new Error("Document to insert has no pages");

  const pos = Math.min(Math.max(0, insertPosition), basePages);

  for (let i = insertPagesCount - 1; i >= 0; i--) {
    const [page] = await basePdf.copyPages(insertPdf, [i]);
    basePdf.insertPage(pos, page);
    onProgress?.(((insertPagesCount - i) / insertPagesCount) * 100);
  }

  return basePdf.save();
}

function normaliseSelection(selectedPages: number[]): number[] {
  return [...new Set(selectedPages)]
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b);
}

/**
 * Single source of truth for operation dispatch, shared by the worker message
 * handler and the main-thread fallback.
 */
export async function runOperation<K extends OperationType>(
  type: K,
  payload: OperationPayloadMap[K],
  onProgress?: ProgressReporter
): Promise<Uint8Array> {
  const report = createThrottledReporter(onProgress);

  switch (type) {
    case "merge":
      return mergePdfs((payload as MergePayload).files, report);
    case "split": {
      const p = payload as SplitPayload;
      return splitPdf(p.file, p.ranges, report);
    }
    case "organize": {
      const p = payload as OrganizePayload;
      return organizePdf(p.file, p.order, p.rotations, report);
    }
    case "extract": {
      const p = payload as PageSelectionPayload;
      return extractPages(p.file, p.selectedPages, report);
    }
    case "delete": {
      const p = payload as PageSelectionPayload;
      return deletePages(p.file, p.selectedPages, report);
    }
    case "rotate": {
      const p = payload as RotatePayload;
      return rotatePages(p.file, p.rotations, report);
    }
    case "nup": {
      const p = payload as NUpPayload;
      return nUpPdf(p.file, p.pagesPerSheet, p.orientation, p.order, report, {
        marginPt: p.marginPt,
        gutterPt: p.gutterPt,
        frames: p.frames,
      });
    }
    case "addblank": {
      const p = payload as AddBlankPayload;
      return addBlankPage(p.file, p.insertPositions, report, p.pageSize);
    }
    case "insert": {
      const p = payload as InsertPayload;
      return insertPages(p.baseFile, p.insertFile, p.insertPosition, report);
    }
    default:
      throw new Error(
        `Unsupported PDF operation: ${(type as string) ?? "unknown"}`
      );
  }
}

/**
 * True only inside a real Worker scope.
 *
 * Checking for `self.postMessage` is not enough: `window` has both
 * `postMessage` and `onmessage`, so that test also passes on the main thread.
 * `importScripts` is absent from module workers, which is exactly the kind
 * this platform uses.
 */
declare const WorkerGlobalScope: (abstract new () => object) | undefined;

function isWorkerScope(): boolean {
  return (
    typeof WorkerGlobalScope !== "undefined" &&
    typeof globalThis !== "undefined" &&
    globalThis instanceof WorkerGlobalScope
  );
}

if (isWorkerScope()) {
  const ctx = globalThis as unknown as {
    postMessage: (message: WorkerResponse) => void;
    onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  };

  ctx.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { type, payload, id } = event.data;

    try {
      const data = await runOperation(
        type,
        payload as OperationPayloadMap[OperationType],
        (progress) => ctx.postMessage({ id, type, success: true, progress })
      );

      ctx.postMessage({ id, type, success: true, data });
    } catch (error) {
      ctx.postMessage({
        id,
        type,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
