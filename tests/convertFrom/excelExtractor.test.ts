/**
 * Ported from the i love pdf project (src/lib/convertFrom/excelExtractor.test.ts)
 * — imports redirected to the ported engine module in features/pdf-tools.
 */
import { describe, expect, it, vi } from "vitest";
import { SCANNED_PDF_MESSAGE } from "@/features/pdf-tools/engines/convertFrom/convertFromUtils";
import { extractTablesFromPdf } from "@/features/pdf-tools/engines/convertFrom/excelExtractor";

function glueWith(result: unknown) {
  return {
    extractBytes: vi.fn(async () => result),
  };
}

describe("extractTablesFromPdf", () => {
  it("normalises cells, headers, markdown tables, and page numbers", async () => {
    const glue = glueWith({
      content: "Some text",
      metadata: { page_count: 3 },
      tables: [
        {
          cells: [
            ["Name", "Amount"],
            ["Alice", "10"],
          ],
          page_number: 2,
        },
        {
          headers: ["H1", "H2"],
          rows: [["a", "b"]],
        },
        {
          markdown: "| X | Y |\n| --- | --- |\n| 1 | 2 |",
        },
        { cells: [] },
        "not a table",
      ],
    });
    const progress = vi.fn();

    const output = await extractTablesFromPdf(
      new Uint8Array([1, 2]),
      progress,
      { loadKreuzberg: async () => glue }
    );

    expect(output.tables).toHaveLength(3);
    expect(output.tables[0]).toEqual({
      id: "table-1",
      pageNumber: 2,
      headers: ["Name", "Amount"],
      rows: [["Alice", "10"]],
    });
    expect(output.tables[1]).toEqual({
      id: "table-2",
      pageNumber: undefined,
      headers: ["H1", "H2"],
      rows: [["a", "b"]],
    });
    expect(output.tables[2]).toEqual({
      id: "table-3",
      pageNumber: undefined,
      headers: ["X", "Y"],
      rows: [["1", "2"]],
    });
    expect(output.pageCount).toBe(3);
    expect(output.ocrUsed).toBe(false);
    expect(glue.extractBytes).toHaveBeenCalledWith(
      new Uint8Array([1, 2]),
      "application/pdf",
      {}
    );
    expect(progress.mock.calls.map(([value]) => value.phase)).toEqual([
      "preparing",
      "extracting",
      "finalizing",
    ]);
  });

  it("does not duplicate a header row returned in cells", async () => {
    const glue = glueWith({
      content: "text",
      tables: [
        {
          headers: ["Name", "Amount"],
          cells: [
            ["Name", "Amount"],
            ["Alice", "10"],
          ],
        },
      ],
    });

    const output = await extractTablesFromPdf(new Uint8Array([1]), undefined, {
      loadKreuzberg: async () => glue,
    });

    expect(output.tables[0].rows).toEqual([["Alice", "10"]]);
  });

  it("rejects a PDF with no text and no tables as scanned", async () => {
    const glue = glueWith({ content: "   ", tables: [] });

    await expect(
      extractTablesFromPdf(new Uint8Array([1]), undefined, {
        loadKreuzberg: async () => glue,
      })
    ).rejects.toThrow(SCANNED_PDF_MESSAGE);
  });

  it("explains when a text PDF simply has no tables", async () => {
    const glue = glueWith({
      content:
        "This is a long paragraph of readable text without any tabular content.",
      tables: [],
    });

    await expect(
      extractTablesFromPdf(new Uint8Array([1]), undefined, {
        loadKreuzberg: async () => glue,
      })
    ).rejects.toThrow("No tables were detected");
  });

  it("maps extraction errors that mention scanned content", async () => {
    const glue = {
      extractBytes: vi.fn(async () => {
        throw new Error("document appears to be scanned");
      }),
    };

    await expect(
      extractTablesFromPdf(new Uint8Array([1]), undefined, {
        loadKreuzberg: async () => glue,
      })
    ).rejects.toThrow(SCANNED_PDF_MESSAGE);
  });

  it("reports engine loading failures", async () => {
    await expect(
      extractTablesFromPdf(new Uint8Array([1]), undefined, {
        loadKreuzberg: async () => {
          throw new Error("404");
        },
      })
    ).rejects.toThrow("local table engine could not be loaded");
  });

  it("warns about very large tables", async () => {
    const rows = Array.from({ length: 501 }, (_, index) => [
      `row ${index + 1}`,
    ]);
    const glue = glueWith({
      content: "text",
      tables: [{ headers: ["Column"], cells: rows }],
    });

    const output = await extractTablesFromPdf(new Uint8Array([1]), undefined, {
      loadKreuzberg: async () => glue,
    });

    expect(output.warnings[0]).toContain("very large");
  });

  it("ignores tables that have no usable rows", async () => {
    const glue = glueWith({
      content:
        "This is a long paragraph of readable text without any tabular content.",
      tables: [{ cells: [["", "  "]] }, { rows: [] }],
    });

    await expect(
      extractTablesFromPdf(new Uint8Array([1]), undefined, {
        loadKreuzberg: async () => glue,
      })
    ).rejects.toThrow("No tables were detected");
  });
});
