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
import { countFlattenable, flattenPdf, type FlattenReport } from "../engines/flattenPdf";
import { baseNameOf } from "../engines/convertShared";

/**
 * Flatten: bake AcroForm field appearances and/or annotations into page
 * content, or rasterize whole pages as an explicit opt-in. The counts are
 * measured before the run so the report is factual.
 */
export default function FlattenPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [forms, setForms] = useState(true);
  const [annotations, setAnnotations] = useState(true);
  const [rasterize, setRasterize] = useState(false);
  const [counts, setCounts] = useState<{ fieldCount: number; annotationCount: number } | null>(null);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState<FlattenReport | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const first = files.files[0];

  // Measure flattenable structures as soon as a file is parsed.
  useEffect(() => {
    if (!first || first.error) {
      setCounts(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const measured = await countFlattenable(new Uint8Array(await first.file.arrayBuffer()));
      if (!cancelled) setCounts(measured);
    })();
    return () => {
      cancelled = true;
    };
  }, [first]);

  const run = () =>
    job.start(async (report_) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);
      if (!forms && !annotations && !rasterize) {
        throw new Error("Pick at least one flattening target — forms, annotations, or full rasterization.");
      }

      const outcome = await flattenPdf(
        new Uint8Array(await entry.file.arrayBuffer()),
        { forms, annotations, rasterize },
        report_
      );
      setOutput(outcome.bytes);
      setReport(outcome.report);
      setWarnings(outcome.warnings);
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={(list) => {
              files.addFiles(list);
              setOutput(null);
              setReport(null);
              job.reset();
            }}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Interactive appearances become permanent page pixels — fields can no longer be edited."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={
                  counts
                    ? `${first.pageCount} pages • ${counts.fieldCount} form field${counts.fieldCount === 1 ? "" : "s"} • ${counts.annotationCount} annotation${counts.annotationCount === 1 ? "" : "s"}`
                    : `${first.pageCount} pages • measuring interactive content…`
                }
              />
              <div className="flex flex-col gap-2 bg-surface-container-low p-space-sm rounded-lg">
                <ToggleRow
                  checked={forms}
                  onChange={(next) => {
                    setForms(next);
                    setOutput(null);
                  }}
                  label="Flatten AcroForm form fields (checkboxes, text inputs, signatures)"
                  right={counts ? `${counts.fieldCount} found` : undefined}
                  disabled={job.running}
                />
                <ToggleRow
                  checked={annotations}
                  onChange={(next) => {
                    setAnnotations(next);
                    setOutput(null);
                  }}
                  label="Flatten annotations (stamps, ink, highlights, comments)"
                  right={counts ? `${counts.annotationCount} found` : undefined}
                  disabled={job.running}
                />
                <ToggleRow
                  checked={rasterize}
                  onChange={(next) => {
                    setRasterize(next);
                    setOutput(null);
                  }}
                  label="Full page rasterization (destroys the text layer)"
                  right="Explicit opt-in"
                  disabled={job.running}
                />
              </div>
              <RunBar
                actionLabel="Flatten PDF (WASM)"
                actionIcon="layers_clear"
                onRun={run}
                disabled={Boolean(first.encrypted)}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  setReport(null);
                  job.reset();
                }}
              />
            </div>
          )}
          <Accordion title="What flattening actually does" icon="layers_clear">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Flattening renders each interactive appearance stream onto its page, then removes the
              interactive object. The engine bakes form fields and annotations in a single pass — if you
              flatten annotations, present form fields are baked with them (and vice versa, screen-only
              annotations stay live in &ldquo;forms only&rdquo; mode). The result card tells you exactly which of the two
              happened.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="Flattened Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "document"}-flattened.pdf`}
            bytes={output}
            downloadLabel="Download Flattened PDF"
            warnings={warnings}
          >
            {report && (
              <div className="flex flex-col gap-1.5 bg-surface-container-low p-3 rounded-lg">
                <span className="font-label-mono-xs text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-semibold">
                  Baked Content Report
                </span>
                <div className="flex items-center justify-between py-1 border-b border-outline-variant/30">
                  <span className="font-body-sm text-body-sm text-on-surface font-medium">Form fields detected</span>
                  <span className="font-label-mono-xs text-label-sm text-on-surface font-semibold">{report.fieldCount}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-outline-variant/30">
                  <span className="font-body-sm text-body-sm text-on-surface font-medium">Annotations detected</span>
                  <span className="font-label-mono-xs text-label-sm text-on-surface font-semibold">{report.annotationCount}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="font-body-sm text-body-sm text-on-surface font-medium">Baked together in one pass</span>
                  <span className="font-label-mono-xs text-label-sm text-tertiary font-semibold">
                    {report.rasterized ? "Rasterized" : report.bakedBothTogether ? "Yes" : "Forms only"}
                  </span>
                </div>
              </div>
            )}
          </ResultCard>
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
