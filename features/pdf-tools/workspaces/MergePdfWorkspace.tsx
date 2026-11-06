"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import LoadedFileList from "../components/LoadedFileList";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runPdfOperation } from "../engines/pdfWorkerClient";
import { formatBytes } from "../engines/optimizeUtils";

export default function MergePdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 20 });
  const job = usePdfJob();
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const totalBytes = files.files.reduce((sum, entry) => sum + entry.size, 0);
  const totalPages = files.files.reduce((sum, entry) => sum + entry.pageCount, 0);
  const readyCount = files.files.filter((entry) => !entry.error).length;

  const run = () =>
    job.start(async (report) => {
      const buffers: ArrayBuffer[] = [];
      for (const entry of files.files) {
        if (entry.error) {
          throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);
        }
        buffers.push(await entry.file.arrayBuffer());
      }
      const bytes = await runPdfOperation({
        type: "merge",
        payload: { files: buffers },
        onProgress: (percent) =>
          report({ phase: "rebuilding", percent, message: "Merging documents…" }),
      });
      setWarnings([
        "Merged output keeps each source document's pages in queue order; per-document bookmarks and form structures are rebuilt as flattened page content.",
      ]);
      setOutput(bytes);
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Order is preserved exactly as listed — drag to rearrange before merging."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {files.notice}
            </div>
          )}
          {files.files.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                  Queue: {files.files.length} document{files.files.length === 1 ? "" : "s"} ({totalPages} pages •{" "}
                  {formatBytes(totalBytes)})
                </span>
                <button
                  type="button"
                  onClick={files.clearFiles}
                  disabled={job.running}
                  className="px-2.5 py-1 text-label-sm font-label-sm bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors"
                >
                  Clear All
                </button>
              </div>
              <LoadedFileList
                files={files.files}
                onMove={files.moveFile}
                onRemove={files.removeFile}
                disabled={job.running}
              />
            </div>
          )}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
            <RunBar
              actionLabel={`Merge ${readyCount} File${readyCount === 1 ? "" : "s"} (WASM)`}
              actionIcon="merge_type"
              onRun={run}
              disabled={readyCount < 2}
              running={job.running}
              progress={job.state.progress}
              message={job.state.message}
              error={job.state.error}
              onReset={files.clearFiles}
              hint="Files are merged in queue order using pdf-lib inside a Web Worker."
            />
          </div>
        </>
      }
      right={
        <>
          <ResultCard
            title="Merged Output"
            beforeBytes={output ? totalBytes : undefined}
            afterBytes={output ? output.byteLength : undefined}
            verdict={
              output
                ? {
                    tone: output.byteLength <= totalBytes ? "good" : "warn",
                    headline:
                      output.byteLength <= totalBytes
                        ? `Saved ${Math.max(0, Math.round(((totalBytes - output.byteLength) / Math.max(1, totalBytes)) * 1000)) / 10}%`
                        : "Structural overhead added",
                    detail: `${formatBytes(totalBytes)} → ${formatBytes(output.byteLength)}`,
                  }
                : null
            }
            sizeLines={
              output
                ? [
                    {
                      label: "Source documents",
                      before: totalBytes,
                      after: output.byteLength,
                    },
                  ]
                : undefined
            }
            fileName="merged.pdf"
            bytes={output}
            downloadLabel="Download Merged PDF"
            warnings={warnings}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
