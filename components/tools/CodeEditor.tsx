"use client";

import { useMemo, useRef } from "react";
import Icon from "@/components/common/Icon";
import { bytesLabel } from "@/hooks/useDownload";

interface CodeEditorProps {
  value: string;
  onChange: (next: string) => void;
  title: string;
  chip?: string;
  chipIcon?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  errorMessage?: string;
  /** Footer left button */
  footerSlot?: React.ReactNode;
  /** class tweak for the value display */
}

/** input editor pane matching the reference styling (header stats + gutter + textarea + footer). */
export default function CodeEditor({
  value,
  onChange,
  title,
  chip,
  chipIcon,
  placeholder,
  minHeight = 380,
  maxHeight = 560,
  errorMessage,
  footerSlot,
}: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const numbers = useMemo(() => {
    const count = Math.max(value.split("\n").length, 24);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [value]);

  return (
    <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
      <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between gap-2">
        <div className="flex items-center gap-space-sm min-w-0">
          <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
          </span>
          <span className="font-headline-sm text-headline-sm text-on-surface">{title}</span>
          {chip && (
            <span className="text-label-mono-xs font-label-mono-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant flex-shrink-0">
              {chip}
            </span>
          )}
        </div>
        <div className="flex items-center gap-space-sm text-label-mono-xs font-label-mono-xs text-on-surface-variant flex-shrink-0">
          <span>{value ? bytesLabel(value) : "0 B"}</span>
          <span className="w-1 h-1 rounded-full bg-surface-container-highest"></span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
              errorMessage
                ? "bg-error-container/30 text-error"
                : value.trim().length > 0
                  ? "bg-secondary-container/20 text-secondary"
                  : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            <Icon name={errorMessage ? "error" : value.trim().length > 0 ? "check_circle" : "cloud_upload"} size={12} />
            <span>{errorMessage ? "Error" : value.trim().length > 0 ? "Ready" : "Awaiting Input"}</span>
          </span>
        </div>
      </div>

      <div
        className="flex flex-1 bg-surface-container-lowest relative overflow-hidden"
        style={{ height: minHeight, maxHeight }}
      >
        <div
          ref={gutterRef}
          className="w-12 py-space-sm select-none bg-surface-container-low/40 text-outline-variant text-right pr-3 font-label-mono-xs text-label-mono-xs leading-[22px] flex flex-col items-end pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          {numbers.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
          }}
          spellCheck={false}
          placeholder={placeholder ?? "Paste here"}
          className="flex-1 bg-transparent text-on-surface p-space-sm leading-[22px] resize-none focus:outline-none selection:bg-primary-container selection:text-on-primary-container font-label-mono-md text-label-mono-md overflow-y-auto whitespace-pre"
          aria-label={`${title} input`}
        />
      </div>

      {footerSlot !== undefined && (
        <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between gap-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant">
          {footerSlot}
        </div>
      )}
    </div>
  );
}
