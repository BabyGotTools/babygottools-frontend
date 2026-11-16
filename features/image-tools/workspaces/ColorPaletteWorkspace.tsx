"use client";

/** Color Palette Extractor workspace â€” median-cut quantization + exports. */

import { useCallback, useState } from "react";
import Icon from "@/components/common/Icon";
import CopyButton from "@/components/tools/CopyButton";
import DownloadButton from "@/components/tools/DownloadButton";
import { RIBBON_BTN_CLEAR, INDENT_BTN_ACTIVE, INDENT_BTN_IDLE, RIBBON_INDENT_GROUP, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import {
  bitmapToCanvas,
  closeImages,
  extractPalette,
  rgbToHsl,
  type LoadedImage,
  type PaletteColor,
} from "../engines/imageEngine";
import { useImageFileInput } from "../components/ImageDropzone";
import { useRibbonPortal } from "@/hooks/useRibbonPortal";

const COLOR_COUNTS = [2, 4, 6, 8, 12];

export function ColorPaletteWorkspace() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [count, setCount] = useState(6);
  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { handleFiles } = useImageFileInput(
    (added) => {
      const img = added[0];
      closeImagesSafe(image);
      setImage(img);
      setError(null);
      const url = URL.createObjectURL(img.file);
      setPreviewUrl(url);
      extract(img, count);
    },
    false
  );

  const extract = useCallback((img: LoadedImage, maxColors: number) => {
    try {
      const canvas = bitmapToCanvas(img.bitmap, img.width, img.height);
      setPalette(extractPalette(canvas, maxColors));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
      setPalette([]);
    }
  }, []);

  const changeCount = (n: number) => {
    setCount(n);
    if (image) extract(image, n);
  };

  const clear = () => {
    closeImagesSafe(image);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImage(null);
    setPreviewUrl(null);
    setPalette([]);
    setError(null);
  };

  const jsonExport = palette.length > 0 ? JSON.stringify({ source: image?.name, colors: palette.map((c) => ({ hex: c.hex, rgb: `rgb(${c.r}, ${c.g}, ${c.b})`, hsl: hslString(c), share: `${Math.round(c.share * 100)}%` })) }, null, 2) : "";
  const cssExport =
    palette.length > 0
      ? `:root {\n${palette.map((c, i) => `  --palette-${i + 1}: ${c.hex}; /* ${Math.round(c.share * 100)}% */`).join("\n")}\n}`
      : "";

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Colors</span>
        <div className={RIBBON_INDENT_GROUP}>
          {COLOR_COUNTS.map((n) => (
            <button key={n} type="button" onClick={() => changeCount(n)} disabled={!image} className={count === n ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
              {n}
            </button>
          ))}
        </div>
        {image && (
          <button type="button" onClick={clear} className={RIBBON_BTN_CLEAR}>
            <Icon name="delete_sweep" size={16} />
            <span>Clear</span>
          </button>
        )}
      </div>
      <span className="inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-primary/10 text-primary text-label-mono-md font-label-mono-md">
        <Icon name="palette" size={16} />
        <span>Median-cut quantization</span>
      </span>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        {/* left: image + swatches */}
        <div className="flex flex-col gap-space-md">
          <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">Source Image</span>
              </div>
              <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">0-Upload</span>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => document.getElementById("palette-file")?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  document.getElementById("palette-file")?.click();
                }
              }}
              className={`m-space-sm p-space-lg border-2 border-dashed rounded-xl transition-all cursor-pointer text-center min-h-40 flex flex-col items-center justify-center ${
                image ? "border-transparent" : "border-outline-variant/50 hover:border-secondary/60"
              }`}
            >
              {image ? (
                <div className="w-full">
                  {previewUrl && <img src={previewUrl} alt={image.name} className="max-h-56 mx-auto rounded object-contain w-full" />}
                  <div className="mt-space-sm font-label-mono-md font-label-mono-md text-on-surface truncate" title={image.name}>
                    {image.name}
                  </div>
                  <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                    {image.width}Ã—{image.height}
                  </div>
                </div>
              ) : loading ? (
                <Icon name="progress_activity" size={32} className="text-secondary animate-spin" />
              ) : (
                <>
                  <Icon name="palette" size={32} className="mx-auto mb-2 text-secondary" />
                  <p className="font-body-md text-body-md text-on-surface font-semibold">Drop a photo here or click to browse</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Photos with distinct subjects produce the most useful palettes.</p>
                </>
              )}
            </div>
            <input
              id="palette-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif"
              className="hidden"
              aria-hidden="true"
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {error && (
            <div className="bg-error-container/20 border border-error/30 rounded-xl p-space-md flex items-start gap-2">
              <Icon name="error" size={18} className="text-error flex-shrink-0 mt-0.5" />
              <span className="text-on-surface font-body-sm text-body-sm break-words">{error}</span>
            </div>
          )}

          {palette.length > 0 && (
            <div className="bg-surface-container rounded-xl p-space-md shadow-2xl">
              <div className="font-headline-sm text-headline-sm text-on-surface mb-space-sm flex items-center gap-2">
                <Icon name="format_shapes" size={18} className="text-secondary" />
                Extracted Palette
              </div>
              <div className="space-y-space-xs">
                {palette.map((c) => {
                  const hsl = rgbToHsl(c.r, c.g, c.b);
                  return (
                    <div key={c.hex} className="flex items-center gap-space-sm bg-surface-container-low rounded-lg px-space-sm py-2">
                      <span className="w-9 h-9 rounded-lg border border-outline-variant/40 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-label-mono-md font-label-mono-md text-on-surface font-semibold">{c.hex.toUpperCase()}</div>
                        <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant truncate">
                          rgb({c.r}, {c.g}, {c.b}) Â· hsl({hsl.h}, {hsl.s}%, {hsl.l}%)
                        </div>
                      </div>
                      <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant flex-shrink-0">{Math.round(c.share * 100)}%</span>
                      <CopyButton value={c.hex} iconOnly title={`Copy ${c.hex}`} className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-secondary transition-colors" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* right: exports */}
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl h-fit">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">Exports</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <DownloadButton value={jsonExport} filename="color-palette.json" mime="application/json;charset=utf-8" title="Download JSON" />
              <CopyButton value={jsonExport} iconOnly title="Copy JSON" />
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-md overflow-auto" style={{ height: 420, maxHeight: 560 }}>
            {palette.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="palette" size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">Load an image to extract its palette â€” HEX, RGB and HSL with share stats.</p>
              </div>
            ) : (
              <>
                <div>
                  <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>CSS custom properties</span>
                    <CopyButton value={cssExport} label="Copy" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 text-secondary hover:bg-secondary/20 font-label-mono-xs text-label-mono-xs" />
                  </div>
                  <pre className="bg-surface-container-low rounded-lg p-space-sm text-on-surface select-text overflow-x-auto font-label-mono-md text-label-mono-md">
                    <code>{cssExport}</code>
                  </pre>
                </div>
                <div>
                  <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>JSON</span>
                    <CopyButton value={jsonExport} label="Copy" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 text-secondary hover:bg-secondary/20 font-label-mono-xs text-label-mono-xs" />
                  </div>
                  <pre className="bg-surface-container-low rounded-lg p-space-sm text-on-surface select-text overflow-x-auto font-label-mono-md text-label-mono-md">
                    <code>{jsonExport}</code>
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {ribbonNode}
    </>
  );
}

function hslString(c: PaletteColor): string {
  const hsl = rgbToHsl(c.r, c.g, c.b);
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

function closeImagesSafe(img: LoadedImage | null) {
  if (img) img.bitmap.close?.();
}
