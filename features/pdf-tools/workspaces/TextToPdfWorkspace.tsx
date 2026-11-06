"use client";

import { useState } from "react";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfWorkspaceGrid from "../components/PdfWorkspaceGrid";
import PdfDropzone from "../components/PdfDropzone";
import ResultCard from "../components/ResultCard";
import EngineSpecsCard from "../components/EngineSpecsCard";
import RunBar from "../components/RunBar";
import { Accordion, NumberField, SegmentedControl, SelectField } from "../components/PdfControls";
import { usePdfFiles } from "../components/usePdfFiles";
import { usePdfJob } from "../components/usePdfJob";
import { buildTextPdf } from "../engines/typesetText";
import type { TextPageOptions } from "../engines/typesetText";
import type { Orientation } from "../engines/convertShared";
import { MARGIN_POINTS } from "../engines/convertShared";

/**
 * Text-to-PDF: real typesetting — the text is measured with the embedded
 * font, wrapped, paginated, and written as selectable vector text.
 */
export default function TextToPdfWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "text", maxFiles: 1 });
  const job = usePdfJob();
  const [text, setText] = useState("");
  const [options, setOptions] = useState<TextPageOptions>({
    ...{ pageSize: "a4", orientation: "portrait", margin: "medium" },
    fontFamily: "mono",
    fontSize: 11,
    lineSpacing: 1.4,
    headerFooter: "page-number",
    customHeader: "",
    customFooter: "",
  } as TextPageOptions);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const first = files.files[0];

  const loadFile = async (list: FileList) => {
    files.addFiles(list);
    const file = list[0];
    if (file) {
      const loaded = await file.text();
      setText(loaded);
      setOutput(null);
    }
  };

  const run = () =>
    job.start(async (report) => {
      if (!text.trim()) throw new Error("Add some text before converting");
      const outcome = await buildTextPdf(text, options, (percent, message) => {
        report({ phase: "writing", percent, message });
      });
      setWarnings(outcome.warnings);
      setOutput(outcome.bytes);
    });

  const patch = (next: Partial<TextPageOptions>) => {
    setOptions((current) => ({ ...current, ...next }));
    setOutput(null);
  };

  const charCount = text.length.toLocaleString();

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={loadFile}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            title="Drop a .txt file — or type below"
            subtitle="The file is read locally and pasted into the editor; nothing is uploaded."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-on-surface font-semibold truncate">{first.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    files.clearFiles();
                    setText("");
                  }}
                  className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors"
                  aria-label="Remove text file"
                >
                  <span className="material-symbols-outlined text-[17px]">close</span>
                </button>
              </div>
            </div>
          )}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Text content ({charCount} chars)
              </span>
              <textarea
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setOutput(null);
                }}
                disabled={job.running}
                rows={12}
                placeholder="Paste or type the text to typeset…"
                className="w-full bg-surface-container-low p-3 rounded-lg font-label-mono-xs text-label-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <SelectField
                label="Typeface"
                value={options.fontFamily}
                onChange={(next) => patch({ fontFamily: next as TextPageOptions["fontFamily"] })}
                options={[
                  { value: "mono", label: "Mono — Cousine" },
                  { value: "sans", label: "Sans — Arimo" },
                  { value: "serif", label: "Serif — Tinos" },
                ]}
                disabled={job.running}
              />
              <NumberField label="Font size" value={options.fontSize} min={8} max={24} suffix="pt" onChange={(next) => patch({ fontSize: next })} disabled={job.running} />
              <NumberField label="Line spacing" value={options.lineSpacing} min={1} max={2.5} step={0.05} onChange={(next) => patch({ lineSpacing: next })} disabled={job.running} />
            </div>
            <Accordion title="Page Setup, Margins & Header/Footer" icon="straighten" defaultOpen>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SelectField
                  label="Page size"
                  value={options.pageSize}
                  onChange={(next) => patch({ pageSize: next as TextPageOptions["pageSize"] })}
                  options={[
                    { value: "a4", label: "A4" },
                    { value: "letter", label: "US Letter" },
                    { value: "legal", label: "US Legal" },
                  ]}
                  disabled={job.running}
                />
                <SelectField
                  label="Margins"
                  value={options.margin}
                  onChange={(next) => patch({ margin: next as TextPageOptions["margin"] })}
                  options={Object.keys(MARGIN_POINTS).map((key) => ({
                    value: key,
                    label: `${key[0].toUpperCase()}${key.slice(1)} (${MARGIN_POINTS[key as keyof typeof MARGIN_POINTS]}pt)`,
                  }))}
                  disabled={job.running}
                />
                <SelectField
                  label="Header / footer"
                  value={options.headerFooter}
                  onChange={(next) => patch({ headerFooter: next as TextPageOptions["headerFooter"] })}
                  options={[
                    { value: "none", label: "None" },
                    { value: "page-number", label: "Page numbers" },
                    { value: "custom", label: "Custom header/footer" },
                  ]}
                  disabled={job.running}
                />
                <SegmentedControl<Orientation>
                  label="Orientation"
                  value={options.orientation}
                  onChange={(next) => patch({ orientation: next })}
                  options={[
                    { value: "auto", label: "Auto", hint: "Fit each page" },
                    { value: "portrait", label: "Portrait" },
                    { value: "landscape", label: "Landscape" },
                  ]}
                  disabled={job.running}
                />
              </div>
              {options.headerFooter === "custom" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={options.customHeader}
                    disabled={job.running}
                    onChange={(event) => patch({ customHeader: event.target.value })}
                    placeholder="Header text"
                    className="bg-surface-container-lowest rounded-md px-2.5 py-2 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  />
                  <input
                    type="text"
                    value={options.customFooter}
                    disabled={job.running}
                    onChange={(event) => patch({ customFooter: event.target.value })}
                    placeholder="Footer text"
                    className="bg-surface-container-lowest rounded-md px-2.5 py-2 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  />
                </div>
              )}
            </Accordion>
            <RunBar
              actionLabel="Typeset to PDF (WASM)"
              actionIcon="picture_as_pdf"
              onRun={run}
              disabled={!text.trim()}
              running={job.running}
              progress={job.state.progress}
              message={job.state.message}
              error={job.state.error}
              onReset={() => {
                files.clearFiles();
                setText("");
                setOutput(null);
                job.reset();
              }}
              hint="Text is embedded as real vector glyphs with the selected font — fully selectable in the output."
            />
          </div>
        </>
      }
      right={
        <>
          <ResultCard
            title="Typeset PDF"
            fileName="text.pdf"
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
