/**
 * Shared constants + pure helpers for the convert-to-PDF engines
 * (image / text / markdown / html / office). Pure math only — no engine
 * imports, safe for unit tests and UI previews.
 */

export const PAGE_DIMENSIONS: Record<
  "a4" | "letter" | "legal",
  { width: number; height: number }
> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
};

export type PageSizeId = "a4" | "letter" | "legal" | "auto";
export type Orientation = "portrait" | "landscape" | "auto";

export const MARGIN_POINTS: Record<"none" | "small" | "medium" | "large", number> =
  { none: 0, small: 24, medium: 48, large: 72 };

export const HEADER_FOOTER_HEIGHT = 22;

export type TextFont = "sans" | "serif" | "mono";

export const FONT_FILES: Record<TextFont, string> = {
  sans: "/fonts/Arimo-Regular.ttf",
  serif: "/fonts/Tinos-Regular.ttf",
  mono: "/fonts/Cousine-Regular.ttf",
};

/**
 * Maps reamkit's @expo-google-fonts CDN URLs onto the vendored /fonts files so
 * office conversion never touches the network.
 */
export const VENDORED_FONT_PATHS: Record<string, string> = {
  Arimo_400Regular: "/fonts/Arimo-Regular.ttf",
  Arimo_700Bold: "/fonts/Arimo-Bold.ttf",
  Arimo_400Regular_Italic: "/fonts/Arimo-Italic.ttf",
  Arimo_700Bold_Italic: "/fonts/Arimo-BoldItalic.ttf",
  Tinos_400Regular: "/fonts/Tinos-Regular.ttf",
  Tinos_700Bold: "/fonts/Tinos-Bold.ttf",
  Tinos_400Regular_Italic: "/fonts/Tinos-Italic.ttf",
  Tinos_700Bold_Italic: "/fonts/Tinos-BoldItalic.ttf",
  Cousine_400Regular: "/fonts/Cousine-Regular.ttf",
  Cousine_700Bold: "/fonts/Cousine-Bold.ttf",
  Cousine_400Regular_Italic: "/fonts/Cousine-Italic.ttf",
  Cousine_700Bold_Italic: "/fonts/Cousine-BoldItalic.ttf",
  Carlito_400Regular: "/fonts/Carlito-Regular.ttf",
  Carlito_700Bold: "/fonts/Carlito-Bold.ttf",
  Carlito_400Regular_Italic: "/fonts/Carlito-Italic.ttf",
  Carlito_700Bold_Italic: "/fonts/Carlito-BoldItalic.ttf",
  Caladea_400Regular: "/fonts/Caladea-Regular.ttf",
  Caladea_700Bold: "/fonts/Caladea-Bold.ttf",
  Caladea_400Regular_Italic: "/fonts/Caladea-Italic.ttf",
  Caladea_700Bold_Italic: "/fonts/Caladea-BoldItalic.ttf",
};

export function localFontPath(cdnUrl: string): string | null {
  const marker = "@expo-google-fonts/";
  const markerIndex = cdnUrl.indexOf(marker);
  if (markerIndex === -1) return null;

  const parts = cdnUrl.slice(markerIndex + marker.length).split("/");
  const file = parts[parts.length - 1]?.replace(/\.ttf$/i, "");
  if (!file) return null;

  return VENDORED_FONT_PATHS[file] ?? null;
}

export function vendoredFontFetch(
  url: string
): Promise<{ ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }> {
  const local = localFontPath(url);
  if (!local) {
    return Promise.resolve({
      ok: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });
  }
  return fetch(local);
}

export function baseNameOf(name: string): string {
  const base = name.split(/[\\/]/).pop() || name;
  const dot = base.lastIndexOf(".");
  if (dot > 0) return base.slice(0, dot);
  return base || "document";
}

export function outputName(baseName: string): string {
  return `${baseNameOf(baseName)}.pdf`;
}

/**
 * Resolves the page box for a convert job. `auto` keeps the source page size
 * (when known) with the requested orientation applied; fixed sizes swap
 * dimensions for landscape.
 */
export function resolvePageDimensions(
  pageSize: PageSizeId,
  orientation: Orientation,
  fallback?: { width: number; height: number }
): { width: number; height: number } {
  if (pageSize === "auto") {
    const width = fallback?.width ?? PAGE_DIMENSIONS.a4.width;
    const height = fallback?.height ?? PAGE_DIMENSIONS.a4.height;
    if (orientation === "portrait" && width > height) {
      return { width: height, height: width };
    }
    if (orientation === "landscape" && height > width) {
      return { width: height, height: width };
    }
    return { width, height };
  }

  const size = PAGE_DIMENSIONS[pageSize];
  return orientation === "landscape"
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

/** Contain-fit dimensions (aspect preserved) used by image + N-up layout. */
export function fitContain(
  contentWidth: number,
  contentHeight: number,
  imageWidth: number,
  imageHeight: number
): { width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(
    contentWidth / imageWidth,
    contentHeight / imageHeight
  );
  return { width: imageWidth * scale, height: imageHeight * scale };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** One honest sentence for raw engine failures. */
export function describeConversionError(
  error: unknown,
  toolName: string
): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (message.includes("password") || message.includes("encrypted")) {
    return "This file is password-protected. Remove the password in its original app, then try again.";
  }
  if (message.includes("unsupported") || message.includes("no registered reader")) {
    return "This file could not be read. It may be damaged or use a format the browser converter does not support.";
  }
  if (message.includes("out of memory") || message.includes("allocation failed")) {
    return "The browser ran out of memory. Try a smaller file or close other tabs.";
  }
  if (message.includes("zero width") || message.includes("zero size")) {
    return "There was no visible content to convert. Add some text or an image and try again.";
  }
  if (message.includes("fetch") || message.includes("font")) {
    return "A required font could not be loaded. Check your connection and try again.";
  }

  return raw || `${toolName} failed`;
}
