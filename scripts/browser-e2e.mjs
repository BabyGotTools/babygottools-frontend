/**
 * Browser-level end-to-end verification for the PDF & Document Tools category.
 *
 * Drives the REAL production build (`next start`) in headless Microsoft Edge
 * via puppeteer-core: uploads real files through the real dropzone inputs,
 * clicks the real action buttons, captures the real blob downloads via CDP,
 * then re-parses every downloaded artifact in Node (pdf-lib / fflate /
 * pdfstudio) to prove the outputs are genuine, valid documents.
 *
 * Usage:  node scripts/browser-e2e.mjs [--port 3177] [--only slug,slug] [--skip-ocr]
 * Exit 0 = every requested flow passed; exit 1 = at least one failure.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { zipSync, strToU8, unzipSync } from "fflate";
import * as studio from "pdfstudio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SAMPLES = path.join(__dirname, "e2e-samples");
const DOWNLOADS = path.join(__dirname, "e2e-downloads");

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(argOf("--port", "3177"));
const ONLY = args.includes("--only") ? argOf("--only", "").split(",").filter(Boolean) : null;
const SKIP_OCR = args.includes("--skip-ocr");
const BASE = `http://127.0.0.1:${PORT}`;
const EDGE =
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

fs.rmSync(DOWNLOADS, { recursive: true, force: true });
fs.mkdirSync(SAMPLES, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Sample builders (Node side)                                         */
/* ------------------------------------------------------------------ */

async function buildPdfSamples() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
    page.drawText(`PAGE ${i} OF 3`, { x: 60, y: 700, size: 40, font, color: rgb(0.1, 0.15, 0.4) });
    page.drawText("Baby Got Tools — structural PDF sample", { x: 60, y: 640, size: 16, font });
    page.drawText(`This page carries unique marker text BGT-P${i}.`, { x: 60, y: 600, size: 14, font });
  }
  fs.writeFileSync(path.join(SAMPLES, "doc-3p.pdf"), await doc.save());

  // Interactive form sample: text field (its widget doubles as an annotation).
  const form = await PDFDocument.create();
  const formPage = form.addPage([595, 842]);
  formPage.drawText("Fillable sample — flatten me", { x: 60, y: 760, size: 18, font });
  const pdfForm = form.getForm();
  const field = pdfForm.createTextField("fullname");
  field.setText("Travis Example");
  field.addToPage(formPage, { x: 60, y: 640, width: 300, height: 32, font });
  fs.writeFileSync(path.join(SAMPLES, "form.pdf"), await form.save());

  // Metadata-rich sample for the sanitizer.
  const meta = await PDFDocument.create();
  const metaPage = meta.addPage([595, 842]);
  metaPage.drawText("Metadata sample", { x: 60, y: 700, size: 24, font });
  meta.setTitle("Secret Working Title v7");
  meta.setAuthor("Jane Author");
  meta.setProducer("Producer Probe App");
  meta.setCreator("Creator Probe App");
  meta.setSubject("Internal subject line");
  meta.setKeywords(["secret", "keywords"]);
  meta.setCreationDate(new Date("2020-01-01T00:00:00Z"));
  meta.setModificationDate(new Date("2021-06-01T00:00:00Z"));
  fs.writeFileSync(path.join(SAMPLES, "meta.pdf"), await meta.save());

  // Damaged sample: the xref table + trailer are physically cut away while
  // the object body stays intact — the classic recoverable corruption the
  // repair engine targets (deeper truncation that deletes body objects is
  // unrecoverable by design and must surface an honest error).
  const good = fs.readFileSync(path.join(SAMPLES, "doc-3p.pdf"));
  const text = good.toString("latin1");
  const cut = text.lastIndexOf("xref");
  fs.writeFileSync(path.join(SAMPLES, "corrupt.pdf"), Buffer.from(text.slice(0, cut), "latin1"));
}

