import { PDFDocument } from "pdf-lib";
import {
  MARGIN_POINTS,
  fitContain,
  resolvePageDimensions,
  type Orientation,
  type PageSizeId,
} from "./convertShared";
import type { PdfOutcome } from "./pdfTypes";

/**
 * Image → PDF: preparation (EXIF-safe decode, quality-managed re-encode)
 * plus the pdf-lib layout writer. Ported from the proven client pipeline.
 */

export type ImageQuality = "high" | "medium" | "low";

const QUALITY_SETTINGS: Record<
  ImageQuality,
  { maxDimension: number; jpegQuality: number; keepPng: boolean }
> = {
  high: { maxDimension: 4096, jpegQuality: 0.92, keepPng: true },
  medium: { maxDimension: 2400, jpegQuality: 0.82, keepPng: false },
  low: { maxDimension: 1600, jpegQuality: 0.68, keepPng: false },
};

export interface PreparedImage {
  name: string;
  bytes: Uint8Array;
  type: "image/jpeg" | "image/png";
  width: number;
  height: number;
}

export interface ImagePageOptions {
  pageSize: PageSizeId;
  orientation: Orientation;
  margin: "none" | "small" | "medium" | "large";
  layout: "single" | "grid";
  gridColumns: number;
  fit: "contain" | "cover";
}

export const DEFAULT_IMAGE_OPTIONS: ImagePageOptions = {
  pageSize: "a4",
  orientation: "portrait",
  margin: "medium",
  layout: "single",
  gridColumns: 2,
  fit: "contain",
};

function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      type,
      quality
    );
  });
}

export async function fileToImageBitmap(file: File | Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/**
 * Decodes one image into embeddable bytes at the chosen quality level.
 * PNG is preserved losslessly at `high` quality when no downscale is needed;
 * everything else is re-encoded as JPEG over a white base so transparency
 * never renders black.
 */
export async function prepareImage(
  file: File,
  quality: ImageQuality
): Promise<PreparedImage> {
  const settings = QUALITY_SETTINGS[quality];
  const bitmap = await fileToImageBitmap(file);

  try {
    const target = scaledDimensions(bitmap.width, bitmap.height, settings.maxDimension);
    const isPng = file.type === "image/png";

    if (isPng && settings.keepPng && target.width === bitmap.width) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return {
        name: file.name,
        bytes,
        type: "image/png",
        width: bitmap.width,
        height: bitmap.height,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable in this browser");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await canvasToBlob(canvas, "image/jpeg", settings.jpegQuality);
    return {
      name: file.name,
      bytes: new Uint8Array(await blob.arrayBuffer()),
      type: "image/jpeg",
      width: target.width,
      height: target.height,
    };
  } finally {
    bitmap.close();
  }
}

export async function prepareImages(
  files: File[],
  quality: ImageQuality,
  onProgress?: (completed: number, total: number, name: string) => void
): Promise<PreparedImage[]> {
  const prepared: PreparedImage[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);
    prepared.push(await prepareImage(file, quality));
  }
  onProgress?.(files.length, files.length, "");
  return prepared;
}

export async function createImagePreview(
  file: File,
  maxDimension = 180
): Promise<{ url: string; width: number; height: number }> {
  const bitmap = await fileToImageBitmap(file);
  try {
    const target = scaledDimensions(bitmap.width, bitmap.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.72);
    return {
      url: URL.createObjectURL(blob),
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

/* ------------------------------ PDF assembly ------------------------------ */

export async function buildImagePdf(
  images: PreparedImage[],
  options: ImagePageOptions,
  onProgress?: (percent: number, message?: string) => void
): Promise<PdfOutcome> {
  const pdf = await PDFDocument.create();
  const margin = MARGIN_POINTS[options.margin];
  const total = images.length;
  const warnings: string[] = [];

  if (total === 0) throw new Error("Add at least one image");

  if (options.layout === "grid") {
    const columns = Math.min(4, Math.max(1, options.gridColumns));
    const perPage = columns * columns;
    const orientation = options.orientation === "auto" ? "portrait" : options.orientation;
    const dimensions = resolvePageDimensions(
      options.pageSize === "auto" ? "a4" : options.pageSize,
      orientation
    );
    const contentWidth = dimensions.width - margin * 2;
    const contentHeight = dimensions.height - margin * 2;
    const gap = 10;
    const cellWidth = (contentWidth - gap * (columns - 1)) / columns;
    const cellHeight = (contentHeight - gap * (columns - 1)) / columns;

    for (let start = 0; start < total; start += perPage) {
      const page = pdf.addPage([dimensions.width, dimensions.height]);
      const slice = images.slice(start, start + perPage);

      for (let i = 0; i < slice.length; i++) {
        const imageData = slice[i];
        const image =
          imageData.type === "image/png"
            ? await pdf.embedPng(imageData.bytes)
            : await pdf.embedJpg(imageData.bytes);
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = margin + col * (cellWidth + gap);
        const top = dimensions.height - margin - row * (cellHeight + gap);

        const drawn =
          options.fit === "cover"
            ? {
                width: cellWidth,
                height: cellHeight,
                dx: 0,
                dy: 0,
              }
            : fitContain(cellWidth, cellHeight, image.width, image.height);
        page.drawImage(image, {
          x: x + (cellWidth - drawn.width) / 2,
          y: top - cellHeight + (cellHeight - drawn.height) / 2,
          width: drawn.width,
          height: drawn.height,
        });
      }

      onProgress?.(
        10 + Math.round((Math.min(total, start + perPage) / total) * 85),
        `Laying out image ${Math.min(total, start + perPage)} of ${total}`
      );
    }

    return { bytes: await pdf.save(), warnings };
  }

  for (let i = 0; i < total; i++) {
    const imageData = images[i];
    const image =
      imageData.type === "image/png"
        ? await pdf.embedPng(imageData.bytes)
        : await pdf.embedJpg(imageData.bytes);

    let dimensions: { width: number; height: number };
    if (options.pageSize === "auto") {
      const maxSide = 842;
      const scale = maxSide / Math.max(image.width, image.height);
      dimensions = {
        width: image.width * scale + margin * 2,
        height: image.height * scale + margin * 2,
      };
    } else {
      const orientation =
        options.orientation === "auto"
          ? image.width >= image.height
            ? "landscape"
            : "portrait"
          : options.orientation;
      dimensions = resolvePageDimensions(options.pageSize, orientation, {
        width: image.width,
        height: image.height,
      });
    }

    const page = pdf.addPage([dimensions.width, dimensions.height]);
    const contentWidth = dimensions.width - margin * 2;
    const contentHeight = dimensions.height - margin * 2;

    let drawWidth: number;
    let drawHeight: number;
    if (options.fit === "cover") {
      const scale = Math.max(contentWidth / image.width, contentHeight / image.height);
      drawWidth = image.width * scale;
      drawHeight = image.height * scale;
    } else {
      const drawn = fitContain(contentWidth, contentHeight, image.width, image.height);
      drawWidth = drawn.width;
      drawHeight = drawn.height;
    }

    page.drawImage(image, {
      x: margin + (contentWidth - drawWidth) / 2,
      y: margin + (contentHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });

    onProgress?.(10 + Math.round(((i + 1) / total) * 85), `Placing image ${i + 1} of ${total}`);
  }

  onProgress?.(95, "Finalizing PDF");
  return { bytes: await pdf.save(), warnings };
}
