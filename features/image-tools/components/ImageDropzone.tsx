"use client";

/** Shared file dropzone + file list for the image-tool workspaces. */

import { useCallback, useRef, useState } from "react";
import Icon from "@/components/common/Icon";
import { RIBBON_BTN_CLEAR } from "@/components/tools/ribbonStyles";
import { validateImageFile, type LoadedImage } from "../engines/imageEngine";

interface ImageDropzoneProps {
  images: LoadedImage[];
  onAdd: (images: LoadedImage[]) => void;
  onRemove: (name: string) => void;
  onClear: () => void;
  /** Files are loaded as they are dropped (parent owns decode). */
  multiple?: boolean;
  label?: string;
}

export function useImageFileInput(onAdd: (imgs: LoadedImage[]) => void, multiple: boolean) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      if (!multiple) list.length = 1;
      setLoading(true);
      setError(null);
      const loaded: LoadedImage[] = [];
      const errors: string[] = [];
      for (const file of list) {
        const validation = validateImageFile(file);
        if (validation) {
          errors.push(`${file.name}: ${validation}`);
          continue;
        }
        try {
          loaded.push(await loadImageFileSafe(file));
        } catch (e) {
          errors.push(`${file.name}: ${e instanceof Error ? e.message : "could not be decoded."}`);
        }
      }
      setLoading(false);
      if (errors.length > 0) setError(errors.join(" • "));
      if (loaded.length > 0) onAdd(loaded);
    },
    [multiple, onAdd]
  );

  return { loading, error, handleFiles };
}

async function loadImageFileSafe(file: File): Promise<LoadedImage> {
  const { loadImageFile } = await import("../engines/imageEngine");
  return loadImageFile(file);
}

export default function ImageDropzone({ images, onAdd, onRemove, onClear, multiple = true, label }: ImageDropzoneProps) {  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { loading, error, handleFiles } = useImageFileInput(onAdd, multiple);

  return (
    <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload images"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
        }}
        className={`p-space-lg border-2 border-dashed rounded-xl transition-all cursor-pointer text-center ${
          dragOver ? "border-secondary bg-secondary/5" : "border-outline-variant/50 hover:border-secondary/60"
        }`}
      >
        <Icon name={loading ? "progress_activity" : "cloud_upload"} size={32} className={`mx-auto mb-2 text-secondary ${loading ? "animate-spin" : ""}`} />
        <p className="font-body-md text-body-md text-on-surface font-semibold">
          {label ?? (multiple ? "Drop images here or click to browse" : "Drop an image here or click to browse")}
        </p>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          PNG, JPEG, WebP, GIF, BMP, AVIF or SVG — max 50 MB per file. Files are processed in your browser and never uploaded.
        </p>
        {error && (
          <div className="mt-space-sm flex items-start gap-2 text-error text-label-mono-md font-label-mono-md text-left justify-center">
            <Icon name="error" size={16} className="mt-0.5 flex-shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/svg+xml"
          multiple={multiple}
          className="hidden"
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="px-space-md pb-space-md">
          <div className="flex items-center justify-between py-space-sm">
            <span className="font-label-mono-md font-label-mono-md text-on-surface-variant">
              {images.length} image{images.length === 1 ? "" : "s"} loaded
            </span>
            <button type="button" onClick={onClear} className={RIBBON_BTN_CLEAR}>
              <Icon name="delete_sweep" size={16} />
              <span>Remove all</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-space-sm">
            {images.map((img) => (
              <div key={img.name} className="relative group bg-surface-container-low rounded-lg p-space-xs">
                {/* Object URL kept brief; revoke on unmount by parent list re-render */}
                <img
                  src={URL.createObjectURL(img.file)}
                  alt={img.name}
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                  className="w-full h-20 object-contain rounded"
                />
                <button
                  type="button"
                  onClick={() => onRemove(img.name)}
                  aria-label={`Remove ${img.name}`}
                  className="absolute top-1 right-1 p-1 rounded bg-surface-container-highest/90 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Icon name="close" size={12} />
                </button>
                <div className="mt-1 px-1">
                  <div className="font-label-mono-xs font-label-mono-xs text-on-surface truncate" title={img.name}>
                    {img.name}
                  </div>
                  <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                    {img.width}×{img.height}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
