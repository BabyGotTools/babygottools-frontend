"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/common/Icon";
import CodeEditor from "@/components/tools/CodeEditor";
import CopyButton from "@/components/tools/CopyButton";
import DownloadButton from "@/components/tools/DownloadButton";
import { LATENCY_EVENT } from "@/components/tools/HeroMetricsCluster";
import {
  INDENT_BTN_ACTIVE,
  INDENT_BTN_IDLE,
  RIBBON_BTN,
  RIBBON_BTN_CLEAR,
  RIBBON_INDENT_GROUP,
  RIBBON_KBD,
  RIBBON_MAIN_ACTION,
} from "@/components/tools/ribbonStyles";
import { bytesLabel } from "@/hooks/useDownload";

export interface WorkbenchProps {
  /** Input placeholder */
  placeholder: string;
  sample?: string;
  /** Output file extension incl. dot */
  fileExtension: string;
  /** mime type for the download */
  mime: string;
  buttonLabel: string;
  /** main action icon */
  buttonIcon: string;
  inputTitle: string;
  inputChip: string;
  outputTitle: string;
  outputChip: string;
  outputPlaceholder: string;
  /** Extra controls rendered in the ribbon (left side, after Clear) */
  extraControls?: React.ReactNode;
  /** Indent selector config; omit to hide */
  indentOptions?: { label: string; value: string }[];
  defaultIndent?: string;
  /** process function */
  run: (input: string, opts: { indent: string }) => Promise<string>;
  /** validate input without running (for live status pill); return error message or null */
  validate?: (input: string) => string | null;
  /** status note lines for output status bar */
  outputStats?: (output: string) => { label: string; value: string }[];
  outputFooterNote?: string;
  /** lazy libraries are heavy — show a running state */
}

/**
 * Generic dual-pane formatter workbench matching the Stitch tool design
 * language (editor left, output right, hero ribbon controls).
 * Powers most single-in/single-out tools.
 */
