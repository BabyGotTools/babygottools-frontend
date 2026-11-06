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
import { runConvertFrom } from "../engines/convertFrom/convertFromClient";
import { CONVERT_FROM_MIME, toPdfPhase } from "../engines/convertFrom/convertFromUtils";
import type { MarkdownChunkBy } from "../engines/convertFrom/convertFromTypes";
import { ConvertTextPreview } from "./ConvertFromPreviews";
import { baseNameOf } from "../engines/convertShared";

export default function PdfToMarkdownWorkspace({ tool }: { tool: PdfTool }) {
  const files = usePdfFiles({ kind: "pdf", maxFiles: 1 });
  const job = usePdfJob();
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [chunkBy, setChunkBy] = useState<MarkdownChunkBy>("none");
  const [maxTokens, setMaxTokens] = useState(800);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [outName, setOutName] = useState("");
  const [markdownText, setMarkdownText] = useState("");

  const first = files.files[0];

  const run = () =>
    job.start(async (report) => {
      const entry = files.files[0];
      if (!entry) throw new Error("Add a PDF first");
      if (entry.error) throw new Error(`"${entry.name}" could not be opened: ${entry.error}`);

      const buffer = await entry.file.arrayBuffer();
      const outcome = await runConvertFrom({
        tool: "markdown",
        bytes: buffer,
        fileName: entry.name,
        options: { includeMetadata, chunkBy, maxTokensPerChunk: maxTokens },
        onProgress: (progress) =>
          report({ phase: toPdfPhase(progress.phase), percent: progress.percent, message: progress.message }),
      });

      if (!outcome.bytes) throw new Error("The converter did not produce an output file");
      setOutput(outcome.bytes);
      setOutName(outcome.fileName);
      setMarkdownText(new TextDecoder().decode(outcome.bytes));
    });

  return (
    <PdfWorkspaceGrid
      left={
        <>
          <PdfDropzone
            onFiles={files.addFiles}
            acceptAttr={files.acceptAttr}
            meta={tool.dropzoneMeta}
            subtitle="Text-based PDFs only — scanned documents are refused with a pointer to OCR."
          />
          {files.notice && (
            <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">{files.notice}</div>
          )}
          {first && (
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
              <FileInspectorCard file={first} />
              <ToggleRow
                label="Include YAML front matter"
                hint="Adds title, author, subject, keywords, source and page count"
                checked={includeMetadata}
                onChange={setIncludeMetadata}
                disabled={job.running}
              />
              <SelectField
                label="Chunking"
                value={chunkBy}
                onChange={(value) => setChunkBy(value as MarkdownChunkBy)}
                options={[
                  { value: "none", label: "Single document" },
                  { value: "heading", label: "By heading (sections)" },
                  { value: "page", label: "By page" },
                  { value: "token", label: "By token budget" },
                ]}
                disabled={job.running}
              />
              {chunkBy === "token" && (
                <NumberField
                  label="Max tokens per chunk"
                  value={maxTokens}
                  min={100}
                  max={4000}
                  step={50}
                  onChange={setMaxTokens}
                  disabled={job.running}
                />
              )}
              <RunBar
                actionLabel="Convert to Markdown (Local)"
                actionIcon="topic"
                onRun={run}
                disabled={!first || first.pageCount === 0}
                running={job.running}
                progress={job.state.progress}
                message={job.state.message}
                error={job.state.error}
                onReset={() => {
                  files.clearFiles();
                  setOutput(null);
                  setOutName("");
                  setMarkdownText("");
                  job.reset();
                }}
              />
            </div>
          )}
          <Accordion title="What is chunking for?" icon="segment">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              LLM/RAG pipelines often need documents pre-split. Chunk by heading (semantic sections), by page, or
              by a token budget — every chunk carries a comment marker naming its pages and section path, and
              chunks are separated by horizontal rules.
            </p>
          </Accordion>
        </>
      }
      right={
        <>
          <ResultCard
            title="Markdown Output"
            beforeBytes={first && output ? first.size : undefined}
            afterBytes={output ? output.byteLength : undefined}
            fileName={outName || (first ? `${baseNameOf(first.name)}.md` : "converted.md")}
            bytes={output}
            mimeType={CONVERT_FROM_MIME.markdown}
            downloadLabel="Download Markdown"
            quickView={false}
          >
            {markdownText && <ConvertTextPreview text={markdownText} />}
          </ResultCard>
          <EngineSpecsCard specs={tool.engineSpecs} />
        </>
      }
    />
  );
}
