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
import { SegmentedControl, ToggleRow } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runPdfOperation } from "../engines/pdfWorkerClient";
import { baseNameOf } from "../engines/convertShared";

type Angle = "90" | "180" | "270";

export default function RotatePagesWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [angle, setAngle] = useState<Angle>("90");
  const [allPages, setAllPages] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [output, setOutput] = useState<Uint8Array | null>(null);

  const first = files.files[0];
  const total = first?.pageCount ?? 0;
  const delta = Number(angle);

  /** Preview rotations shown on the grid when applying to all pages. */
  const previewRotations = allPages
    ? Object.fromEntries(Array.from({ length: total }, (_, i) => [i, delta]))
    : Object.fromEntries(Array.from(selected, (i) => [i, delta]));

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (!allPages && selected.size === 0) throw new Error("Select at least one page to rotate");

      const rotations: Record<number, number> = allPages
        ? Object.fromEntries(Array.from({ length: total }, (_, i) => [i, delta]))
        : Object.fromEntries(Array.from(selected, (i) => [i, delta]));

      const bytes = await runPdfOperation({
        type: "rotate",
        payload: {
          file: await entry.file.arrayBuffer(),
          rotations,
        },
        onProgress: (percent) =>
          report({ phase: "rebuilding", percent, message: "Applying rotation metadata…" }),
      });
      setOutput(bytes);
    });

  const toggleSelect = (index: number, additive: boolean) => {
    setSelected((current) => {
      const next = additive ? new Set(current) : new Set<number>();
      if (next.has(index) && additive) next.delete(index);
      else next.add(index);
      return next;
    });
    setOutput(null);
  };

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={(list) => {
              files.addFiles(list);
              setAllPages(true);
              setSelected(new Set());
            }}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Rotation is written into each page's metadata — the text layer and content streams stay intact."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} metaLine={`${total} pages • rotating ${allPages ? "all" : selected.size} by ${delta}°`} />
              <SegmentedControl<Angle>
                label="Rotation"
                value={angle}
                onChange={(next) => {
                  setAngle(next);
                  setOutput(null);
                }}
                options={[
                  { value: "90", label: "90° Clockwise" },
                  { value: "180", label: "180° Upside Down" },
                  { value: "270", label: "270° / 90° CCW" },
                ]}
                disabled={job.running}
              />
              <ToggleRow
                checked={allPages}
                onChange={(next) => {
                  setAllPages(next);
                  setOutput(null);
                }}
                label="Apply to all pages"
                right={allPages ? `${total} pages` : `${selected.size} selected`}
                disabled={job.running}
              />
              {!allPages && (
                <PageThumbGrid
                  cacheKey={first.id}
                  file={first.file}
                  pageCount={total}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  rotations={previewRotations}
                  disabled={job.running}
                />
              )}
              <RunBar
                actionLabel={`Rotate ${allPages ? "All" : selected.size} Page${allPages && total === 1 ? "" : "s"} (WASM)`}
                actionIcon="rotate_right"
                onRun={run}
                disabled={!allPages && selected.size === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  job.reset();
                }}
                hint="The live grid previews the exact rotation the engine will write."
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Rotated Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "document"}-rotated.pdf`}
            bytes={output}
            downloadLabel="Download Rotated PDF"
            warnings={
              output
                ? [`Rotation is metadata-level (/Rotate): viewers honor it universally, and text remains selectable.`]
                : []
            }
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
