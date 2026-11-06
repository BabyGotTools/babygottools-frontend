"use client";

/** Encoder & converter workspaces. */

import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/common/Icon";
import CodeEditor from "@/components/tools/CodeEditor";
import CopyButton from "@/components/tools/CopyButton";
import FormatterWorkbench from "./FormatterWorkbench";
import { encodeBase64, decodeBase64, encodeUrl, decodeUrl } from "../engines/encoders";
import { csvToJson, jsonToCsv } from "../engines/csvEngine";
import { yamlToJson } from "../engines/yamlEngine";
import { formatCode, minifyHtml } from "../engines/codeFormat";
import {
  RIBBON_BTN,
  RIBBON_BTN_CLEAR,
  RIBBON_BTN_MINIFY,
  RIBBON_KBD,
  RIBBON_MAIN_ACTION,
} from "@/components/tools/ribbonStyles";

/* ------------------------------- Base64 ----------------------------------- */

export function Base64Workspace() {
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) => {
      if (opts.indent === "decode") {
        const res = decodeBase64(input);
        if (!res.ok) throw new Error(res.error);
        return res.text;
      }
      return encodeBase64(input, opts.indent === "urlsafe", opts.indent === "urlsafe-nopad");
    },
    []
  );
  return (
    <FormatterWorkbench
      placeholder="Type text to encode, or paste Base64 to decode…"
      sample="Baby Got Tools — little tools, big possibilities 🚀"
      fileExtension=".txt"
      mime="text/plain;charset=utf-8"
      buttonLabel="Transform"
      buttonIcon="swap_horiz"
      inputTitle="Input"
      inputChip="UTF-8 SAFE"
      outputTitle="Result"
      outputChip="TRANSFORMED"
      outputPlaceholder="Encoded or decoded result appears here — full Unicode & emoji fidelity."
      indentOptions={[
        { label: "Encode →", value: "encode" },
        { label: "← Decode", value: "decode" },
        { label: "URL-Safe", value: "urlsafe" },
      ]}
      defaultIndent="encode"
      run={run}
      outputStats={(out) => [{ label: "Output", value: `${out.length} chars` }]}
      outputFooterNote="RFC 4648 compliant"
    />
  );
}

/* --------------------------------- URL ------------------------------------ */

export function UrlWorkspace() {
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) => {
      if (opts.indent === "decode-c" || opts.indent === "decode-u") {
        const res = decodeUrl(input, opts.indent === "decode-c" ? "component" : "whole");
        if (!res.ok) throw new Error(res.error);
        return res.text;
      }
      return encodeUrl(input, opts.indent === "encode-u" ? "whole" : "component");
    },
    []
  );
  return (
    <FormatterWorkbench
      placeholder="https://example.com/search?q=hello world&tag=工具"
      sample="https://babygottools.com/search?q=hello world&filter=工具"
      fileExtension=".txt"
      mime="text/plain;charset=utf-8"
      buttonLabel="Transform"
      buttonIcon="link"
      inputTitle="URL / Text"
      inputChip="RFC 3986"
      outputTitle="Result"
      outputChip="PERCENT-ENCODED / DECODED"
      outputPlaceholder="Result appears here — component vs whole-URL encoding kept explicit."
      indentOptions={[
        { label: "Component Encode →", value: "encode-c" },
        { label: "Whole-URL Encode →", value: "encode-u" },
        { label: "← Decode", value: "decode-c" },
      ]}
      defaultIndent="encode-c"
      run={run}
      outputFooterNote="Never confuses encodeURI with encodeURIComponent"
    />
  );
}

/* ------------------------------ CSV → JSON -------------------------------- */

export function CsvToJsonWorkspace() {
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) => {
      const delimiter = opts.indent.startsWith("d:") ? opts.indent.slice(2) : ",";
      const rows = await csvToJson(input, { delimiter: delimiter as string, headers: true });
      return JSON.stringify(rows, null, 2);
    },
    []
  );
  return (
    <FormatterWorkbench
      placeholder="id,name,role\n1,Baby Got Tools,engineer"
      sample={`id,name,role,signed_up\n1,"Baby Got Tools",engineer,2025-10-25\n2,"Doe, John",designer,2024-01-01`}
      fileExtension=".json"
      mime="application/json;charset=utf-8"
      buttonLabel="Convert to JSON"
      buttonIcon="table_chart"
      inputTitle="CSV Input"
      inputChip="RFC 4180"
      outputTitle="JSON Output"
      outputChip="ARRAY OF OBJECTS"
      outputPlaceholder="Parsed rows appear here — quoted commas, newlines in quotes, escaped delimiters handled."
      indentOptions={[
        { label: `, Delim`, value: "d:," },
        { label: `; Delim`, value: "d:;" },
        { label: `Tab Delim`, value: "d:\t" },
        { label: `| Delim`, value: "d:|" },
      ]}
      defaultIndent="d:,"
      run={run}
      outputStats={(out) => [{ label: "Rows", value: String((out.match(/\n  \{/g) ?? []).length) }]}
      outputFooterNote="Headers promoted to keys"
    />
  );
}

