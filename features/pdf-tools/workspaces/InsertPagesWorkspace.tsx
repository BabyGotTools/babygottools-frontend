"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import LoadedFileList from "../components/LoadedFileList";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { SegmentedControl } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runPdfOperation } from "../engines/pdfWorkerClient";
import { baseNameOf } from "../engines/convertShared";

type SlotMode = "start" | "end" | "after-page";

export default function InsertPagesWorkspace({ tool }: { tool: PdfTool }) {
  const base = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const insert = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [slot, setSlot] = useState<SlotMode>("after-page");
  const [afterPage, setAfterPage] = useState(1);
  const [output, setOutput] = useState<Uint8Array | null>(null);

  const baseFile = base.files[0];
  const insertFile = insert.files[0];
  const insertPosition =
    slot === "start" ? 0 : slot === "end" ? (baseFile?.pageCount ?? 0) : Math.max(0, Math.min(afterPage, baseFile?.pageCount ?? 0));
  const outputPages = (baseFile?.pageCount ?? 0) + (insertFile?.pageCount ?? 0);

  const run = () =>
    job.start(async (report) => {
      const baseEntry = base.files[0];
      const insertEntry = insert.files[0];
      if (!baseEntry) throw new Error("Add the base PDF first");
      if (!insertEntry) throw new Error("Add the PDF to insert");
      if (baseEntry.error) throw new Error(`"${baseEntry.name}" could not be opened: ${baseEntry.error}`);
      if (insertEntry.error) throw new Error(`"${insertEntry.name}" could not be opened: ${insertEntry.error}`);

      const bytes = await runPdfOperation({
        type: "insert",
        payload: {
          baseFile: await baseEntry.file.arrayBuffer(),
          insertFile: await insertEntry.file.arrayBuffer(),
          insertPosition,
        },
        onProgress: (percent) =>
          report({ phase: "rebuilding", percent, message: "Splicing documents…" }),
      });
      setOutput(bytes);
    });

  const slotLabel =
    slot === "start" ? "before page 1" : slot === "end" ? "at the end" : `after page ${afterPage}`;

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
              1 — Base document
            </span>
            <PdfDropzone
              onFiles={base.addFiles}
              acceptAttr={base.acceptAttr}
              compact
              meta="The document that keeps its position"
              title="Drop the base PDF"
              subtitle="Receives the inserted pages."
              disabled={job.running}
            />
            {base.notice && <p className="font-body-sm text-body-sm text-error">{base.notice}</p>}
            {baseFile && <FileInspectorCard file={baseFile} />}
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
              2 — Pages to insert
            </span>
            <PdfDropzone
              onFiles={insert.addFiles}
              acceptAttr={insert.acceptAttr}
              compact
              meta="Inserted whole, in its own order"
              title="Drop the PDF to insert"
              subtitle="All of its pages are spliced in as a block."
              disabled={job.running}
            />
            {insert.notice && <p className="font-body-sm text-body-sm text-error">{insert.notice}</p>}
            {insertFile && <FileInspectorCard file={insertFile} />}
          </div>
          {(baseFile || insertFile) && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <SegmentedControl<SlotMode>
                label="3 — Insertion slot"
                value={slot}
                onChange={(next) => {
                  setSlot(next);
                  setOutput(null);
                }}
                options={[
                  { value: "start", label: "Start", hint: "Before page 1" },
                  { value: "after-page", label: "After page N", hint: "Middle splice" },
                  { value: "end", label: "End", hint: "Append" },
                ]}
                disabled={job.running}
              />
              {slot === "after-page" && (
                <label className="flex flex-col gap-1">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Insert after page
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={baseFile?.pageCount ?? 0}
                    value={afterPage}
                    disabled={job.running}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) {
                        setAfterPage(Math.min(baseFile?.pageCount ?? 0, Math.max(0, next)));
                        setOutput(null);
                      }
                    }}
                    className="bg-surface-container-lowest rounded-md px-2.5 py-2 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm font-label-mono-xs"
                  />
                </label>
              )}
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Inserting {insertFile?.name ?? "—"} ({insertFile?.pageCount ?? 0} pages) {slotLabel}. Output:{" "}
                {outputPages} pages.
              </p>
              <RunBar
                actionLabel="Insert Pages (WASM)"
                actionIcon="content_paste"
                onRun={run}
                disabled={!baseFile || !insertFile}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  base.clearFiles();
                  insert.clearFiles();
                  setOutput(null);
                  job.reset();
                }}
              />
            </div>
          )}
          {base.files.length > 1 && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
              <p className="font-body-sm text-body-sm text-error mb-2">
                This tool takes one base file — extras are ignored:
              </p>
              <LoadedFileList
                files={base.files}
                onMove={base.moveFile}
                onRemove={base.removeFile}
                disabled={job.running}
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Spliced Output"
            beforeBytes={baseFile && output ? baseFile.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${baseFile ? baseNameOf(baseFile.name) : "base"}-inserted.pdf`}
            bytes={output}
            downloadLabel="Download Result"
            warnings={output ? [`Output is ${outputPages} pages (${slotLabel} splice).`] : []}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
