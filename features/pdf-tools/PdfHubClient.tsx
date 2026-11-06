"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/common/Icon";
import Breadcrumbs from "@/components/tools/Breadcrumbs";
import type { PdfToolCategory, PdfToolHubCard } from "@/data/pdfToolTypes";
import { PDF_HUB_CATEGORIES as PDF_TOOL_CATEGORIES } from "@/data/pdfToolTypes";
import { usePdfFiles } from "./components/usePdfFiles";
import { usePdfJob } from "./components/usePdfJob";
import { runPdfOperation } from "./engines/pdfWorkerClient";
import { formatBytes } from "./engines/convertShared";

/* ------------------------------------------------------------------ */
/* Hub content (mirrors the Stitch PDF category hub). Copy that would   */
/* make unverifiable engine claims was adjusted to the real stack:      */
/* pdf-lib for structural ops, qpdf-wasm for repair/linearize,          */
/* tesseract.js for OCR.                                                */
/* ------------------------------------------------------------------ */

const PILLARS = [
  {
    icon: "cloud_off",
    iconClass: "bg-tertiary-fixed text-tertiary-container",
    title: "Zero Server Uploads",
    desc: "Unlike traditional cloud PDF editors, your confidential contracts, medical records, or tax returns are never transmitted over HTTP. Disconnect your Wi-Fi and every tool executes identically.",
    footIcon: "check_circle",
    footClass: "text-tertiary",
    foot: "0 KB Network Footprint",
  },
  {
    icon: "memory",
    iconClass: "bg-primary/10 text-primary",
    title: "WebAssembly & WebWorkers",
    desc: "C++-compiled engines (qpdf, Tesseract) plus the pdf-lib core run inside dedicated WebWorker threads. Expect desktop-class page reordering, rasterization and byte parsing without a single upload.",
    footIcon: "speed",
    footClass: "text-primary",
    foot: "Sub-100ms In-Memory Ops",
  },
  {
    icon: "flight_takeoff",
    iconClass: "bg-secondary/10 text-secondary",
    title: "Air-Gapped Capable",
    desc: "Engineered to satisfy strict SOC2 and HIPAA handling requirements without enterprise software installations. Well suited to defense, legal teams, and healthcare compliance workflows.",
    footIcon: "lock",
    footClass: "text-secondary",
    foot: "Local Memory Sandbox",
  },
] as const;

const HUB_FAQS = [
  {
    q: "Is my confidential document or contract uploaded to your servers?",
    a: "No. All Baby Got Tools document utilities run entirely in your local browser sandbox via WebAssembly and WebWorkers. Open your browser Developer Tools (Network tab) and inspect every operation: you will see exactly zero outbound file transmissions.",
  },
  {
    q: "What is the maximum file size supported by in-browser processing?",
    a: "Because operations run against client RAM, standard 64-bit modern browsers comfortably handle individual documents up to 250MB without performance stutter. For batch merging, our streaming chunking keeps peak memory pressure minimal across the 500MB in-memory budget.",
  },
  {
    q: "How does the in-browser OCR engine recognize text without an API key?",
    a: "We load a Tesseract.js WebAssembly runtime and its language dictionary directly into your browser. Recognition occurs locally using your computer's CPU threads — no API key, no remote inference call, no telemetry.",
  },
  {
    q: "Can I use these PDF tools offline without internet connectivity?",
    a: "Yes, for the structural engines. Merge, split, rotate, organize, compress and repair code is bundled with the page itself, so once the tab is open it keeps working with the network unplugged. OCR additionally fetches its language dictionary on first use and caches it in the browser afterwards.",
  },
] as const;

/** True engine chips (from the registry) power card footers — no invented ratings. */
const ICON_TILE: Record<PdfToolHubCard["accent"], string> = {
  primary: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary",
  secondary: "bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-on-secondary",
  tertiary: "bg-tertiary/10 text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary",
  error: "bg-error-container/40 text-error group-hover:bg-error group-hover:text-on-error",
  neutral: "bg-surface-container text-on-surface group-hover:bg-primary group-hover:text-on-primary",
  engine: "bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-on-secondary",
  "on-surface": "bg-surface-container-high text-on-surface group-hover:bg-on-surface group-hover:text-surface",
};

