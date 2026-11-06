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
import { runConvertFrom } from "../engines/convertFrom/convertFromClient";
import { CONVERT_FROM_MAX_PAGES_WARNING, imageExtension, toPdfPhase } from "../engines/convertFrom/convertFromUtils";
import type { ConvertFromPreview, ImagePreviewData, ImageOutputFormat } from "../engines/convertFrom/convertFromTypes";
import { ConvertImagePreviewGrid } from "./ConvertFromPreviews";
import { baseNameOf } from "../engines/convertShared";

type ScaleId = "1" | "1.5" | "2" | "3";

export default function PdfToJpgWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [format, setFormat] = useState<ImageOutputFormat>("jpeg");
  const [scale, setScale] = useState<ScaleId>("2");
  const [quality, setQuality] = useState(90);
  const [pageRange, setPageRange] = useState("");
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [outName, setOutName] = useState("");
  const [preview, setPreview] = useState<ImagePreviewData | null>(null);

  const first = files.files[0];
  const manyPages = (first?.pageCount ?? 0) > CONVERT_FROM_MAX_PAGES_WARNING;

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const buffer = await entry.file.arrayBuffer();
      const outcome = await runConvertFrom({
        tool: "image",
        bytes: buffer,
        fileName: entry.name,
        options: { format, scale: Number(scale), quality: quality / 100, pageRange: pageRange.trim() || "all" },
        onProgress: (progress) =>
          report({ phase: toPdfPhase(progress.phase), percent: progress.percent, message: progress.message }),
      });

      if (!outcome.bytes) throw new Error("The converter did not produce an output file");
      setOutput(outcome.bytes);
      setOutName(outcome.fileName);
      const previewData: ConvertFromPreview | undefined = outcome.preview;
      setPreview(previewData?.kind === "images" ? previewData : null);
    });

  const ext = imageExtension(format);

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="One page downloads as an image; multiple pages bundle into an ordered ZIP."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                <SelectField
                  label="Image format"
                  value={format}
                  onChange={(value) => setFormat(value as ImageOutputFormat)}
                  options={[
                    { value: "jpeg", label: "JPG — smaller files" },
                    { value: "png", label: "PNG — lossless, larger" },
                  ]}
                  disabled={job.running}
                />
                <SelectField
                  label="Resolution"
                  value={scale}
                  onChange={(value) => setScale(value as ScaleId)}
                  options={[
                    { value: "1", label: "1× — screen (smallest)" },
                    { value: "1.5", label: "1.5× — balanced" },
                    { value: "2", label: "2× — high quality" },
                    { value: "3", label: "3× — print (largest)" },
                  ]}
                  disabled={job.running}
                />
              </div>
              {format === "jpeg" && (
                <label className="flex flex-col gap-1">
                  <span className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    JPG quality
                    <span className="font-label-mono-xs normal-case">{quality}%</span>
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={quality}
                    onChange={(event) => setQuality(Number(event.target.value))}
                    disabled={job.running}
                    className="accent-primary"
                  />
                </label>
              )}
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
              {manyPages && (
                <p className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
                  Rendering more than {CONVERT_FROM_MAX_PAGES_WARNING} pages at high resolution can exhaust browser
                  memory. Consider converting a page range first.
                </p>
              )}
              <RunBar
                actionLabel={`Convert to ${format === "jpeg" ? "JPG" : "PNG"} (Local)`}
                actionIcon="image"
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
                  setPreview(null);
                  job.reset();
                }}
              />
            </div>
          )}
          <Accordion title="How rasterization works" icon="photo_library">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Every page is drawn through pdf.js onto an offscreen canvas at your chosen scale, then encoded as
              JPEG (with a white underlay so transparent areas never turn black) or lossless PNG. Filenames
              include the page number ({`{name}-page-3.{ext}`}), and multi-page jobs arrive as one ZIP.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="Image Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={outName || (first ? `${baseNameOf(first.name)}.${first.pageCount === 1 ? ext : "zip"}` : "images.zip")}
            bytes={output}
            mimeType={output?.byteLength !== undefined && first?.pageCount === 1 && !outName.endsWith(".zip") ? `image/${format === "jpeg" ? "jpeg" : "png"}` : "application/zip"}
            downloadLabel="Download Images"
            quickView={false}
          >
            {preview && <ConvertImagePreviewGrid data={preview} />}
          </ResultCard>
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