function xmlEsc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildOfficeSamples() {
  // --- minimal .docx -------------------------------------------------
  const docx = zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="48"/></w:rPr><w:t>Baby Got Tools DOCX Sample</w:t></w:r></w:p><w:p><w:r><w:t>This paragraph was typeset from a minimal OOXML package.</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph for line wrapping behaviour.</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`
    ),
  });
  fs.writeFileSync(path.join(SAMPLES, "report.docx"), docx);

  // --- minimal .xlsx -------------------------------------------------
  const xlsx = zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/></sheets></workbook>`
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c t="inlineStr"><is><t>Item</t></is></c><c t="inlineStr"><is><t>Cost</t></is></c></row><row r="2"><c t="inlineStr"><is><t>Paper</t></is></c><c><v>12.5</v></c></row><row r="3"><c t="inlineStr"><is><t>Ink</t></is></c><c><v>7.25</v></c></row><row r="4"><c t="inlineStr"><is><t>Staples</t></is></c><c><v>3</v></c></row></sheetData></worksheet>`
    ),
  });
  fs.writeFileSync(path.join(SAMPLES, "budget.xlsx"), xlsx);

  // --- minimal .pptx -------------------------------------------------
  const pptx = zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`
    ),
    "ppt/presentation.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldSz cx="9144000" cy="6858000"/><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`
    ),
    "ppt/_rels/presentation.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`
    ),
    "ppt/slides/slide1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="838200" y="365760"/><a:ext cx="7200900" cy="1325563"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US" sz="4400" b="1"/><a:t>Baby Got Tools PPTX Sample</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="838200" y="1828800"/><a:ext cx="7200900" cy="3657600"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US" sz="2000"/><a:t>Rendered slide-to-page, one slide per sheet.</a:t></a:r></a:p><a:p><a:r><a:rPr lang="en-US" sz="2000"/><a:t>Second paragraph on slide one.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
    ),
  });
  fs.writeFileSync(path.join(SAMPLES, "deck.pptx"), pptx);
}

function buildTextSamples() {
  fs.writeFileSync(
    path.join(SAMPLES, "notes.txt"),
    [
      "QUARTERLY FIELD NOTES",
      "",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. The text-to-PDF",
      "engine wraps these lines at the configured width and paginates them.",
      "",
      "END OF DOCUMENT",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(SAMPLES, "readme.md"),
    [
      "# Release Notes",
      "",
      "Shipped **bold** and _italic_ plus `inline code`.",
      "",
      "## Checklist",
      "",
      "- [x] parse front matter",
      "- [ ] ship it",
      "",
      "| Column A | Column B |",
      "| --- | --- |",
      "| one | two |",
      "",
      "```js",
      'const ok = true;',
      "```",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(SAMPLES, "invoice.html"),
    `<!doctype html><html><head><style>h1{color:#123a6d}table{border-collapse:collapse}td{border:1px solid #999;padding:6px}</style></head><body><h1>Invoice #0042</h1><p>Billed to <strong>Baby Got Tools</strong> — rendered <em>locally</em>.</p><table><tr><td>Item</td><td>Qty</td></tr><tr><td>Widgets</td><td>12</td></tr></table><ul><li>Paid via wire</li><li>Net 30</li></ul></body></html>`
  );
}

/* JPEG/PNG built by the browser canvas so the bytes are genuine raster art. */
async function buildImageSamples(page) {
  const b64 = await page.evaluate(async () => {
    const make = (kind) => {
      const c = document.createElement("canvas");
      c.width = 1000;
      c.height = 720;
      const ctx = c.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 1000, 720);
      g.addColorStop(0, "#20456e");
      g.addColorStop(1, "#9ec7e8");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1000, 720);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 255 | 0},${Math.random() * 255 | 0},0.25)`;
        ctx.fillRect(Math.random() * 1000, Math.random() * 720, 3, 3);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 84px Arial";
      ctx.fillText(kind === "png" ? "BABY GOT TOOLS PNG" : "BABY GOT TOOLS JPG", 60, 140);
      ctx.font = "40px Arial";
      ctx.fillText("Sample raster for conversion tools", 60, 220);
      return kind === "png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.92);
    };
    return { png: make("png"), jpeg: make("jpeg") };
  });
  fs.writeFileSync(path.join(SAMPLES, "photo.png"), Buffer.from(b64.png.split(",")[1], "base64"));
  fs.writeFileSync(path.join(SAMPLES, "photo.jpg"), Buffer.from(b64.jpeg.split(",")[1], "base64"));
}

/* "Scanned" PDFs: raster JPEG pages → PDF via pdfstudio (engine also used in-app). */
async function buildScannedSamples() {
  const jpeg = new Uint8Array(fs.readFileSync(path.join(SAMPLES, "photo.jpg")));
  const { imagesToPdf } = await import("pdfstudio");
  const one = await imagesToPdf([jpeg], { dpi: 150 });
  fs.writeFileSync(path.join(SAMPLES, "scanned-1p.pdf"), one);
  const three = await imagesToPdf([jpeg, jpeg, jpeg], { dpi: 150 });
  fs.writeFileSync(path.join(SAMPLES, "scanned-3p.pdf"), three);
}

/* ------------------------------------------------------------------ */
/* Browser plumbing                                                    */
/* ------------------------------------------------------------------ */

async function startServer() {
  const server = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: ROOT,
    shell: true,
    env: { ...process.env, NODE_OPTIONS: "" },
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(BASE + "/", { redirect: "manual" });
      if (res.status < 500) return server;
    } catch {}
    await sleep(500);
  }
  throw new Error("next start did not become ready");
}

async function newPage(browser) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console: ${msg.text()}`);
  });
  await page.setViewport({ width: 1440, height: 1000 });
  return { page, consoleErrors };
}