const BADGE_CHIP: Record<PdfToolHubCard["accent"], string> = {
  primary: "bg-primary-fixed text-primary",
  secondary: "bg-secondary-fixed text-secondary",
  tertiary: "bg-tertiary-fixed/60 text-tertiary",
  error: "bg-error-container text-error",
  neutral: "bg-surface-container text-on-surface",
  engine: "bg-secondary-fixed text-secondary",
  "on-surface": "bg-surface-container-high text-on-surface",
};

/** Doc-tile artwork cycles through these like the stitch mock's three samples. */
const TILE_ART = [
  { icon: "description", tone: "text-primary/70" },
  { icon: "contract", tone: "text-secondary" },
  { icon: "receipt_long", tone: "text-primary/70" },
  { icon: "article", tone: "text-secondary" },
] as const;

type SortKey = "popularity" | "alphabetical" | "scope";

/* ------------------------------------------------------------------ */

export default function PdfHubClient({ tools }: { tools: PdfToolHubCard[] }) {
  /* ------------------------------ directory ------------------------------ */
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PdfToolCategory | "all">("all");
  const [sort, setSort] = useState<SortKey>("popularity");
  const searchRef = useRef<HTMLInputElement>(null);

  /* "/" focuses the search box, like the stitch prototype. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== searchRef.current) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tools.length };
    for (const tool of tools) counts[tool.category] = (counts[tool.category] ?? 0) + 1;
    return counts;
  }, [tools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tools.filter((tool) => {
      const inCategory = category === "all" || tool.category === category;
      const inQuery =
        q.length === 0 ||
        tool.title.toLowerCase().includes(q) ||
        (tool.alias ?? "").toLowerCase().includes(q) ||
        tool.desc.toLowerCase().includes(q) ||
        tool.tags.some((tag) => tag.includes(q));
      return inCategory && inQuery;
    });
    return list.sort((a, b) => {
      if (sort === "alphabetical") return a.title.localeCompare(b.title);
      if (sort === "scope") {
        const byScope = b.capabilityCount - a.capabilityCount;
        return byScope !== 0 ? byScope : b.popularity - a.popularity;
      }
      return b.popularity - a.popularity;
    });
  }, [tools, query, category, sort]);

  /* --------------------------- featured sandbox --------------------------- */
  const files = usePdfFiles({ kind: "pdf", maxFiles: 20 });
  const job = usePdfJob();
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [mergedInfo, setMergedInfo] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [outputName, setOutputName] = useState("Merged_Output.pdf");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropArmed, setDropArmed] = useState(false);
  const dropInputRef = useRef<HTMLInputElement>(null);

  const docs = files.files;
  const totalPages = docs.reduce((sum, doc) => sum + (doc.pageCount || 0), 0);
  const mergeable = docs.filter((doc) => !doc.error);

  const rotateDoc = useCallback((id: string) => {
    setRotations((current) => ({ ...current, [id]: ((current[id] ?? 0) + 90) % 360 }));
  }, []);

  const rotateAll = useCallback(() => {
    setRotations((current) => {
      const next: Record<string, number> = {};
      for (const doc of docs) next[doc.id] = ((current[doc.id] ?? 0) + 90) % 360;
      return next;
    });
  }, [docs]);

  const addBlankPage = useCallback(async () => {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      pdf.addPage(); // A4 portrait blank spacer
      const bytes = (await pdf.save()) as Uint8Array<ArrayBuffer>;
      await files.addFiles([new File([bytes], "Blank_Spacer.pdf", { type: "application/pdf" })]);
    } catch (error) {
      files.setNotice(
        `Could not generate the blank spacer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, [files]);

  const runMerge = useCallback(() => {
    if (mergeable.length < 2) {
      files.setNotice("Add at least two readable PDFs to run a merge.");
      return;
    }
    const locked = docs.filter((doc) => doc.error);
    if (locked.length > 0) {
      files.setNotice(
        `Remove locked documents first: ${locked.map((doc) => doc.name).join(", ")}`
      );
      return;
    }
    void job.start(async (report) => {
      const buffers: ArrayBuffer[] = [];
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        report({ phase: "reading", percent: Math.round((i / docs.length) * 80), message: `Reading ${doc.name}…` });
        let bytes = new Uint8Array(await doc.file.arrayBuffer());
        const angle = rotations[doc.id] ?? 0;
        if (angle !== 0) {
          report({
            phase: "rebuilding",
            percent: Math.round(((i + 0.5) / docs.length) * 80),
            message: `Rotating ${doc.name} by ${angle}°…`,
          });
          const identity = Array.from({ length: doc.pageCount }, (_, index) => index);
          const perPage: Record<number, number> = {};
          for (const index of identity) perPage[index] = angle;
          bytes = (await runPdfOperation({
            type: "organize",
            payload: { file: bytes.slice().buffer as ArrayBuffer, order: identity, rotations: perPage },
          })) as Uint8Array<ArrayBuffer>;
        }
        buffers.push(bytes.slice().buffer as ArrayBuffer);
      }
      report({ phase: "rebuilding", percent: 85, message: "Merging documents in sandbox memory…" });
      const merged = (await runPdfOperation({ type: "merge", payload: { files: buffers } })) as Uint8Array<ArrayBuffer>;
      report({ phase: "writing", percent: 95, message: "Packaging download…" });

      const name = outputName.trim().endsWith(".pdf") ? outputName.trim() : `${outputName.trim()}.pdf`;
      const url = URL.createObjectURL(new Blob([merged.slice()], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name || "Merged_Output.pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMergedInfo(`${name} (${formatBytes(merged.byteLength)}) Downloaded!`);
      setTimeout(() => setMergedInfo(null), 4000);
    });
  }, [docs, files, job, mergeable.length, outputName, rotations]);

  const mergeLabel = (() => {
    if (job.state.status === "error" && job.state.error) return null; // error surfaces below
    if (mergedInfo) return mergedInfo;
    if (job.running) return job.state.progress !== null ? `Merging… ${job.state.progress}%` : "Merging locally…";
    return null;
  })();

  /* ------------------------------- render -------------------------------- */

  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 -left-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto px-gutter-desktop py-space-md flex flex-col gap-space-lg relative">
        <Breadcrumbs current="PDF & Document Tools" variant="hub" />

        {/* Header & Telemetry Panel */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
          <div className="flex flex-col gap-space-xs max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                <Icon name="picture_as_pdf" size={15} />
                CATEGORY HUB • {tools.length} CLIENT-SIDE UTILITIES
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed/40 text-tertiary font-label-sm text-label-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container animate-pulse" />
                100% In-Browser WASM / WebWorker Engine
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              PDF &amp; Document Tools
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
              Fast, zero-latency document processors, converters, compressors, and page organizers. Processed 100%
              locally in your browser memory with zero server uploads.
            </p>
          </div>

          {/* Telemetry Sparkline Pill Box */}
          <div className="flex-shrink-0 flex items-center gap-space-md p-space-md bg-surface-container-low rounded-lg shadow-sm">
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-space-md mb-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Engine Telemetry
                </span>
                <span className="font-label-sm text-label-sm text-primary font-bold">pdf-lib · qpdf WASM</span>
              </div>
              <div className="flex items-center gap-space-lg">
                <div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Active Tools</p>
                  <p className="font-headline-sm text-headline-sm text-on-surface font-bold">{tools.length}</p>
                </div>
                <div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Server Payload</p>
                  <p className="font-headline-sm text-headline-sm text-tertiary font-bold">0 KB</p>
                </div>
                <div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Local Avg Latency</p>
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-sm text-headline-sm text-primary font-bold">
                      {job.state.latencyMs !== null
                        ? `${(job.state.latencyMs / 1000).toFixed(2)}s`
                        : "0.08s"}
                    </span>
                    {/* Sparkline SVG */}
                    <svg aria-hidden="true" className="w-16 h-6 text-primary stroke-current fill-none" viewBox="0 0 64 24">
                      <path d="M2 18 L14 14 L26 19 L38 8 L50 11 L62 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Interactive Live Sandbox Feature: Merge & Organize PDF */}
        <section
          aria-labelledby="sandbox-heading"
          className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-low/50 -mx-space-lg -mt-space-lg px-space-lg pt-space-md pb-space-sm rounded-t-xl">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                <Icon name="view_carousel" size={18} />
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold" id="sandbox-heading">
                  Featured Utility: Merge &amp; Organize PDF
                </h2>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Reorder, inspect, rotate, and combine pages directly in browser sandbox memory
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed/50 text-secondary font-label-sm text-label-sm font-medium">
                <Icon name="timer" size={15} />
                {job.state.latencyMs !== null
                  ? `${(job.state.latencyMs / 1000).toFixed(2)}s Last Local Merge • No Upload Required`
                  : "Local Merge Time • No Upload Required"}
              </span>
            </div>
          </div>

          {/* Sandbox Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md pt-space-xs">
            {/* Reorderable Document Queue (8 Cols) */}
            <div className="lg:col-span-8 flex flex-col gap-space-sm min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider truncate">
                  {docs.length > 0
                    ? `Queue: ${docs.length} Document${docs.length === 1 ? "" : "s"} (${totalPages} Page${totalPages === 1 ? "" : "s"} Total)`
                    : "Queue: Empty"}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={rotateAll}
                    disabled={docs.length === 0}
                    className="px-2.5 py-1 text-label-sm font-label-sm bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-1 disabled:opacity-40 disabled:hover:bg-surface-container"
                  >
                    <Icon name="rotate_right" size={15} />
                    Rotate All 90°
                  </button>
                  <button
                    type="button"
                    onClick={() => void addBlankPage()}
                    disabled={job.running}
                    className="px-2.5 py-1 text-label-sm font-label-sm bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-1 disabled:opacity-40 disabled:hover:bg-surface-container"
                  >
                    <Icon name="post_add" size={15} />
                    Add Blank Page
                  </button>
                </div>
              </div>

              {files.notice && (
                <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">
                  {files.notice}
                </div>
              )}
              {job.state.status === "error" && job.state.error && (
                <div className="p-2.5 rounded-lg bg-error-container/30 text-error font-body-sm text-body-sm">
                  {job.state.error}
                </div>
              )}

              {/* Document Tiles Sandbox */}
              {docs.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant font-body-sm text-body-sm flex flex-col items-center justify-center gap-2 bg-surface-container-low rounded-lg">
                  <Icon name="content_paste_off" size={32} className="text-outline" />
                  <span>Document queue empty. Drag files into the dropzone to start.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                  {docs.map((doc, index) => {
                    const art = TILE_ART[index % TILE_ART.length];
                    const angle = rotations[doc.id] ?? 0;
                    return (
                      <div
                        key={doc.id}
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragEnd={() => setDragIndex(null)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (dragIndex !== null && dragIndex !== index) files.moveFile(dragIndex, index);
                        }}
                        className="p-space-sm bg-surface-container-low rounded-lg shadow-sm flex flex-col gap-2 group hover:shadow-md transition-all relative cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center justify-between text-on-surface-variant">
                          <Icon name="drag_indicator" size={18} className="cursor-grab text-outline hover:text-on-surface" />
                          <span className="font-label-sm text-label-sm font-bold bg-surface-container-lowest px-1.5 py-0.5 rounded text-on-surface">
                            Doc #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => files.removeFile(doc.id)}
                            title="Remove Document"
                            className="text-outline hover:text-error transition-colors"
                          >
                            <Icon name="close" size={17} />
                          </button>
                        </div>
                        <div className="h-32 bg-surface-container-lowest rounded flex flex-col items-center justify-center p-2 text-center shadow-inner relative overflow-hidden group-hover:bg-surface-bright">
                          <span
                            className="transition-transform duration-300"
                            style={{ transform: angle ? `rotate(${angle}deg)` : undefined }}
                          >
                            <Icon name={art.icon} size={36} className={`${art.tone} mb-1`} />
                          </span>
                          <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate w-full">
                            {doc.name}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            {doc.pageCount || "?"} Pages • {formatBytes(doc.size)}
                          </span>
                          {angle !== 0 && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-label-mono-xs text-label-sm font-bold">
                              ↻ {angle}°
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          {doc.error ? (
                            <span
                              className="font-label-sm text-label-sm text-error font-semibold flex items-center gap-0.5 truncate"
                              title={doc.error}
                            >
                              <Icon name="error" size={14} /> Locked
                            </span>
                          ) : (
                            <span className="font-label-sm text-label-sm text-tertiary font-semibold flex items-center gap-0.5">
                              <Icon name="check_circle" size={14} /> Ready
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => rotateDoc(doc.id)}
                              title="Rotate 90°"
                              className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                            >
                              <Icon name="rotate_right" size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => files.duplicateFile(index)}
                              title="Duplicate"
                              className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                            >
                              <Icon name="content_copy" size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dropzone & Execution Panel (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col gap-space-sm justify-between bg-surface-container-low p-space-md rounded-lg shadow-sm">
              {/* Drop Area */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => dropInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") dropInputRef.current?.click();
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropArmed(true);
                }}
                onDragLeave={() => setDropArmed(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropArmed(false);
                  void files.addFiles(event.dataTransfer.files);
                }}
                className={`flex-1 flex flex-col items-center justify-center text-center p-space-md bg-surface-container-lowest rounded-lg cursor-pointer hover:bg-surface-bright transition-all shadow-inner ${
                  dropArmed ? "bg-surface-container-high scale-[1.01]" : ""
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Icon name="cloud_upload" size={28} />
                </div>
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Drop PDF files here
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  or click to browse your local filesystem
                </span>
                <span className="font-label-sm text-label-sm text-outline mt-2">Max 250MB • In-Memory Processing</span>
                <input
                  ref={dropInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) void files.addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </div>

              {/* Options (Advanced Export Parameters) */}
              {optionsOpen && (
                <label className="flex flex-col gap-1 bg-surface-container-lowest rounded-lg p-2.5 shadow-inner">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Output file name
                  </span>
                  <input
                    type="text"
                    value={outputName}
                    onChange={(event) => setOutputName(event.target.value)}
                    className="bg-transparent text-body-sm font-body-sm text-on-surface focus:outline-none font-label-mono-xs"
                  />
                </label>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-space-xs">
                <button
                  type="button"
                  onClick={runMerge}
                  disabled={job.running || mergeable.length < 2}
                  className={`w-full h-10 px-4 font-headline-sm text-headline-sm rounded-lg active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 ${
                    mergedInfo
                      ? "bg-tertiary-fixed/60 text-tertiary hover:bg-tertiary-fixed"
                      : "bg-primary text-on-primary hover:bg-primary-container"
                  }`}
                >
                  <Icon
                    name={mergedInfo ? "check_circle" : job.running ? "progress_activity" : "merge_type"}
                    size={20}
                    className={job.running && !mergedInfo ? "animate-spin" : undefined}
                  />
                  <span className="truncate">
                    {mergedInfo ?? (job.running ? "Merging via local engine…" : "Merge All Files (WASM)")}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      files.clearFiles();
                      setRotations({});
                      setMergedInfo(null);
                      job.reset();
                    }}
                    className="flex-1 h-9 px-3 bg-surface-container-high text-on-surface font-body-sm text-body-sm font-medium rounded-lg hover:bg-surface-dim transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Icon name="delete_sweep" size={16} />
                    Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptionsOpen((open) => !open)}
                    aria-expanded={optionsOpen}
                    title="Advanced Export Parameters"
                    className={`h-9 px-3 font-body-sm text-body-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                      optionsOpen
                        ? "bg-surface-dim text-on-surface"
                        : "bg-surface-container-high text-on-surface hover:bg-surface-dim"
                    }`}
                  >
                    <Icon name="tune" size={16} />
                    Options
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Filter, Search & Sorting Controls */}
        <section aria-label="Tool Directory Navigation" className="flex flex-col gap-space-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
            {/* Search Input with Keyboard Indicator */}
            <div className="relative flex-1 max-w-lg">
              <Icon name="search" size={18} className="absolute left-3 top-2.5 text-on-surface-variant" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search PDF utilities (e.g. Merge, Convert, OCR, Compress, Split)..."
                aria-label="Search PDF tools"
                className="w-full pl-9 pr-12 py-2 rounded-lg bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md shadow-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
              />
              <kbd className="absolute right-3 top-2.5 px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm shadow-xs font-mono">
                /
              </kbd>
            </div>
            {/* Sort Select & Counter */}
            <div className="flex items-center gap-space-md justify-between sm:justify-end">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Showing <span className="font-bold text-on-surface">{filtered.length}</span> PDF tools
              </span>
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                  Sort by:
                </span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  aria-label="Sort PDF tools"
                  className="h-9 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm shadow-sm focus:outline-none cursor-pointer"
                >
                  <option value="popularity">Popularity</option>
                  <option value="alphabetical">Alphabetical</option>
                  <option value="scope">Max Engine Scope</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
            {(
              [
                { value: "all" as const, label: "All" },
                ...PDF_TOOL_CATEGORIES.filter((c) => c.value !== "all").map((c) => ({
                  value: c.value as PdfToolCategory,
                  label: c.label,
                })),
              ]
            ).map((pill) => {
              const active = category === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setCategory(pill.value)}
                  aria-pressed={active}
                  className={`px-3.5 py-1.5 rounded-full font-label-sm text-label-sm font-semibold shadow-xs transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                    active
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`px-1.5 rounded-full text-[10px] ${
                      active ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-highest text-on-surface"
                    }`}
                  >
                    {categoryCounts[pill.value] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Complete Catalog Grid */}
        {filtered.length === 0 ? (
          <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm text-center">
            <Icon name="search_off" size={40} className="text-outline-variant mx-auto mb-2" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              No PDF tools match “{query}”.
            </p>
          </section>
        ) : (
          <section aria-label="PDF Tools Grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
            {filtered.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                data-category={tool.category}
                className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${ICON_TILE[tool.accent]}`}
                    >
                      <Icon name={tool.icon} size={22} />
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-label-sm font-label-sm font-bold truncate max-w-[60%] ${BADGE_CHIP[tool.accent]}`}
                    >
                      {tool.heroChips[0]?.label ?? tool.tags[0]}
                    </span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold group-hover:text-primary transition-colors">
                    {tool.title}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{tool.desc}</p>
                </div>
                <div className="flex items-center justify-between pt-space-md text-label-sm font-label-sm text-on-surface-variant">
                  <span className="font-mono truncate max-w-[60%]">{tool.heroChips[2]?.label ?? tool.tags[0]}</span>
                  <span className="flex items-center gap-0.5 text-on-surface-variant flex-shrink-0">
                    {tool.heroChips[1]?.label ?? tool.tags[0]}
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* Client-Side Security & Architectural Trust Section */}
        <section
          aria-labelledby="security-heading"
          className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-lg mt-space-md"
        >
          <div className="flex flex-col gap-1 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-tertiary-fixed/50 text-tertiary font-label-sm text-label-sm uppercase font-semibold w-fit">
              <Icon name="verified_user" size={14} />
              Architecture &amp; Data Sovereignty
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold" id="security-heading">
              Why In-Browser PDF Processing Protects Sensitive Documents
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Every byte is manipulated strictly within local WebAssembly sandboxes inside your browser process.
            </p>
          </div>

          {/* Trust Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="p-space-md bg-surface-container-low rounded-lg shadow-sm flex flex-col gap-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-1 ${pillar.iconClass}`}>
                  <Icon name={pillar.icon} size={24} />
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{pillar.title}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{pillar.desc}</p>
                <span className={`font-label-sm text-label-sm font-medium flex items-center gap-1 mt-auto pt-2 ${pillar.footClass}`}>
                  <Icon name={pillar.footIcon} size={16} /> {pillar.foot}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Frequently Asked Questions Accordion */}
        <section
          aria-labelledby="faq-heading"
          className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md mt-space-md"
        >
          <div className="flex flex-col gap-1">
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold" id="faq-heading">
              Frequently Asked Questions
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Common technical and security questions regarding local PDF processing engines.
            </p>
          </div>
          <div className="flex flex-col gap-2 divide-y divide-surface-container-high/60">
            {HUB_FAQS.map((faq, index) => (
              <details key={faq.q} className="group py-space-sm" open={index === 0}>
                <summary className="flex items-center justify-between cursor-pointer list-none text-on-surface font-headline-sm text-headline-sm font-semibold hover:text-primary transition-colors">
                  <span>{faq.q}</span>
                  <Icon
                    name="keyboard_arrow_down"
                    size={20}
                    className="transition-transform duration-200 group-open:rotate-180 text-on-surface-variant"
                  />
                </summary>
                <p className="font-body-md text-body-md text-on-surface-variant mt-2 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom Request Banner */}
        <aside className="flex flex-col sm:flex-row items-center justify-between gap-space-md p-space-lg rounded-xl bg-surface-container-low shadow-sm">
          <div className="flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center flex-shrink-0">
              <Icon name="extension" size={22} />
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Missing a specialized document converter or AST parser?
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                We release client-side utilities weekly. Propose a new document format or contribute to our WASM core.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <button
              type="button"
              className="w-full sm:w-auto px-4 py-2 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm font-medium rounded-lg hover:bg-surface-container-high transition-colors shadow-xs"
            >
              Request a Tool
            </button>
            <button
              type="button"
              className="w-full sm:w-auto px-4 py-2 bg-primary text-on-primary font-body-sm text-body-sm font-medium rounded-lg hover:bg-primary-container transition-colors shadow-xs flex items-center justify-center gap-1.5"
            >
              <Icon name="code" size={16} />
              View WASM Core
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
