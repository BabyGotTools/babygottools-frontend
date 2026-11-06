"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/common/Icon";
import CopyButton from "@/components/tools/CopyButton";
import DownloadButton from "@/components/tools/DownloadButton";
import { LATENCY_EVENT } from "@/components/tools/HeroMetricsCluster";
import { bytesLabel } from "@/hooks/useDownload";
import {
  INDENT_BTN_ACTIVE,
  INDENT_BTN_IDLE,
  RIBBON_BTN,
  RIBBON_BTN_CLEAR,
  RIBBON_BTN_MINIFY,
  RIBBON_BTN_PRIMARY_SOFT,
  RIBBON_INDENT_GROUP,
  RIBBON_KBD,
  RIBBON_MAIN_ACTION,
} from "@/components/tools/ribbonStyles";
import {
  buildJsonTree,
  formatJson,
  inferJsonSchema,
  parseJsonStrict,
  queryJsonPath,
  tokenizeFormattedJson,
  tryRepairJson,
  type JsonErrorInfo,
  type JsonIndent,
  type JsonTreeNode,
} from "./engines/jsonEngine";
import type { DevTool } from "@/data/devToolTypes";

/** DOM id of the ribbon slot inside ToolPageShell's hero card. */
const RIBBON_SLOT = "tool-ribbon-slot";

interface JsonFormatterWorkspaceProps {
  tool: DevTool;
}

type OutputView = "formatted" | "tree" | "schema";

type Outcome = { ok: boolean; output: string; error?: JsonErrorInfo; keys: number; bytes: number };

