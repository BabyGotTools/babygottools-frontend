"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, NumberField, RecommendedBadge, SegmentedControl, SelectField, ToggleRow } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { compressPdf } from "../engines/optimizePdf";
import {
  DEFAULT_DPI_BY_PROFILE,
  PROFILE_DESCRIPTIONS,
  describeSavings,
  formatBytes,
  isLargeFile,
} from "../engines/optimizeUtils";
import type { CompressProfile } from "../engines/pdfTypes";
import { baseNameOf } from "../engines/convertShared";

const PROFILE_BADGES: Record<CompressProfile, string> = {
  extreme: "-85%",
  balanced: "-65%",
  prepress: "-35%",
};

export default function CompressPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [profile, setProfile] = useState<CompressProfile>("balanced");
  const [dpi, setDpi] = useState(DEFAULT_DPI_BY_PROFILE.balanced);
  const [downsample, setDownsample] = useState(true);
  const [grayscale, setGrayscale] = useState(false);
  const [recompressStreams, setRecompressStreams] = useState(true);
  const [stripMetadata, setStripMetadata] = useState(true);
  const [result, setResult] = useState<Awaited<ReturnType<typeof compressPdf>> | null>(null);

  const first = files.files[0];

  const applyProfile = (next: CompressProfile) => {
    setProfile(next);
    setDpi(DEFAULT_DPI_BY_PROFILE[next]);
    setResult(null);
  };

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const bytes = await entry.file.arrayBuffer();
      const outcome = await compressPdf(
        new Uint8Array(bytes),
        {
          profile,
          downsample,
          dpi,
          grayscale,
          recompressStreams,
          stripMetadata,
        },
        report
      );
      setResult(outcome);
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={(list) => {
              files.addFiles(list);
              setResult(null);
              job.reset();
            }}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Instant client-side buffer loading. Batch uploads supported up to 250MB per instance."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={`${first.pageCount} page${first.pageCount === 1 ? "" : "s"}${isLargeFile(first.size) ? " • Large file: expect a multi-minute run" : ""}`}
              />

              {/* Profile tiles */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="font-headline-sm text-headline-sm text-on-surface font-medium">
                    Select Compression Profile
                  </label>
                  <span className="text-label-sm font-label-sm text-primary font-medium">Profile Auto-Optimized</span>
                </div>
                <div className="relative">
                  <SegmentedControl<CompressProfile>
                    value={profile}
                    onChange={applyProfile}
                    options={[
                      {
                        value: "extreme" as CompressProfile,
                        label: `Extreme ${PROFILE_BADGES.extreme}`,
                        hint: "72 DPI downsampling. Maximum size reduction for mail attachments.",
                      },
                      {
                        value: "balanced" as CompressProfile,
                        label: `Balanced ${PROFILE_BADGES.balanced}`,
                        hint: "150 DPI target. Sharp imagery and crisp vectors for regular printing & screen.",
                      },
                      {
                        value: "prepress" as CompressProfile,
                        label: `Mild / Prepress ${PROFILE_BADGES.prepress}`,
                        hint: "300 DPI target. Preserves critical art fidelity and high-res schematics.",
                      },
                    ]}
                    disabled={job.running}
                  />
                  {profile === "balanced" && (
                    <span className="absolute -top-2 right-[calc(33.9%+8px)]">
                      <RecommendedBadge />
                    </span>
                  )}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {PROFILE_DESCRIPTIONS[profile]}
                </p>
              </div>

              {/* Advanced tuning */}
              <Accordion title="Fine-Tuning Engine Parameters">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <ToggleRow
                    checked={downsample}
                    onChange={(next) => {
                      setDownsample(next);
                      setResult(null);
                    }}
                    label="Downsample Embedded Raster Images"
                    disabled={job.running}
                  />
                  <NumberField label="Target resolution" value={dpi} min={36} max={300} step={6} suffix="DPI" onChange={(next) => { setDpi(next); setResult(null); }} disabled={job.running || !downsample} />
                </div>
                <ToggleRow
                  checked={grayscale}
                  onChange={(next) => {
                    setGrayscale(next);
                    setResult(null);
                  }}
                  label="Convert Color Channels to Grayscale (1-Channel)"
                  disabled={job.running}
                />
                <ToggleRow
                  checked={recompressStreams}
                  onChange={(next) => {
                    setRecompressStreams(next);
                    setResult(null);
                  }}
                  label="Flate/Deflate Content Streams & Pack Object Streams"
                  right="Lossless"
                  disabled={job.running}
                />
                <ToggleRow
                  checked={stripMetadata}
                  onChange={(next) => {
                    setStripMetadata(next);
                    setResult(null);
                  }}
                  label="Strip Document Metadata & Info Dictionary (XMP/EXIF)"
                  disabled={job.running}
                />
              </Accordion>

              <RunBar
                actionLabel="Compress PDF Now (WASM)"
                actionIcon="bolt"
                onRun={run}
                disabled={first.pageCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setResult(null);
                  job.reset();
                }}
                hint={
                  downsample
                    ? "Pages are rasterised at the chosen DPI and re-embedded; the text layer is replaced by page images."
                    : "Lossless structural pass only — text stays selectable."
                }
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Estimated Compression Output"
            beforeBytes={result?.originalSize}
            afterBytes={result?.outputSize}
            verdict={result ? describeSavings(result.stats) : null}
            sizeLines={result?.sizeLines}
            fileName={`${first ? baseNameOf(first.name) : "compressed"}-compressed.pdf`}
            bytes={result?.bytes ?? null}
            downloadLabel="Download Compressed PDF"
            warnings={result?.warnings}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
