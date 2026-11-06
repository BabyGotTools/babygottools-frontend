"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { SegmentedControl, SelectField, NumberField } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runPdfOperation } from "../engines/pdfWorkerClient";
import { parsePageRanges } from "../engines/pageMath";
import { PAPER_SIZES } from "../engines/pageMath";
import { baseNameOf } from "../engines/convertShared";

type PositionMode = "after-every" | "custom";

export default function AddBlankPageWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [mode, setMode] = useState<PositionMode>("after-every");
  const [everyN, setEveryN] = useState(1);
  const [positions, setPositions] = useState("");
  const [pageSize, setPageSize] = useState<"match" | "a4" | "letter" | "legal">("match");
  const [output, setOutput] = useState<Uint8Array | null>(null);

  const first = files.files[0];
  const total = first?.pageCount ?? 0;

  /** 0-indexed slots the blank page will occupy (page index + 1 = after that page). */
  const insertPositions = (() => {
    if (total === 0) return [];
    if (mode === "after-every") {
      const size = Math.max(1, Math.floor(everyN));
      const list: number[] = [];
      for (let i = size - 1; i < total; i += size) list.push(i + 1);
      return list;
    }
    // "3" = blank lands after page 3; "end" appends a trailing blank.
    const afterPages = parsePageRanges(positions, total);
    return afterPages.map((index) => index + 1);
  })();

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (insertPositions.length === 0) throw new Error("Choose at least one insertion point");

      const bytes = await runPdfOperation({
        type: "addblank",
        payload: {
          file: await entry.file.arrayBuffer(),
          insertPositions,
          pageSize:
            pageSize === "match"
              ? "match"
              : { width: PAPER_SIZES[pageSize].width, height: PAPER_SIZES[pageSize].height },
        },
        onProgress: (percent) =>
          report({ phase: "rebuilding", percent, message: "Inserting blank pages…" }),
      });
      setOutput(bytes);
    });

  const sheet = pageSize === "match" ? "matching" : PAPER_SIZES[pageSize].label;

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="True empty pages are inserted structurally — no visible content, no placeholder graphics."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={`${total} pages → ${total + insertPositions.length} after insertion`}
              />
              <SegmentedControl<PositionMode>
                label="Insertion points"
                value={mode}
                onChange={(next) => {
                  setMode(next);
                  setOutput(null);
                }}
                options={[
                  { value: "after-every", label: "After every N pages", hint: "Note-taking spacing" },
                  { value: "custom", label: "Custom positions", hint: 'After pages "2, 5-7"' },
                ]}
                disabled={job.running}
              />
              {mode === "after-every" ? (
                <NumberField label="Insert after every" value={everyN} min={1} max={Math.max(1, total)} suffix="pages" onChange={(next) => { setEveryN(next); setOutput(null); }} disabled={job.running} />
              ) : (
                <label className="flex flex-col gap-1">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Insert a blank page after which pages?
                  </span>
                  <input
                    type="text"
                    value={positions}
                    onChange={(event) => {
                      setPositions(event.target.value);
                      setOutput(null);
                    }}
                    disabled={job.running}
                    placeholder="2, 5-7"
                    className="bg-surface-container-lowest rounded-md px-2.5 py-2 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm font-label-mono-xs"
                  />
                </label>
              )}
              <SelectField
                label="Blank page size"
                value={pageSize}
                onChange={(next) => {
                  setPageSize(next as typeof pageSize);
                  setOutput(null);
                }}
                options={[
                  { value: "match", label: "Match neighbouring page" },
                  { value: "a4", label: "A4 (210×297mm)" },
                  { value: "letter", label: "US Letter" },
                  { value: "legal", label: "US Legal" },
                ]}
                disabled={job.running}
              />
              <RunBar
                actionLabel={`Insert ${insertPositions.length} Blank Page${insertPositions.length === 1 ? "" : "s"} (WASM)`}
                actionIcon="post_add"
                onRun={run}
                disabled={insertPositions.length === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  job.reset();
                }}
                hint={`${insertPositions.length} blank ${sheet}-size page(s) will be added.`}
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Output With Blanks"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "document"}-with-blanks.pdf`}
            bytes={output}
            downloadLabel="Download Result"
            warnings={output ? [`Now ${total + insertPositions.length} pages (was ${total}).`] : []}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