export default function FormatterWorkbench({
  placeholder,
  sample,
  fileExtension,
  mime,
  buttonLabel,
  buttonIcon,
  inputTitle,
  inputChip,
  outputTitle,
  outputChip,
  outputPlaceholder,
  extraControls,
  indentOptions,
  defaultIndent,
  run,
  validate,
  outputStats,
  outputFooterNote,
}: WorkbenchProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [indent, setIndent] = useState<string>(defaultIndent ?? "");
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const process = useCallback(
    async (text = input, opts?: { minify?: boolean; indentOverride?: string }) => {
      if (text.trim().length === 0) {
        setError("Awaiting input — paste your content first.");
        return;
      }
      setBusy(true);
      try {
        const started = performance.now();
        const out = await run(text, { indent: opts?.indentOverride ?? indent });
        const ms = performance.now() - started;
        window.dispatchEvent(new CustomEvent<number>(LATENCY_EVENT, { detail: ms }));
        setOutput(out);
        setError(null);
      } catch (e) {
        setOutput("");
        setError(e instanceof Error ? e.message : "Processing failed.");
      } finally {
        setBusy(false);
      }
    },
    [input, indent, run]
  );

  const liveError = useMemo(() => (validate && input.trim().length > 0 ? validate(input) : null), [input, validate]);

  const windowKeydown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void process();
      } else if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        setInput("");
        setOutput("");
        setError(null);
      }
    },
    [process]
  );
  useEffect(() => {
    window.addEventListener("keydown", windowKeydown);
    return () => window.removeEventListener("keydown", windowKeydown);
  }, [windowKeydown]);

  const numberCount = Math.max(input.split("\n").length, 24);
  void numberCount;
  const ribbon = (
    <div className="mt-space-lg pt-space-md flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
      <div className="flex flex-wrap items-center gap-space-xs">
        {sample && (
          <button type="button" onClick={() => setInput(sample)} className={RIBBON_BTN}>
            <Icon name="terminal" size={16} />
            <span>Sample Input</span>
          </button>
        )}
        <button type="button" onClick={() => fileRef.current?.click()} className={RIBBON_BTN}>
          <Icon name="upload_file" size={16} />
          <span>Upload</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setInput("");
            setOutput("");
            setError(null);
          }}
          className={RIBBON_BTN_CLEAR}
        >
          <Icon name="delete_sweep" size={16} />
          <span>Clear</span>
        </button>
        <span className="w-px h-4 bg-surface-container-highest mx-1"></span>
        {extraControls}
      </div>
      <div className="flex flex-wrap items-center gap-space-xs">
        {indentOptions && indentOptions.length > 0 && (
          <div className={RIBBON_INDENT_GROUP}>
            {indentOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIndent(opt.value)}
                className={indent === opt.value ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => void process()}
          disabled={busy}
          className={`${RIBBON_MAIN_ACTION} ${busy ? "opacity-60" : ""}`}
        >
          <Icon name={busy ? "progress_activity" : buttonIcon} size={16} className={busy ? "animate-spin" : ""} />
          <span>{busy ? "Working…" : buttonLabel}</span>
          <kbd className={RIBBON_KBD}>⌘+↵</kbd>
        </button>
      </div>
    </div>
  );

  const slot = mounted ? document.getElementById("tool-ribbon-slot") : null;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor
          value={input}
          onChange={setInput}
          title={inputTitle}
          chip={inputChip}
          placeholder={placeholder}
          errorMessage={liveError ?? undefined}
          footerSlot={
            <>
              <span>Paste freely — nothing is uploaded anywhere.</span>
              <span className="flex items-center gap-2 justify-end min-w-0">
                <span className="truncate">{liveError ? "Fix syntax errors to continue." : "UTF-8 • Client-side"}</span>
              </span>
            </>
          }
        />

        {/* Output pane */}
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">{outputTitle}</span>
              <span className="text-label-mono-xs font-label-mono-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant flex-shrink-0">
                {outputChip}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <DownloadButton
                value={output}
                filename={`baby-got-tools-output${fileExtension}`}
                mime={mime}
                title="Download output"
              />
              <CopyButton value={output} />
            </div>
          </div>

          <div
            className="flex-1 bg-surface-container-lowest p-space-md font-label-mono-md text-label-mono-md overflow-auto leading-[22px]"
            style={{ height: 380, maxHeight: 560 }}
          >
            {error ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-space-md">
                <Icon name="error" size={36} className="text-error" />
                <p className="text-error font-semibold">{error}</p>
              </div>
            ) : output ? (
              <pre className="text-on-surface select-text overflow-x-auto whitespace-pre-wrap break-words">
                <code>{output}</code>
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name={buttonIcon} size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">{outputPlaceholder}</p>
              </div>
            )}
          </div>

          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between flex-wrap gap-1 text-label-mono-xs font-label-mono-xs">
            <div className={`flex items-center gap-2 min-w-0 ${error ? "text-error" : output ? "text-secondary" : "text-on-surface-variant"}`}>
              <Icon name={error ? "close" : output ? "verified" : "hourglass_empty"} size={16} className="flex-shrink-0" />
              <span className="font-semibold truncate">
                {error ? error.slice(0, 72) : output ? "Processed successfully • 100% Client Memory" : "Awaiting processing"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-on-surface-variant flex-shrink-0">
              {output &&
                (outputStats?.(output) ?? []).map((s) => (
                  <span key={s.label}>
                    {s.label}: <span className="text-secondary font-semibold">{s.value}</span>
                  </span>
                ))}
              {output && <span className="hidden sm:inline">•</span>}
              <span className={output ? "text-secondary font-semibold" : ""}>{outputFooterNote ?? output ? bytesLabel(output) : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {mounted && slot ? createPortal(ribbon, slot) : null}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const reader = new FileReader();
            reader.onload = () => {
              const text = String(reader.result ?? "");
              setInput(text);
              void process(text);
            };
            reader.readAsText(f);
          }
          e.target.value = "";
        }}
      />
    </>
  );
}


