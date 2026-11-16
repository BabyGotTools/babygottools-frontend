/**
 * Image & Media tools engines — canvas-based processing with WASM encoders
 * (@jsquash webp/avif) for formats browsers can't natively encode.
 * Everything runs client-side; files never leave the browser.
 */

import { bundleZip, type ZipEntry } from "@/features/pdf-tools/engines/zip";

/* ------------------------------- shared utils ------------------------------- */

export interface LoadedImage {
  /** Decoded bitmap, ready for canvas drawing. */
  bitmap: ImageBitmap;
  file: File;
  width: number;
  height: number;
  name: string;
  type: string;
  size: number;
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per image
export const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/avif", "image/svg+xml"];

export function bytesToLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Human-readable validation error, or null when the file is acceptable. */
export function validateImageFile(file: File): string | null {
  if (file.size === 0) return "File is empty.";
  if (file.size > MAX_FILE_BYTES) return `File is ${bytesToLabel(file.size)} — the per-file limit is ${bytesToLabel(MAX_FILE_BYTES)}.`;
  const type = file.type.toLowerCase();
  if (type && !ACCEPTED_MIME.includes(type)) return `Unsupported file type "${type || file.name}". Use PNG, JPG, WebP, GIF, BMP, AVIF or SVG.`;
  return null;
}

/** Decode a File into an ImageBitmap via createImageBitmap (browser-native decoders). */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  return {
    bitmap,
    file,
    width: bitmap.width,
    height: bitmap.height,
    name: file.name,
    type: file.type || "image/png",
    size: file.size,
  };
}

export function closeImages(images: LoadedImage[]) {
  for (const img of images) img.bitmap.close?.();
}

/** Draw a bitmap (optionally resized) onto an offscreen canvas. */
export function bitmapToCanvas(bitmap: ImageBitmap | HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable in this browser.");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Encode a canvas to a Blob with the browser's native encoders. */
export function canvasToBlob(canvas: HTMLCanvasElement, mime: "image/png" | "image/jpeg" | "image/webp", quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`This browser could not encode ${mime}.`));
      },
      mime,
      quality
    );
  });
}

/** Does this browser support natively encoding the given canvas mime? */
export function supportsNativeEncode(mime: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.createElement("canvas").toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

/* --------------------------- WASM encoders (jsquash) --------------------------- */
/* Browser-native canvas encoding covers PNG/JPEG always and WebP in most
   browsers. For the rest (Safari WebP, and AVIF everywhere) the @jsquash
   codecs are lazy-loaded; their Emscripten glue resolves the .wasm through
   webpack's asyncWebAssembly experiment, so nothing is fetched until an
   encode actually runs. */

export type OutputFormat = "png" | "jpeg" | "webp" | "avif";

export const FORMAT_MIME: Record<OutputFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
};

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  avif: "AVIF",
};

/** WASM-encode raw pixels to WebP/AVIF at an explicit 0–100 quality. */
export async function encodeImageDataWasm(format: "webp" | "avif", imageData: ImageData, quality: number): Promise<Blob> {
  const q = Math.max(0, Math.min(100, Math.round(quality * 100)));
  if (format === "webp") {
    const { default: encode } = await import("@jsquash/webp/encode");
    const buf = await encode(imageData, { quality: q });
    return new Blob([buf], { type: "image/webp" });
  }
  const { default: encode } = await import("@jsquash/avif/encode");
  const buf = await encode(imageData, { quality: q, lossless: q >= 100 });
  return new Blob([buf], { type: "image/avif" });
}

/**
 * Encode a canvas into any supported format. PNG/JPEG use the native canvas
 * encoders; WebP uses the native encoder when the browser supports it and
 * falls back to the bundled WASM codec (e.g. Safari) otherwise. AVIF always
 * goes through the WASM encoder.
 */
export async function encodeCanvas(canvas: HTMLCanvasElement, format: OutputFormat, quality = 0.9): Promise<Blob> {
  if (format === "png" || format === "jpeg" || (format === "webp" && supportsNativeEncode("image/webp"))) {
    return canvasToBlob(canvas, format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp", quality);
  }
  const imageData = canvasToImageData(canvas);
  return encodeImageDataWasm(format, imageData, quality);
}

/* ------------------------------ palette engine ------------------------------ */

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  hex: string;
  count: number;
  share: number; // 0–1 share of sampled pixels
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Median-cut palette extraction over downsampled pixel data.
 * `maxColors` buckets are refined iteratively, then bucket averages are
 * returned ranked by pixel share.
 */
export function extractPalette(canvas: HTMLCanvasElement, maxColors = 6): PaletteColor[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable.");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  // Sample pixels on a grid, skipping (nearly) transparent ones.
  const stepX = Math.max(1, Math.floor(width / 128));
  const stepY = Math.max(1, Math.floor(height / 128));
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < 16) continue;
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  if (pixels.length === 0) return [];

  let buckets: [number, number, number][][] = [pixels];
  while (buckets.length < maxColors) {
    // Split the bucket with the widest channel range.
    let targetIdx = -1;
    let targetRange = -1;
    let targetChannel = 0;
    buckets.forEach((bucket, idx) => {
      if (bucket.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let min = 255, max = 0;
        for (const px of bucket) {
          if (px[ch] < min) min = px[ch];
          if (px[ch] > max) max = px[ch];
        }
        const range = (max - min) * bucket.length;
        if (range > targetRange) {
          targetRange = range;
          targetIdx = idx;
          targetChannel = ch;
        }
      }
    });
    if (targetIdx < 0 || targetRange <= 0) break;
    const bucket = buckets[targetIdx];
    const sorted = [...bucket].sort((a, b) => a[targetChannel] - b[targetChannel]);
    const mid = Math.floor(sorted.length / 2);
    buckets = [...buckets.slice(0, targetIdx), sorted.slice(0, mid), sorted.slice(mid), ...buckets.slice(targetIdx + 1)];
  }

  const total = pixels.length;
  const colors = buckets
    .filter((b) => b.length > 0)
    .map((bucket) => {
      const sum = bucket.reduce((acc, px) => [acc[0] + px[0], acc[1] + px[1], acc[2] + px[2]], [0, 0, 0]);
      const r = Math.round(sum[0] / bucket.length);
      const g = Math.round(sum[1] / bucket.length);
      const b = Math.round(sum[2] / bucket.length);
      return { r, g, b, hex: toHex(r, g, b), count: bucket.length, share: bucket.length / total };
    })
    .sort((a, b) => b.count - a.count);

  return colors;
}

