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
import { baseNameOf } from "../engines/convertShared";

/**
 * Structural repair: qpdf rebuilds a damaged cross-reference table and
 * recovers what it can. The output is re-inspected and the recovery is
 * verified — a failed recovery is reported as failed, never dressed up.
 */
export default function RepairPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState<string[]>([]);

  const first = files.files[0];

  const run = () =>
    job.start(async (report_) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");

      report_({ phase: "analyzing", percent: 25, message: "Rebuilding cross-reference table…" });
      const bytes = await studio.repair(new Uint8Array(await entry.file.arrayBuffer()));
      const check = await studio.validateOutput(bytes);
      if (!check.ok) {
        throw new Error("Recovery failed — the file is damaged beyond what this engine can reconstruct.");
      }

      const notes: string[] = [
        `Recovered document exposes ${check.pageCount} page${check.pageCount === 1 ? "" : "s"} (PDF ${check.pdfVersion}).`,
        `Output size: ${bytes.byteLength.toLocaleString()} bytes (input: ${entry.size.toLocaleString()}).`,
      ];
      if (check.pageCount !== entry.pageCount && entry.pageCount > 0) {
        notes.push(
          `Page count changed from the pre-repair parse (${entry.pageCount}). Damaged structures can hide or recover pages — inspect the output before relying on it.`
        );
      }
      setReport(notes);
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
              setReport([]);
              job.reset();
            }}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Broken xref tables, truncated trailers and bad stream lengths are rebuilt in-memory."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={first.error ?? `${first.pageCount} pages parsed${first.encrypted ? " • Encrypted" : ""}`}
                sizeBadgeLabel="Damaged Input"
              />
              <RunBar
                actionLabel="Repair PDF (WASM)"
                actionIcon="build_circle"
                onRun={run}
                disabled={Boolean(first.encrypted)}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  setReport([]);
                  job.reset();
                }}
                hint="Encrypted files must be unlocked first; repair operates on the raw byte structure."
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Recovered Document"
            fileName={`${first ? baseNameOf(first.name) : "document"}-repaired.pdf`}
            bytes={output}
            downloadLabel="Download Repaired PDF"
            warnings={report}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
