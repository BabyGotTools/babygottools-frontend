"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/common/Icon";
import {
  getCachedDocument,
  renderPageToDataURL,
} from "../engines/pdfRender";

/**
 * Lazy page-thumbnail grid shared by the page-operation workspaces.
 *
 * - Thumbnails render only when scrolled into view (IntersectionObserver)
 *   and are cached per (document, page, rotation) so rotations don't reload.
 * - Selection is click / Ctrl-click / Shift-range.
 * - Reorder is native HTML5 drag plus keyboard: focus a tile and press
 *   Alt+ArrowLeft/Right to move it within the current order.
 */

export interface PageThumbGridProps {
  /** Owner-supplied pdf.js document-cache key (file id). */
  cacheKey: string | null;
  file: File | ArrayBuffer;
  pageCount: number;
  /** Current display order: source page indices (defaults to 0..n-1). */
  order?: number[];
  onOrderChange?: (order: number[]) => void;
  /** Selected source page indices (when selection is enabled). */
  selected?: Set<number>;
  onToggleSelect?: (index: number, additive: boolean) => void;
  /** Per-source-index extra rotation in degrees (90/180/270). */
  rotations?: Record<number, number>;
  onRotate?: (index: number, delta: number) => void;
  onRemove?: (index: number) => void;
  maxDimension?: number;
  disabled?: boolean;
}

interface ThumbProps {
  cacheKey: string | null;
  file: File | ArrayBuffer;
  pageIndex: number;
  rotation: number;
  maxDimension: number;
}

const dataUrlCache = new Map<string, string>();

function PageThumb({ cacheKey, file, pageIndex, rotation, maxDimension }: ThumbProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(
    cacheKey ? dataUrlCache.get(`${cacheKey}:${pageIndex}:${rotation}`) ?? null : null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = holderRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || src) return;
    let cancelled = false;
    const cacheId = cacheKey ? `${cacheKey}:${pageIndex}:${rotation}` : null;
    if (cacheId && dataUrlCache.has(cacheId)) {
      setSrc(dataUrlCache.get(cacheId)!);
      return;
    }
    (async () => {
      try {
        const pdf = await getCachedDocument(cacheKey, file);
        const url = await renderPageToDataURL(pdf, pageIndex, maxDimension, rotation);
        if (cancelled) return;
        if (cacheId) dataUrlCache.set(cacheId, url);
        setSrc(url);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, src, cacheKey, file, pageIndex, rotation, maxDimension]);

  return (
    <div
      ref={holderRef}
      className="h-28 bg-surface-container-lowest rounded flex items-center justify-center shadow-inner overflow-hidden relative"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Page ${pageIndex + 1}`} className="max-h-full max-w-full object-contain" draggable={false} />
      ) : failed ? (
        <Icon name="broken_image" size={28} className="text-error" />
      ) : (
        <Icon name="image" size={28} className="text-outline animate-pulse" />
      )}
      <span className="absolute bottom-0.5 right-1 font-label-mono-xs text-label-sm text-on-surface bg-surface-container/80 px-1 rounded">
        {pageIndex + 1}
      </span>
    </div>
  );
}

export default function PageThumbGrid({
  cacheKey,
  file,
  pageCount,
  order,
  onOrderChange,
  selected,
  onToggleSelect,
  rotations = {},
  onRotate,
  onRemove,
  maxDimension = 200,
  disabled = false,
}: PageThumbGridProps) {
  const effectiveOrder = order ?? Array.from({ length: pageCount }, (_, i) => i);
  const dragIndex = useRef<number | null>(null);

  const moveWithin = (from: number, to: number) => {
    if (!onOrderChange || disabled) return;
    if (to < 0 || to >= effectiveOrder.length) return;
    const next = [...effectiveOrder];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onOrderChange(next);
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-space-xs">
      {effectiveOrder.map((sourceIndex, displayIndex) => {
        const isSelected = selected?.has(sourceIndex) ?? false;
        const rotation = rotations[sourceIndex] ?? 0;
        const selectionEnabled = Boolean(onToggleSelect);
        const reorderEnabled = Boolean(onOrderChange) && !disabled;

        return (
          <div
            key={`${sourceIndex}-${displayIndex}`}
            role={selectionEnabled ? "checkbox" : undefined}
            aria-checked={selectionEnabled ? isSelected : undefined}
            tabIndex={0}
            aria-label={`Page ${sourceIndex + 1}${isSelected ? " (selected)" : ""}`}
            draggable={reorderEnabled}
            onDragStart={() => {
              dragIndex.current = displayIndex;
            }}
            onDragOver={(event) => {
              if (reorderEnabled) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex.current !== null && reorderEnabled) {
                moveWithin(dragIndex.current, displayIndex);
              }
              dragIndex.current = null;
            }}
            onDragEnd={() => {
              dragIndex.current = null;
            }}
            onClick={(event) => {
              if (!selectionEnabled || disabled) return;
              onToggleSelect?.(sourceIndex, event.ctrlKey || event.metaKey || event.shiftKey);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (selectionEnabled && !disabled) onToggleSelect?.(sourceIndex, event.ctrlKey || event.metaKey);
              }
              if (reorderEnabled && event.altKey) {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  moveWithin(displayIndex, displayIndex - 1);
                }
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  moveWithin(displayIndex, displayIndex + 1);
                }
              }
            }}
            className={`p-1.5 rounded-lg border transition-all flex flex-col gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isSelected
                ? "border-primary ring-2 ring-primary bg-primary/5"
                : "border-transparent bg-surface-container-low hover:bg-surface-container"
            }`}
          >
            <div className="flex items-center justify-between px-0.5">
              <span className="font-label-mono-xs text-label-sm text-on-surface-variant">
                #{displayIndex + 1}
              </span>
              <span className="flex items-center gap-0.5">
                {onRotate && !disabled && (
                  <button
                    type="button"
                    title="Rotate 90°"
                    aria-label={`Rotate page ${sourceIndex + 1} by 90 degrees`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRotate(sourceIndex, 90);
                    }}
                    className="p-0.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <Icon name="rotate_right" size={14} />
                  </button>
                )}
                {onRemove && !disabled && (
                  <button
                    type="button"
                    title="Remove from sequence"
                    aria-label={`Remove page ${sourceIndex + 1} from the output`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(sourceIndex);
                    }}
                    className="p-0.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors"
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
                {reorderEnabled && (
                  <Icon name="drag_indicator" size={14} className="text-outline cursor-grab" />
                )}
              </span>
            </div>
            <PageThumb
              cacheKey={cacheKey}
              file={file}
              pageIndex={sourceIndex}
              rotation={rotation}
              maxDimension={maxDimension}
            />
          </div>
        );
      })}
    </div>
  );
}