/* ------------------------------ JSON → CSV -------------------------------- */

export function JsonToCsvWorkspace() {
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) => {
      const delimiter = opts.indent.startsWith("d:") ? opts.indent.slice(2) : ",";
      const { csv } = await jsonToCsv(input, { delimiter });
      return csv;
    },
    []
  );
  return (
    <FormatterWorkbench
      placeholder='[\n  { "id": 1, "name": "Baby Got Tools" }\n]'
      sample={`[\n  { "id": 1, "name": "Baby Got Tools", "role": "engineer", "tags": ["core", "client"] },\n  { "id": 2, "name": "Doe, John", "role": "designer", "tags": ["brand"] }\n]`}
      fileExtension=".csv"
      mime="text/csv;charset=utf-8"
      buttonLabel="Convert to CSV"
      buttonIcon="file_download"
      inputTitle="JSON Input"
      inputChip="ARRAY OF OBJECTS"
      outputTitle="CSV Output"
      outputChip="RFC 4180"
      outputPlaceholder="CSV appears here — nested objects flatten to dot keys, missing keys become empty cells."
      indentOptions={[
        { label: `, Delim`, value: "d:," },
        { label: `; Delim`, value: "d:;" },
        { label: `Tab Delim`, value: "d:\t" },
      ]}
      defaultIndent="d:,"
      run={run}
      outputFooterNote="Commas/quotes/newlines escaped"
    />
  );
}

/* ---------------------------- YAML → JSON ---------------------------------- */

export function YamlToJsonWorkspace() {
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) => {
      const res = await yamlToJson(input, opts.indent === "4" ? 4 : 2);
      if (!res.ok) {
        throw new Error(`${res.error?.message ?? "Invalid YAML"}${res.error?.line ? ` (line ${res.error.line})` : ""}`);
      }
      return res.output;
    },
    []
  );
  return (
    <FormatterWorkbench
      placeholder="service:\n  name: baby-got-tools"
      sample={`cluster_id: "us-east-bgt-09"\nengine: "BabyGotTools_AST_v2"\nactive: true\nnodes: 4\ntelemetry:\n  latency_p99_ms: 1.48\n  throughput_rps: 94820\nsupported_encodings:\n  - "utf-8"\n  - "base64"\nsecurity_policy:\n  zero_retention: true\n  isolated_workers: true`}
      fileExtension=".json"
      mime="application/json;charset=utf-8"
      buttonLabel="Convert to JSON"
      buttonIcon="sync_alt"
      inputTitle="YAML Input"
      inputChip="YAML 1.2"
      outputTitle="JSON Output"
      outputChip="LOSSLESS"
      outputPlaceholder="Converted JSON appears here — strict validation reports line numbers on errors."
      indentOptions={[
        { label: "2 Spaces", value: "2" },
        { label: "4 Spaces", value: "4" },
      ]}
      defaultIndent="2"
      run={run}
      outputFooterNote="Semantics preserved"
    />
  );
}

/* --------------------------- HTML Viewer workspace -------------------------- */

