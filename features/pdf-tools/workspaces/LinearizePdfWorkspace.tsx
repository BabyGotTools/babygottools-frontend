"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import * as studio from "../engines/pdfStudio";
import { computeStats, describeSavings, formatBytes } from "../engines/optimizeUtils";
import { baseNameOf } from "../engines/convertShared";

/**
 * Linearize ("fast web view"): restructures the file so page 1 can render
 * from a partial download. qpdf handles the hint-stream surgery.
 */
export default function LinearizePdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [outputPages, setOutputPages] = useState<number | null>(null);

  const first = files.files[0];

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      report({ phase: "analyzing", percent: 30, message: "Restructuring for byte-range streaming…" });
      const bytes = await studio.linearize(new Uint8Array(await entry.file.arrayBuffer()));
      // Honest verification: the linearized file must still expose its pages.
      const check = await studio.validateOutput(bytes);
      if (!check.ok) {
        throw new Error("The engine produced a file without readable pages — output discarded.");
      }
      setOutputPages(check.pageCount);
      setOutput(bytes);
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={(list) => {
              files.addFiles(list);
              setOutput(null);
              job.reset();
            }}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="No content changes — pure byte-range restructuring for fast web view."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} metaLine={`${first.pageCount} pages • no content changes`} />
              <RunBar
                actionLabel="Linearize PDF (WASM)"
                actionIcon="flash_on"
                onRun={run}
                disabled={first.pageCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  job.reset();
                }}
                hint="Linearized files stream page 1 before the download finishes — ideal for serving PDFs over the web."
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Linearized Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            verdict={
              output
                ? describeSavings(computeStats(first?.size ?? output.byteLength, output.byteLength))
                : null
            }
            fileName={`${first ? baseNameOf(first.name) : "document"}-linearized.pdf`}
            bytes={output}
            downloadLabel="Download Linearized PDF"
            warnings={
              output
                ? [
                    `The output is ${formatBytes(output.byteLength)} with ${outputPages} verified pages. Linearization adds a hint stream, so the file can be slightly larger — that is expected and documented.`,
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
