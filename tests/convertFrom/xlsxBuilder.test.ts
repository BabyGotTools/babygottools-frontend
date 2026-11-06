/**
 * Ported from the i love pdf project (src/lib/convertFrom/xlsxBuilder.test.ts)
 * — imports redirected to the ported engine module in features/pdf-tools.
 */
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import type { ExtractedTable } from "@/features/pdf-tools/engines/convertFrom/convertFromTypes";
import { buildXlsxFromTables } from "@/features/pdf-tools/engines/convertFrom/xlsxBuilder";

function readWorkbook(bytes: Uint8Array) {
  const files = unzipSync(bytes);
  return {
    files,
    text: (path: string) => strFromU8(files[path]),
  };
}

function table(overrides: Partial<ExtractedTable> = {}): ExtractedTable {
  return {
    id: "table-1",
    rows: [["A", "B"]],
    ...overrides,
  };
}

describe("buildXlsxFromTables", () => {
  it("rejects an empty selection", () => {
    expect(() => buildXlsxFromTables([], "source.pdf")).toThrow(
      "No tables selected"
    );
  });

  it("writes one sheet per table with headers and inline strings", () => {
    const bytes = buildXlsxFromTables(
      [
        table({
          pageNumber: 2,
          headers: ["Name", "Amount"],
          rows: [
            ["Alice", "10"],
            ["Bob", "20"],
          ],
        }),
        table({ id: "table-2", rows: [["Only"]] }),
      ],
      "Q3 report.pdf"
    );

    const { text } = readWorkbook(bytes);
    const workbook = text("xl/workbook.xml");
    const sheet1 = text("xl/worksheets/sheet1.xml");
    const sheet2 = text("xl/worksheets/sheet2.xml");

    expect(workbook).toContain('name="Table 1 (page 2)"');
    expect(workbook).toContain('name="Table 2"');
    expect(sheet1).toContain('<t xml:space="preserve">Name</t>');
    expect(sheet1).toContain('<t xml:space="preserve">Alice</t>');
    expect(sheet1).toContain('s="1"');
    expect(sheet1).toContain("<autoFilter");
    expect(sheet1).toContain('dimension ref="A1:B3"');
    expect(sheet2).toContain('<t xml:space="preserve">Only</t>');
    expect(text("[Content_Types].xml")).toContain("/xl/styles.xml");
  });

  it("does not duplicate a header row that is already the first row", () => {
    const { text } = readWorkbook(
      buildXlsxFromTables(
        [
          table({
            headers: ["Name", "Amount"],
            rows: [
              ["Name", "Amount"],
              ["Alice", "10"],
            ],
          }),
        ],
        "source.pdf"
      )
    );
    const sheet = text("xl/worksheets/sheet1.xml");
    expect(sheet.match(/Name/g)).toHaveLength(1);
  });

  it("escapes XML and strips control characters", () => {
    const { text } = readWorkbook(
      buildXlsxFromTables(
        [table({ rows: [['<&>"\'', "line\u0000one"]] })],
        "source.pdf"
      )
    );
    const sheet = text("xl/worksheets/sheet1.xml");
    expect(sheet).toContain("&lt;&amp;&gt;&quot;&apos;");
    expect(sheet).not.toContain("\u0000");
    expect(sheet).toContain("lineone");
  });

  it("pads short rows to the widest row", () => {
    const { text } = readWorkbook(
      buildXlsxFromTables(
        [table({ rows: [["a"], ["b", "c", "d"]] })],
        "source.pdf"
      )
    );
    const sheet = text("xl/worksheets/sheet1.xml");
    expect(sheet).toContain('dimension ref="A1:C2"');
    expect(sheet).toContain('<c r="B1" s="1"/>');
    expect(sheet).toContain('<c r="C1" s="1"/>');
  });

  it("includes page numbers in unique sheet names", () => {
    const { text } = readWorkbook(
      buildXlsxFromTables(
        [
          table({ pageNumber: 1 }),
          table({ id: "table-2", pageNumber: 3 }),
        ],
        "source.pdf"
      )
    );
    const workbook = text("xl/workbook.xml");
    expect(workbook).toContain('name="Table 1 (page 1)"');
    expect(workbook).toContain('name="Table 2 (page 3)"');
    expect(workbook.match(/<sheet /g)).toHaveLength(2);
  });

  it("records the source name in the document properties", () => {
    const { text } = readWorkbook(
      buildXlsxFromTables([table()], "A & B.pdf")
    );
    expect(text("docProps/core.xml")).toContain("A &amp; B.pdf");
  });
});
