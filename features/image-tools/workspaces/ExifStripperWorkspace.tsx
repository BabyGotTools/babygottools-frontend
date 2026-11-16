"use client";

/** EXIF Metadata Stripper â€” inspect embedded metadata, re-encode clean copies. */

import { useCallback, useState } from "react";
import Icon from "@/components/common/Icon";
import { RIBBON_MAIN_ACTION, RIBBON_BTN_CLEAR, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import {
  bytesToLabel,
  bitmapToCanvas,
  canvasToBlob,
  closeImages,
  readExifSummary,
  type ExifSummary,
  type LoadedImage,
} from "../engines/imageEngine";
import { useImageFileInput } from "../components/ImageDropzone";
import { dispatchLatency, useRibbonPortal } from "@/hooks/useRibbonPortal";
import { downloadBlob } from "@/hooks/useDownload";

interface FileRecord {
  image: LoadedImage;
  exif: ExifSummary;
  previewUrl: string;
}

interface StripResult {
  name: string;
  blob: Blob;
  original: number;
}

export function ExifStripperWorkspace() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [quality, setQuality] = useState(0.9);
  const [results, setResults] = useState<StripResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const { handleFiles } = useImageFileInput(
    async (added) => {
      setLoading(true);
      const records: FileRecord[] = [];
      for (const img of added) {
        const exif = await readExifSummary(img.file);
        records.push({ image: img, exif, previewUrl: URL.createObjectURL(img.file) });
      }
      setFiles((prev) => {
        const names = new Set(prev.map((p) => p.image.name));
        return [...prev, ...records.filter((r) => !names.has(r.image.name))];
      });
      setLoading(false);
    },
    true
  );

  const strip = useCallback(async () => {
    if (files.length === 0) {
      setError("Load at least one photo first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResults([]);
    const out: StripResult[] = [];
    const started = performance.now();
    for (const record of files) {
      const canvas = bitmapToCanvas(record.image.bitmap, record.image.width, record.image.height);
      // PNG keeps lossless fidelity for graphics; JPEG suits photos.
      const mime = record.image.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await canvasToBlob(canvas, mime, quality);
      const dot = record.image.name.lastIndexOf(".");
      const base = dot > 0 ? record.image.name.slice(0, dot) : record.image.name;
      out.push({
        name: `${base}-clean.${mime === "image/png" ? "png" : "jpg"}`,
        blob,
        original: record.image.size,
      });
    }
    dispatchLatency(performance.now() - started);
    setResults(out);
    setBusy(false);
  }, [files, quality]);

  const clear = () => {
    files.forEach((f) => {
      closeImages([f.image]);
      URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
    setResults([]);
    setError(null);
  };

  const withMetadata = files.filter((f) => f.exif.hasExif);
  const withGps = files.filter((f) => f.exif.gps);

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className="flex items-center gap-2 px-space-sm py-1 rounded-lg bg-surface-container-lowest">
          <label htmlFor="exif-quality" className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            JPEG quality
          </label>
          <input id="exif-quality" type="range" min={0.5} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-24 accent-secondary cursor-pointer" />
          <span className="text-label-mono-md font-label-mono-md text-on-surface font-semibold tabular-nums">{Math.round(quality * 100)}%</span>
        </div>
        {files.length > 0 && (
          <button type="button" onClick={clear} className={RIBBON_BTN_CLEAR}>
            <Icon name="delete_sweep" size={16} />
            <span>Clear files</span>
          </button>
        )}
      </div>
      <button type="button" onClick={() => void strip()} disabled={busy || loading} className={`${RIBBON_MAIN_ACTION} ${busy || loading ? "opacity-60" : ""}`}>
        <Icon name={busy ? "progress_activity" : "no_encryption"} size={16} className={busy ? "animate-spin" : ""} />
        <span>{busy ? "Strippingâ€¦" : "Strip Metadata"}</span>
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
          onClick={() => document.getElementById("exif-file")?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              document.getElementById("exif-file")?.click();
            }
          }}
          className="p-space-lg border-2 border-dashed border-outline-variant/50 hover:border-secondary/60 rounded-xl transition-all cursor-pointer text-center"
        >
          <Icon name={loading ? "progress_activity" : "cloud_upload"} size={32} className={`mx-auto mb-2 text-secondary ${loading ? "animate-spin" : ""}`} />
          <p className="font-body-md text-body-md text-on-surface font-semibold">Drop photos here or click to browse</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Metadata is inspected locally via exifr â€” including GPS coordinates â€” and never leaves your browser.
          </p>
        </div>
        <input
          id="exif-file"
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
      </div>

      {files.length > 0 && (
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Metadata Report</span>
              {withGps.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-error-container/30 text-error text-label-mono-xs font-label-mono-xs font-semibold flex items-center gap-1">
                  <Icon name="location_on" size={12} />
                  {withGps.length} file{withGps.length === 1 ? "" : "s"} with GPS data
                </span>
              )}
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant flex-shrink-0">
              {withMetadata.length} of {files.length} carry metadata
            </span>
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-sm overflow-auto" style={{ maxHeight: 420 }}>
            {files.map((record) => (
              <div key={record.image.name} className="flex gap-space-sm bg-surface-container-low rounded-lg p-space-sm flex-wrap">
                <img
                  src={record.previewUrl}
                  alt={record.image.name}
                  className="w-14 h-14 rounded object-cover flex-shrink-0"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-label-mono-md font-label-mono-md text-on-surface truncate max-w-full" title={record.image.name}>
                      {record.image.name}
                    </span>
                    {record.exif.gps && (
                      <span className="px-1.5 py-0.5 rounded bg-error-container/30 text-error text-label-mono-xs font-label-mono-xs font-semibold flex-shrink-0">GPS</span>
                    )}
                    {!record.exif.hasExif && (
                      <span className="px-1.5 py-0.5 rounded bg-secondary-container/20 text-secondary text-label-mono-xs font-label-mono-xs font-semibold flex-shrink-0">Already clean</span>
                    )}
                  </div>
                  {record.exif.hasExif ? (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {record.exif.fields.slice(0, 6).map((field) => (
                        <span key={`${field.group}-${field.tag}`} className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                          <span className="text-on-surface">{field.tag}</span>: {field.value}
                        </span>
                      ))}
                      {record.exif.fields.length > 6 && (
                        <span className="font-label-mono-xs font-label-mono-xs text-tertiary">+ {record.exif.fields.length - 6} more fields</span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 font-body-sm text-body-sm text-on-surface-variant">No EXIF metadata detected in this file.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-error-container/20 border border-error/30 rounded-xl p-space-md mb-space-lg flex items-start gap-2">
          <Icon name="error" size={18} className="text-error flex-shrink-0 mt-0.5" />
          <span className="text-on-surface font-body-sm text-body-sm break-words">{error}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Clean Copies</span>
              <span className="px-2 py-0.5 rounded bg-secondary-container/20 text-secondary text-label-mono-xs font-label-mono-xs font-semibold flex-shrink-0">
                0 metadata blocks
              </span>
            </div>
            {results.length > 1 && (
              <button
                type="button"
                onClick={async () => {
                  const m = await import("../engines/imageEngine");
                  const zip = await m.zipImages(results.map((r) => ({ name: r.name, blob: r.blob, originalSize: r.original })));
                  downloadBlob(zip, "cleaned-photos.zip");
                }}
                className="inline-flex items-center gap-1.5 px-space-sm py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-label-mono-md font-label-mono-md font-semibold transition-all shadow-md cursor-pointer flex-shrink-0"
              >
                <Icon name="folder_zip" size={16} />
                <span>Download all (ZIP)</span>
              </button>
            )}
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-sm overflow-auto" style={{ maxHeight: 420 }}>
            {results.map((r) => {
              const delta = Math.round(((r.original - r.blob.size) / r.original) * 100);
              return (
                <div key={r.name} className="flex items-center justify-between gap-space-sm bg-surface-container-low rounded-lg px-space-sm py-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-label-mono-md font-label-mono-md text-on-surface truncate" title={r.name}>
                      {r.name}
                    </div>
                    <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                      {bytesToLabel(r.original)} â†’ {bytesToLabel(r.blob.size)} {delta > 0 ? `Â· âˆ’${delta}%` : delta < 0 ? `Â· +${-delta}% (re-encode grew the file â€” lower the quality)` : ""}
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
              );
            })}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            Output is re-encoded through the canvas â€” a format that physically cannot carry EXIF blocks.
          </div>
        </div>
      )}

      {ribbonNode}
    </>
  );
}
