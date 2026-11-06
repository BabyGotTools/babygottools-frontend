"use client";

import { useState, type ReactNode } from "react";
import Icon from "@/components/common/Icon";
import { downloadBytes, openBytesInNewTab } from "../engines/pdfRender";
import { formatBytes, type StatsVerdict } from "../engines/optimizeUtils";
import type { SizeLine } from "../engines/pdfTypes";

interface ResultCardProps {
  title?: string;
  /** Original size in bytes (gauge hidden when omitted). */
  beforeBytes?: number;
  /** Output size in bytes (gauge hidden when omitted). */
  afterBytes?: number;
  verdict?: StatsVerdict | null;
  /** Component Byte Breakdown rows (before shown with line-through). */
  sizeLines?: SizeLine[];
  fileName: string;
  bytes: Uint8Array | null;
  mimeType?: string;
  downloadLabel?: string;
  quickView?: boolean;
  warnings?: string[];
  /** Extra content under the actions (e.g. extracted text preview). */
  children?: ReactNode;
}

const lineIcons: Record<string, string> = {
  default: "code",
  "Page rasters (JPEG)": "image",
  "Structure & streams": "data_object",
  "Document structure": "data_object",
};

/** Stitch right-column output card: gauge, byte breakdown, download actions. */
export default function ResultCard({
  title = "Estimated Compression Output",
  beforeBytes,
  afterBytes,
  verdict,
  sizeLines,
  fileName,
  bytes,
  mimeType = "application/pdf",
  downloadLabel = "Download PDF",
  quickView = true,
  warnings = [],
  children,
}: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  const hasGauge = beforeBytes !== undefined && afterBytes !== undefined && beforeBytes > 0;
  const retainedPercent =
    hasGauge && afterBytes !== undefined
      ? Math.min(100, Math.max(0, (afterBytes / (beforeBytes || 1)) * 100))
      : 0;
  const savedPercent = hasGauge ? 100 - retainedPercent : 0;

  const copyUrl = async () => {
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: mimeType }));
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Blob URL (Ctrl+C to copy):", url);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
      <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
        <div className="flex items-center gap-2">
          <Icon name="donut_large" size={20} className="text-tertiary" />
          <span className="font-headline-sm text-headline-sm text-on-surface font-bold">{title}</span>
        </div>
        {verdict && (
          <span
            className={`px-2.5 py-0.5 rounded-full font-label-mono-xs font-bold text-label-sm ${
              verdict.tone === "good"
                ? "bg-tertiary-fixed/40 text-tertiary"
                : verdict.tone === "warn"
                  ? "bg-error-container/40 text-error"
                  : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {verdict.headline}
          </span>
        )}
      </div>

      {hasGauge && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-body-sm font-body-sm">
            <div className="flex flex-col">
              <span className="text-outline font-label-sm text-label-sm">BEFORE</span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {formatBytes(beforeBytes || 0)}
              </span>
            </div>
            <Icon name="arrow_forward" size={20} className="text-outline" />
            <div className="flex flex-col items-end">
              <span className="text-primary font-label-sm text-label-sm font-semibold">AFTER (LOCAL)</span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                {formatBytes(afterBytes || 0)}
              </span>
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-surface-container overflow-hidden flex mt-1">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${retainedPercent}%` }} />
            <div className="h-full bg-tertiary/70 transition-all duration-300" style={{ width: `${savedPercent}%` }} />
          </div>
          <div className="flex items-center justify-between font-label-mono-xs text-label-sm text-outline">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Retained Bytes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-tertiary inline-block" /> Pruned / Saved
            </span>
          </div>
        </div>
      )}

      {verdict?.detail && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">{verdict.detail}</p>
      )}

      {sizeLines && sizeLines.length > 0 && (
        <div className="flex flex-col gap-1.5 bg-surface-container-low p-3 rounded-lg">
          <span className="font-label-mono-xs text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-semibold">
            Component Byte Breakdown
          </span>
          {sizeLines.map((line) => (
            <div
              key={line.label}
              className="flex items-center justify-between py-1 border-b border-outline-variant/30 last:border-b-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon name={lineIcons[line.label] ?? "code"} size={16} className="text-on-surface-variant" />
                <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">{line.label}</span>
              </div>
              <div className="font-label-mono-xs text-label-sm flex items-center gap-2 shrink-0">
                {line.before > 0 && line.before !== line.after && (
                  <span className="text-outline line-through">{formatBytes(line.before)}</span>
                )}
                <span className="text-on-surface font-semibold">{formatBytes(line.after)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {children}

      {bytes && (
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => downloadBytes(bytes, fileName, mimeType)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-tertiary text-on-tertiary font-headline-sm text-headline-sm font-semibold hover:opacity-90 transition-all shadow-sm active:scale-[0.99]"
          >
            <Icon name="download" size={20} />
            <span>{downloadLabel}</span>
          </button>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={copyUrl}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-body-sm font-medium transition-colors"
            >
              <Icon name="link" size={16} />
              <span>{copied ? "Copied!" : "Copy Blob URL"}</span>
            </button>
            {quickView && mimeType === "application/pdf" && (
              <button
                type="button"
                onClick={() => openBytesInNewTab(bytes, mimeType)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-body-sm font-medium transition-colors"
              >
                <Icon name="preview" size={16} />
                <span>Quick View</span>
              </button>
            )}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-2.5 rounded-lg bg-surface-container-low flex items-start gap-2 text-on-surface-variant">
          <Icon name="info" size={18} className="shrink-0 mt-0.5 text-secondary" />
          <ul className="font-body-sm text-body-sm leading-tight list-disc list-inside">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-2.5 rounded-lg bg-tertiary-fixed/30 flex items-center gap-2 text-tertiary">
        <Icon name="verified" size={18} className="shrink-0" />
        <span className="font-body-sm text-body-sm leading-tight">
          <strong>Zero-Outbound Guarantee:</strong> Every byte was processed in this tab&apos;s local
          V8/WASM sandbox. 0 outbound network bytes.
        </span>
      </div>
    </div>
  );
}
