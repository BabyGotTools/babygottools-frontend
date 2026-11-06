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
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runPdfOperation } from "../engines/pdfWorkerClient";
import { parsePageRanges } from "../engines/pageMath";
import { baseNameOf } from "../engines/convertShared";

export default function DeletePagesWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = useState("");
  const [useThumbSelection, setUseThumbSelection] = useState(true);
  const [output, setOutput] = useState<Uint8Array | null>(null);

  const first = files.files[0];
  const total = first?.pageCount ?? 0;

  /** Pages to delete, as 1-indexed display values. */
  const deleteIndices = useThumbSelection
    ? Array.from(selected).sort((a, b) => a - b)
    : parsePageRanges(rangeText, total);
  const keepCount = total - deleteIndices.length;

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (deleteIndices.length === 0) throw new Error("Select at least one page to delete");
      if (keepCount === 0) throw new Error("A PDF must keep at least one page — deselect everything is not allowed");

      const bytes = await runPdfOperation({
        type: "delete",
        payload: {
          file: await entry.file.arrayBuffer(),
          selectedPages: deleteIndices,
        },
        onProgress: (percent) =>
          report({ phase: "rebuilding", percent, message: "Dropping pages…" }),
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
            subtitle="Mark the pages to remove — everything else is kept untouched."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={`${total} pages • ${deleteIndices.length} marked for removal • ${keepCount} kept`}
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                    Removal Mode
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseThumbSelection(true)}
                    disabled={job.running}
                    className={`px-2.5 py-1 text-label-sm font-label-sm rounded-lg transition-colors ${
                      useThumbSelection ? "bg-error/10 text-error ring-1 ring-error" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    Click Pages
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseThumbSelection(false)}
                    disabled={job.running}
                    className={`px-2.5 py-1 text-label-sm font-label-sm rounded-lg transition-colors ${
                      !useThumbSelection ? "bg-error/10 text-error ring-1 ring-error" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
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
                  Unmark All
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
                  placeholder="2-4, 9"
                  className="bg-surface-container-lowest rounded-md px-2.5 py-2 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm font-label-mono-xs"
                />
              )}
              <RunBar
                actionLabel={`Delete ${deleteIndices.length} Page${deleteIndices.length === 1 ? "" : "s"} (WASM)`}
                actionIcon="delete"
                onRun={run}
                disabled={deleteIndices.length === 0 || keepCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  job.reset();
                }}
                hint="The document must keep at least one page — the engine enforces this before writing."
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Remaining Document"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "document"}-deleted-pages.pdf`}
            bytes={output}
            downloadLabel="Download Result"
            warnings={
              output
                ? [
                    deleteIndices.length > 0
                      ? `Removed pages: ${deleteIndices.map((i) => i + 1).slice(0, 12).join(", ")}${deleteIndices.length > 12 ? "…" : ""}`
                      : "",
                  ].filter(Boolean)
                : []
            }
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
