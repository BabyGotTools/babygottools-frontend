"use client";

import { useRef } from "react";
import Icon from "@/components/common/Icon";
import type { LoadedPdfFile } from "../engines/pdfTypes";
import { formatBytes } from "../engines/optimizeUtils";

/**
 * Multi-file queue for merge/insert tools: native HTML5 drag reorder
 * (plus keyboard Alt+arrows), duplicate and remove. Rows show the parsed
 * page count and any load error honestly.
 */
export default function LoadedFileList({
  files,
  onMove,
  onRemove,
  onDuplicate,
  disabled,
}: {
  files: LoadedPdfFile[];
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onDuplicate?: (index: number) => void;
  disabled?: boolean;
}) {
  const dragIndex = useRef<number | null>(null);

  return (
    <div className="flex flex-col gap-space-xs">
      {files.map((file, index) => (
        <div
          key={file.id}
          draggable={!disabled}
          onDragStart={() => {
            dragIndex.current = index;
          }}
          onDragOver={(event) => {
            if (!disabled) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragIndex.current !== null && !disabled) onMove(dragIndex.current, index);
            dragIndex.current = null;
          }}
          onDragEnd={() => {
            dragIndex.current = null;
          }}
          onKeyDown={(event) => {
            if (disabled || !event.altKey) return;
            if (event.key === "ArrowUp") {
              event.preventDefault();
              onMove(index, index - 1);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onMove(index, index + 1);
            }
          }}
          tabIndex={0}
          className={`p-space-sm bg-surface-container-low rounded-lg shadow-sm flex items-center gap-space-sm group hover:shadow-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            file.error ? "border border-error/40" : ""
          }`}
        >
          <Icon name="drag_indicator" size={18} className="text-outline cursor-grab shrink-0" />
          <div className="w-9 h-9 rounded bg-error-container/30 text-error flex items-center justify-center shrink-0">
            <Icon name={file.error ? "error" : "picture_as_pdf"} size={18} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-body-sm text-body-sm text-on-surface font-semibold truncate">{file.name}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              {file.error
                ? file.error
                : `${file.pageCount} page${file.pageCount === 1 ? "" : "s"} • ${formatBytes(file.size)}${
                    file.encrypted ? " • Encrypted" : ""
                  }`}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="font-label-mono-xs text-label-sm text-on-surface-variant mr-1">#{index + 1}</span>
            {onDuplicate && !disabled && (
              <button
                type="button"
                title="Duplicate"
                aria-label={`Duplicate ${file.name}`}
                onClick={() => onDuplicate(index)}
                className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <Icon name="content_copy" size={16} />
              </button>
            )}
            {!disabled && (
              <button
                type="button"
                title="Remove document"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemove(file.id)}
                className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors"
              >
                <Icon name="close" size={17} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
