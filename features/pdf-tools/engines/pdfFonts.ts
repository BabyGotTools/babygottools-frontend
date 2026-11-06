import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

const fontCache = new Map<string, Uint8Array>();

export async function loadFontBytes(path: string): Promise<Uint8Array> {
  const cached = fontCache.get(path);
  if (cached) return cached;

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load font ${path}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  fontCache.set(path, bytes);
  return bytes;
}

export async function embedPdfFont(
  doc: PDFDocument,
  path: string
): Promise<PDFFont> {
  doc.registerFontkit(fontkit);
  const bytes = await loadFontBytes(path);
  return doc.embedFont(bytes, { subset: true });
}