export default function JsonFormatterWorkspace({ tool }: JsonFormatterWorkspaceProps) {
  const sample = tool.sample ?? "{}";
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<JsonIndent>(2);
  const [sortKeys, setSortKeys] = useState(false);
  const [view, setView] = useState<OutputView>("formatted");
  const [result, setResult] = useState<Outcome | null>(() => formatJson(sample, { indent: 2 }));
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const [filterPath, setFilterPath] = useState("");
  const [filterResult, setFilterResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [repairNote, setRepairNote] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const refresh = useCallback(
    (text: string, opts?: { minify?: boolean }) => {
      const started = typeof performance !== "undefined" ? performance.now() : 0;
      const outcome = formatJson(text, { indent, sortKeys, minify: opts?.minify });
      const ms = typeof performance !== "undefined" ? performance.now() - started : 0;
      window.dispatchEvent(new CustomEvent<number>(LATENCY_EVENT, { detail: ms }));
      setResult(outcome);
      return outcome;
    },
    [indent, sortKeys]
  );

  /* live validation while typing (debounced) */
  useEffect(() => {
    if (input.length === 0) {
      setResult(null);
      return;
    }
    const id = setTimeout(() => refresh(input), 220);
    return () => clearTimeout(id);
  }, [input, refresh]);

  /* re-run when indent / sort options change */
  const prevOpts = useRef({ indent: 2 as JsonIndent, sortKeys: false });
  useEffect(() => {
    if (prevOpts.current.indent === indent && prevOpts.current.sortKeys === sortKeys) return;
    prevOpts.current = { indent, sortKeys };
    if (input.trim().length > 0) refresh(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indent, sortKeys]);

  const handleFormat = () => {
    if (input.trim().length === 0) return;
    refresh(input);
    setRepairNote(null);
    setView("formatted");
  };
  const handleMinify = () => {
    if (input.trim().length === 0) return;
    refresh(input, { minify: true });
    setView("formatted");
  };
  const handleAutoFix = () => {
    if (input.trim().length === 0) return;
    const base = parseJsonStrict(input);
    if (base.ok) {
      setRepairNote("Input is already valid JSON — nothing to fix.");
      setView("formatted");
      return;
    }
    const { repaired, changed, ok } = tryRepairJson(input);
    if (changed) setInput(repaired);
    if (ok) {
      refresh(repaired);
      setRepairNote(changed ? "Heuristic repair applied — re-validated." : "Already valid after refresh.");
      setView("formatted");
    } else if (changed) {
      refresh(repaired);
      setRepairNote("Partial cleanup applied — fix the remaining error marked in the diagnostics below.");
    } else {
      setRepairNote("Couldn't auto-repair this input — follow the error line/col shown in the diagnostics below.");
    }
  };
  const handleClear = () => {
    setInput("");
    setResult(null);
    setFilterResult(null);
    setRepairNote(null);
  };
  const handleSample = () => {
    setInput(sample);
    refresh(sample);
    setRepairNote(null);
  };
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setInput(text);
      refresh(text);
    };
    reader.readAsText(file);
  };
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text);
        refresh(text);
      }
    } catch {
      /* clipboard read denied — best-effort only */
    }
  };

  const updateCaret = () => {
    const el = textareaRef.current;
    if (!el) return;
    const upto = el.value.slice(0, el.selectionStart);
    const lines = upto.split("\n");
    setCaret({ line: lines.length, col: (lines[lines.length - 1]?.length ?? 0) + 1 });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleFormat();
    } else if (e.altKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      handleClear();
    } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      if (result?.ok) void navigator.clipboard?.writeText(result.output);
    }
  };

  const onFilter = () => {
    if (!result?.ok) {
      setFilterResult({ ok: false, text: "Fix the JSON syntax first — filtering needs a valid document." });
      return;
    }
    const parsed = result.ok ? parseJsonStrict(result.output) : null;
    if (!parsed?.ok) {
      setFilterResult({ ok: false, text: parsed?.error.message ?? "Cannot resolve path on invalid input." });
      return;
    }
    const q = queryJsonPath(parsed.value, filterPath);
    setFilterResult({
      ok: q.ok,
      text: q.ok ? JSON.stringify(q.value, null, 2) : q.error ?? "Path could not be resolved.",
    });
  };

  const gutterNumbers = useMemo(() => {
    const count = Math.max(input.split("\n").length, result?.output.split("\n").length ?? 0, 24);
    return Array.from({ length: Math.max(count, 24) }, (_, i) => i + 1);
  }, [input, result]);

  const parsedForUi = input.trim().length === 0 ? null : parseJsonStrict(input);
  const valid = parsedForUi?.ok ?? false;
  const tokens = useMemo(
    () => (result?.ok && view === "formatted" ? tokenizeFormattedJson(result.output) : []),
    [result, view]
  );
  const tree = useMemo(() => {
    if (view !== "tree" || !result?.ok) return null;
    const p = parseJsonStrict(result.output);
    return p.ok ? buildJsonTree(p.value) : null;
  }, [view, result]);
  const schema = useMemo(() => {
    if (view !== "schema" || !result?.ok) return null;
    const p = parseJsonStrict(result.output);
    return p.ok ? inferJsonSchema(p.value) : null;
  }, [view, result]);

  /* ------------------------------- ribbon ------------------------------- */
  const indentOptions: { label: string; value: JsonIndent }[] = [
    { label: "2 Spaces", value: 2 },
    { label: "4 Spaces", value: 4 },
    { label: "Tabs", value: "tabs" },
  ];

  const ribbon = (
    <div className="mt-space-lg pt-space-md flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
      <div className="flex flex-wrap items-center gap-space-xs">
        <button type="button" onClick={handleSample} className={RIBBON_BTN}>
          <Icon name="terminal" size={16} />
          <span>Sample JSON</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={RIBBON_BTN}>
          <Icon name="upload_file" size={16} />
          <span>Upload (.json)</span>
        </button>
        <button type="button" onClick={handleClear} className={RIBBON_BTN_CLEAR}>
          <Icon name="delete_sweep" size={16} />
          <span>Clear</span>
        </button>
        <span className="w-px h-4 bg-surface-container-highest mx-1"></span>
        <button type="button" onClick={handleAutoFix} className={RIBBON_BTN_PRIMARY_SOFT}>
          <Icon name="auto_fix_high" size={16} />
          <span>Auto-Fix Syntax</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className={RIBBON_INDENT_GROUP}>
          {indentOptions.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setIndent(opt.value)}
              className={indent === opt.value ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={handleMinify} className={RIBBON_BTN_MINIFY}>
          <Icon name="compress" size={16} />
          <span>Minify</span>
        </button>
        <button type="button" onClick={handleFormat} className={RIBBON_MAIN_ACTION}>
          <Icon name="format_align_left" size={16} />
          <span>Format JSON</span>
          <kbd className={RIBBON_KBD}>⌘+↵</kbd>
        </button>
      </div>
    </div>
  );

  const ribbonSlot = mounted ? document.getElementById(RIBBON_SLOT) : null;

  return (
    <>
      {/* Dual-pane side-by-side IDE workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        {/* LEFT PANE: raw input editor */}
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Input Editor</span>
              <span className="text-label-mono-xs font-label-mono-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant flex-shrink-0">
                RAW JSON
              </span>
            </div>
            <div className="flex items-center gap-space-sm text-label-mono-xs font-label-mono-xs text-on-surface-variant flex-shrink-0">
              <span>
                Lines: {lineNumberCapped(caret.line, input)} • Col: {caret.col}
              </span>
              <span className="w-1 h-1 rounded-full bg-surface-container-highest"></span>
              <span>{input ? bytesLabel(input) : "0 B"}</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                  valid
                    ? "bg-secondary-container/20 text-secondary"
                    : input.trim().length === 0
                      ? "bg-surface-container-high text-on-surface-variant"
                      : "bg-error-container/30 text-error"
                }`}
              >
                <Icon name={valid ? "check_circle" : input.trim().length === 0 ? "cloud_upload" : "error"} size={12} />
                <span>{valid ? "Valid" : input.trim().length === 0 ? "Awaiting Input" : "Syntax Error"}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-1 min-h-[460px] max-h-[580px] bg-surface-container-lowest relative overflow-hidden">
            <div
              ref={gutterRef}
              className="w-12 py-space-sm select-none bg-surface-container-low/40 text-outline-variant text-right pr-3 font-label-mono-xs text-label-mono-xs leading-[22px] flex flex-col items-end pointer-events-none overflow-hidden"
              aria-hidden="true"
            >
              {gutterNumbers.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyUp={updateCaret}
              onClick={updateCaret}
              onKeyDown={onKeyDown}
              onScroll={(e) => {
                if (gutterRef.current) gutterRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
              }}
              spellCheck={false}
              placeholder='{"key": "value"} — paste raw JSON here, or press Sample JSON'
              className="flex-1 bg-transparent text-on-surface p-space-sm leading-[22px] resize-none focus:outline-none selection:bg-primary-container selection:text-on-primary-container font-label-mono-md text-label-mono-md overflow-y-auto whitespace-pre"
              aria-label="Raw JSON input"
            />
          </div>

          {/* Input footer micro-actions */}
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between gap-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            <button
              type="button"
              onClick={() => void handlePaste()}
              className="hover:text-secondary flex items-center gap-1 transition-colors flex-shrink-0"
            >
              <Icon name="content_paste" size={14} />
              <span>Paste from clipboard</span>
            </button>
            <div className="flex items-center gap-2 min-w-0 justify-end">
              {repairNote && <span className="text-primary truncate hidden md:inline">{repairNote}</span>}
              <span className="text-outline-variant flex-shrink-0">Auto-detecting encoding:</span>
              <span className="text-on-surface">UTF-8</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: output, tree inspector & analytics */}
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-xs flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "formatted", icon: "code", label: "Formatted" },
                  { key: "tree", icon: "account_tree", label: "Tree Inspector" },
                  { key: "schema", icon: "schema", label: "Infer Schema" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setView(tab.key)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-label-mono-md font-label-mono-md ${
                    view === tab.key
                      ? "bg-surface-container-high text-secondary font-semibold"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <Icon name={tab.icon} size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Sort JSON Keys Alphabetically"
                aria-pressed={sortKeys}
                onClick={() => setSortKeys((v) => !v)}
                className={`p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors ${
                  sortKeys ? "text-secondary" : "text-on-surface-variant hover:text-secondary"
                }`}
              >
                <Icon name="sort_by_alpha" size={18} />
              </button>
              <DownloadButton
                value={result?.output ?? ""}
                filename="baby-got-tools-formatted.json"
                mime="application/json;charset=utf-8"
                title="Download Formatted JSON"
              />
              <CopyButton value={result?.ok ? result.output : ""} />
            </div>
          </div>

          {/* Output display canvas */}
          <div className="flex-1 min-h-[460px] max-h-[580px] bg-surface-container-lowest p-space-md font-label-mono-md text-label-mono-md overflow-auto leading-[22px]">
            {!result && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="data_object" size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">
                  Formatted output appears here — press <span className="text-secondary">Format JSON</span> or paste
                  valid JSON.
                </p>
              </div>
            )}
            {result && !result.ok && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-space-md">
                <Icon name="error" size={36} className="text-error" />
                <p className="text-error font-semibold">{result.error?.message}</p>
                {result.error?.line !== undefined && (
                  <p className="text-on-surface-variant">
                    Line {result.error.line}
                    {result.error.column !== undefined ? `, Column ${result.error.column}` : ""}
                  </p>
                )}
              </div>
            )}
            {result?.ok && (
              <>
                {view === "formatted" && (
                  <pre className="text-on-surface select-text overflow-x-auto">
                    <code>
                      {tokens.map((t, i) => {
                        if (t.kind === "text") return <span key={i}>{t.text}</span>;
                        const cls =
                          t.kind === "key"
                            ? "text-secondary"
                            : t.kind === "string"
                              ? "text-tertiary"
                              : t.kind === "number"
                                ? "text-on-surface-variant"
                                : t.kind === "bool"
                                  ? "text-tertiary"
                                  : t.kind === "null"
                                    ? "text-tertiary"
                                    : "text-on-surface";
                        return (
                          <span key={i} className={cls}>
                            {t.text}
                          </span>
                        );
                      })}
                    </code>
                  </pre>
                )}
                {view === "tree" && tree && <TreeInspector node={tree} />}
                {view === "schema" && schema !== null && (
                  <pre className="text-on-surface-variant overflow-x-auto">
                    <code>{JSON.stringify(schema, null, 2)}</code>
                  </pre>
                )}
              </>
            )}
          </div>

          {/* Diagnostic / validation status bar */}
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between flex-wrap gap-1 text-label-mono-xs font-label-mono-xs">
            <div
              className={`flex items-center gap-2 min-w-0 ${
                result?.ok ? "text-secondary" : result ? "text-error" : "text-on-surface-variant"
              }`}
            >
              <Icon name={result?.ok ? "verified" : result ? "close" : "hourglass_empty"} size={16} className="flex-shrink-0" />
              <span className="font-semibold truncate">
                {result?.ok
                  ? "RFC 8259 compliant JSON • Zero Syntax Errors"
                  : result
                    ? (result.error?.message ?? "Validation failed").slice(0, 72)
                    : "Awaiting validation — load the sample or paste JSON"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-on-surface-variant flex-shrink-0">
              <span>AST Tree: {result?.ok ? "Valid" : "—"}</span>
              <span className="hidden sm:inline">•</span>
              {result?.ok && <span>Keys: {result.keys}</span>}
              <span className="hidden sm:inline">•</span>
              <span className="text-secondary font-semibold">100% Client Memory</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time quick JSONPath / filter bar */}
      <div className="bg-surface-container-low rounded-xl p-space-md mb-space-xl flex flex-col md:flex-row items-center justify-between gap-space-md shadow-md">
        <div className="flex items-center gap-space-sm w-full md:w-auto">
          <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
            <Icon name="filter_alt" size={20} className="text-secondary" />
          </div>
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface">Interactive JSONPath / Filter</div>
            <div className="font-body-sm text-body-sm text-on-surface-variant">
              Query nodes instantly without changing raw data
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-xs w-full md:max-w-xl">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-label-mono-xs font-label-mono-xs text-primary font-bold">
              $.
            </span>
            <input
              value={filterPath}
              onChange={(e) => setFilterPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onFilter();
              }}
              className="w-full pl-8 pr-4 py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary placeholder:text-outline-variant"
              placeholder="telemetry.throughput_rps or supported_encodings[0]"
              type="text"
              aria-label="JSONPath query"
            />
          </div>
          <button
            type="button"
            onClick={onFilter}
            className="px-space-md py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-secondary font-label-mono-md text-label-mono-md font-semibold transition-all"
          >
            Filter
          </button>
        </div>
      </div>
      {filterResult && (
        <div
          className={`mb-space-xl rounded-xl p-space-md font-label-mono-md text-label-mono-md overflow-x-auto whitespace-pre-wrap break-all ${
            filterResult.ok ? "bg-surface-container-lowest text-primary" : "bg-error-container/10 text-error"
          }`}
        >
          {filterResult.text}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".json,.txt"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />

      {/* Ribbon rendered into the hero card slot of ToolPageShell */}
      {mounted && ribbonSlot && createPortal(ribbon, ribbonSlot)}
    </>
  );
}

function lineNumberCapped(caretLine: number, input: string): number {
  const total = input ? input.split("\n").length : 1;
  return Math.min(caretLine, total);
}

/* ----------------------------- tree inspector ----------------------------- */

function TreeInspector({ node }: { node: JsonTreeNode }) {
  const rootIsArray = Array.isArray(node.value);
  const countLabel = rootIsArray ? `${node.childCount} items` : `${node.childCount} properties`;
  return (
    <div className="space-y-1">
      <TreeRow node={node} root countLabel={countLabel} />
    </div>
  );
}

function TreeRow({ node, root, countLabel }: { node: JsonTreeNode; root?: boolean; countLabel?: string }) {
  const collapsible = node.children !== undefined && node.children.length > 0;
  const [open, setOpen] = useState(true);
  const isBranch = collapsible;
  const rootLabel =
    root && countLabel !== undefined
      ? Array.isArray(node.value)
        ? `[${countLabel}]`
        : `{${countLabel}}`
      : "";

  const valueNode = !isBranch && (
    <ValueLabel value={node.value} />
  );

  if (root) {
    return (
      <div>
        <button
          type="button"
          onClick={() => isBranch && setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-on-surface cursor-pointer hover:bg-surface-container/50 px-2 py-1 rounded w-full text-left"
        >
          {isBranch && (
            <Icon
              name="expand_more"
              size={16}
              className={`text-secondary transition-transform ${open ? "" : "-rotate-90"}`}
            />
          )}
          <span className="font-bold text-secondary">{node.key}</span>
          <span className="text-outline-variant text-label-mono-xs font-label-mono-xs">
            {rootLabel}
          </span>
        </button>
        {isBranch && open && <div className="pl-5 space-y-1">{node.children!.map((c) => renderChild(c))}</div>}
      </div>
    );
  }

  return null;
}

function renderChild(child: JsonTreeNode) {
  const branch = child.children !== undefined && child.children.length > 0;
  const isIndexChild = /^\d+$/.test(child.key);
  if (branch) {
    return (
      <TreeBranchRow
        key={`${child.key}-${child.keyIndex}`}
        node={child}
        countLabel={Array.isArray(child.value) ? `${child.childCount} items` : `${child.childCount} properties`}
      />
    );
  }
  return (
    <div key={`${child.key}-${child.keyIndex}`} className="flex items-center gap-2 hover:bg-surface-container/40 px-2 py-0.5 rounded">
      {!isIndexChild && <Icon name="fiber_manual_record" size={14} className="text-outline flex-shrink-0" />}
      {isIndexChild && <span className="text-outline-variant text-label-mono-xs font-label-mono-xs">{child.key}:</span>}
      {!isIndexChild && <span className="text-secondary font-medium">{child.key}:</span>}
      <ValueLabel value={child.value} />
    </div>
  );
}

interface TreeBranchRowProps {
  node: JsonTreeNode;
  countLabel: string;
}

function TreeBranchRow({ node, countLabel }: TreeBranchRowProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-on-surface cursor-pointer hover:bg-surface-container/50 px-2 py-1 rounded w-full text-left"
      >
        <Icon
          name="expand_more"
          size={16}
          className={`text-secondary transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="text-secondary font-medium">{node.key}:</span>
        <span className="text-outline-variant text-label-mono-xs font-label-mono-xs">
          {Array.isArray(node.value) ? `[${countLabel}]` : `{${countLabel}}`}
        </span>
      </button>
      {open && <div className="pl-5 space-y-0.5">{node.children!.map((c) => renderChild(c))}</div>}
    </div>
  );
}

function ValueLabel({ value }: { value: unknown }) {
  if (typeof value === "string") return <span className="text-primary">&quot;{value}&quot;</span>;
  if (typeof value === "number") return <span className="text-tertiary-fixed">{String(value)}</span>;
  if (typeof value === "boolean") return <span className="text-tertiary">{String(value)}</span>;
  if (value === null) return <span className="text-outline">null</span>;
  return <span className="text-outline-variant">{String(value)}</span>;
}
