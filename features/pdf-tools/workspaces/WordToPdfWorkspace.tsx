"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, SelectField, ToggleRow } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { buildOfficePdf, type WordOptions } from "../engines/officePdf";
import { MARGIN_POINTS, describeConversionError, outputName, type PageSizeId } from "../engines/convertShared";

export default function WordToPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "office", maxFiles: 1 });
  const job = usePdfJob();
  const [options, setOptions] = useState<WordOptions>({
    pageSize: "auto",
    orientation: "auto",
    margin: "none",
    preserveHeadersFooters: true,
    includeComments: false,
  });
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const first = files.files[0];

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a .docx file first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const outcome = await buildOfficePdf(
        {
          tool: "word",
          bytes: new Uint8Array(await entry.file.arrayBuffer()),
          fileName: entry.name,
          options,
        },
        report
      );
      setWarnings(outcome.warnings);
      setOutput(outcome.bytes);
    });

  const patch = (next: Partial<WordOptions>) => {
    setOptions((current) => ({ ...current, ...next }));
    setOutput(null);
  };

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
            title="Drop your .docx here or click to browse"
            subtitle="reamkit renders the flow layout with the real page geometry — no server, no upload."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} metaLine="Word document • flow layout" />
              <Accordion title="Page Setup Controls" icon="straighten" defaultOpen>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <SelectField
                    label="Page size"
                    value={options.pageSize}
                    onChange={(next) => patch({ pageSize: next as PageSizeId })}
                    options={[
                      { value: "auto", label: "Match document" },
                      { value: "a4", label: "A4" },
                      { value: "letter", label: "US Letter" },
                      { value: "legal", label: "US Legal" },
                    ]}
                    disabled={job.running}
                  />
                  <SelectField
                    label="Orientation"
                    value={options.orientation}
                    onChange={(next) => patch({ orientation: next as WordOptions["orientation"] })}
                    options={[
                      { value: "auto", label: "Match document" },
                      { value: "portrait", label: "Portrait" },
                      { value: "landscape", label: "Landscape" },
                    ]}
                    disabled={job.running}
                  />
                  <SelectField
                    label="Margins"
                    value={options.margin}
                    onChange={(next) => patch({ margin: next as WordOptions["margin"] })}
                    options={Object.keys(MARGIN_POINTS).map((key) => ({
                      value: key,
                      label: `${key[0].toUpperCase()}${key.slice(1)} (${MARGIN_POINTS[key as keyof typeof MARGIN_POINTS]}pt)`,
                    }))}
                    disabled={job.running}
                  />
                </div>
                <ToggleRow
                  checked={options.preserveHeadersFooters}
                  onChange={(next) => patch({ preserveHeadersFooters: next })}
                  label="Preserve headers & footers"
                  disabled={job.running}
                />
                <ToggleRow
                  checked={options.includeComments}
                  onChange={(next) => patch({ includeComments: next })}
                  label="Include review comments"
                  right="Tracked changes"
                  disabled={job.running}
                />
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
                hint="Fonts are served locally from the vendored font set (Arimo/Tinos/Carlito/Caladea) — no CDN fetches."
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
            fileName={first ? outputName(first.name) : "document.pdf"}
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
