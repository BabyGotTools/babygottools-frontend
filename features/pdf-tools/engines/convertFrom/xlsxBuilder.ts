import { strToU8, zipSync } from "fflate";
import type { ExtractedTable } from "./convertFromTypes";
import { safeSheetName } from "./convertFromUtils";

function escapeXml(value: string): string {
  return value
    // XML 1.0 forbids most control characters; strip them rather than produce
    // a workbook Excel refuses to open.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function normaliseRows(table: ExtractedTable): string[][] {
  const source =
    table.rows && table.rows.length > 0
      ? table.rows
      : table.headers
        ? [table.headers]
        : [];

  const rows = source.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? "" : String(cell)))
  );

  if (table.headers && table.headers.length > 0) {
    const first = rows[0] ?? [];
    const headersAlreadyPresent =
      first.length === table.headers.length &&
      first.every(
        (cell, index) => cell.trim() === table.headers?.[index]?.trim()
      );
    if (!headersAlreadyPresent) {
      rows.unshift(table.headers.map((cell) => String(cell)));
    }
  }

  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => {
    const padded = [...row];
    while (padded.length < width) padded.push("");
    return padded;
  });
}

function cellXml(value: string, reference: string, header: boolean): string {
  const style = header ? ' s="1"' : "";
  if (value === "") return `<c r="${reference}"${style}/>`;
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function worksheetXml(rows: string[][]): string {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const lastColumn = columnName(Math.max(0, maxColumns - 1));
  const lastRow = Math.max(1, rows.length);

  const columnWidths = Array.from({ length: maxColumns }, (_, index) => {
    const longest = rows.reduce(
      (max, row) => Math.max(max, (row[index] ?? "").length),
      8
    );
    const width = Math.min(60, Math.max(10, longest + 2));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) =>
          cellXml(
            cell,
            `${columnName(columnIndex)}${rowIndex + 1}`,
            rowIndex === 0
          )
        )
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columnWidths}</cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * Builds a valid multi-sheet XLSX from normalised tables using inline strings.
 * No server, no SheetJS, and no shared-string table to keep in sync.
 */
export function buildXlsxFromTables(
  tables: ExtractedTable[],
  sourceName: string
): Uint8Array {
  if (tables.length === 0) throw new Error("No tables selected for export");

  const usedNames = new Set<string>();
  const sheets = tables.map((table, index) => {
    const base = safeSheetName(
      table.pageNumber
        ? `Table ${index + 1} (page ${table.pageNumber})`
        : `Table ${index + 1}`,
      index
    );
    let name = base;
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) {
      name = `${base.slice(0, 28)} ${suffix++}`;
    }
    usedNames.add(name.toLowerCase());
    return { name, rows: normaliseRows(table) };
  });

  const sheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  ${sheetOverrides}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

  const workbookSheets = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("\n  ")}
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const now = new Date().toISOString();
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(sourceName)} — extracted tables</dc:title>
  <dc:creator>PDF Intelligence Platform</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "docProps/core.xml": strToU8(core),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
    "xl/styles.xml": strToU8(STYLES_XML),
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(
      worksheetXml(sheet.rows)
    );
  });

  return zipSync(files, { level: 6 });
}
