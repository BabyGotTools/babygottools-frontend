/**
 * PDF engine smoke verification — runs the REAL engines in node (no DOM
 * needed for the structural pipeline). Produces sample documents with
 * pdf-lib, then exercises every operation and validates each output by
 * re-parsing it. Exit code 0 = every check passed.
 *
 * Run:  npx tsx scripts/pdf-smoke.mjs   (from frontend/)
 */
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { runOperation } from "../features/pdf-tools/engines/pdfOps.ts";
import { bundleZip } from "../features/pdf-tools/engines/zip.ts";
import {
  repair,
  linearize,
  compressLossless,
  stripMetadata,
  flatten,
  validateOutput,
  pageCount,
} from "../features/pdf-tools/engines/pdfStudio.ts";

const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

/** Builds a sample PDF with visible text on every page. */
async function makePdf(pages, title, { corrupt = false } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`${title} — page ${i + 1}`, { x: 72, y: 760, size: 24, font });
    page.drawRectangle({ x: 72, y: 700, width: 200, height: 100, color: rgb(0.9, 0.9, 1) });
  }
  let bytes = await doc.save();
  if (corrupt) {
    // Truncate the xref table away — the classic "damaged file" scenario.
    const text = Buffer.from(bytes).toString("latin1");
    const cut = text.lastIndexOf("xref");
    bytes = Uint8Array.from(Buffer.from(text.slice(0, cut), "latin1"));
  }
  return { bytes: bytes.slice().buffer, pageCount: pages, title };
}

const expectPages = async (bytes, expected, label) => {
  const count = await pageCount(new Uint8Array(bytes));
  ok(`${label} → ${expected} pages`, count === expected, `parsed ${count}`);
  return count;
};

/* ---------------------------- sample documents ---------------------------- */

const docA = await makePdf(4, "Report Alpha");
const docB = await makePdf(2, "Report Beta");
const docC = await makePdf(3, "Invoices");

/* --------------------------------- merge ---------------------------------- */

{
  const merged = await runOperation("merge", { files: [docA.bytes, docB.bytes, docC.bytes] });
  await expectPages(merged, 9, "merge 4+2+3");
}

/* --------------------------------- split ---------------------------------- */
/* The workspace splits per-range (one PDF each) and bundles the parts into a
   zip — mirror that exact flow here. */

{
  const part1 = await runOperation("split", { file: docA.bytes, ranges: "1-2" });
  const part2 = await runOperation("split", { file: docA.bytes, ranges: "4" });
  await expectPages(part1, 2, "split part (pages 1-2)");
  await expectPages(part2, 1, "split part (page 4)");
  const zip = bundleZip([
    { name: "Report-Alpha-pages-1-2.pdf", bytes: part1 },
    { name: "Report-Alpha-page-4.pdf", bytes: part2 },
  ]);
  ok("split → zip container", new Uint8Array(zip.slice(0, 4)).join(",") === "80,75,3,4", "PK magic");
}

/* -------------------------------- organize -------------------------------- */

{
  const organized = await runOperation("organize", {
    file: docA.bytes,
    order: [3, 2, 1, 0],
    rotations: { 0: 90 },
  });
  await expectPages(organized, 4, "organize reversed");
}

/* ------------------------------- extract/delete ---------------------------- */

{
  const extracted = await runOperation("extract", { file: docA.bytes, selectedPages: [0, 2] });
  await expectPages(extracted, 2, "extract pages 1,3");

  const deleted = await runOperation("delete", { file: docA.bytes, selectedPages: [0, 2] });
  await expectPages(deleted, 2, "delete pages 1,3");
}

/* --------------------------------- rotate --------------------------------- */

{
  const rotated = await runOperation("rotate", { file: docA.bytes, rotations: { 0: 90, 1: 180 } });
  await expectPages(rotated, 4, "rotate 0/90, 1/180");
}

/* ----------------------------------- n-up --------------------------------- */

{
  const nup = await runOperation("nup", {
    file: docC.bytes,
    pagesPerSheet: 4,
    orientation: "portrait",
    order: "horizontal",
    marginPt: 24,
    gutterPt: 12,
  });
  await expectPages(nup, 1, "n-up 4-on-1 (3 pages → 1 sheet)");
}

/* ------------------------------- add blank/insert ------------------------- */

{
  const withBlank = await runOperation("addblank", {
    file: docB.bytes,
    insertPositions: [1, 2],
  });
  await expectPages(withBlank, 4, "add blank after pages 1,2");

  const inserted = await runOperation("insert", {
    baseFile: docB.bytes,
    insertFile: docC.bytes,
    insertPosition: 1,
  });
  await expectPages(inserted, 5, "insert 3 pages at position 1");
}

/* --------------------------- qpdf-wasm (pdfstudio) ------------------------- */

{
  const info = await validateOutput(docA.bytes);
  ok("pdfstudio parses sample", info.ok, `${info.pageCount} pages, PDF ${info.pdfVersion}`);

  const fixed = await repair((await makePdf(3, "Damaged", { corrupt: true })).bytes);
  const fixedInfo = await validateOutput(fixed);
  ok("repair recovers a truncated xref", fixedInfo.ok, `${fixedInfo.pageCount} pages, PDF ${fixedInfo.pdfVersion}`);

  const lin = await linearize(docA.bytes);
  const linInfo = await validateOutput(lin);
  ok("linearize keeps a valid document", linInfo.ok, `${linInfo.pageCount} pages`);

  const squeezed = await compressLossless(docA.bytes, { objectStreams: true });
  const squeezedInfo = await validateOutput(squeezed);
  ok("lossless compress keeps a valid document", squeezedInfo.ok, `${docA.bytes.byteLength}B → ${squeezed.byteLength}B`);

  const clean = await stripMetadata(docA.bytes);
  ok("stripMetadata produces bytes", clean.byteLength > 0, `${clean.byteLength}B`);

  // Form flatten: build a doc with an AcroForm text field.
  const formDoc = await PDFDocument.create();
  const page = formDoc.addPage([595.28, 841.89]);
  const helv = await formDoc.embedFont(StandardFonts.Helvetica);
  formDoc.getForm().createTextField("name");
  page.drawText("Form:", { x: 72, y: 700, size: 18, font: helv });
  const formBytes = (await formDoc.save()).slice().buffer;
  const flat = await flatten(formBytes, { forms: true, annotations: true, rasterize: false });
  const flatInfo = await validateOutput(flat);
  ok("flatten bakes AcroForm fields", flatInfo.ok, `${flatInfo.pageCount} pages`);
}

/* --------------------------------- summary -------------------------------- */

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) process.exit(1);
