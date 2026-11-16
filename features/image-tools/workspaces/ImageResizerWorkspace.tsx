"use client";

/** Image Resizer & Aspect Ratio workspace â€” precise scaling, batch ZIP. */

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/common/Icon";
import { RIBBON_MAIN_ACTION, RIBBON_BTN_CLEAR, INDENT_BTN_ACTIVE, INDENT_BTN_IDLE, RIBBON_INDENT_GROUP, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import {
  bytesToLabel,
  bitmapToCanvas,
  closeImages,
  encodeCanvas,
  FORMAT_LABEL,
  type LoadedImage,
  type OutputFormat,
} from "../engines/imageEngine";
import { useImageFileInput } from "../components/ImageDropzone";
import { dispatchLatency, useRibbonPortal } from "@/hooks/useRibbonPortal";
import { downloadBlob } from "@/hooks/useDownload";

const FORMATS: OutputFormat[] = ["png", "jpeg", "webp"];
const PERCENT_PRESETS = [100, 75, 50, 25];

interface ResizeResult {
  name: string;
  blob: Blob;
  from: { w: number; h: number };
  to: { w: number; h: number };
  size: number;
}

export function ImageResizerWorkspace() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [format, setFormat] = useState<OutputFormat>("png");
  const [quality, setQuality] = useState(0.9);
  const [width, setWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [lockRatio, setLockRatio] = useState(true);
  const [results, setResults] = useState<ResizeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ratio, setRatio] = useState(1);

  const { loading, handleFiles } = useImageFileInput(
    (added) => {
      setImages((prev) => {
        const names = new Set(prev.map((p) => p.name));
        return [...prev, ...added.filter((a) => !names.has(a.name))];
      });
      if (added[0]) {
        setWidth(added[0].width);
        setHeight(added[0].height);
        setRatio(added[0].width / added[0].height);
      }
    },
    true
  );

  // Seed defaults from the first loaded image when fields are untouched.
  useEffect(() => {
    if (images[0] && (width === null || height === null)) {
      setWidth(images[0].width);
      setHeight(images[0].height);
      setRatio(images[0].width / images[0].height);
    }
  }, [images, width, height]);

  const applyPreset = useCallback(
    (pct: number) => {
      if (!images[0]) return;
      setWidth(Math.round((images[0].width * pct) / 100));
      setHeight(Math.round((images[0].height * pct) / 100));
    },
    [images]
  );

  const onWidth = (v: number | null) => {
    setWidth(v);
    if (lockRatio && v !== null && ratio > 0) setHeight(Math.max(1, Math.round(v / ratio)));
  };
  const onHeight = (v: number | null) => {
    setHeight(v);
    if (lockRatio && v !== null && ratio > 0) setWidth(Math.max(1, Math.round(v * ratio)));
  };

  const resize = useCallback(async () => {
    if (images.length === 0) return setError("Load at least one image first.");
    const w = width ?? 0;
    const h = height ?? 0;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return setError("Enter target dimensions of at least 1Ã—1 pixels.");
    if (w > 16384 || h > 16384) return setError("Target dimensions exceed the 16384Ã—16384 canvas limit most browsers enforce.");
    setBusy(true);
    setError(null);
    setResults([]);
    const out: ResizeResult[] = [];
    const started = performance.now();
    for (const img of images) {
      const canvas = bitmapToCanvas(img.bitmap, w, h);
      const blob = await encodeCanvas(canvas, format, quality);
      out.push({
        name: rename(img.name, format, w, h),
        blob,
        from: { w: img.width, h: img.height },
        to: { w, h },
        size: blob.size,
      });
    }
    dispatchLatency(performance.now() - started);
    setResults(out);
    setBusy(false);
  }, [images, width, height, format, quality]);

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className={RIBBON_INDENT_GROUP}>
          {FORMATS.map((f) => (
            <button key={f} type="button" onClick={() => setFormat(f)} className={format === f ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
              {FORMAT_LABEL[f]}
            </button>
          ))}
        </div>
        {format !== "png" && (
          <div className="flex items-center gap-2 px-space-sm py-1 rounded-lg bg-surface-container-lowest">
            <label htmlFor="resize-quality" className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">
              Quality
            </label>
            <input id="resize-quality" type="range" min={0.3} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-24 accent-secondary cursor-pointer" />
            <span className="text-label-mono-md font-label-mono-md text-on-surface font-semibold tabular-nums">{Math.round(quality * 100)}%</span>
          </div>
        )}
        <button type="button" onClick={() => setLockRatio(!lockRatio)} aria-pressed={lockRatio} className={lockRatio ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
          {lockRatio ? "Aspect locked" : "Free stretch"}
        </button>
        {images.length > 0 && (
          <button
            type="button"
            onClick={() => {
              closeImages(images);
              setImages([]);
              setResults([]);
              setError(null);
            }}
            className={RIBBON_BTN_CLEAR}
          >
            <Icon name="delete_sweep" size={16} />
            <span>Clear files</span>
          </button>
        )}
      </div>
      <button type="button" onClick={() => void resize()} disabled={busy || loading} className={`${RIBBON_MAIN_ACTION} ${busy || loading ? "opacity-60" : ""}`}>
        <Icon name={busy ? "progress_activity" : "aspect_ratio"} size={16} className={busy ? "animate-spin" : ""} />
        <span>{busy ? "Resizingâ€¦" : "Resize Images"}</span>
      </button>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        {/* dropzone + queue */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
          }}
          className="bg-surface-container rounded-xl overflow-hidden shadow-2xl"
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => document.getElementById("imgresize-file")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                document.getElementById("imgresize-file")?.click();
              }
            }}
            className="p-space-lg border-2 border-dashed border-outline-variant/50 hover:border-secondary/60 rounded-xl transition-all cursor-pointer text-center"
          >
            <Icon name={loading ? "progress_activity" : "cloud_upload"} size={32} className={`mx-auto mb-2 text-secondary ${loading ? "animate-spin" : ""}`} />
            <p className="font-body-md text-body-md text-on-surface font-semibold">Drop images here or click to browse</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Batch resizing supported â€” processed locally, never uploaded.</p>
          </div>
          <input
            id="imgresize-file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif"
            multiple
            className="hidden"
            aria-hidden="true"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {images.length > 0 && (
            <div className="px-space-md pb-space-md">
              <div className="grid grid-cols-3 gap-space-sm">
                {images.slice(0, 9).map((img) => (
                  <div key={img.name} className="bg-surface-container-low rounded-lg p-space-xs">
                    <img
                      src={URL.createObjectURL(img.file)}
                      alt={img.name}
                      onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                      className="w-full h-16 object-contain rounded"
                    />
                    <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant truncate text-center" title={img.name}>
                      {img.width}Ã—{img.height}
                    </div>
                  </div>
                ))}
              </div>
              {images.length > 9 && (
                <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant pt-space-xs">+ {images.length - 9} more</div>
              )}
            </div>
          )}
        </div>

        {/* dimension controls */}
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Target Dimensions</span>
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">px</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-md">
            <div className="grid grid-cols-2 gap-space-sm">
              <label className="block">
                <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wide">Width</span>
                <input
                  type="number"
                  min={1}
                  max={16384}
                  value={width ?? ""}
                  onChange={(e) => onWidth(e.target.value === "" ? null : Number(e.target.value))}
                  className="mt-1 w-full px-space-sm py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </label>
              <label className="block">
                <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wide">Height</span>
                <input
                  type="number"
                  min={1}
                  max={16384}
                  value={height ?? ""}
                  onChange={(e) => onHeight(e.target.value === "" ? null : Number(e.target.value))}
                  className="mt-1 w-full px-space-sm py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </label>
            </div>
            <div>
              <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant mb-space-xs uppercase tracking-wide">Quick presets (of original)</div>
              <div className="grid grid-cols-4 gap-space-xs">
                {PERCENT_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPreset(p)}
                    disabled={!images[0]}
                    className="px-2 py-2 rounded-lg border border-outline-variant/40 text-label-mono-md font-label-mono-md text-on-surface hover:border-secondary/60 disabled:opacity-50 cursor-pointer disabled:cursor-default transition-all"
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            {images[0] && (
              <div className="flex items-center gap-2 text-label-mono-md font-label-mono-md text-on-surface-variant">
                <Icon name="info" size={16} className="text-tertiary flex-shrink-0" />
                <span>
                  Original: {images[0].width}Ã—{images[0].height} Â· {bytesToLabel(images[0].size)} Â· aspect {(ratio).toFixed(3)}
                </span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 text-error text-label-mono-md font-label-mono-md">
                <Icon name="error" size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* results */}
      {results.length > 0 && (
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Resized Output</span>
            </div>
            {results.length > 1 && (
              <button
                type="button"
                onClick={async () => {
                  const m = await import("../engines/imageEngine");
                  const zip = await m.zipImages(results.map((r) => ({ name: r.name, blob: r.blob, originalSize: 0 })));
                  downloadBlob(zip, "resized-images.zip");
                }}
                className="inline-flex items-center gap-1.5 px-space-sm py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-label-mono-md font-label-mono-md font-semibold transition-all shadow-md cursor-pointer"
              >
                <Icon name="folder_zip" size={16} />
                <span>Download all (ZIP)</span>
              </button>
            )}
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-sm overflow-auto" style={{ maxHeight: 480 }}>
            {results.map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-space-sm bg-surface-container-low rounded-lg px-space-sm py-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-label-mono-md font-label-mono-md text-on-surface truncate" title={r.name}>
                    {r.name}
                  </div>
                  <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                    {r.from.w}Ã—{r.from.h} â†’ {r.to.w}Ã—{r.to.h} Â· {bytesToLabel(r.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadBlob(r.blob, r.name)}
                  className="inline-flex items-center gap-1 px-space-sm py-1 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 font-label-mono-md text-label-mono-md transition-all cursor-pointer flex-shrink-0"
                >
                  <Icon name="download" size={16} />
                  <span>Save</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {ribbonNode}
    </>
  );
}

function rename(name: string, format: OutputFormat, w: number, h: number): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = format === "jpeg" ? "jpg" : format;
  return `${base}_${w}x${h}.${ext}`;
}
