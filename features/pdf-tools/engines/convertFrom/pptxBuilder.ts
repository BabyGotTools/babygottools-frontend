import PptxGenJS from "pptxgenjs";
import type { SlideSize } from "./convertFromTypes";
import { bytesToDataUrl } from "./convertFromUtils";

export interface PptxImageInput {
  pageNumber: number;
  bytes: Uint8Array;
  mimeType: string;
  pageWidth: number;
  pageHeight: number;
}

export interface BuildPptxOptions {
  slideSize: SlideSize;
  title: string;
}

interface SlideDimensions {
  width: number;
  height: number;
}

function fitWithin(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
  const w = imageWidth * scale;
  const h = imageHeight * scale;
  return {
    x: (boxWidth - w) / 2,
    y: (boxHeight - h) / 2,
    w,
    h,
  };
}

function matchPdfDimensions(image: PptxImageInput): SlideDimensions {
  const ratio = image.pageWidth / image.pageHeight;
  const maxWidth = 13.333;
  const maxHeight = 7.5;
  if (ratio >= maxWidth / maxHeight) {
    return { width: maxWidth, height: maxWidth / ratio };
  }
  return { width: maxHeight * ratio, height: maxHeight };
}

function dimensionsFor(
  slideSize: SlideSize,
  first: PptxImageInput
): SlideDimensions {
  if (slideSize === "16:9") return { width: 13.333, height: 7.5 };
  if (slideSize === "4:3") return { width: 10, height: 7.5 };
  return matchPdfDimensions(first);
}

/**
 * Assembles a PPTX with one full-slide image per PDF page.
 *
 * The image itself is rendered by pdfjs in the worker; this function only does
 * layout and packaging, which keeps it easy to unit test with a mocked
 * pptxgenjs module.
 */
export async function buildPptx(
  images: PptxImageInput[],
  options: BuildPptxOptions
): Promise<Uint8Array> {
  if (images.length === 0) throw new Error("No pages were rendered for the presentation");

  const pptx = new PptxGenJS();
  const dimensions = dimensionsFor(options.slideSize, images[0]);

  if (options.slideSize === "match") {
    pptx.defineLayout({
      name: "PDF_MATCH",
      width: dimensions.width,
      height: dimensions.height,
    });
    pptx.layout = "PDF_MATCH";
  } else if (options.slideSize === "16:9") {
    pptx.layout = "LAYOUT_16x9";
  } else {
    pptx.layout = "LAYOUT_4x3";
  }

  pptx.author = "PDF Intelligence Platform";
  pptx.company = "PDF Intelligence Platform";
  pptx.subject = options.title;
  pptx.title = options.title;

  for (const image of images) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    const placement = fitWithin(
      image.pageWidth,
      image.pageHeight,
      dimensions.width,
      dimensions.height
    );
    slide.addImage({
      data: bytesToDataUrl(image.bytes, image.mimeType),
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
      altText: `PDF page ${image.pageNumber}`,
    });
  }

  const output = await pptx.write({ outputType: "arraybuffer" });
  if (output instanceof ArrayBuffer) return new Uint8Array(output);
  if (output instanceof Uint8Array) return output;
  if (typeof output === "string") return new TextEncoder().encode(output);
  if (typeof Blob !== "undefined" && output instanceof Blob) {
    return new Uint8Array(await output.arrayBuffer());
  }
  throw new Error("pptxgenjs returned an unsupported output type");
}
