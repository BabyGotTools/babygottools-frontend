"use client";

import { useEffect, useState } from "react";
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
import { buildOfficePdf, listWorkbookSheets, type ExcelOptions } from "../engines/officePdf";
import { MARGIN_POINTS, describeConversionError, outputName } from "../engines/convertShared";

export default function ExcelToPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "office", maxFiles: 1 });
  const job = usePdfJob();
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [options, setOptions] = useState<ExcelOptions>({
    pageSize: "auto",
    orientation: "auto",
    sheets: [],
    includeGridlines: false,
    fitToWidth: true,
    includeSheetNames: true,
  });
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const first = files.files[0];

  // Read the real sheet list as soon as the workbook is parsed.
  useEffect(() => {
    if (!first || first.error) {
      setSheetNames([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const names = await listWorkbookSheets(new Uint8Array(await first.file.arrayBuffer()));
        if (!cancelled) {
          setSheetNames(names);
          setOptions((current) => ({ ...current, sheets: [] }));
        }
      } catch {
        if (!cancelled) setSheetNames([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [first?.id]);

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add an .xlsx file first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const outcome = await buildOfficePdf(
        {
          tool: "excel",
          bytes: new Uint8Array(await entry.file.arrayBuffer()),
          fileName: entry.name,
          options,
        },
        report
      );
      setWarnings(outcome.warnings);
      setOutput(outcome.bytes);
    });

  const toggleSheet = (name: string) => {
    setOptions((current) => {
      const selected = current.sheets.includes(name)
        ? current.sheets.filter((sheet) => sheet !== name)
        : [...current.sheets, name];
      return { ...current, sheets: selected };
    });
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
            title="Drop your .xlsx here or click to browse"
            subtitle="Sheet order, print areas and cell styling are preserved by the reamkit grid engine."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={sheetNames.length > 0 ? `Workbook • ${sheetNames.length} sheet${sheetNames.length === 1 ? "" : "s"}` : "Workbook"}
              />
              {sheetNames.length > 0 && (
                <div className="flex flex-col gap-2 bg-surface-container-low p-space-sm rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                      Sheets to include (none = all)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOptions((current) => ({ ...current, sheets: [] }));
                        setOutput(null);
                      }}
                      disabled={job.running}
                      className="px-2 py-0.5 text-label-mono-xs font-label-mono-xs rounded bg-surface-container-lowest text-primary hover:bg-surface-container-high transition-colors"
                    >
                      Select all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sheetNames.map((name) => {
                      const selected = options.sheets.includes(name);
                      const active = options.sheets.length === 0 || selected;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleSheet(name)}
                          disabled={job.running}
                          className={`px-2.5 py-1 rounded-lg text-label-sm font-label-sm transition-colors ${
                            active
                              ? selected || options.sheets.length === 0
                                ? "bg-primary/10 text-primary ring-1 ring-primary"
                                : ""
                              : "bg-surface-container text-on-surface-variant opacity-70 hover:opacity-100"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <Accordion title="Layout Configuration" icon="table_chart" defaultOpen>
                <div className="flex flex-col gap-2">
                  <ToggleRow
                    checked={options.includeGridlines}
                    onChange={(next) => {
                      setOptions((current) => ({ ...current, includeGridlines: next }));
                      setOutput(null);
                    }}
                    label="Print cell gridlines"
                    disabled={job.running}
                  />
                  <ToggleRow
                    checked={options.fitToWidth}
                    onChange={(next) => {
                      setOptions((current) => ({ ...current, fitToWidth: next }));
                      setOutput(null);
                    }}
                    label="Fit columns to one page wide"
                    right="Per-sheet pagination"
                    disabled={job.running}
                  />
                  <ToggleRow
                    checked={options.includeSheetNames}
                    onChange={(next) => {
                      setOptions((current) => ({ ...current, includeSheetNames: next }));
                      setOutput(null);
                    }}
                    label="Print sheet names as centered headers"
                    disabled={job.running}
                  />
                </div>
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
                hint={`Margins apply via the page setup (${Object.entries(MARGIN_POINTS).map(([k, v]) => `${k} ${v}pt`).join(", ")}).`}
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
            fileName={first ? outputName(first.name) : "spreadsheet.pdf"}
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
