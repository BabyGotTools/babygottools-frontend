"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, SegmentedControl } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runConvertFrom } from "../engines/convertFrom/convertFromClient";
import { CONVERT_FROM_MIME, toPdfPhase } from "../engines/convertFrom/convertFromUtils";
import { baseNameOf } from "../engines/convertShared";

type WordMode = "layout" | "text";

export default function PdfToWordWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [mode, setMode] = useState<WordMode>("layout");
  const [pageRange, setPageRange] = useState("");
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [outName, setOutName] = useState("");

  const first = files.files[0];

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const buffer = await entry.file.arrayBuffer();
      const outcome = await runConvertFrom({
        tool: "word",
        bytes: buffer,
        fileName: entry.name,
        options: { mode, pageRange: pageRange.trim() || "all" },
        onProgress: (progress) =>
          report({ phase: toPdfPhase(progress.phase), percent: progress.percent, message: progress.message }),
      });

      if (!outcome.bytes) throw new Error("The converter did not produce an output file");
      setOutput(outcome.bytes);
      setOutName(outcome.fileName);
      if (outcome.warnings.length > 0) {
        report({ phase: "writing", percent: 100, message: outcome.warnings[0] });
      }
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="One document at a time — the DOCX is assembled in a Web Worker and downloaded from memory."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} />
              <SegmentedControl<WordMode>
                label="Word output mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "layout", label: "Keep Layout", hint: "Full-page images — pixel-perfect, not editable" },
                  { value: "text", label: "Editable Text", hint: "Extracted text with inferred headings" },
                ]}
                columns={2}
                disabled={job.running}
              />
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Page range (blank = all pages)
                </span>
                <input
                  type="text"
                  value={pageRange}
                  onChange={(event) => setPageRange(event.target.value)}
                  disabled={job.running}
                  placeholder="e.g. 1-5, 8"
                  className="bg-surface-container-lowest rounded-md px-2.5 py-2 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm font-label-mono-xs"
                />
              </label>
              {mode === "text" && (
                <p className="p-2.5 rounded-lg bg-surface-container-low text-secondary font-body-sm text-body-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0">info</span>
                  Editable text is experimental: best on simple, single-column documents. Scanned PDFs are refused —
                  run OCR PDF first.
                </p>
              )}
              <RunBar
                actionLabel="Convert to Word (Local)"
                actionIcon="article"
                onRun={run}
                disabled={!first || first.pageCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setPageRange("");
                  setOutput(null);
                  setOutName("");
                  job.reset();
                }}
              />
            </div>
          )}
          <Accordion title="How the two modes differ" icon="swap_horiz">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              <strong>Keep Layout</strong> renders each page at 2× and places it as a full-page image on a
              matching paper size — perfect fidelity, text not editable. <strong>Editable Text</strong> extracts
              positioned runs, infers Heading 1/2 from font-size ratios, and builds a lightweight document you
              can edit — complex multi-column layouts may flatten.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="Word Document Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={outName || (first ? `${baseNameOf(first.name)}.docx` : "converted.docx")}
            bytes={output}
            mimeType={CONVERT_FROM_MIME.word}
            downloadLabel="Download DOCX"
            quickView={false}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
