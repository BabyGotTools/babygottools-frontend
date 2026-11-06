"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import LoadedFileList from "../components/LoadedFileList";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, NumberField, SegmentedControl, SelectField } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { buildImagePdf, prepareImages, type ImageQuality } from "../engines/imagePdf";
import { DEFAULT_IMAGE_OPTIONS } from "../engines/imagePdf";
import type { ImagePageOptions } from "../engines/imagePdf";
import { formatBytes } from "../engines/optimizeUtils";
import { describeConversionError } from "../engines/convertShared";

/** Image-to-PDF: tray with reorder/duplicate/rotate, quality + page setup. */
export default function ImageToPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "image", maxFiles: 60 });
  const job = usePdfJob();
  const [options, setOptions] = useState<ImagePageOptions>(DEFAULT_IMAGE_OPTIONS);
  const [quality, setQuality] = useState<ImageQuality>("high");
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const totalBytes = files.files.reduce((sum, entry) => sum + entry.size, 0);

  const run = () =>
    job.start(async (report) => {
      const list = files.files.map((entry) => entry.file);
      if (list.length === 0) throw new Error("Add at least one image");

      report({ phase: "reading", percent: 10, message: "Decoding images…" });
      const prepared = await prepareImages(list, quality, (completed, total, name) => {
        report({
          phase: "rasterizing",
          percent: Math.round((completed / Math.max(1, total)) * 60),
          message: name ? `Decoding ${name} (${completed + 1}/${total})` : "Images decoded",
        });
      });

      report({ phase: "rebuilding", percent: 70, message: "Laying out pages…" });
      const outcome = await buildImagePdf(prepared, options, (percent, message) => {
        report({ phase: "writing", percent, message });
      });
      setWarnings(outcome.warnings);
      setOutput(outcome.bytes);
    });

  const patch = (next: Partial<ImagePageOptions>) => {
    setOptions((current) => ({ ...current, ...next }));
    setOutput(null);
  };

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            title="Drop images here or click to browse"
            subtitle="JPG, PNG, WebP, HEIC, GIF, BMP, TIFF — validated by real signature bytes."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {files.files.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                  {files.files.length} image{files.files.length === 1 ? "" : "s"} • {formatBytes(totalBytes)}
                </span>
                <button
                  type="button"
                  onClick={files.clearFiles}
                  disabled={job.running}
                  className="px-2.5 py-1 text-label-sm font-label-sm bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors"
                >
                  Clear All
                </button>
              </div>
              <LoadedFileList
                files={files.files}
                onMove={files.moveFile}
                onRemove={files.removeFile}
                onDuplicate={files.duplicateFile}
                disabled={job.running}
              />
            </div>
          )}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <SelectField
                label="Page size"
                value={options.pageSize}
                onChange={(next) => patch({ pageSize: next as ImagePageOptions["pageSize"] })}
                options={[
                  { value: "a4", label: "A4 (210×297mm)" },
                  { value: "letter", label: "US Letter" },
                  { value: "legal", label: "US Legal" },
                  { value: "auto", label: "Fit to image" },
                ]}
                disabled={job.running}
              />
              <SelectField
                label="Orientation"
                value={options.orientation}
                onChange={(next) => patch({ orientation: next as ImagePageOptions["orientation"] })}
                options={[
                  { value: "auto", label: "Auto (per image)" },
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Landscape" },
                ]}
                disabled={job.running}
              />
              <SelectField
                label="Margins"
                value={options.margin}
                onChange={(next) => patch({ margin: next as ImagePageOptions["margin"] })}
                options={[
                  { value: "none", label: "None — edge to edge" },
                  { value: "small", label: "Small (24pt)" },
                  { value: "medium", label: "Medium (48pt)" },
                  { value: "large", label: "Large (72pt)" },
                ]}
                disabled={job.running}
              />
              <SelectField
                label="Re-encode quality"
                value={quality}
                onChange={(next) => {
                  setQuality(next as ImageQuality);
                  setOutput(null);
                }}
                options={[
                  { value: "high", label: "High — PNG kept lossless" },
                  { value: "medium", label: "Medium — 2400px JPEG" },
                  { value: "low", label: "Low — 1600px JPEG" },
                ]}
                disabled={job.running}
              />
            </div>
            <Accordion title="Layout & Fit (grid, cover, columns)" icon="grid_view">
              <SegmentedControl<"single" | "grid">
                label="Layout"
                value={options.layout}
                onChange={(next) => patch({ layout: next })}
                options={[
                  { value: "single", label: "One image per page", hint: "Full content box" },
                  { value: "grid", label: "Grid collage", hint: "N×N per sheet" },
                ]}
                disabled={job.running}
              />
              {options.layout === "grid" && (
                <NumberField
                  label="Grid columns"
                  value={options.gridColumns}
                  min={1}
                  max={4}
                  onChange={(next) => patch({ gridColumns: next })}
                  disabled={job.running}
                />
              )}
              <SegmentedControl<"contain" | "cover">
                label="Fit behavior"
                value={options.fit}
                onChange={(next) => patch({ fit: next })}
                options={[
                  { value: "contain", label: "Contain", hint: "Whole image visible (aspect safe)" },
                  { value: "cover", label: "Cover", hint: "Edge-to-edge (crops overflow)" },
                ]}
                disabled={job.running}
              />
            </Accordion>
            <RunBar
              actionLabel={`Build PDF from ${files.files.length} image${files.files.length === 1 ? "" : "s"} (WASM)`}
              actionIcon="image"
              onRun={run}
              disabled={files.files.length === 0}
              running={job.running}
              progress={job.state.progress}
              message={job.state.message}
              error={job.state.error ? describeConversionError(job.state.error, tool.title) : null}
              onReset={() => {
                files.clearFiles();
                setOutput(null);
                job.reset();
              }}
            />
          </div>
        </>
      }
      right={
        <>
          <ResultCard
            title="PDF Output"
            beforeBytes={output ? totalBytes : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName="images.pdf"
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
