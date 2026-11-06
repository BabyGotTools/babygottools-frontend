"use client";

import { useMemo, useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, NumberField, SegmentedControl } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runPdfOperation } from "../engines/pdfWorkerClient";
import { bundleZip, extensionOf } from "../engines/zip";
import { parsePageRanges } from "../engines/pageMath";
import { formatBytes } from "../engines/optimizeUtils";
import { baseNameOf } from "../engines/convertShared";

type SplitMode = "every-page" | "fixed" | "ranges";

export default function SplitPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [mode, setMode] = useState<SplitMode>("every-page");
  const [everyN, setEveryN] = useState(1);
  const [ranges, setRanges] = useState("");
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [partNames, setPartNames] = useState<string[]>([]);

  const first = files.files[0];
  const coverageWarning = useMemo(() => {
    if (!first || first.pageCount === 0) return null;
    if (mode === "ranges") {
      const indices = parsePageRanges(ranges, first.pageCount);
      if (indices.length === 0) return `No pages match "${ranges}". This document has ${first.pageCount} pages.`;
      if (new Set(indices).size !== first.pageCount) {
        return `${new Set(indices).size} of ${first.pageCount} pages are covered — pages not listed stay in no output file.`;
      }
      return null;
    }
    return null;
  }, [first, mode, ranges]);

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const buffer = await entry.file.arrayBuffer();
      const total = entry.pageCount;
      report({ phase: "rebuilding", percent: 20, message: "Computing ranges…" });

      let chunks: { name: string; pages: number[] }[] = [];
      if (mode === "every-page") {
        chunks = Array.from({ length: total }, (_, i) => ({
          name: `${baseNameOf(entry.name)}-page-${i + 1}.pdf`,
          pages: [i],
        }));
      } else if (mode === "fixed") {
        const size = Math.max(1, Math.floor(everyN));
        for (let start = 0; start < total; start += size) {
          const slice = Array.from({ length: Math.min(size, total - start) }, (_, i) => start + i);
          chunks.push({
            name: `${baseNameOf(entry.name)}-pages-${start + 1}-${start + slice.length}.pdf`,
            pages: slice,
          });
        }
      } else {
        // Ranges: each range string becomes one document.
        const groups = ranges
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (groups.length === 0) throw new Error("Enter at least one page range");
        chunks = groups.map((group, i) => {
          const indices = parsePageRanges(group, total);
          if (indices.length === 0) throw new Error(`Range "${group}" matches no pages (document has ${total}).`);
          const from = indices[0] + 1;
          const to = indices[indices.length - 1] + 1;
          return {
            name: `${baseNameOf(entry.name)}-${indices.length === 1 ? `page-${from}` : `pages-${from}-${to}`}-${i + 1}.pdf`,
            pages: indices,
          };
        });
      }

      report({ phase: "rebuilding", percent: 40, message: `Writing ${chunks.length} parts…` });
      const parts: { name: string; bytes: Uint8Array }[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const bytes = await runPdfOperation({
          type: "split",
          payload: { file: buffer, ranges: chunks[i].pages.map((p) => p + 1).join(",") },
        });
        parts.push({ name: chunks[i].name, bytes });
        report({
          phase: "rebuilding",
          percent: 40 + Math.round(((i + 1) / chunks.length) * 55),
          message: `Wrote part ${i + 1} of ${chunks.length}`,
        });
      }

      setPartNames(parts.map((part) => `${part.name} (${formatBytes(part.bytes.byteLength)})`));
      if (extensionOf(entry.name) !== "pdf") {
        throw new Error("Only .pdf inputs are supported");
      }
      const zipped = bundleZip(parts.map((part) => ({ name: part.name, bytes: part.bytes })));
      setOutput(zipped);
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="One document at a time — parts are produced locally and bundled into a ZIP."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={`${first.pageCount} pages${coverageWarning ? " • Coverage incomplete" : ""}`}
              />
              <SegmentedControl<SplitMode>
                label="Split Mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "every-page", label: "Every Page", hint: "One PDF per page" },
                  { value: "fixed", label: "Every N Pages", hint: "Chunks of N pages" },
                  { value: "ranges", label: "Custom Ranges", hint: 'e.g. "1-3, 5, 8-10"' },
                ]}
                disabled={job.running}
              />
              {mode === "fixed" && (
                <NumberField label="Pages per file" value={everyN} min={1} max={first.pageCount || 1} onChange={setEveryN} disabled={job.running} />
              )}
              {mode === "ranges" && (
                <label className="flex flex-col gap-1">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Page ranges (one output per comma-separated range)
                  </span>
                  <input
                    type="text"
                    value={ranges}
                    onChange={(event) => setRanges(event.target.value)}
                    disabled={job.running}
                    placeholder="1-3, 5, 8-10"
                    className="bg-surface-container-lowest rounded-md px-2.5 py-2 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm font-label-mono-xs"
                  />
                </label>
              )}
              {coverageWarning && (
                <p className="p-2.5 rounded-lg bg-surface-container-low text-secondary font-body-sm text-body-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0">info</span>
                  {coverageWarning}
                </p>
              )}
              <RunBar
                actionLabel={`Split into ${mode === "every-page" ? `${first.pageCount} files` : "parts"} (WASM)`}
                actionIcon="call_split"
                onRun={run}
                disabled={Boolean(coverageWarning) || first.pageCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  setPartNames([]);
                  job.reset();
                }}
              />
            </div>
          )}
          <Accordion title="How ranges are read" icon="rule">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Ranges accept single pages (7), inclusive spans (2-5), the word <code>end</code>, and negative
              offsets (-2 = second-to-last). Duplicate or reversed entries are de-duplicated; the summary line
              tells you exactly which pages every output covers.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="Split Output (ZIP)"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "split"}-parts.zip`}
            bytes={output}
            mimeType="application/zip"
            downloadLabel="Download ZIP of Parts"
            quickView={false}
            warnings={partNames.length > 0 ? [`Bundled ${partNames.length} parts: ${partNames.slice(0, 3).join(", ")}${partNames.length > 3 ? "…" : ""}`] : []}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
