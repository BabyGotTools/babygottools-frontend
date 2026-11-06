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
import type { HtmlPreviewData } from "../engines/convertFrom/convertFromTypes";
import { ConvertHtmlPreview } from "./ConvertFromPreviews";
import { baseNameOf } from "../engines/convertShared";

export default function PdfToHtmlWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [includePageNumbers, setIncludePageNumbers] = useState(false);
  const [includeCitation, setIncludeCitation] = useState(true);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [outName, setOutName] = useState("");
  const [htmlPreview, setHtmlPreview] = useState<HtmlPreviewData | null>(null);

  const first = files.files[0];

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const buffer = await entry.file.arrayBuffer();
      const outcome = await runConvertFrom({
        tool: "html",
        bytes: buffer,
        fileName: entry.name,
        options: { includePageNumbers, includeCitation },
        onProgress: (progress) =>
          report({ phase: toPdfPhase(progress.phase), percent: progress.percent, message: progress.message }),
      });

      if (!outcome.bytes) throw new Error("The converter did not produce an output file");
      setOutput(outcome.bytes);
      setOutName(outcome.fileName);
      if (outcome.preview?.kind === "html") {
        setHtmlPreview(outcome.preview);
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
            subtitle="Text-based PDFs only — scanned documents are refused with a pointer to OCR."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} />
              <ToggleRow
                label="Add page markers"
                hint="Inserts the page number at the start of each page's content."
                checked={includePageNumbers}
                onChange={setIncludePageNumbers}
                disabled={job.running}
              />
              <ToggleRow
                label="Include document title and author"
                hint="Adds a citation header when the PDF metadata contains a title or author."
                checked={includeCitation}
                onChange={setIncludeCitation}
                disabled={job.running}
              />
              <RunBar
                actionLabel="Convert to HTML (Local)"
                actionIcon="web"
                onRun={run}
                disabled={!first || first.pageCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setIncludePageNumbers(false);
                  setIncludeCitation(true);
                  setOutput(null);
                  setOutName("");
                  setHtmlPreview(null);
                  job.reset();
                }}
              />
            </div>
          )}
          <Accordion title="About the generated HTML" icon="code">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              The output is a single self-contained .html file with an embedded stylesheet (dark-mode aware) and
              real semantic tags for headings, lists, tables, and emphasis. Scripts, iframes, event handlers, and
              remote assets are stripped before anything is previewed, and the live preview runs in a sandboxed
              iframe.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="HTML Document Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={outName || (first ? `${baseNameOf(first.name)}.html` : "converted.html")}
            bytes={output}
            mimeType={CONVERT_FROM_MIME.html}
            downloadLabel="Download HTML"
            quickView={false}
          >
            {htmlPreview && <ConvertHtmlPreview data={htmlPreview} />}
          </ResultCard>
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