export function HtmlViewerWorkspace() {
  const [input, setInput] = useState("");
  const [formatted, setFormatted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"preview" | "outlined">("preview");
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const doFormat = async (text = input, minify = false) => {
    if (text.trim().length === 0) {
      setError("Awaiting input — paste HTML to format or preview.");
      return;
    }
    try {
      const out = minify ? await minifyHtml(text) : await formatCode(text, "html" as never, { indent: 2, semi: true, singleQuote: false, useTabs: false });
      setFormatted(out);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "HTML could not be formatted.");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void doFormat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const domOutline = useMemo(() => buildOutline(input), [input]);
  const slot = mounted ? document.getElementById("tool-ribbon-slot") : null;

  const ribbon = (
    <div className="mt-space-lg pt-space-md flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
      <div className="flex flex-wrap items-center gap-space-xs">
        <button type="button" onClick={() => setInput(sampleHtml)} className={RIBBON_BTN}>
          <Icon name="terminal" size={16} />
          <span>Sample HTML</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={RIBBON_BTN}>
          <Icon name="upload_file" size={16} />
          <span>Upload</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setInput("");
            setFormatted("");
            setError(null);
          }}
          className={RIBBON_BTN_CLEAR}
        >
          <Icon name="delete_sweep" size={16} />
          <span>Clear</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-space-xs">
        <button type="button" onClick={() => void doFormat(input, true)} className={RIBBON_BTN_MINIFY}>
          <Icon name="compress" size={16} />
          <span>Minify</span>
        </button>
        <button type="button" onClick={() => void doFormat()} className={RIBBON_MAIN_ACTION}>
          <Icon name="format_align_left" size={16} />
          <span>Format HTML</span>
          <kbd className={RIBBON_KBD}>⌘+↵</kbd>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        {/* Input editor */}
        <CodeEditor
          value={input}
          onChange={setInput}
          title="HTML Input"
          chip="SANDBOX TARGET"
          placeholder="<!DOCTYPE html> — paste markup here"
          errorMessage={error ?? undefined}
          minHeight={430}
          footerSlot={
            <span className="flex items-center gap-1">
              <Icon name="shield" size={14} className="text-tertiary" />
              <span>Preview renders in an isolated iframe — zero same-origin access</span>
            </span>
          }
        />

        {/* Preview / outline pane */}
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-xs flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "preview", icon: "visibility", label: "Preview" },
                  { key: "outlined", icon: "account_tree", label: "DOM Outline" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-label-mono-md font-label-mono-md ${
                    tab === t.key ? "bg-surface-container-high text-secondary font-semibold" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <Icon name={t.icon} size={16} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-outline-variant">sandboxed iframe • no same-origin access</span>
          </div>
          <div className="flex-1 bg-surface-container-lowest" style={{ height: 430 }}>
            {tab === "preview" ? (
              <iframe
                title="HTML preview"
                sandbox=""
                className="w-full h-full bg-white"
                /* user markup renders inside a fully restricted frame — no scripts, no same-origin */
                srcDoc={input || "<!-- preview appears here -->"}
              />
            ) : (
              <pre className="p-space-md font-label-mono-md text-label-mono-md text-on-surface leading-[22px] overflow-auto whitespace-pre">
                {domOutline || "Paste HTML to inspect its structure."}
              </pre>
            )}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            <span className="flex items-center gap-2">
              <Icon name="shield" size={16} className="text-tertiary" />
              <span className="font-semibold text-tertiary">Scripts never execute on this page</span>
            </span>
            <span>{input ? `${input.length} chars` : "empty"}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-error-container/10 text-error rounded-xl p-space-md mb-space-xl font-label-mono-md text-label-mono-md flex items-center gap-2">
          <Icon name="error" size={18} />
          <span>{error}</span>
        </div>
      )}

      {formatted.length > 0 && (
        <div className="bg-surface-container rounded-xl p-space-md mb-space-xl shadow-lg">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-headline-sm text-headline-sm text-on-surface">Formatted Output</span>
            <CopyButton value={formatted} />
          </div>
          <pre className="bg-surface-container-lowest p-space-md rounded-lg text-on-surface font-label-mono-md text-label-mono-md overflow-x-auto leading-[22px]">{formatted}</pre>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm,.txt"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const reader = new FileReader();
            reader.onload = () => setInput(String(reader.result ?? ""));
            reader.readAsText(f);
          }
          e.target.value = "";
        }}
      />
      {mounted && slot && createPortal(ribbon, slot)}
    </>
  );
}

const sampleHtml = `<!DOCTYPE html>
<html lang="en">
  <body>
      <div id="app"><h1>Baby Got Tools</h1><p>Little tools. <strong>Big possibilities.</strong></p>
    <!-- untidy markup gets cleaned up -->
  </body>
</html>`;

/** Indent-aware tree outline for the DOM shape. */
function buildOutline(html: string): string {
  if (html.trim().length === 0) return "";
  const tagRe = /<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  const lines: string[] = [];
  let depth = 0;
  const voidEls = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const [full, tag, attrs, text] = m;
    if (text !== undefined) {
      const t = text.trim();
      if (t) lines.push(`${"  ".repeat(depth)}• ${t.length > 40 ? `${t.slice(0, 40)}…` : t}`);
      continue;
    }
    if (!tag) continue;
    const isClose = full.startsWith("</");
    const selfClose = attrs?.endsWith("/") === true;
    const name = tag.toLowerCase();
    if (isClose) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    lines.push(`${"  ".repeat(depth)}<${name}${attrs && attrs.trim() ? ` ${attrs.trim().slice(0, 30)}` : ""}>`);
    if (!voidEls.has(name) && !selfClose) depth++;
  }
  return lines.join("\n");
}
