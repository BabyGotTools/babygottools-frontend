"use client";

/** Image Compressor workspace â€” canvas + WASM (WebP/AVIF) encoding, batch ZIP. */

import { useCallback, useState } from "react";
import Icon from "@/components/common/Icon";
import { RIBBON_MAIN_ACTION, RIBBON_BTN_CLEAR, INDENT_BTN_ACTIVE, INDENT_BTN_IDLE, RIBBON_INDENT_GROUP, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import {
  bytesToLabel,
  bitmapToCanvas,
  closeImages,
  encodeCanvas,
  FORMAT_LABEL,
  supportsNativeEncode,
  type LoadedImage,
  type OutputFormat,
  type ProcessedImage,
} from "../engines/imageEngine";
import { useImageFileInput } from "../components/ImageDropzone";
import { dispatchLatency, useRibbonPortal } from "@/hooks/useRibbonPortal";
import { downloadBlob } from "@/hooks/useDownload";

interface ResultRow {
  name: string;
  original: number;
  compressed: number;
  format: OutputFormat;
  blob: Blob;
  error?: string;
}

const FORMATS: OutputFormat[] = ["png", "jpeg", "webp", "avif"];

export function ImageCompressorWorkspace() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(0.75);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { loading, handleFiles } = useImageFileInput(
    (added) => {
      setImages((prev) => {
        const names = new Set(prev.map((p) => p.name));
        return [...prev, ...added.filter((a) => !names.has(a.name))];
      });
    },
    true
  );

  const webpNative = supportsNativeEncode("image/webp");

  const compress = useCallback(async () => {
    if (images.length === 0) {
      setError("Load at least one image first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResults([]);
    const rows: ResultRow[] = [];
    const started = performance.now();
    for (const img of images) {
      try {
        const canvas = bitmapToCanvas(img.bitmap, img.width, img.height);
        const blob = await encodeCanvas(canvas, format, quality);
        rows.push({
          name: swapExtension(img.name, format),
          original: img.size,
          compressed: blob.size,
          format,
          blob,
        });
      } catch (e) {
        rows.push({
          name: img.name,
          original: img.size,
          compressed: 0,
          format,
          blob: new Blob(),
          error: e instanceof Error ? e.message : "Encoding failed.",
        });
      }
    }
    dispatchLatency(performance.now() - started);
    setResults(rows);
    setBusy(false);
  }, [images, format, quality]);

  const successful = results.filter((r) => !r.error);
  const totalOriginal = successful.reduce((s, r) => s + r.original, 0);
  const totalCompressed = successful.reduce((s, r) => s + r.compressed, 0);
  const saving = totalOriginal > 0 ? Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100) : 0;

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
        <div className="flex items-center gap-2 px-space-sm py-1 rounded-lg bg-surface-container-lowest">
          <label htmlFor="img-quality" className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            Quality
          </label>
          <input
            id="img-quality"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-28 accent-secondary cursor-pointer"
          />
          <span className="text-label-mono-md font-label-mono-md text-on-surface font-semibold tabular-nums">
            {Math.round(quality * 100)}%
          </span>
        </div>
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
      <button type="button" onClick={() => void compress()} disabled={busy || loading} className={`${RIBBON_MAIN_ACTION} ${busy || loading ? "opacity-60" : ""}`}>
        <Icon name={busy ? "progress_activity" : "compress"} size={16} className={busy ? "animate-spin" : ""} />
        <span>{busy ? `Compressing ${images.length} file${images.length === 1 ? "" : "s"}â€¦` : `Compress to ${FORMAT_LABEL[format]}`}</span>
      </button>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
        }}
        className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => document.getElementById("imgcomp-file")?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              document.getElementById("imgcomp-file")?.click();
            }
          }}
          className="p-space-lg border-2 border-dashed border-outline-variant/50 hover:border-secondary/60 rounded-xl transition-all cursor-pointer text-center"
        >
          <Icon name={loading ? "progress_activity" : "cloud_upload"} size={32} className={`mx-auto mb-2 text-secondary ${loading ? "animate-spin" : ""}`} />
          <p className="font-body-md text-body-md text-on-surface font-semibold">Drop images here or click to browse</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            PNG, JPEG, WebP, GIF, BMP or AVIF â€” max 50 MB per file. Everything is processed locally; nothing is uploaded.
          </p>
        </div>
        <input
          id="imgcomp-file"
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
            <div className="font-label-mono-md font-label-mono-md text-on-surface-variant py-space-sm">
              {images.length} image{images.length === 1 ? "" : "s"} queued â€” {bytesToLabel(images.reduce((s, i) => s + i.size, 0))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-space-sm">
              {images.map((img) => (
                <div key={img.name} className="bg-surface-container-low rounded-lg p-space-xs">
                  <img
                    src={URL.createObjectURL(img.file)}
                    alt={img.name}
                    onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                    className="w-full h-20 object-contain rounded"
                  />
                  <div className="mt-1 px-1 font-label-mono-xs font-label-mono-xs text-on-surface truncate" title={img.name}>
                    {img.name}
                  </div>
                  <div className="px-1 font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                    {img.width}Ã—{img.height} Â· {bytesToLabel(img.size)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-error-container/20 border border-error/30 rounded-xl p-space-md mb-space-lg flex items-start gap-2">
          <Icon name="error" size={18} className="text-error flex-shrink-0 mt-0.5" />
          <span className="text-on-surface font-body-sm text-body-sm break-words">{error}</span>
        </div>
      )}

      {/* results */}
      {results.length > 0 && (
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Results</span>
              {successful.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded text-label-mono-xs font-label-mono-xs font-semibold flex-shrink-0 ${
                    saving > 0 ? "bg-secondary-container/20 text-secondary" : "bg-tertiary-container/20 text-tertiary"
                  }`}
                >
                  {saving > 0 ? `${saving}% smaller` : saving === 0 ? "Same size" : `${-saving}% larger`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {successful.length > 1 && (
                <button
                  type="button"
                  onClick={async () => {
                    const m = await import("../engines/imageEngine");
                    const zip = await m.zipImages(successful.map((r) => ({ name: r.name, blob: r.blob, originalSize: r.original })));
                    downloadBlob(zip, "compressed-images.zip");
                  }}
                  className="inline-flex items-center gap-1.5 px-space-sm py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-label-mono-md font-label-mono-md font-semibold transition-all shadow-md cursor-pointer"
                >
                  <Icon name="folder_zip" size={16} />
                  <span>Download all (ZIP)</span>
                </button>
              )}
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-sm overflow-auto" style={{ maxHeight: 480 }}>
            {results.map((r, i) => {
              const delta = r.error ? null : Math.round(((r.original - r.compressed) / r.original) * 100);
              return (
                <div key={`${r.name}-${i}`} className="flex items-center justify-between gap-space-sm bg-surface-container-low rounded-lg px-space-sm py-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-label-mono-md font-label-mono-md text-on-surface truncate" title={r.name}>
                      {r.error ? <Icon name="error" size={14} className="text-error inline mr-1" /> : null}
                      {r.name}
                    </div>
                    <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                      {r.error ? r.error : `${bytesToLabel(r.original)} â†’ ${bytesToLabel(r.compressed)} Â· ${FORMAT_LABEL[r.format]}`}
                    </div>
                  </div>
                  {!r.error && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-label-mono-md font-label-mono-md font-semibold ${delta !== null && delta > 0 ? "text-secondary" : "text-tertiary"}`}>
                        {delta !== null && delta > 0 ? `âˆ’${delta}%` : delta === 0 ? "0%" : `+${delta !== null ? -delta : 0}%`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const url = URL.createObjectURL(r.blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = r.name;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="inline-flex items-center gap-1 px-space-sm py-1 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 font-label-mono-md text-label-mono-md transition-all cursor-pointer"
                      >
                        <Icon name="download" size={16} />
                        <span>Save</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            {successful.length > 0 && (
              <span>
                Total: {bytesToLabel(totalOriginal)} â†’ {bytesToLabel(totalCompressed)} ({saving >= 0 ? "âˆ’" : "+"}
                {Math.abs(saving)}%) â€¢ encoded locally, {format === "webp" && !webpNative ? "WebP via WASM codec" : format === "avif" ? "AVIF via WASM codec" : "native canvas encoder"}
              </span>
            )}
          </div>
        </div>
      )}

      {ribbonNode}
    </>
  );
}

function swapExtension(name: string, format: OutputFormat): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${format === "jpeg" ? "jpg" : format}`;
}
