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
import { CONVERT_FROM_MAX_PAGES_WARNING, CONVERT_FROM_MIME, toPdfPhase } from "../engines/convertFrom/convertFromUtils";
import type { PptxQuality, SlideSize } from "../engines/convertFrom/convertFromTypes";
import { baseNameOf } from "../engines/convertShared";

export default function PdfToPowerPointWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [slideSize, setSlideSize] = useState<SlideSize>("match");
  const [quality, setQuality] = useState<PptxQuality>("high");
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [outName, setOutName] = useState("");

  const first = files.files[0];
  const manyPages = (first?.pageCount ?? 0) > CONVERT_FROM_MAX_PAGES_WARNING;

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const buffer = await entry.file.arrayBuffer();
      const outcome = await runConvertFrom({
        tool: "powerpoint",
        bytes: buffer,
        fileName: entry.name,
        options: { slideSize, quality },
        onProgress: (progress) =>
          report({ phase: toPdfPhase(progress.phase), percent: progress.percent, message: progress.message }),
      });

      if (!outcome.bytes) throw new Error("The converter did not produce an output file");
      setOutput(outcome.bytes);
      setOutName(outcome.fileName);
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Every page becomes one full-slide image — perfect for projecting a PDF as a deck."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} />
              <SegmentedControl<SlideSize>
                label="Slide size"
                value={slideSize}
                onChange={setSlideSize}
                options={[
                  { value: "match", label: "Match PDF", hint: "Canvas sized to the page's aspect ratio" },
                  { value: "16:9", label: "Widescreen 16:9", hint: "Standard modern decks" },
                  { value: "4:3", label: "Standard 4:3", hint: "Legacy projectors" },
                ]}
                columns={3}
                disabled={job.running}
              />
              <SegmentedControl<PptxQuality>
                label="Render quality"
                value={quality}
                onChange={setQuality}
                options={[
                  { value: "high", label: "High", hint: "2.5× · q92 — projection" },
                  { value: "medium", label: "Medium", hint: "1.5× · q82 — sharing" },
                  { value: "low", label: "Low", hint: "1× · q70 — quick drafts" },
                ]}
                columns={3}
                disabled={job.running}
              />
              {manyPages && (
                <p className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
                  This PDF has more than {CONVERT_FROM_MAX_PAGES_WARNING} pages. The PPTX may be large and take
                  longer to open.
                </p>
              )}
              <RunBar
                actionLabel="Convert to PowerPoint (Local)"
                actionIcon="co_present"
                onRun={run}
                disabled={!first || first.pageCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  setOutName("");
                  job.reset();
                }}
              />
            </div>
          )}
          <Accordion title="Are the slides editable?" icon="co_present">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Slides are images of the PDF pages, so layout is pixel-faithful but text is not editable inside
              PowerPoint. If you need editable content, use PDF to Word in editable-text mode. Animations,
              transitions, and embedded media are not part of a slide-image deck.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="PowerPoint Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={outName || (first ? `${baseNameOf(first.name)}.pptx` : "deck.pptx")}
            bytes={output}
            mimeType={CONVERT_FROM_MIME.powerpoint}
            downloadLabel="Download PPTX"
            quickView={false}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
