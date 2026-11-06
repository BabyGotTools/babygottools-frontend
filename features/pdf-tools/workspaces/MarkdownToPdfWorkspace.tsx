"use client";

import { useState } from "react";
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
import { markdownToHtml } from "../engines/markdownEngine";
import { renderHtmlToPdf, type HtmlConvertOptions } from "../engines/htmlPdf";
import { MARGIN_POINTS } from "../engines/convertShared";

/**
 * Markdown-to-PDF: marked → sanitized HTML → offscreen render → paged PDF.
 * The preview iframe is sandboxed with no permissions (defense in depth on
 * top of DOMPurify).
 */
export default function MarkdownToPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "text", maxFiles: 1 });
  const job = usePdfJob();
  const [markdown, setMarkdown] = useState("");
  const [highlightCode, setHighlightCode] = useState(true);
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
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sanitizationNotes, setSanitizationNotes] = useState<string[]>([]);

  const first = files.files[0];

  const loadFile = async (list: FileList) => {
    files.addFiles(list);
    const file = list[0];
    if (file) {
      setMarkdown(await file.text());
      setOutput(null);
    }
  };

  const run = () =>
    job.start(async (report) => {
      if (!markdown.trim()) throw new Error("Add some Markdown before converting");

      report({ phase: "reading", percent: 12, message: "Parsing Markdown…" });
      const rendered = await markdownToHtml(markdown, { highlightCode, customCss });
      setSanitizationNotes(rendered.warnings);

      report({ phase: "rasterizing", percent: 30, message: "Rendering HTML…" });
      const outcome = await renderHtmlToPdf(rendered.html, rendered.css, pageOptions, (percent, message) => {
        report({ phase: "rebuilding", percent: Math.max(30, percent), message });
      });
      setWarnings([...rendered.warnings, ...outcome.warnings]);
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
            title="Drop a .md file — or type below"
            subtitle="GFM tables, fenced code and task lists are supported."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <FileInspectorCard file={first} metaLine="Markdown source" />
          )}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Markdown ({markdown.length.toLocaleString()} chars)
              </span>
              <textarea
                value={markdown}
                onChange={(event) => {
                  setMarkdown(event.target.value);
                  setOutput(null);
                }}
                disabled={job.running}
                rows={12}
                placeholder={"# Heading\n\nParagraph with **bold**, a [link](https://example.com) and a table:\n\n| A | B |\n| - | - |\n| 1 | 2 |"}
                className="w-full bg-surface-container-low p-3 rounded-lg font-label-mono-xs text-label-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            </label>
            <ToggleRow
              checked={highlightCode}
              onChange={(next) => {
                setHighlightCode(next);
                setOutput(null);
              }}
              label="Highlight fenced code with highlight.js"
              right="Full theme set"
              disabled={job.running}
            />
            <RunBar
              actionLabel="Convert to PDF (WASM)"
              actionIcon="picture_as_pdf"
              onRun={run}
              disabled={!markdown.trim()}
              running={job.running}
              progress={job.state.progress}
              message={job.state.message}
              error={job.state.error}
              onReset={() => {
                files.clearFiles();
                setMarkdown("");
                setOutput(null);
                setWarnings([]);
                setSanitizationNotes([]);
                job.reset();
              }}
              hint="Output is sanitized with DOMPurify before rendering — scripts, forms and remote resources never reach the PDF."
            />
          </div>
          <Accordion title="Advanced: Page Setup & Custom CSS" icon="palette">
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
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Custom CSS (sanitized — @import and remote url() are stripped)
              </span>
              <textarea
                value={customCss}
                onChange={(event) => {
                  setCustomCss(event.target.value);
                  setOutput(null);
                }}
                disabled={job.running}
                rows={3}
                placeholder="body { font-size: 12pt; }"
                className="w-full bg-surface-container-lowest rounded-md p-2 font-label-mono-xs text-label-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              />
            </label>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="Rendered PDF"
            fileName="markdown.pdf"
            bytes={output}
            downloadLabel="Download PDF"
            warnings={[...sanitizationNotes, ...warnings]}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