/* ------------------------------ favicon engine ------------------------------ */

export interface FaviconSize {
  size: number;
  label: string;
  usage: string;
}

export const FAVICON_SIZES: FaviconSize[] = [
  { size: 16, label: "favicon-16x16.png", usage: "Browser tab (standard)" },
  { size: 32, label: "favicon-32x32.png", usage: "Browser tab (retina)" },
  { size: 48, label: "favicon-48x48.png", usage: "Windows site icon" },
  { size: 96, label: "favicon-96x96.png", usage: "Google TV / desktop shortcut" },
  { size: 180, label: "apple-touch-icon.png", usage: "iOS home screen" },
  { size: 192, label: "android-chrome-192x192.png", usage: "Android chrome icon" },
  { size: 512, label: "android-chrome-512x512.png", usage: "PWA splash / store" },
];

/** Build an .ico container (Vista+ format with embedded PNG entries). */
export async function buildIco(pngBlobs: { size: number; blob: Blob }[]): Promise<Blob> {
  const count = pngBlobs.length;
  // ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes) per image.
  const headerSize = 6 + count * 16;
  const entries = await Promise.all(
    pngBlobs.map(async (entry) => ({ size: entry.size, bytes: new Uint8Array(await entry.blob.arrayBuffer()) }))
  );
  const header = new DataView(new ArrayBuffer(headerSize));
  header.setUint16(0, 0, true); // reserved
  header.setUint16(2, 1, true); // type: icon
  header.setUint16(4, count, true);
  let offset = headerSize;
  entries.forEach((entry, i) => {
    const base = 6 + i * 16;
    header.setUint8(base, entry.size >= 256 ? 0 : entry.size); // width (0 = 256)
    header.setUint8(base + 1, entry.size >= 256 ? 0 : entry.size); // height
    header.setUint8(base + 2, 0); // palette
    header.setUint8(base + 3, 0); // reserved
    header.setUint16(base + 4, 1, true); // color planes
    header.setUint16(base + 6, 32, true); // bits per pixel
    header.setUint32(base + 8, entry.bytes.length, true);
    header.setUint32(base + 12, offset, true);
    offset += entry.bytes.length;
  });
  const total = headerSize + entries.reduce((sum, e) => sum + e.bytes.length, 0);
  const out = new Uint8Array(total);
  out.set(new Uint8Array(header.buffer), 0);
  let cursor = headerSize;
  for (const entry of entries) {
    out.set(entry.bytes, cursor);
    cursor += entry.bytes.length;
  }
  return new Blob([out], { type: "image/x-icon" });
}

/* -------------------------------- EXIF engine -------------------------------- */

export interface ExifSummary {
  hasExif: boolean;
  fields: { group: string; tag: string; value: string }[];
  gps: boolean;
}

/** Summarize the metadata an uploaded JPEG/WebP/TIFF carries (via exifr). */
export async function readExifSummary(file: File): Promise<ExifSummary> {
  try {
    const exifr = await import("exifr");
    const parsed = await exifr.parse(file, { tiff: true, exif: true, gps: true, translateValues: true });
    if (!parsed || Object.keys(parsed).length === 0) return { hasExif: false, fields: [], gps: false };
    const fields: ExifSummary["fields"] = [];
    let gps = false;
    for (const [tag, value] of Object.entries(parsed)) {
      const lower = tag.toLowerCase();
      if (lower.startsWith("gps")) gps = true;
      if (tag === "ifd0" || tag === "exif" || tag === "gps" || tag === "interop") continue; // block containers
      if (typeof value === "object") continue; // skip nested blocks
      fields.push({ group: lower.startsWith("gps") ? "GPS" : "Metadata", tag, value: String(value).slice(0, 60) });
    }
    return { hasExif: fields.length > 0, fields: fields.slice(0, 24), gps };
  } catch {
    // Unsupported container (e.g. PNG) — canvas output is metadata-free anyway.
    return { hasExif: false, fields: [], gps: false };
  }
}

/* ------------------------------ batching helper ------------------------------ */

export interface ProcessedImage {
  name: string;
  blob: Blob;
  originalSize: number;
}

/** Zip a batch of processed files using the shared fflate bundler. */
export async function zipImages(images: ProcessedImage[]): Promise<Blob> {
  const entries: ZipEntry[] = [];
  for (const img of images) {
    entries.push({ name: img.name, bytes: new Uint8Array(await img.blob.arrayBuffer()) });
  }
  const zipped = bundleZip(entries);
  return new Blob([zipped.slice().buffer], { type: "application/zip" });
}
