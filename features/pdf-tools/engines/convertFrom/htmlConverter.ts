import type { HtmlFromPdfOptions } from "./convertFromTypes";
import { SCANNED_PDF_MESSAGE } from "./convertFromUtils";
import { detectPdfTextLayer, type TextLayerReport } from "./pdfToImageUtils";

export interface HtmlConversionDeps {
  detectTextLayer?: (bytes: Uint8Array) => Promise<TextLayerReport>;
  loadExtractPdf?: () => Promise<typeof import("extract-pdf")>;
}

export interface HtmlConversionOutput {
  html: string;
  title?: string;
  author?: string;
  warnings: string[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The parser only emits structural tags, but a downloaded HTML file is still
 * user-controlled data. Strip the few constructs that could execute or load
 * remote content, and let the preview iframe's sandbox handle the rest.
 */
function sanitizeFragment(fragment: string): string {
  return fragment
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("|')javascript:[\s\S]*?\2/gi, "");
}

const DOCUMENT_CSS = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 2rem 1.25rem 4rem;
  background: #faf8ff;
  color: #1b1b1f;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.65;
}
main { max-width: 52rem; margin: 0 auto; }
.pdf-citation {
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #d9d5e3;
}
.pdf-citation h1 { margin: 0 0 .35rem; font-size: 1.75rem; line-height: 1.2; }
.pdf-citation p { margin: 0; color: #5d5a68; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 2rem 0 .75rem; }
p { margin: 0 0 1rem; }
ul, ol { margin: 0 0 1rem 1.35rem; padding: 0; }
li { margin: .25rem 0; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0 1.5rem; font-size: .95rem; }
th, td { border: 1px solid #d9d5e3; padding: .5rem .65rem; text-align: left; vertical-align: top; }
th { background: #f0edf8; }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
code { background: #f0edf8; padding: .12rem .3rem; border-radius: .25rem; }
pre { overflow-x: auto; padding: 1rem; background: #f0edf8; border-radius: .5rem; }
pre code { background: none; padding: 0; }
img { max-width: 100%; height: auto; }
.page-marker { color: #7a7685; font-size: .8rem; }
@media (prefers-color-scheme: dark) {
  body { background: #0f131d; color: #e6e1f0; }
  .pdf-citation { border-color: #2c3140; }
  .pdf-citation p { color: #a9a4b8; }
  th, td { border-color: #2c3140; }
  th, code, pre { background: #1a1f2c; }
}
`;

/**
 * Converts a text-based PDF into a standalone HTML document.
 *
 * `extract-pdf` supplies the structural tagging (headings, lists, tables,
 * emphasis). The package's default pdf.js loader points at a CDN; the Next
 * webpack config aliases that URL to the locally bundled pdf.js build so this
 * remains a zero-network operation.
 */
export async function convertPdfToHtml(
  bytes: Uint8Array,
  options: HtmlFromPdfOptions,
  sourceName: string,
  onProgress?: (progress: { phase: string; percent: number; message?: string }) => void,
  deps: HtmlConversionDeps = {}
): Promise<HtmlConversionOutput> {
  const detect = deps.detectTextLayer ?? detectPdfTextLayer;
  onProgress?.({
    phase: "preparing",
    percent: 5,
    message: "Checking the PDF text layer",
  });

  const report = await detect(bytes);
  if (!report.hasText) throw new Error(SCANNED_PDF_MESSAGE);

  const loadExtractPdf =
    deps.loadExtractPdf ?? (() => import("extract-pdf"));
  onProgress?.({
    phase: "converting",
    percent: 15,
    message: "Preparing HTML converter",
  });

  const { convertPDFToHTML } = await loadExtractPdf();
  const result = await convertPDFToHTML(bytes.slice().buffer, {
    addPageNumbers: options.includePageNumbers,
    addCitation: options.includeCitation,
    method: "ts-block-algorithm",
    processor: "frontend",
  });

  if ("error" in result && result.error) {
    throw new Error(String(result.error));
  }
  if (!result.html) {
    throw new Error(SCANNED_PDF_MESSAGE);
  }

  onProgress?.({
    phase: "finalizing",
    percent: 92,
    message: "Building HTML document",
  });

  const title = result.title?.trim() || sourceName;
  const author = result.author?.trim();
  const fragment = sanitizeFragment(result.html);
  const citation =
    options.includeCitation && (result.title || author)
      ? `<header class="pdf-citation">${
          result.title ? `<h1>${escapeHtml(result.title)}</h1>` : ""
        }${author ? `<p>By ${escapeHtml(author)}</p>` : ""}</header>`
      : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="generator" content="PDF Intelligence Platform"/>
${author ? `<meta name="author" content="${escapeHtml(author)}"/>` : ""}
<title>${escapeHtml(title)}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body>
<main>
${citation}
${fragment}
</main>
</body>
</html>`;

  const warnings: string[] = [];
  if (report.pagesWithText < report.sampledPages) {
    warnings.push(
      "Some sampled pages had no extractable text. Those pages may be missing from the HTML output."
    );
  }

  return { html, title: result.title, author, warnings };
}
