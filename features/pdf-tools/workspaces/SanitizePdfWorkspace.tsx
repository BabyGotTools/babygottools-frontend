"use client";

import { useEffect, useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { ToggleRow } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { inspectPdf, sanitizePdf } from "../engines/sanitizePdf";
import type { SanitizeInspectResult, SanitizeOptions } from "../engines/pdfTypes";
import { baseNameOf } from "../engines/convertShared";

/**
 * Sanitize: inspect first (honest report of what is really in the file),
 * then strip exactly the categories the user selects via a structural
 * rebuild-copy.
 */
export default function SanitizePdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [inspection, setInspection] = useState<(SanitizeInspectResult & { pageCount: number }) | null>(null);
  const [options, setOptions] = useState<SanitizeOptions>({
    info: true,
    xmp: true,
    javascript: false,
    openActions: false,
    attachments: false,
    annotations: false,
  });
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const first = files.files[0];

  useEffect(() => {
    if (!first || first.error) {
      setInspection(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const found = await inspectPdf(new Uint8Array(await first.file.arrayBuffer()));
        if (!cancelled) {
          setInspection(found);
          setOptions((current) => ({
            ...current,
            attachments: found.attachmentNames.length > 0,
            javascript: found.hasJavaScript || found.hasOpenAction,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setInspection(null);
          files.setNotice(
            error instanceof Error ? `Inspection failed: ${error.message}` : "Inspection failed"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first?.id]);

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      report({ phase: "analyzing", percent: 30, message: "Rebuilding document without selected structures…" });
      const outcome = await sanitizePdf(new Uint8Array(await entry.file.arrayBuffer()), options);
      setOutput(outcome.bytes);
      setWarnings(outcome.warnings);
    });

  const setOption = (key: keyof SanitizeOptions) => (checked: boolean) => {
    setOptions((current) => ({ ...current, [key]: checked }));
    setOutput(null);
  };

  const findings = inspection
    ? [
        inspection.infoFields.length > 0 ? `${inspection.infoFields.length} info fields` : "No info fields",
        inspection.hasXmp ? "XMP metadata present" : "No XMP metadata",
        inspection.hasJavaScript ? "JavaScript/actions present" : "No JavaScript",
        inspection.hasOpenAction ? "OpenAction present" : "No OpenAction",
        inspection.attachmentNames.length > 0 ? `${inspection.attachmentNames.length} embedded files` : "No embedded files",
        inspection.annotationCount > 0 ? `${inspection.annotationCount} annotations` : "No annotations",
      ]
    : [];

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={(list) => {
              files.addFiles(list);
              setOutput(null);
              setWarnings([]);
              job.reset();
            }}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="The inspector reads real structures first; nothing is removed until you run the sanitize."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={inspection ? `Inspected: ${first.pageCount} pages` : "Inspecting…"}
                sizeBadgeLabel="Input"
              />

              {/* Honest inspection report */}
              {inspection && (
                <div className="flex flex-col gap-1.5 bg-surface-container-low p-3 rounded-lg">
                  <span className="font-label-mono-xs text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-semibold">
                    Inspection Report
                  </span>
                  {inspection.infoFields.length > 0 && (
                    <div className="grid grid-cols-2 gap-1 mb-1">
                      {inspection.infoFields.map((field) => (
                        <div key={field.label} className="text-label-sm font-label-sm text-on-surface-variant truncate">
                          <span className="text-outline">{field.label}:</span> {field.value}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {findings.map((finding) => {
                      const positive = /present|Embedded files|\d+ annotations|\d+ info fields/.test(finding);
                      return (
                        <span
                          key={finding}
                          className={`px-2 py-0.5 rounded-full font-label-mono-xs text-label-sm ${
                            positive
                              ? "bg-error-container/40 text-error"
                              : "bg-tertiary-fixed/40 text-tertiary"
                          }`}
                        >
                          {finding}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Removal toggles */}
              <div className="flex flex-col gap-2 bg-surface-container-low p-space-sm rounded-lg">
                <ToggleRow checked={options.info} onChange={setOption("info")} label="Document info fields (Title, Author, Producer, dates)" disabled={job.running} />
                <ToggleRow checked={options.xmp} onChange={setOption("xmp")} label="XMP metadata stream" disabled={job.running} />
                <ToggleRow checked={options.javascript} onChange={setOption("javascript")} label="JavaScript & additional actions" right={inspection?.hasJavaScript ? "Detected" : undefined} disabled={job.running} />
                <ToggleRow checked={options.openActions} onChange={setOption("openActions")} label="OpenAction (auto-run on open)" right={inspection?.hasOpenAction ? "Detected" : undefined} disabled={job.running} />
                <ToggleRow checked={options.attachments} onChange={setOption("attachments")} label="Embedded file attachments" right={inspection?.attachmentNames.length ? `${inspection.attachmentNames.length} found` : undefined} disabled={job.running} />
                <ToggleRow checked={options.annotations} onChange={setOption("annotations")} label="Annotations (comments, highlights, ink)" right={inspection ? `${inspection.annotationCount} found` : undefined} disabled={job.running} />
              </div>

              <RunBar
                actionLabel="Sanitize PDF (WASM)"
                actionIcon="security"
                onRun={run}
                disabled={Boolean(first.encrypted)}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  setWarnings([]);
                  job.reset();
                }}
                hint="Visible page content is untouched unless you opt into annotation stripping."
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Sanitized Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "document"}-sanitized.pdf`}
            bytes={output}
            downloadLabel="Download Sanitized PDF"
            warnings={warnings}
          />
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
