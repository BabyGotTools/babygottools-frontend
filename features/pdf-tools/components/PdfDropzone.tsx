"use client";

import { useRef, useState } from "react";
import Icon from "@/components/common/Icon";

interface PdfDropzoneProps {
  onFiles: (files: FileList) => void;
  acceptAttr: string;
  title?: string;
  subtitle?: string;
  meta: string;
  /** Compact variant for right-column panels (hub sandbox). */
  compact?: boolean;
  disabled?: boolean;
  multiple?: boolean;
}

/** Stitch dropzone: cloud_upload circle + Memory Protected/Zero Server Logs chips. */
export default function PdfDropzone({
  onFiles,
  acceptAttr,
  title = "Drop your PDF here or click to browse files",
  subtitle = "Instant client-side buffer loading. Batch uploads supported.",
  meta,
  compact = false,
  disabled = false,
  multiple = true,
}: PdfDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        if (!disabled && event.dataTransfer.files.length > 0) {
          onFiles(event.dataTransfer.files);
        }
      }}
      className={`relative group cursor-pointer bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        compact ? "p-space-md min-h-44" : "p-space-lg"
      } ${dragOver ? "ring-2 ring-primary bg-primary/5" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary mb-space-sm group-hover:scale-110 transition-transform">
        <Icon name="cloud_upload" size={28} />
      </div>
      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">
        {title}
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mb-3">
        {subtitle}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant text-label-sm font-label-sm">
          <Icon name="lock" size={14} /> Memory Protected
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container text-on-surface-variant text-label-sm font-label-sm">
          <Icon name="verified_user" size={14} /> Zero Server Logs
        </span>
      </div>
      <span className="font-label-sm text-label-sm text-outline mt-2">{meta}</span>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            onFiles(event.target.files);
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}
