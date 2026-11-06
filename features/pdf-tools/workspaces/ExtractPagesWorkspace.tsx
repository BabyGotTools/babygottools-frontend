"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import PageThumbGrid from "../components/PageThumbGrid";
import { Accordion } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runPdfOperation } from "../engines/pdfWorkerClient";
import { parsePageRanges } from "../engines/pageMath";
import { baseNameOf } from "../engines/convertShared";

export default function ExtractPagesWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = useState("");
  const [useThumbSelection, setUseThumbSelection] = useState(true);
  const [output, setOutput] = useState<Uint8Array | null>(null);

  const first = files.files[0];
  const total = first?.pageCount ?? 0;

  /** Effective selection: thumbnails or typed ranges, resolved to indices. */
  const indices = useThumbSelection
    ? Array.from(selected).sort((a, b) => a - b)
    : parsePageRanges(rangeText, total);

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (indices.length === 0) throw new Error("Select at least one page to extract");

      const bytes = await runPdfOperation({
        type: "extract",
        payload: {
          file: await entry.file.arrayBuffer(),
          selectedPages: indices,
        },
        onProgress: (percent) =>
          report({ phase: "rebuilding", percent, message: "Copying pages…" }),
      });
      setOutput(bytes);
    });

  const toggleSelect = (index: number, additive: boolean) => {
    setSelected((current) => {
      const next = additive ? new Set(current) : new Set<number>();
      if (next.has(index) && additive) {
        next.delete(index);
      } else {
        next.add(index);
      }
      setOutput(null);
      return next;
    });
  };

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Click pages to select — the output keeps exactly the chosen order."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={`${total} pages • ${indices.length} selected`}
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                    Selection Mode
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseThumbSelection(true)}
                    disabled={job.running}
                    className={`px-2.5 py-1 text-label-sm font-label-sm rounded-lg transition-colors ${
                      useThumbSelection ? "bg-primary/10 text-primary ring-1 ring-primary" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    Click Pages
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseThumbSelection(false)}
                    disabled={job.running}
                    className={`px-2.5 py-1 text-label-sm font-label-sm rounded-lg transition-colors ${
                      !useThumbSelection ? "bg-primary/10 text-primary ring-1 ring-primary" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    Type Ranges
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(new Set());
                    setOutput(null);
                  }}
                  disabled={job.running || selected.size === 0}
                  className="px-2.5 py-1 text-label-sm font-label-sm bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  Clear Selection
                </button>
              </div>
              {useThumbSelection ? (
                <PageThumbGrid
                  cacheKey={first.id}
                  file={first.file}
                  pageCount={total}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  disabled={job.running}
                />
              ) : (
                <input
                  type="text"
                  value={rangeText}
                  onChange={(event) => {
                    setRangeText(event.target.value);
                    setOutput(null);
                  }}
                  disabled={job.running}
                  placeholder="1-3, 5, 8-end"
                  className="bg-surface-container-lowest rounded-md px-2.5 py-2 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm font-label-mono-xs"
                />
              )}
              <RunBar
                actionLabel={`Extract ${indices.length} Page${indices.length === 1 ? "" : "s"} (WASM)`}
                actionIcon="file_download"
                onRun={run}
                disabled={indices.length === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  job.reset();
                }}
                hint="Extracted pages keep their original rotation, size and content streams."
              />
            </div>
          )}
          <Accordion title="Range syntax" icon="rule">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Single pages (7), spans (2-5), <code>end</code>, and negative offsets (-2 = second-to-last page)
              are supported. Selection order is preserved exactly as clicked/typed — the summary confirms the
              final page order before you run it.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="Extracted Pages"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "pages"}-extracted.pdf`}
            bytes={output}
            downloadLabel="Download Extracted PDF"
            warnings={
              output
                ? [`Output holds ${indices.length} page${indices.length === 1 ? "" : "s"}: ${indices.map((i) => i + 1).slice(0, 12).join(", ")}${indices.length > 12 ? "…" : ""}`]
                : []
            }
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
