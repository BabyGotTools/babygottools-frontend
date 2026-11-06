"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import FileInspectorCard from "../components/FileInspectorCard";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, NumberField, SelectField, ToggleRow } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { OCR_LANGUAGES, ocrPdf } from "../engines/ocrEngine";
import { baseNameOf } from "../engines/convertShared";

/**
 * OCR Scanner: Tesseract.js runs page-by-page; recognized pages are
 * reassembled into a searchable PDF and the full text is shown for copying.
 */
export default function OcrPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [language, setLanguage] = useState("eng");
  const [dpi, setDpi] = useState(200);
  const [skipPagesWithText, setSkipPagesWithText] = useState(true);
  const [result, setResult] = useState<Awaited<ReturnType<typeof ocrPdf>> | null>(null);

  const first = files.files[0];

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const outcome = await ocrPdf(
        new Uint8Array(await entry.file.arrayBuffer()),
        { language, dpi, skipPagesWithText },
        report
      );
      setResult(outcome);
    });

  const languageNote =
    language === "eng"
      ? null
      : "Non-English language models (~2-15 MB) download once from the tessdata CDN, then cache in IndexedDB for offline reuse.";

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
            subtitle="Scanned pages are rasterised, recognized by Tesseract, and rebuilt as a searchable document."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard
                file={first}
                metaLine={`${first.pageCount} page${first.pageCount === 1 ? "" : "s"} • OCR is slow (~2-6s per page)`}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SelectField
                  label="Recognition language"
                  value={language}
                  onChange={(next) => {
                    setLanguage(next);
                    setResult(null);
                  }}
                  options={OCR_LANGUAGES.map((entry) => ({ value: entry.id, label: entry.label }))}
                  disabled={job.running}
                />
                <SelectField
                  label="Render resolution"
                  value={String(dpi)}
                  onChange={(next) => {
                    setDpi(Number(next));
                    setResult(null);
                  }}
                  options={[
                    { value: "150", label: "150 DPI — fast" },
                    { value: "200", label: "200 DPI — balanced" },
                    { value: "300", label: "300 DPI — best accuracy" },
                  ]}
                  disabled={job.running}
                />
              </div>
              <ToggleRow
                checked={skipPagesWithText}
                onChange={(next) => {
                  setSkipPagesWithText(next);
                  setResult(null);
                }}
                label="Skip pages that already contain digital text"
                hint="Mixed documents keep their vector pages untouched; only image-only pages get OCR."
                right="Preserves originals"
                disabled={job.running}
              />
              {languageNote && (
                <p className="p-2.5 rounded-lg bg-surface-container-low text-secondary font-body-sm text-body-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0">language</span>
                  {languageNote}
                </p>
              )}
              <RunBar
                actionLabel="Run OCR (WASM)"
                actionIcon="document_scanner"
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
                hint="First run downloads the language model; afterwards it is cached for offline use."
              />
            </div>
          )}
        </>
      }
      right={
        <>
          <ResultCard
            title="Searchable Output"
            beforeBytes={first && result ? first.size : undefined}
            afterBytes={result ? result.bytes.byteLength : undefined}
            fileName={`${first ? baseNameOf(first.name) : "document"}-searchable.pdf`}
            bytes={result?.bytes ?? null}
            downloadLabel="Download Searchable PDF"
            warnings={
              result
                ? [
                    result.copiedPages > 0
                      ? `${result.copiedPages} page${result.copiedPages === 1 ? "" : "s"} kept their original digital content (skipped or non-rasterizable).`
                      : "",
                    "Recognition confidence varies by scan quality; verify critical text against the source.",
                  ].filter(Boolean)
                : []
            }
          >
            {result?.extractedText && (
              <div className="flex flex-col gap-1.5 bg-surface-container-low p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono-xs text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Extracted Text ({result.extractedText.length.toLocaleString()} chars)
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(result.extractedText)}
                    className="px-2 py-0.5 rounded bg-surface-container-lowest text-primary font-label-mono-xs font-semibold hover:bg-surface-container-high transition-colors"
                  >
                    Copy All
                  </button>
                </div>
                <pre className="max-h-40 overflow-auto font-label-mono-xs text-label-sm text-on-surface whitespace-pre-wrap">
                  {result.extractedText.slice(0, 2000)}
                  {result.extractedText.length > 2000 ? "\n…" : ""}
                </pre>
              </div>
            )}
          </ResultCard>
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
