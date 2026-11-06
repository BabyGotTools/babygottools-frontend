"use client";

import { useEffect, useRef, useState } from "react";
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
import { baseNameOf } from "../engines/convertShared";

export default function OrganizePdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [order, setOrder] = useState<number[]>([]);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [output, setOutput] = useState<Uint8Array | null>(null);

  const first = files.files[0];
  const total = first?.pageCount ?? 0;

  /**
   * The written order starts at identity for every newly loaded document —
   * without this, edits that do not touch the sequence (rotate-in-place)
   * would leave the run bar disabled and the engine's `order` empty.
   */
  const initializedFor = useRef<string | null>(null);
  useEffect(() => {
    const id = first?.id ?? null;
    if (!id || initializedFor.current === id) return;
    initializedFor.current = id;
    setOrder(Array.from({ length: first.pageCount }, (_, i) => i));
    setRotations({});
  }, [first]);

  const resetEdits = () => {
    setOrder(Array.from({ length: total }, (_, i) => i));
    setRotations({});
  };

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);
      if (order.length === 0) throw new Error("No pages left to write — reset or add pages back");

      const bytes = await runPdfOperation({
        type: "organize",
        payload: {
          file: await entry.file.arrayBuffer(),
          order,
          rotations,
        },
        onProgress: (percent) =>
          report({ phase: "rebuilding", percent, message: "Rebuilding page tree…" }),
      });
      setOutput(bytes);
    });

  const edited = order.length !== total || Object.keys(rotations).length > 0;

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={(list) => {
              setOrder([]);
              files.addFiles(list);
            }}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Drag tiles to reorder, rotate in place, or drop pages from the output entirely."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={`${total} source pages → ${order.length} output pages • ${
                  Object.keys(rotations).length
                } rotated`}
              />
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                  Page Sequence
                </span>
                <button
                  type="button"
                  onClick={resetEdits}
                  disabled={job.running || !edited}
                  className="px-2.5 py-1 text-label-sm font-label-sm bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  Undo &amp; Reset
                </button>
              </div>
              <PageThumbGrid
                cacheKey={first.id}
                file={first.file}
                pageCount={total}
                order={order.length === total ? order : undefined}
                onOrderChange={(next) => {
                  setOrder(next);
                  setOutput(null);
                }}
                rotations={rotations}
                onRotate={(index, delta) => {
                  setRotations((current) => ({
                    ...current,
                    [index]: (((current[index] ?? 0) + delta) % 360 + 360) % 360,
                  }));
                  setOutput(null);
                }}
                onRemove={(sourceIndex) => {
                  if (order.length === total) {
                    setOrder(order.filter((p) => p !== sourceIndex));
                  } else {
                    setOrder((current) => current.filter((p) => p !== sourceIndex));
                  }
                  setOutput(null);
                }}
                disabled={job.running}
              />
              <RunBar
                actionLabel="Write Organized PDF (WASM)"
                actionIcon="low_priority"
                onRun={run}
                disabled={!edited || order.length === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  job.reset();
                }}
                hint="Edits apply only when you run the write — the grid is a preview until then."
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Organized Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "organized"}-organized.pdf`}
            bytes={output}
            downloadLabel="Download Organized PDF"
            warnings={
              output
                ? [
                    `Output contains ${order.length} of ${total} source pages${
                      Object.keys(rotations).length ? " with applied rotations" : ""
                    }.`,
                  ]
                : []
            }
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
