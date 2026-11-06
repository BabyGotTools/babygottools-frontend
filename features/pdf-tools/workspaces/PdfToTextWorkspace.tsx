"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, ToggleRow } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runConvertFrom } from "../engines/convertFrom/convertFromClient";
import { CONVERT_FROM_MIME, toPdfPhase } from "../engines/convertFrom/convertFromUtils";
import { ConvertTextPreview } from "./ConvertFromPreviews";
import { baseNameOf } from "../engines/convertShared";

export default function PdfToTextWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [pageRange, setPageRange] = useState("");
  const [preserveLineBreaks, setPreserveLineBreaks] = useState(true);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [outName, setOutName] = useState("");
  const [textPreview, setTextPreview] = useState("");

  const first = files.files[0];

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const buffer = await entry.file.arrayBuffer();
      const outcome = await runConvertFrom({
        tool: "text",
        bytes: buffer,
        fileName: entry.name,
        options: { pageRange: pageRange.trim() || "all", preserveLineBreaks },
        onProgress: (progress) =>
          report({ phase: toPdfPhase(progress.phase), percent: progress.percent, message: progress.message }),
      });

      if (!outcome.bytes) throw new Error("The converter did not produce an output file");
      setOutput(outcome.bytes);
      setOutName(outcome.fileName);
      setTextPreview(new TextDecoder().decode(outcome.bytes));
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Reads the PDF's text layer — scanned documents are refused with a pointer to OCR."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} />
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
              <ToggleRow
                label="Preserve line breaks"
                hint="Keeps each visual line on its own line. Turn off to join lines into flowing paragraphs."
                checked={preserveLineBreaks}
                onChange={setPreserveLineBreaks}
                disabled={job.running}
              />
              <RunBar
                actionLabel="Extract Text (Local)"
                actionIcon="notes"
                onRun={run}
                disabled={!first || first.pageCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setPageRange("");
                  setPreserveLineBreaks(true);
                  setOutput(null);
                  setOutName("");
                  setTextPreview("");
                  job.reset();
                }}
              />
            </div>
          )}
          <Accordion title="How the text is reconstructed" icon="format_line_spacing">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Positioned runs are clustered into visual lines by baseline proximity and sorted in reading order,
              and words hyphenated across a line break are rejoined — so the .txt you download is searchable and
              paste-ready. Pages without any text layer are reported rather than dropped silently.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="Plain Text Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={outName || (first ? `${baseNameOf(first.name)}.txt` : "converted.txt")}
            bytes={output}
            mimeType={CONVERT_FROM_MIME.text}
            downloadLabel="Download TXT"
            quickView={false}
          >
            {textPreview && <ConvertTextPreview text={textPreview} />}
          </ResultCard>
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
