"use client";

import type { ReactNode } from "react";
import Icon from "@/components/common/Icon";

interface RunBarProps {
  actionLabel: string;
  actionIcon?: string;
  onRun: () => void;
  disabled?: boolean;
  running?: boolean;
  /** 0–100 or null (indeterminate). */
  progress?: number | null;
  message?: string;
  error?: string | null;
  onReset?: () => void;
  rightSlot?: ReactNode;
  hint?: string;
}

/** Stitch "Bottom Action Execution Bar": primary WASM action + reset/status. */
export default function RunBar({
  actionLabel,
  actionIcon = "bolt",
  onRun,
  disabled = false,
  running = false,
  progress = null,
  message = "",
  error = null,
  onReset,
  rightSlot,
  hint,
}: RunBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm pt-2">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onRun}
            disabled={disabled || running}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <Icon name={running ? "progress_activity" : actionIcon} size={20} className={running ? "animate-spin" : ""} />
            <span>{running ? "Working…" : actionLabel}</span>
          </button>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {rightSlot}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              disabled={running}
              title="Reset all settings"
              className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
            >
              <Icon name="restart_alt" size={18} />
            </button>
          )}
        </div>
      </div>
      {hint && !running && !error && (
        <p className="font-body-sm text-body-sm text-outline">{hint}</p>
      )}
      {error && (
        <div className="p-2.5 rounded-lg bg-error-container/40 flex items-start gap-2 text-error">
          <Icon name="error" size={18} className="shrink-0 mt-0.5" />
          <span className="font-body-sm text-body-sm">{error}</span>
        </div>
      )}
      {running && (
        <div className="flex flex-col gap-1">
          <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
            <div
              className={`h-full bg-primary transition-all duration-300 ${progress === null ? "animate-pulse" : ""}`}
              style={{ width: progress === null ? "40%" : `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-label-mono-xs text-label-sm text-outline">
            <span>{message || "Processing…"}</span>
            <span>{progress !== null ? `${progress}%` : "…"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
