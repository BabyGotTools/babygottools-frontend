import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import {
  FONT_FILES,
  MARGIN_POINTS,
  resolvePageDimensions,
  type PageSizeId,
  type Orientation,
} from "./convertShared";
import { headerFooterMargins } from "./officePdf";
import { embedPdfFont } from "./pdfFonts";
import type { PdfOutcome } from "./pdfTypes";

/**
 * HTML → PDF by offscreen rendering + html2canvas, then slicing the canvas
 * into pages. The DOM approach keeps complex CSS faithful; the trade-off
 * (text not selectable) is reported as an explicit warning in the outcome.
 */

export interface HtmlConvertOptions {
  pageSize: PageSizeId;
  orientation: Orientation;
  margin: keyof typeof MARGIN_POINTS;
  headerFooter: "none" | "page-number" | "custom";
  customHeader: string;
  customFooter: string;
  printBackgrounds: boolean;
}

const PX_PER_PT = 96 / 72;
const MAX_CANVAS_DIMENSION = 16_000;

const RESET_CSS = `
  html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; }
  *, *::before, *::after { box-sizing: border-box; }
  img, svg, video, canvas { max-width: 100%; height: auto; }
  table { border-collapse: collapse; max-width: 100%; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
  pre { white-space: pre-wrap; word-break: break-word; overflow: hidden; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  a { color: #1d4ed8; text-decoration: underline; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.2em 0 0.5em; }
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  p { margin: 0 0 0.85em; line-height: 1.55; }
  ul, ol { margin: 0 0 0.85em; padding-left: 1.5em; }
  blockquote { margin: 0 0 0.85em; padding-left: 1em; border-left: 4px solid #d1d5db; color: #4b5563; }
  hr { border: 0; border-top: 1px solid #d1d5db; margin: 1.5em 0; }
`;

const NO_BACKGROUND_CSS = `
  *, *::before, *::after {
    background: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
  }
  html, body { background: #ffffff !important; }
`;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          const timer = setTimeout(resolve, 5000);
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        })
    )
  );
}

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );
  if (!blob) throw new Error("Could not encode the rendered page");
  return new Uint8Array(await blob.arrayBuffer());
}

function safeText(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  let output = "";
  for (const char of text) {
    output += supported.has(char.codePointAt(0) ?? 0) ? char : "?";
  }
  return output;
}

function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  y: number,
  pageWidth: number
): void {
  if (!text) return;
  const safe = safeText(text, font);
  const size = 9;
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: Math.max(12, (pageWidth - width) / 2),
    y,
    size,
    font,
    color: rgb(0.42, 0.45, 0.5),
  });
}

