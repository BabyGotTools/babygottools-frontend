"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, SelectField } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { buildOfficePdf, type PowerPointOptions } from "../engines/officePdf";
import { PAGE_DIMENSIONS, describeConversionError, outputName } from "../engines/convertShared";
import { PAPER_SIZES } from "../engines/pageMath";

export default function PowerPointToPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "office", maxFiles: 1 });
  const job = usePdfJob();
  const [options, setOptions] = useState<PowerPointOptions>({
    pageSize: "auto" as PowerPointOptions["pageSize"],
    slideRange: "all",
  });
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const first = files.files[0];

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a .pptx file first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const outcome = await buildOfficePdf(
        {
          tool: "powerpoint",
          bytes: new Uint8Array(await entry.file.arrayBuffer()),
          fileName: entry.name,
          options,
        },
        report
      );
      setWarnings(outcome.warnings);
      setOutput(outcome.bytes);
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={(list) => {
              files.addFiles(list);
              setOutput(null);
            }}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            title="Drop your .pptx here or click to browse"
            subtitle="Slides keep their native dimensions; text, media and text layers are rendered by reamkit."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} metaLine="Presentation • slides → pages" />
              <Accordion title="Page Setup & Slide Range" icon="style" defaultOpen>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <SelectField
                    label="Page size"
                    value={String(options.pageSize)}
                    onChange={(next) => {
                      setOptions((current) => ({
                        ...current,
                        pageSize: (next === "auto" ? "a4" : next) as PowerPointOptions["pageSize"],
                      }));
                      setOutput(null);
                    }}
                    options={[
                      { value: "auto", label: "Native slide dimensions" },
                      { value: "a4", label: `A4 landscape (${PAGE_DIMENSIONS.a4.width}×${PAGE_DIMENSIONS.a4.height}pt)` },
                      { value: "letter", label: "Letter landscape" },
                      { value: "legal", label: "Legal landscape" },
                    ]}
                    disabled={job.running}
                  />
                  <label className="flex flex-col gap-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                      Slide range
                    </span>
                    <input
                      type="text"
                      value={options.slideRange}
                      disabled={job.running}
                      onChange={(event) => {
                        setOptions((current) => ({ ...current, slideRange: event.target.value }));
                        setOutput(null);
                      }}
                      placeholder="all, 1-5, 8"
                      className="bg-surface-container-lowest rounded-md px-2.5 py-2 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm font-label-mono-xs"
                    />
                  </label>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Slide ranges are applied structurally after conversion — a range of &ldquo;2-4&rdquo; produces a
                  PDF holding exactly slides 2 through 4 in order. The result card reports the count.
                </p>
              </Accordion>
              <RunBar
                actionLabel="Convert to PDF (WASM)"
                actionIcon="picture_as_pdf"
                onRun={run}
                disabled={Boolean(first.encrypted)}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error ? describeConversionError(job.state.error, tool.title) : null}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  job.reset();
                }}
                hint={`Rendered at ${PAPER_SIZES.a4.width}×${PAPER_SIZES.a4.height}pt reference geometry unless native dimensions are kept.`}
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="PDF Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={first ? outputName(first.name) : "slides.pdf"}
            bytes={output}
            downloadLabel="Download PDF"
            warnings={warnings}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