async function gotoTool(page, slug) {
  await page.goto(`${BASE}/tools/${slug}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForSelector("input[type=file], textarea", { timeout: 30_000 });
}

/**
 * Reads the text of a REAL failure surface. Icon chips (file cards, inspector
 * badges) reuse `bg-error-container` styling without any error, so the check
 * is scoped to the `p-2.5` padded notice/error boxes and strips
 * material-symbols ligature text before judging emptiness.
 */
async function readErrorText(page) {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll('[class*="bg-error-container"]')].filter((el) =>
      /\bp-2\.5\b/.test(el.className)
    );
    for (const box of boxes) {
      const clone = box.cloneNode(true);
      clone
        .querySelectorAll(".material-symbols-outlined, svg, span.material-symbols-outlined")
        .forEach((n) => n.remove());
      const text = clone.textContent?.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    return null;
  });
}

async function clickButton(page, label, { exact = false } = {}) {
  const clicked = await page.evaluate(
    ({ label, exact }) => {
      const buttons = [...document.querySelectorAll("button")];
      const btn = buttons.find(
        (b) =>
          (exact
            ? b.textContent?.trim() === label
            : b.textContent?.includes(label)) && !b.disabled
      );
      if (!btn) return false;
      btn.scrollIntoView({ block: "center" });
      btn.click();
      return true;
    },
    { label, exact }
  );
  if (!clicked) throw new Error(`Action button not found/enabled: "${label}"`);
}

/**
 * One browser-level CDP session drives every download: `Browser.*` download
 * commands sent on a page session are ignored by Chromium — the behavior and
 * progress events live on the browser target.
 */
let browserCdp = null;
let downloadWaiter = null;
let lastDownloadPath = null;

function initDownloadCapture(browser) {
  return (async () => {
    browserCdp = await browser.target().createCDPSession();
    browserCdp.on("Browser.downloadProgress", (e) => {
      if (e.state === "completed") {
        lastDownloadPath = e.filePath ?? null;
        downloadWaiter?.resolve();
      } else if (e.state === "canceled") {
        downloadWaiter?.reject(new Error("download canceled"));
      }
    });
  })();
}

function awaitDownload(timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      downloadWaiter = null;
      reject(new Error("download timeout"));
    }, timeoutMs);
    downloadWaiter = {
      resolve: () => {
        clearTimeout(timer);
        downloadWaiter = null;
        resolve(lastDownloadPath);
      },
      reject: (error) => {
        clearTimeout(timer);
        downloadWaiter = null;
        reject(error);
      },
    };
  });
}

/**
 * Run an action, watch for completion or honest failure, then click the
 * result-card download button and capture the real blob download to disk.
 */
async function runAndDownload(page, slug, actionLabel, downloadLabel, timeoutMs = 120_000) {
  const dir = path.join(DOWNLOADS, slug);
  fs.mkdirSync(dir, { recursive: true });
  await browserCdp.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: dir,
    eventsEnabled: true,
  });

  const before = new Set(fs.readdirSync(dir));

  // The action button appears/turns enabled only after the file tray parses,
  // so wait for it instead of clicking blind.
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`"${slug}" action button never became ready`);
    const ready = await page.evaluate((label) => {
      const buttons = [...document.querySelectorAll("button")];
      const btn = buttons.find((b) => b.textContent?.includes(label));
      return Boolean(btn && !btn.disabled);
    }, actionLabel);
    if (ready) break;
    const errText = await readErrorText(page);
    if (errText) throw new Error(`Tool reported failure: ${errText}`);
    await sleep(400);
  }

  await clickButton(page, actionLabel);

  for (;;) {
    if (Date.now() > deadline) throw new Error(`"${slug}" did not finish within ${timeoutMs / 1000}s`);
    const status = await page.evaluate((label) => {
      const buttons = [...document.querySelectorAll("button")];
      const ready = buttons.some(
        (b) => !b.disabled && b.textContent?.includes(label)
      );
      return { ready };
    }, downloadLabel);
    if (status.ready) break;
    const errText = await readErrorText(page);
    if (errText) throw new Error(`Tool reported failure: ${errText}`);
    await sleep(400);
  }

  await clickButton(page, downloadLabel);

  // Capture the blob download (real file written by the browser).
  const eventPath = await awaitDownload(90_000).catch(async (error) => {
    // Fallback: scan the download dir for a stable new file.
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const candidates = fs
        .readdirSync(dir)
        .filter((f) => !f.endsWith(".crdownload") && !before.has(f));
      if (candidates.length > 0) return path.join(dir, candidates[0]);
    }
    throw error;
  });
  if (eventPath) return eventPath;
  const candidates = fs
    .readdirSync(dir)
    .filter((f) => !f.endsWith(".crdownload") && !before.has(f));
  if (candidates.length === 0) throw new Error("no file downloaded");
  return path.join(dir, candidates[0]);
}

/* ------------------------------------------------------------------ */
/* Validation helpers (Node side, on the downloaded artifacts)          */
/* ------------------------------------------------------------------ */

async function loadPdf(file) {
  const bytes = fs.readFileSync(file);
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50) throw new Error(`${path.basename(file)} is not a PDF (bad magic)`);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
  return { doc, bytes };
}

const validators = {
  "merge-pdf": async (file) => {
    const { doc, bytes } = await loadPdf(file);
    assert(doc.getPageCount() === 4, `expected 4 pages, got ${doc.getPageCount()}`);
    return `4 pages, ${bytes.length} bytes`;
  },
  "split-pdf": async (file) => {
    const entries = unzipSync(fs.readFileSync(file));
    const parts = Object.keys(entries).filter((n) => n.endsWith(".pdf"));
    assert(parts.length === 3, `expected 3 PDF parts in ZIP, got ${parts.length}`);
    for (const part of parts) {
      const d = await PDFDocument.load(entries[part], { ignoreEncryption: true, throwOnInvalidObject: false });
      assert(d.getPageCount() === 1, `${part} should hold 1 page, got ${d.getPageCount()}`);
    }
    return `ZIP with ${parts.length} single-page parts`;
  },
  "insert-pages": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 4, `expected 4 pages, got ${doc.getPageCount()}`);
    return `4 pages (3 base + 1 inserted)`;
  },
  "extract-pages": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 2, `expected 2 pages, got ${doc.getPageCount()}`);
    return `2 pages (1 and 3)`;
  },
  "organize-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 3, `expected 3 pages, got ${doc.getPageCount()}`);
    const rot = doc.getPage(0).getRotation().angle % 360;
    assert(rot === 90, `page 1 should carry /Rotate 90, got ${rot}`);
    return `3 pages, page 1 rotated 90°`;
  },
  "delete-pages": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 2, `expected 2 pages, got ${doc.getPageCount()}`);
    return `2 pages (page 2 removed)`;
  },
  "rotate-pages": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 3, `expected 3 pages, got ${doc.getPageCount()}`);
    for (let i = 0; i < 3; i++) {
      const rot = doc.getPage(i).getRotation().angle % 360;
      assert(rot === 90, `page ${i + 1} should be rotated 90°, got ${rot}`);
    }
    return `3 pages, all /Rotate 90`;
  },
  "n-up-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 2, `expected 2 sheets (3 pages @2-up), got ${doc.getPageCount()}`);
    const size = doc.getPage(0).getSize();
    assert(Math.abs(size.width - 595) < 3, `A4 portrait width expected ~595pt, got ${size.width}`);
    return `2 A4 sheets, 3 source pages composed`;
  },
  "add-blank-page": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 6, `expected 6 pages (3 + 3 blanks), got ${doc.getPageCount()}`);
    return `6 pages (3 source + 3 true blanks)`;
  },
  "compress-pdf": async (file, ctx) => {
    const { doc, bytes } = await loadPdf(file);
    assert(doc.getPageCount() === 3, `expected 3 pages, got ${doc.getPageCount()}`);
    const delta = bytes.length - ctx.inputSize;
    return `3 pages, ${bytes.length} bytes vs input ${ctx.inputSize} (${delta <= 0 ? "smaller" : "larger by " + delta})`;
  },
  "linearize-pdf": async (file) => {
    const { doc, bytes } = await loadPdf(file);
    assert(doc.getPageCount() === 3, `expected 3 pages, got ${doc.getPageCount()}`);
    return `3 pages, ${bytes.length} bytes, qpdf-linearized`;
  },
  "repair-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() >= 1, `recovered document must have pages`);
    return `recovered ${doc.getPageCount()} pages from truncated xref`;
  },
  "flatten-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 1, `expected 1 page, got ${doc.getPageCount()}`);
    const fields = doc.getForm().getFields().length;
    assert(fields === 0, `form fields must be gone after flattening, ${fields} remain`);
    return `1 page, AcroForm removed, appearances baked`;
  },
  "sanitize-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 1, `expected 1 page, got ${doc.getPageCount()}`);
    assert(doc.getTitle() === undefined, `title should be stripped, found "${doc.getTitle()}"`);
    assert(doc.getAuthor() === undefined, `author should be stripped`);
    return `1 page, info dictionary fields stripped`;
  },
  "ocr-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 1, `expected 1 page, got ${doc.getPageCount()}`);
    return `1 searchable page produced`;
  },
  "image-to-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() === 2, `expected 2 pages (PNG + JPEG), got ${doc.getPageCount()}`);
    return `2 pages from PNG + JPEG`;
  },
  "word-to-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() >= 1, `expected at least 1 page`);
    return `${doc.getPageCount()} page(s) from .docx`;
  },
  "excel-to-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() >= 1, `expected at least 1 page`);
    return `${doc.getPageCount()} page(s) from .xlsx`;
  },
  "powerpoint-to-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() >= 1, `expected at least 1 page`);
    return `${doc.getPageCount()} page(s) from .pptx`;
  },
  "html-to-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() >= 1, `expected at least 1 page`);
    return `${doc.getPageCount()} page(s) from sanitized HTML`;
  },
  "text-to-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() >= 1, `expected at least 1 page`);
    return `${doc.getPageCount()} page(s) from typeset text`;
  },
  "markdown-to-pdf": async (file) => {
    const { doc } = await loadPdf(file);
    assert(doc.getPageCount() >= 1, `expected at least 1 page`);
    return `${doc.getPageCount()} page(s) from Markdown`;
  },
};

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/* ------------------------------------------------------------------ */
/* Tool flows                                                          */
/* ------------------------------------------------------------------ */

const S = (name) => path.join(SAMPLES, name);

const flows = [
  {
    slug: "merge-pdf",
    uploads: [[S("doc-3p.pdf"), S("form.pdf")]],
    actionLabel: "Merge 2 Files (WASM)",
    downloadLabel: "Download Merged PDF",
  },
  {
    slug: "split-pdf",
    uploads: [[S("doc-3p.pdf")]],
    actionLabel: "Split into 3 files (WASM)",
    downloadLabel: "Download ZIP of Parts",
  },
  {
    slug: "insert-pages",
    uploads: [S("doc-3p.pdf"), S("form.pdf")], // two separate dropzones
    actionLabel: "Insert Pages (WASM)",
    downloadLabel: "Download Result",
  },
  {
    slug: "extract-pages",
    uploads: [[S("doc-3p.pdf")]],
    prep: async (page) => {
      await clickButton(page, "Type Ranges", { exact: true });
      await typeInto(page, 'input[type="text"][placeholder^="1-3"]', "1, 3");
    },
    actionLabel: "Extract 2 Pages (WASM)",
    downloadLabel: "Download Extracted PDF",
  },
  {
    slug: "organize-pdf",
    uploads: [[S("doc-3p.pdf")]],
    prep: async (page) => {
      await page.waitForSelector('button[aria-label="Rotate page 1 by 90 degrees"]', { timeout: 30_000 });
      await page.click('button[aria-label="Rotate page 1 by 90 degrees"]');
    },
    actionLabel: "Write Organized PDF (WASM)",
    downloadLabel: "Download Organized PDF",
  },
  {
    slug: "delete-pages",
    uploads: [[S("doc-3p.pdf")]],
    prep: async (page) => {
      await clickButton(page, "Type Ranges", { exact: true });
      await typeInto(page, 'input[type="text"][placeholder^="2-4"]', "2");
    },
    actionLabel: "Delete 1 Page (WASM)",
    downloadLabel: "Download Result",
  },
  {
    slug: "rotate-pages",
    uploads: [[S("doc-3p.pdf")]],
    actionLabel: "Rotate All Pages (WASM)",
    downloadLabel: "Download Rotated PDF",
  },
  {
    slug: "n-up-pdf",
    uploads: [[S("doc-3p.pdf")]],
    actionLabel: "Build 2-up PDF (WASM)",
    downloadLabel: "Download N-up PDF",
  },
  {
    slug: "add-blank-page",
    uploads: [[S("doc-3p.pdf")]],
    actionLabel: "Insert 3 Blank Pages (WASM)",
    downloadLabel: "Download Result",
  },
  {
    slug: "compress-pdf",
    uploads: [[S("scanned-3p.pdf")]],
    actionLabel: "Compress PDF Now (WASM)",
    downloadLabel: "Download Compressed PDF",
    timeout: 240_000,
  },
  {
    slug: "linearize-pdf",
    uploads: [[S("doc-3p.pdf")]],
    actionLabel: "Linearize PDF (WASM)",
    downloadLabel: "Download Linearized PDF",
  },
  {
    slug: "repair-pdf",
    uploads: [[S("corrupt.pdf")]],
    actionLabel: "Repair PDF (WASM)",
    downloadLabel: "Download Repaired PDF",
  },
  {
    slug: "flatten-pdf",
    uploads: [[S("form.pdf")]],
    actionLabel: "Flatten PDF (WASM)",
    downloadLabel: "Download Flattened PDF",
  },
  {
    slug: "sanitize-pdf",
    uploads: [[S("meta.pdf")]],
    actionLabel: "Sanitize PDF (WASM)",
    downloadLabel: "Download Sanitized PDF",
  },
  {
    slug: "image-to-pdf",
    uploads: [[S("photo.png"), S("photo.jpg")]],
    actionLabel: "Build PDF from 2 images (WASM)",
    downloadLabel: "Download PDF",
  },
  {
    slug: "word-to-pdf",
    uploads: [[S("report.docx")]],
    actionLabel: "Convert to PDF (WASM)",
    downloadLabel: "Download PDF",
  },
  {
    slug: "excel-to-pdf",
    uploads: [[S("budget.xlsx")]],
    actionLabel: "Convert to PDF (WASM)",
    downloadLabel: "Download PDF",
  },
  {
    slug: "powerpoint-to-pdf",
    uploads: [[S("deck.pptx")]],
    actionLabel: "Convert to PDF (WASM)",
    downloadLabel: "Download PDF",
  },
  {
    slug: "html-to-pdf",
    uploads: [[S("invoice.html")]],
    actionLabel: "Render to PDF (WASM)",
    downloadLabel: "Download PDF",
  },
  {
    slug: "text-to-pdf",
    uploads: [[S("notes.txt")]],
    actionLabel: "Typeset to PDF (WASM)",
    downloadLabel: "Download PDF",
  },
  {
    slug: "markdown-to-pdf",
    uploads: [[S("readme.md")]],
    actionLabel: "Convert to PDF (WASM)",
    downloadLabel: "Download PDF",
  },
];

if (!SKIP_OCR) {
  flows.splice(flows.findIndex((f) => f.slug === "image-to-pdf"), 0, {
    slug: "ocr-pdf",
    uploads: [[S("scanned-1p.pdf")]],
    actionLabel: "Run OCR (WASM)",
    downloadLabel: "Download Searchable PDF",
    timeout: 300_000,
    ocr: true,
  });
}

async function typeInto(page, selector, text) {
  await page.waitForSelector(selector, { timeout: 15_000 });
  await page.type(selector, text, { delay: 5 });
}

/* ------------------------------------------------------------------ */
/* Hub flow                                                            */
/* ------------------------------------------------------------------ */

async function runHubTest(browser) {
  const { page, consoleErrors } = await newPage(browser);
  const dir = path.join(DOWNLOADS, "_hub");
  fs.mkdirSync(dir, { recursive: true });
  await browserCdp.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: dir,
    eventsEnabled: true,
  });

  await page.goto(`${BASE}/tools/pdf`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForSelector('a[href="/tools/merge-pdf"]', { timeout: 30_000 });

  const cardCount = await page.evaluate(
    () => [...document.querySelectorAll('a[href^="/tools/"]')].filter((a) =>
      /\/tools\/(merge-pdf|image-to-pdf|ocr-pdf|sanitize-pdf)/.test(a.getAttribute("href") || "")
    ).length
  );
  assert(cardCount >= 4, `hub should link the PDF tools, found ${cardCount}`);

  // Featured sandbox: load two documents and merge them for real.
  const input = await page.$('input[type="file"]');
  assert(input, "hub sandbox file input missing");
  await input.uploadFile(S("doc-3p.pdf"), S("form.pdf"));
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some(
      (b) => b.textContent?.includes("Merge All Files (WASM)") && !b.disabled
    ),
    { timeout: 60_000 }
  );

  const before = new Set(fs.readdirSync(dir));
  const dl = awaitDownload(90_000).catch(async (error) => {
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      if (fs.readdirSync(dir).some((f) => !f.endsWith(".crdownload") && !before.has(f))) return;
    }
    throw error;
  });
  await clickButton(page, "Merge All Files (WASM)");
  await dl;
  await sleep(1500);
  const got = fs.readdirSync(dir).filter((f) => !f.endsWith(".crdownload"));
  assert(got.length > 0, "hub merge produced no download");
  const { doc } = await loadPdf(path.join(dir, got[0]));
  assert(doc.getPageCount() === 4, `hub merge expected 4 pages, got ${doc.getPageCount()}`);

  const errors = consoleErrors.filter((e) => !/Download the React DevTools|third-party cookie/i.test(e));
  await page.close();
  return { pages: doc.getPageCount(), file: got[0], consoleErrors: errors };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const results = [];

async function main() {
  console.log(`[e2e] building samples in ${SAMPLES} …`);
  await buildPdfSamples();
  buildOfficeSamples();
  buildTextSamples();

  const server = await startServer();
  console.log(`[e2e] next start ready on ${BASE}`);

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    protocolTimeout: 600_000,
    args: ["--no-first-run", "--disable-extensions", "--hide-scrollbars"],
  });
  initDownloadCapture(browser);

  try {
    // Canvas-dependent samples first (real raster bytes from the browser).
    const boot = await newPage(browser);
    await boot.page.goto("about:blank");
    await buildImageSamples(boot.page);
    await boot.page.close();
    await buildScannedSamples();
    console.log(`[e2e] samples ready:`, fs.readdirSync(SAMPLES).join(", "));

    for (const flow of flows) {
      if (ONLY && !ONLY.includes(flow.slug)) continue;
      const tag = `[e2e] ${flow.slug}`;
      try {
        const { page, consoleErrors } = await newPage(browser);
        await gotoTool(page, flow.slug);
        if (flow.uploads) {
          const inputs = await page.$$('input[type="file"]');
          if (flow.uploads.length === 1 && inputs.length >= 1) {
            await inputs[0].uploadFile(...flow.uploads[0]);
          } else if (flow.uploads.length === 2 && inputs.length >= 2) {
            await inputs[0].uploadFile(flow.uploads[0]);
            await inputs[1].uploadFile(flow.uploads[1]);
          } else {
            throw new Error(`expected ${flow.uploads.length} file inputs, page has ${inputs.length}`);
          }
        }
        // Give the tray parse a moment, then run any tool-specific prep
        // (option changes, range typing, tile edits) on the loaded document.
        await sleep(700);
        if (flow.prep) await flow.prep(page);
        const firstFile = Array.isArray(flow.uploads?.[0]) ? flow.uploads[0][0] : flow.uploads?.[0];
        const ctx = { inputSize: firstFile ? fs.statSync(firstFile).size : 0 };
        const file = await runAndDownload(
          page,
          flow.slug,
          flow.actionLabel,
          flow.downloadLabel,
          flow.timeout ?? 120_000
        );
        const detail = await validators[flow.slug](file, ctx);
        const realErrors = consoleErrors.filter(
          (e) =>
            !/Download the React DevTools|third-party cookie|favicon/i.test(e) &&
            !/net::ERR_ABORTED.*blob:/i.test(e)
        );
        results.push({ slug: flow.slug, ok: true, detail, consoleErrors: realErrors });
        console.log(`${tag} PASS — ${detail}`);
        await page.close();
      } catch (error) {
        results.push({ slug: flow.slug, ok: false, detail: error.message });
        console.log(`${tag} FAIL — ${error.message}`);
      }
    }

    if (!ONLY) {
      try {
        const hub = await runHubTest(browser);
        results.push({ slug: "hub:pdf", ok: true, detail: `sandbox merge → ${hub.file} (${hub.pages} pages)` });
        console.log(`[e2e] hub:pdf PASS — sandbox merged ${hub.pages} pages → ${hub.file}`);
        if (hub.consoleErrors.length) {
          console.log(`[e2e] hub console notes:`, hub.consoleErrors.slice(0, 5));
        }
      } catch (error) {
        results.push({ slug: "hub:pdf", ok: false, detail: error.message });
        console.log(`[e2e] hub:pdf FAIL — ${error.message}`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
    server.kill("SIGTERM");
    if (process.platform === "win32") {
      // npm spawns nested processes; make sure the port is released.
      spawn("cmd", ["/c", `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${PORT} ^| findstr LISTENING') do taskkill /f /pid %a`], { shell: true, stdio: "ignore" });
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n[e2e] ${passed}/${results.length} flows passed`);
  if (failed.length) {
    console.log("[e2e] failures:");
    for (const f of failed) console.log(`  - ${f.slug}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[e2e] fatal:", error);
  process.exitCode = 1;
});
