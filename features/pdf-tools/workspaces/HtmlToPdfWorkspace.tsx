"use client";

import { useEffect, useRef, useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, SelectField, ToggleRow } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { sanitizeHtml } from "../engines/sanitizeHtmlEngine";
import { renderHtmlToPdf, type HtmlConvertOptions } from "../engines/htmlPdf";
import { MARGIN_POINTS } from "../engines/convertShared";

/**
 * HTML-to-PDF: hard sandboxing. The pasted document is sanitized (DOMPurify
 * + attribute scrubbing), previewed in a permission-less sandboxed iframe,
 * and rendered offscreen. No URL fetching — content only enters via paste
 * or file drop, and remote resources are stripped before rendering.
 */
export default function HtmlToPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "text", maxFiles: 1 });
  const job = usePdfJob();
  const [html, setHtml] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [pageOptions, setPageOptions] = useState<HtmlConvertOptions>({
    pageSize: "a4",
    orientation: "portrait",
    margin: "medium",
    headerFooter: "page-number",
    customHeader: "",
    customFooter: "",
    printBackgrounds: true,
  });
  const [clean, setClean] = useState<{ html: string; warnings: string[] } | null>(null);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const first = files.files[0];
  const frameRef = useRef<HTMLIFrameElement>(null);

  const loadFile = async (list: FileList) => {
    files.addFiles(list);
    const file = list[0];
    if (file) {
      setHtml(await file.text());
      setOutput(null);
    }
  };

  // Live sanitized preview inside a permission-less sandboxed iframe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!html.trim()) {
        setClean(null);
        return;
      }
      try {
        const sanitized = await sanitizeHtml(html);
        if (!cancelled) setClean({ html: sanitized.html, warnings: sanitized.warnings });
      } catch {
        if (!cancelled) setClean(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [html]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.srcdoc = clean
      ? `<!doctype html><html><head><style>${customCss}</style></head><body>${clean.html}</body></html>`
      : "";
  }, [clean, customCss]);

  const run = () =>
    job.start(async (report) => {
      if (!html.trim()) throw new Error("Add some content before converting");

      report({ phase: "reading", percent: 10, message: "Sanitizing HTML…" });
      const sanitized = await sanitizeHtml(html);
      setWarnings(sanitized.warnings);

      report({ phase: "rasterizing", percent: 30, message: "Rendering layout…" });
      const outcome = await renderHtmlToPdf(
        sanitized.html,
        [sanitized.css, customCss].filter(Boolean).join("\n"),
        pageOptions,
        (percent, message) => {
          report({ phase: "rebuilding", percent: Math.max(30, percent), message });
        }
      );
      setWarnings([...sanitized.warnings, ...outcome.warnings]);
      setOutput(outcome.bytes);
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={loadFile}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            title="Drop an .html file — or paste markup below"
            subtitle="No URL fetching: only pasted/dropped content is processed, remote assets are stripped."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && <FileInspectorCard file={first} metaLine="HTML source" />}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                HTML source ({html.length.toLocaleString()} chars)
              </span>
              <textarea
                value={html}
                onChange={(event) => {
                  setHtml(event.target.value);
                  setOutput(null);
                }}
                disabled={job.running}
                rows={10}
                placeholder="<h1>Invoice</h1><p>Rendered <strong>locally</strong>…"
                className="w-full bg-surface-container-low p-3 rounded-lg font-label-mono-xs text-label-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {/* Sandboxed preview */}
              <div className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Sanitized preview (sandboxed iframe)
                </span>
                <iframe
                  ref={frameRef}
                  title="Sanitized HTML preview"
                  sandbox=""
                  className="w-full h-56 rounded-lg bg-white border border-outline-variant/40"
                />
              </div>
              <Accordion title="Page Setup" icon="straighten" defaultOpen>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <SelectField
                    label="Page size"
                    value={pageOptions.pageSize}
                    onChange={(next) => {
                      setPageOptions((current) => ({ ...current, pageSize: next as HtmlConvertOptions["pageSize"] }));
                      setOutput(null);
                    }}
                    options={[
                      { value: "a4", label: "A4" },
                      { value: "letter", label: "US Letter" },
                      { value: "legal", label: "US Legal" },
                    ]}
                    disabled={job.running}
                  />
                  <SelectField
                    label="Margins"
                    value={pageOptions.margin}
                    onChange={(next) => {
                      setPageOptions((current) => ({ ...current, margin: next as HtmlConvertOptions["margin"] }));
                      setOutput(null);
                    }}
                    options={Object.keys(MARGIN_POINTS).map((key) => ({
                      value: key,
                      label: `${key[0].toUpperCase()}${key.slice(1)} (${MARGIN_POINTS[key as keyof typeof MARGIN_POINTS]}pt)`,
                    }))}
                    disabled={job.running}
                  />
                </div>
                <ToggleRow
                  checked={pageOptions.printBackgrounds}
                  onChange={(next) => {
                    setPageOptions((current) => ({ ...current, printBackgrounds: next }));
                    setOutput(null);
                  }}
                  label="Print backgrounds & CSS shadows"
                  disabled={job.running}
                />
                <ToggleRow
                  checked={pageOptions.headerFooter === "page-number"}
                  onChange={(next) => {
                    setPageOptions((current) => ({ ...current, headerFooter: next ? "page-number" : "none" }));
                    setOutput(null);
                  }}
                  label="Add page numbers"
                  disabled={job.running}
                />
              </Accordion>
            </div>
            <RunBar
              actionLabel="Render to PDF (WASM)"
              actionIcon="picture_as_pdf"
              onRun={run}
              disabled={!html.trim()}
              running={job.running}
              progress={job.state.progress}
              message={job.state.message}
              error={job.state.error}
              onReset={() => {
                files.clearFiles();
                setHtml("");
                setCustomCss("");
                setOutput(null);
                setWarnings([]);
                job.reset();
              }}
              hint="Scripts, forms, frames and remote URLs are removed before rendering — the PDF can never phone home."
            />
          </div>
        </>
      }
      right={
        <>
          <ResultCard
            title="Rendered PDF"
            fileName="document.pdf"
            bytes={output}
            downloadLabel="Download PDF"
            warnings={warnings}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
