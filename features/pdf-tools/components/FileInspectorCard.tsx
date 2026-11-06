"use client";

import Icon from "@/components/common/Icon";
import type { LoadedPdfFile } from "../engines/pdfTypes";
import { formatBytes } from "../engines/optimizeUtils";

/**
 * Stitch "Loaded Document Preview Inspector" header row: pdf icon, name,
 * parsed meta line, size badge. Purely presentational.
 */
export default function FileInspectorCard({
  file,
  metaLine,
  sizeBadgeLabel = "Original Size",
  extra,
}: {
  file: LoadedPdfFile;
  metaLine?: string;
  sizeBadgeLabel?: string;
  extra?: React.ReactNode;
}) {
  const meta = metaLine ?? `${file.pageCount} page${file.pageCount === 1 ? "" : "s"}${file.encrypted ? " • Encrypted" : ""}`;
  return (
    <div className="flex items-start justify-between gap-space-md bg-surface-container-low p-space-sm rounded-lg">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-error-container/40 text-error flex items-center justify-center shrink-0">
          <Icon name="picture_as_pdf" size={22} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">{file.name}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{meta}</span>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-1">
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container-highest text-on-surface font-label-mono-xs font-semibold text-label-sm">
          {formatBytes(file.size)}
        </span>
        <span className="text-label-sm font-label-sm text-outline">{sizeBadgeLabel}</span>
        {extra}
      </div>
    </div>
  );
}
