"use client";

import { useEffect, useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runConvertFrom } from "../engines/convertFrom/convertFromClient";
import { CONVERT_FROM_MIME, toPdfPhase } from "../engines/convertFrom/convertFromUtils";
import type { ConvertFromPreview, TablePreviewData } from "../engines/convertFrom/convertFromTypes";
import { buildXlsxFromTables } from "../engines/convertFrom/xlsxBuilder";
import { ConvertTablePreview } from "./ConvertFromPreviews";
import { baseNameOf } from "../engines/convertShared";

export default function PdfToExcelWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [tables, setTables] = useState<TablePreviewData | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [workbook, setWorkbook] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  const first = files.files[0];

  useEffect(() => {
    if (!tables) return;
    setSelectedIds(new Set(tables.tables.map((table) => table.id)));
  }, [tables]);

  /* Selection changes rebuild the workbook bytes, so the download button in
     ResultCard always exports exactly the ticked tables. */
  useEffect(() => {
    if (!tables) return;
    const selected = tables.tables.filter((table) => selectedIds.has(table.id));
    if (selected.length === 0) {
      setWorkbook(null);
      return;
    }
    try {
      const bytes = buildXlsxFromTables(selected, tables.sourceName);
      setWorkbook({ bytes, name: `${baseNameOf(tables.sourceName)}-tables.xlsx` });
    } catch {
      setWorkbook(null);
    }
  }, [tables, selectedIds]);

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      setTables(null);
      setWorkbook(null);
      const buffer = await entry.file.arrayBuffer();
      const outcome = await runConvertFrom({
        tool: "excel",
        bytes: buffer,
        fileName: entry.name,
        options: {},
        onProgress: (progress) =>
          report({ phase: toPdfPhase(progress.phase), percent: progress.percent, message: progress.message }),
      });

      const preview: ConvertFromPreview | undefined = outcome.preview;
      if (preview?.kind !== "tables") throw new Error("No table data was returned by the local engine");
      setTables(preview);
    });

  const selectedCount = tables ? tables.tables.filter((table) => selectedIds.has(table.id)).length : 0;

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Only tabular content is exported. Scanned PDFs need OCR PDF first."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} />
              <RunBar
                actionLabel="Detect Tables (Local WASM)"
                actionIcon="grid_on"
                onRun={run}
                disabled={!first || first.pageCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setTables(null);
                  setSelectedIds(new Set());
                  setWorkbook(null);
                  job.reset();
                }}
                hint="First run fetches the one-time ~90 MB table engine from this site (cached afterwards, never your document)."
              />
            </div>
          )}
          <Accordion title="What becomes a sheet" icon="table_chart">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Each detected table exports as its own worksheet with a frozen header row, content-sized columns,
              and an auto-filter. Paragraphs, images, and page layout are not part of the export. Deselect noisy
              tables before downloading to keep the workbook clean.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="Excel Workbook Output"
            beforeBytes={first && workbook ? first.size : undefined}
            afterBytes={workbook ? workbook.bytes.byteLength : undefined}
            fileName={workbook?.name ?? (first ? `${baseNameOf(first.name)}-tables.xlsx` : "tables.xlsx")}
            bytes={workbook?.bytes ?? null}
            mimeType={CONVERT_FROM_MIME.excel}
            downloadLabel={selectedCount > 0 ? `Download XLSX (${selectedCount} table${selectedCount === 1 ? "" : "s"})` : "Download XLSX"}
            quickView={false}
            warnings={
              tables
                ? [
                    `${tables.tables.length} table${tables.tables.length === 1 ? "" : "s"} detected${tables.pageCount ? ` across ${tables.pageCount} pages` : ""}.`,
                  ]
                : []
            }
          >
            {tables && (
              <ConvertTablePreview data={tables} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />
            )}
          </ResultCard>
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
