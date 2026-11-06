/**
 * Pure page-math helpers shared by the PDF engines and the UI.
 *
 * Free of any `pdf-lib` import so UI components can use them (range parsing,
 * N-up previews) without pulling the PDF engine into the route bundle.
 */

/**
 * Parses a user-entered page range expression such as `"1-3, 5, 7-9"` into
 * zero-based page indices, clamped to `[0, maxPages)`.
 *
 * Malformed segments are skipped rather than throwing, and out-of-order input
 * (`"5,1,3"`) is normalised to ascending order.
 */
export function parsePageRanges(ranges: string, maxPages: number): number[] {
  if (!Number.isFinite(maxPages) || maxPages <= 0) return [];

  const indices: number[] = [];

  for (const part of ranges.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes("-")) {
      const [rawStart, rawEnd, ...rest] = trimmed.split("-");
      // Reject "3-1-9" and negative numbers like "-2" (whose start side is
      // empty), rather than silently coercing them to page 1.
      if (rest.length > 0 || !rawStart.trim() || !rawEnd.trim()) continue;

      const start = Number(rawStart.trim());
      const end = Number(rawEnd.trim());
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

      const from = Math.max(1, Math.min(start, end));
      const to = Math.min(maxPages, Math.max(start, end));
      for (let page = from; page <= to; page++) {
        indices.push(page - 1);
      }
    } else {
      const page = Number(trimmed);
      if (Number.isFinite(page) && page >= 1 && page <= maxPages) {
        indices.push(page - 1);
      }
    }
  }

  return [...new Set(indices)].sort((a, b) => a - b);
}

/** Standard paper sizes in PostScript points. */
export const PAPER_SIZES = {
  a4: { width: 595.28, height: 841.89, label: "A4" },
  letter: { width: 612, height: 792, label: "Letter" },
  legal: { width: 612, height: 1008, label: "Legal" },
  a3: { width: 841.89, height: 1190.55, label: "A3" },
} as const;

export type PaperSizeId = keyof typeof PAPER_SIZES;

export const NUP_LAYOUTS: Record<number, { cols: number; rows: number }> = {
  2: { cols: 2, rows: 1 },
  4: { cols: 2, rows: 2 },
  6: { cols: 3, rows: 2 },
  9: { cols: 3, rows: 3 },
};

export const A4_WIDTH = PAPER_SIZES.a4.width;
export const A4_HEIGHT = PAPER_SIZES.a4.height;

export type NUpOrder = "horizontal" | "vertical";
export type PagesPerSheet = 2 | 4 | 6 | 9;

export interface NUpCell {
  /** Zero-based source page index placed in this cell. */
  pageIndex: number;
  col: number;
  row: number;
}

/**
 * Resolves which cell of the sheet each page lands in.
 *
 * Single source of truth for N-up placement: the engine uses it to draw, and
 * the UI preview uses it to show the resulting grid, so the picture the user
 * sees can never disagree with the PDF they get.
 *
 * `horizontal` fills left-to-right then wraps; `vertical` fills top-to-bottom
 * down each column. For 2-up (a single row) the two are equivalent.
 */
export function computeNUpPlacement(
  pagesPerSheet: PagesPerSheet,
  order: NUpOrder,
  totalPages: number
): NUpCell[] {
  const layout = NUP_LAYOUTS[pagesPerSheet];
  if (!layout) throw new Error(`Unsupported pages-per-sheet value: ${pagesPerSheet}`);

  const { cols, rows } = layout;
  const cells: NUpCell[] = [];

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const i = pageIndex % pagesPerSheet;
    const col = order === "horizontal" ? i % cols : Math.floor(i / rows);
    const row = order === "horizontal" ? Math.floor(i / cols) : i % rows;
    if (col >= cols || row >= rows) continue;
    cells.push({ pageIndex, col, row });
  }

  return cells;
}

/** True when the two page orders produce an identical sheet. */
export function nUpOrderMatters(pagesPerSheet: PagesPerSheet): boolean {
  return NUP_LAYOUTS[pagesPerSheet].rows > 1;
}

/** Millimeters → PostScript points (1 mm = 72/25.4 pt). */
export function mmToPoints(mm: number): number {
  return (mm * 72) / 25.4;
}
