"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, NumberField, SegmentedControl, SelectField, ToggleRow } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { runPdfOperation } from "../engines/pdfWorkerClient";
import { mmToPoints, NUP_LAYOUTS, type PagesPerSheet } from "../engines/pageMath";
import { formatBytes } from "../engines/optimizeUtils";
import { baseNameOf } from "../engines/convertShared";

type NUpOrder = "horizontal" | "vertical";

export default function NUpPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [pagesPerSheet, setPagesPerSheet] = useState<PagesPerSheet>(2);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [order, setOrder] = useState<NUpOrder>("horizontal");
  const [marginMm, setMarginMm] = useState(10);
  const [gutterMm, setGutterMm] = useState(5);
  const [frames, setFrames] = useState(true);
  const [output, setOutput] = useState<Uint8Array | null>(null);

  const first = files.files[0];
  const total = first?.pageCount ?? 0;
  const layout = NUP_LAYOUTS[pagesPerSheet];
  const sheetCount = total > 0 ? Math.ceil(total / pagesPerSheet) : 0;

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (total === 0) throw new Error("The document has no readable pages");

      const bytes = await runPdfOperation({
        type: "nup",
        payload: {
          file: await entry.file.arrayBuffer(),
          pagesPerSheet,
          orientation,
          order,
          marginPt: mmToPoints(marginMm),
          gutterPt: mmToPoints(gutterMm),
          frames,
        },
        onProgress: (percent) =>
          report({ phase: "rebuilding", percent, message: "Composing sheets…" }),
      });
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
            subtitle="Several source pages are scaled down and composed onto each output sheet."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={`${total} pages → ${sheetCount} sheets (${layout.cols}×${layout.rows} per sheet)`}
              />
              <SegmentedControl<PagesPerSheet>
                label="Pages per sheet"
                value={pagesPerSheet}
                onChange={(next) => {
                  setPagesPerSheet(next);
                  setOutput(null);
                }}
                options={[
                  { value: 2 as PagesPerSheet, label: "2-up", hint: "1×2 — reading pairs" },
                  { value: 4 as PagesPerSheet, label: "4-up", hint: "2×2 — handouts" },
                  { value: 6 as PagesPerSheet, label: "6-up", hint: "2×3 — compact proofs" },
                  { value: 9 as PagesPerSheet, label: "9-up", hint: "3×3 — overview grids" },
                ]}
                columns={4}
                disabled={job.running}
              />
              <Accordion title="Sheet Geometry" icon="grid_view" defaultOpen>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <SelectField
                    label="Orientation"
                    value={orientation}
                    onChange={(next) => {
                      setOrientation(next as "portrait" | "landscape");
                      setOutput(null);
                    }}
                    options={[
                      { value: "portrait", label: "Portrait" },
                      { value: "landscape", label: "Landscape" },
                    ]}
                    disabled={job.running}
                  />
                  <SelectField
                    label="Placement order"
                    value={order}
                    onChange={(next) => {
                      setOrder(next as NUpOrder);
                      setOutput(null);
                    }}
                    options={[
                      { value: "horizontal", label: "Left→right, top→bottom" },
                      { value: "vertical", label: "Top→bottom, then columns" },
                    ]}
                    disabled={job.running}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Margin" value={marginMm} min={0} max={40} suffix="mm" onChange={(next) => { setMarginMm(next); setOutput(null); }} disabled={job.running} />
                    <NumberField label="Gutter" value={gutterMm} min={0} max={40} suffix="mm" onChange={(next) => { setGutterMm(next); setOutput(null); }} disabled={job.running} />
                  </div>
                </div>
                <ToggleRow
                  checked={frames}
                  onChange={(next) => {
                    setFrames(next);
                    setOutput(null);
                  }}
                  label="Draw hairline frames around placed pages"
                  right="Aids cutting"
                  disabled={job.running}
                />
              </Accordion>
              <RunBar
                actionLabel={`Build ${pagesPerSheet}-up PDF (WASM)`}
                actionIcon="grid_view"
                onRun={run}
                disabled={total === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  job.reset();
                }}
                hint={`Output: ${sheetCount} A4 sheet${sheetCount === 1 ? "" : "s"} — source pages are embedded as vector XObjects (no rasterization).`}
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="N-up Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "document"}-${pagesPerSheet}up.pdf`}
            bytes={output}
            downloadLabel="Download N-up PDF"
            warnings={
              output
                ? [
                    `${sheetCount} sheet${sheetCount === 1 ? "" : "s"} written; small page text becomes harder to read as layout density grows — verify readability at ${pagesPerSheet}-up.`,
                  ]
                : []
            }
          />
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2">
            <span className="font-label-mono-xs text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
              Placement Map
            </span>
            <div className="font-label-sm font-label-sm text-on-surface-variant">
              {layout.cols}×{layout.rows} grid • {formatBytes(first?.size ?? 0)} source • margins{" "}
              {marginMm}mm • gutter {gutterMm}mm
            </div>
          </div>
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