export async function renderHtmlToPdf(
  html: string,
  css: string,
  options: HtmlConvertOptions,
  onProgress?: (percent: number, message?: string) => void
): Promise<PdfOutcome> {
  if (!html.trim()) {
    throw new Error("Add some content before converting");
  }

  const dimensions = resolvePageDimensions(options.pageSize, options.orientation);
  const headerText =
    options.headerFooter === "custom" ? options.customHeader?.trim() ?? "" : "";
  const footerText =
    options.headerFooter === "custom" ? options.customFooter?.trim() ?? "" : "";
  const pageNumbers = options.headerFooter === "page-number";
  const { topMarginPt, bottomMarginPt } = headerFooterMargins(
    options.margin,
    headerText,
    footerText,
    pageNumbers
  );
  const contentWidthPt = dimensions.width - MARGIN_POINTS[options.margin] * 2;
  const contentHeightPt = dimensions.height - topMarginPt - bottomMarginPt;

  if (contentWidthPt <= 24 || contentHeightPt <= 24) {
    throw new Error("The selected margins leave no room for content");
  }

  const contentWidthCss = contentWidthPt * PX_PER_PT;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    "z-index:-1",
    `width:${contentWidthCss}px`,
    "height:auto",
    "overflow:visible",
    "background:#ffffff",
    "color:#111827",
    "pointer-events:none",
    "font-family:Arial, Helvetica, sans-serif",
    "font-size:11pt",
  ].join(";");

  const style = document.createElement("style");
  style.textContent = [
    RESET_CSS,
    css,
    options.printBackgrounds ? "" : NO_BACKGROUND_CSS,
  ].join("\n");

  const article = document.createElement("article");
  article.style.cssText = "width:100%;margin:0;padding:0;";
  article.innerHTML = html;

  host.appendChild(style);
  host.appendChild(article);
  document.body.appendChild(host);

  try {
    onProgress?.(18, "Preparing layout");
    await waitForImages(host);
    await Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      delay(2500),
    ]);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const naturalWidth = Math.max(1, host.offsetWidth);
    const naturalHeight = Math.max(1, host.offsetHeight);
    if (
      article.textContent?.trim() === "" &&
      article.querySelector("img,svg") === null
    ) {
      throw new Error("There was no visible content to convert");
    }

    const maxScale = Math.min(
      2,
      MAX_CANVAS_DIMENSION / naturalWidth,
      MAX_CANVAS_DIMENSION / naturalHeight
    );
    const scale = Math.max(0.25, Math.min(2, maxScale));

    onProgress?.(34, "Rendering HTML");
    const { default: html2canvas } = await import("html2canvas");
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(host, {
        scale,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: false,
        allowTaint: false,
        imageTimeout: 5000,
        width: naturalWidth,
        height: naturalHeight,
        windowWidth: naturalWidth,
        scrollX: 0,
        scrollY: 0,
      });
    } catch (error) {
      throw new Error(
        "This HTML could not be rendered. Try simplifying unsupported CSS or removing unusual fonts.",
        { cause: error }
      );
    }

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("The rendered HTML was empty");
    }

    const sliceHeight = contentHeightPt * PX_PER_PT * scale;
    const totalPages = Math.max(1, Math.ceil(canvas.height / sliceHeight));
    const pdf = await PDFDocument.create();

    let headerFont: PDFFont | null = null;
    if (headerText || footerText || pageNumbers) {
      try {
        headerFont = await embedPdfFont(pdf, FONT_FILES.sans);
      } catch {
        headerFont = await pdf.embedFont(StandardFonts.Helvetica);
      }
    }

    onProgress?.(48, "Building PDF pages");
    for (let index = 0; index < totalPages; index++) {
      const offsetY = index * sliceHeight;
      const height = Math.max(1, Math.min(sliceHeight, canvas.height - offsetY));

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.ceil(height);
      const ctx = pageCanvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D is unavailable in this browser");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, -offsetY);

      const jpeg = await canvasToJpeg(pageCanvas);
      const image = await pdf.embedJpg(jpeg);
      const page = pdf.addPage([dimensions.width, dimensions.height]);
      const drawHeight = (pageCanvas.height / canvas.width) * contentWidthPt;
      page.drawImage(image, {
        x: MARGIN_POINTS[options.margin],
        y: dimensions.height - topMarginPt - drawHeight,
        width: contentWidthPt,
        height: drawHeight,
      });

      onProgress?.(
        50 + Math.round(((index + 1) / totalPages) * 45),
        `Building page ${index + 1} of ${totalPages}`
      );
    }

    if (headerFont) {
      pdf.getPages().forEach((page, index) => {
        if (headerText) {
          drawCentered(
            page,
            headerText,
            headerFont!,
            dimensions.height - topMarginPt / 2 - 5,
            dimensions.width
          );
        }
        const footer = footerText
          ? footerText
          : pageNumbers
            ? `Page ${index + 1} of ${totalPages}`
            : "";
        if (footer) {
          drawCentered(
            page,
            footer,
            headerFont!,
            bottomMarginPt / 2 - 4,
            dimensions.width
          );
        }
      });
    }

    onProgress?.(98, "Finalizing PDF");
    const bytes = await pdf.save();
    const warnings = [
      "HTML is rendered as high-resolution page images so complex layouts stay faithful; text is not selectable.",
    ];
    if (scale < 1) {
      warnings.push(
        "This is a very long document, so it was rendered at reduced resolution to stay within browser canvas limits."
      );
    }

    return { bytes, warnings };
  } finally {
    host.remove();
  }
}
