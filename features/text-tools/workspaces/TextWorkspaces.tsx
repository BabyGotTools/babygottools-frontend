"use client";

/** Text & Writing workspaces (case converter, dedupe, lorem, invisible chars). */

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/common/Icon";
import CodeEditor from "@/components/tools/CodeEditor";
import CopyButton from "@/components/tools/CopyButton";
import DownloadButton from "@/components/tools/DownloadButton";
import {
  INDENT_BTN_ACTIVE,
  INDENT_BTN_IDLE,
  RIBBON_BTN,
  RIBBON_BTN_CLEAR,
  RIBBON_BTN_PRIMARY_SOFT,
  RIBBON_INDENT_GROUP,
  RIBBON_MAIN_ACTION, RIBBON_ROW
} from "@/components/tools/ribbonStyles";
import { bytesLabel } from "@/hooks/useDownload";
import { dispatchLatency, useRibbonPortal } from "@/hooks/useRibbonPortal";
import {
  CASE_MODES,
  INVISIBLE_CHARS,
  convertCase,
  generateLorem,
  removeDuplicateLines,
  scanInvisibleChars,
  type CaseMode,
  type LoremOptions,
  type LoremUnit,
} from "../engines/textEngines";

/* ---------------------------- shared ribbon bits ---------------------------- */

function OutputPane({
  title,
  chip,
  output,
  mime,
  fileExtension,
  children,
  stats,
}: {
  title: string;
  chip: string;
  output: string;
  mime: string;
  fileExtension: string;
  children?: React.ReactNode;
  stats?: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
      <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between gap-2">
        <div className="flex items-center gap-space-sm min-w-0">
          <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
          </span>
          <span className="font-headline-sm text-headline-sm text-on-surface truncate">{title}</span>
          <span className="text-label-mono-xs font-label-mono-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant flex-shrink-0">
            {chip}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <DownloadButton value={output} filename={`baby-got-tools${fileExtension}`} mime={mime} />
          <CopyButton value={output} />
        </div>
      </div>
      <div className="flex-1 bg-surface-container-lowest p-space-md font-label-mono-md text-label-mono-md overflow-auto leading-[22px]" style={{ height: 380, maxHeight: 560 }}>
        {children}
      </div>
      {stats && (
        <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between flex-wrap gap-1 text-label-mono-xs font-label-mono-xs">
          <div className="flex items-center gap-2 min-w-0 text-secondary">
            <Icon name="verified" size={16} className="flex-shrink-0" />
            <span className="font-semibold truncate">{output ? "Processed successfully â€¢ 100% Client Memory" : "Awaiting input"}</span>
          </div>
          <div className="flex items-center gap-3 text-on-surface-variant flex-shrink-0">
            {stats.map((s) => (
              <span key={s.label}>
                {s.label}: <span className="text-secondary font-semibold">{s.value}</span>
              </span>
            ))}
            <span className="hidden sm:inline">â€¢</span>
            <span>{output ? bytesLabel(output) : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyOutput({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-2">
      <Icon name={icon} size={36} className="text-outline-variant" />
      <p className="text-on-surface-variant font-body-sm text-body-sm">{message}</p>
    </div>
  );
}

/* ------------------------------ case converter ------------------------------ */

export function CaseConverterWorkspace() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<CaseMode>("title");

  const output = useMemo(() => convertCase(input, mode), [input, mode]);

  const process = useCallback(() => {
    if (input.trim().length === 0) return;
    const started = performance.now();
    convertCase(input, mode);
    dispatchLatency(performance.now() - started);
  }, [input, mode]);

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <button type="button" onClick={() => setInput("the quick brown fox jumps over the lazy dog")} className={RIBBON_BTN}>
          <Icon name="terminal" size={16} />
          <span>Sample Text</span>
        </button>
        <button type="button" onClick={() => setInput("")} className={RIBBON_BTN_CLEAR}>
          <Icon name="delete_sweep" size={16} />
          <span>Clear</span>
        </button>
        <span className="hidden sm:inline text-label-mono-xs font-label-mono-xs text-on-surface-variant">
          Conversion is live â€” pick a style and start typing
        </span>
      </div>
      <button type="button" onClick={process} disabled={input.trim().length === 0} className={`${RIBBON_MAIN_ACTION} ${input.trim().length === 0 ? "opacity-60" : ""}`}>
        <Icon name="match_case" size={16} />
        <span>Refresh Output</span>
      </button>
    </div>
  );

  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor
          value={input}
          onChange={setInput}
          title="Input Text"
          chip="ANY CASE"
          placeholder="Type or paste text â€” the converted output appears live on the right"
          minHeight={300}
        />
        <OutputPane
          title="Converted Text"
          chip={CASE_MODES.find((m) => m.value === mode)?.label ?? ""}
          output={output}
          mime="text/plain;charset=utf-8"
          fileExtension=".txt"
          stats={[{ label: "Mode", value: mode }, { label: "Length", value: String(output.length) }]}
        >
          {output ? (
            <pre className="text-on-surface select-text overflow-x-auto whitespace-pre-wrap break-words">
              <code>{output}</code>
            </pre>
          ) : (
            <EmptyOutput icon="match_case" message="Converted text appears here â€” live, as you type." />
          )}
        </OutputPane>
      </div>

      {/* Case style grid */}
      <div className="bg-surface-container rounded-xl p-space-md mb-space-lg shadow-md">
        <div className="font-headline-sm text-headline-sm text-on-surface mb-space-sm flex items-center gap-2">
          <Icon name="text_select" size={18} className="text-secondary" />
          Choose a Case Style
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-space-sm">
          {CASE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              aria-pressed={mode === m.value}
              className={`text-left px-space-sm py-2 rounded-lg border transition-all cursor-pointer ${
                mode === m.value
                  ? "border-secondary bg-secondary/10 text-secondary"
                  : "border-outline-variant/40 bg-surface-container-low text-on-surface hover:border-secondary/60"
              }`}
            >
              <span className="block font-label-mono-md text-label-mono-md font-semibold">{m.label}</span>
              <span className="block font-label-mono-xs text-label-mono-xs text-on-surface-variant truncate">{m.example}</span>
            </button>
          ))}
        </div>
      </div>

      {ribbonNode}
    </>
  );
}

/* --------------------------- remove duplicate lines --------------------------- */

export function RemoveDuplicatesWorkspace() {
  const [input, setInput] = useState("");
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [trim, setTrim] = useState(true);
  const [removeEmpty, setRemoveEmpty] = useState(true);
  const [sort, setSort] = useState(false);
  const [sortDesc, setSortDesc] = useState(false);

  const result = useMemo(
    () => removeDuplicateLines(input, { ignoreCase, trim, removeEmpty, sort, sortDesc }),
    [input, ignoreCase, trim, removeEmpty, sort, sortDesc]
  );

  const toggles: { label: string; value: boolean; set: (v: boolean) => void }[] = [
    { label: "Ignore case", value: ignoreCase, set: setIgnoreCase },
    { label: "Trim whitespace", value: trim, set: setTrim },
    { label: "Remove empty lines", value: removeEmpty, set: setRemoveEmpty },
    { label: "Sort Aâ†’Z", value: sort, set: setSort },
    { label: "Sort Zâ†’A", value: sortDesc, set: setSortDesc },
  ];

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <button type="button" onClick={() => setInput("apple\nBanana\napple\ncherry\nbanana\napple\ncherry\ndate")} className={RIBBON_BTN}>
          <Icon name="terminal" size={16} />
          <span>Sample List</span>
        </button>
        <button type="button" onClick={() => setInput("")} className={RIBBON_BTN_CLEAR}>
          <Icon name="delete_sweep" size={16} />
          <span>Clear</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className={RIBBON_INDENT_GROUP}>
          {toggles.map((t) => (
            <button key={t.label} type="button" onClick={() => t.set(!t.value)} className={t.value ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor
          value={input}
          onChange={setInput}
          title="Input List"
          chip="ONE ITEM PER LINE"
          placeholder={"apple\nbanana\napple\ncherry"}
          minHeight={300}
        />
        <OutputPane
          title="Deduplicated List"
          chip="UNIQUE"
          output={result.output}
          mime="text/plain;charset=utf-8"
          fileExtension=".txt"
          stats={[
            { label: "Original", value: String(result.stats.original) },
            { label: "Unique", value: String(result.stats.unique) },
            { label: "Removed", value: String(result.stats.removed) },
          ]}
        >
          {result.output ? (
            <pre className="text-on-surface select-text overflow-x-auto whitespace-pre-wrap break-words">
              <code>{result.output}</code>
            </pre>
          ) : (
            <EmptyOutput icon="playlist_remove" message="Paste a list on the left â€” duplicates are removed live." />
          )}
        </OutputPane>
      </div>

      {result.stats.original > 0 && result.stats.removed === 0 && (
        <div className="bg-surface-container rounded-xl p-space-md mb-space-lg shadow-md flex items-center gap-2 text-label-mono-md font-label-mono-md text-on-surface-variant">
          <Icon name="info" size={16} className="text-tertiary flex-shrink-0" />
          <span>No duplicates found in {result.stats.original} lines â€” every line is already unique.</span>
        </div>
      )}

      {ribbonNode}
    </>
  );
}

/* ----------------------------- lorem ipsum ----------------------------- */

const UNIT_LABEL: Record<LoremUnit, string> = {
  paragraphs: "Paragraphs",
  sentences: "Sentences",
  words: "Words",
};

export function LoremIpsumWorkspace() {
  const [unit, setUnit] = useState<LoremUnit>("paragraphs");
  const [count, setCount] = useState(3);
  const [classicStart, setClassicStart] = useState(true);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(() => {
    setError(null);
    const n = Number(count);
    if (!Number.isFinite(n) || n < 1) {
      setError("Enter a count of at least 1.");
      setOutput("");
      return;
    }
    const max = unit === "paragraphs" ? 50 : unit === "sentences" ? 200 : 5000;
    if (n > max) {
      setError(`Maximum for ${UNIT_LABEL[unit].toLowerCase()} is ${max}.`);
      setOutput("");
      return;
    }
    const started = performance.now();
    const opts: LoremOptions = { unit, count: n, classicStart };
    setOutput(generateLorem(opts));
    dispatchLatency(performance.now() - started);
  }, [unit, count, classicStart]);

  // Seed an initial output so the page is never empty.
  useEffect(() => {
    setOutput(generateLorem({ unit: "paragraphs", count: 3, classicStart: true }));
  }, []);

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className={RIBBON_INDENT_GROUP}>
          {(Object.keys(UNIT_LABEL) as LoremUnit[]).map((u) => (
            <button key={u} type="button" onClick={() => setUnit(u)} className={unit === u ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
              {UNIT_LABEL[u]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={unit === "paragraphs" ? 50 : unit === "sentences" ? 200 : 5000}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label={`Number of ${UNIT_LABEL[unit].toLowerCase()}`}
            className="w-20 px-2 py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
          />
          <button
            type="button"
            onClick={() => setClassicStart(!classicStart)}
            aria-pressed={classicStart}
            className={RIBBON_BTN_PRIMARY_SOFT}
          >
            <Icon name={classicStart ? "check_box" : "check_box_outline_blank"} size={16} />
            <span>Classic start</span>
          </button>
        </div>
      </div>
      <button type="button" onClick={generate} className={RIBBON_MAIN_ACTION}>
        <Icon name="casino" size={16} />
        <span>Generate</span>
      </button>
    </div>
  );

  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Generator Controls</span>
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Instant â€¢ In-browser</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-md flex-1">
            <div>
              <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant mb-space-xs uppercase tracking-wide">Output unit</div>
              <div className="grid grid-cols-3 gap-space-xs">
                {(Object.keys(UNIT_LABEL) as LoremUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    aria-pressed={unit === u}
                    className={`px-2 py-2 rounded-lg border text-label-mono-md font-label-mono-md transition-all cursor-pointer ${
                      unit === u ? "border-secondary bg-secondary/10 text-secondary font-semibold" : "border-outline-variant/40 text-on-surface hover:border-secondary/60"
                    }`}
                  >
                    {UNIT_LABEL[u]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant mb-space-xs uppercase tracking-wide">
                Count â€” max {unit === "paragraphs" ? 50 : unit === "sentences" ? 200 : 5000}
              </div>
              <input
                type="range"
                min={1}
                max={unit === "paragraphs" ? 50 : unit === "sentences" ? 200 : 5000}
                value={Math.min(count, unit === "paragraphs" ? 50 : unit === "sentences" ? 200 : 5000)}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-secondary"
                aria-label="Amount of placeholder text"
              />
              <div className="text-label-mono-md font-label-mono-md text-on-surface mt-1">{count}</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={classicStart} onChange={(e) => setClassicStart(e.target.checked)} className="accent-secondary" />
              <span className="font-body-md text-body-md text-on-surface">Start with the classic â€œLorem ipsum dolor sit ametâ€¦â€</span>
            </label>
            {error && (
              <div className="flex items-center gap-2 text-error text-label-mono-md font-label-mono-md">
                <Icon name="error" size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
        <OutputPane
          title="Generated Text"
          chip={UNIT_LABEL[unit].toUpperCase()}
          output={output}
          mime="text/plain;charset=utf-8"
          fileExtension=".txt"
          stats={[
            { label: "Words", value: String(output.split(/\s+/).filter(Boolean).length) },
            { label: "Paragraphs", value: String(output.split(/\n\s*\n/).filter(Boolean).length) },
          ]}
        >
          {output ? (
            <pre className="text-on-surface select-text overflow-x-auto whitespace-pre-wrap break-words font-body-md text-body-md">
              <code>{output}</code>
            </pre>
          ) : (
            <EmptyOutput icon="article" message="Press Generate to create placeholder text." />
          )}
        </OutputPane>
      </div>

      {ribbonNode}
    </>
  );
}

/* ------------------------ invisible unicode characters ------------------------ */

export function InvisibleCharWorkspace() {
  const [pasted, setPasted] = useState("");
  const [copiedChar, setCopiedChar] = useState<string | null>(null);
  const scan = useMemo(() => scanInvisibleChars(pasted), [pasted]);

  const copyChar = useCallback(async (char: string, name: string) => {
    try {
      await navigator.clipboard.writeText(char);
      setCopiedChar(name);
      setTimeout(() => setCopiedChar(null), 1600);
    } catch {
      setCopiedChar(null);
    }
  }, []);

  return (
    <>
      {/* character grid */}
      <div className="bg-surface-container rounded-xl p-space-md mb-space-lg shadow-md">
        <div className="font-headline-sm text-headline-sm text-on-surface mb-space-sm flex items-center gap-2">
          <Icon name="format_shapes" size={18} className="text-secondary" />
          Invisible Characters â€” click to copy
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-sm">
          {INVISIBLE_CHARS.map((c) => (
            <button
              key={c.codepoint}
              type="button"
              onClick={() => void copyChar(c.char, c.name)}
              className="text-left px-space-sm py-2.5 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:border-secondary/60 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-body-md text-body-md text-on-surface font-semibold truncate">{c.name}</span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">{c.codepoint}</span>
                  <Icon
                    name={copiedChar === c.name ? "check" : "content_copy"}
                    size={14}
                    className={copiedChar === c.name ? "text-secondary" : "text-outline-variant group-hover:text-secondary"}
                  />
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{c.desc}</p>
            </button>
          ))}
        </div>
        {copiedChar && (
          <div className="mt-space-sm flex items-center gap-2 text-secondary text-label-mono-md font-label-mono-md">
            <Icon name="check_circle" size={16} />
            <span>
              Copied <strong>{copiedChar}</strong> â€” paste it anywhere to use it.
            </span>
          </div>
        )}
      </div>

      {/* paste verifier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor
          value={pasted}
          onChange={setPasted}
          title="Paste Verifier"
          chip="SCAN & CLEAN"
          placeholder="Paste text here to count the invisible characters it contains"
          minHeight={220}
        />
        <OutputPane
          title="Scan Report"
          chip={scan.total > 0 ? `${scan.total} HIDDEN` : "CLEAN"}
          output={scan.cleaned}
          mime="text/plain;charset=utf-8"
          fileExtension="-cleaned.txt"
          stats={[{ label: "Tracked", value: String(scan.counts.length) }]}
        >
          {pasted.length === 0 ? (
            <EmptyOutput icon="content_paste_search" message="Paste text to scan it for hidden characters." />
          ) : scan.total === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2">
              <Icon name="check_circle" size={36} className="text-secondary" />
              <p className="text-on-surface-variant font-body-sm text-body-sm">No tracked invisible characters found â€” this text is clean.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {scan.counts.map(({ info, count }) => (
                <div key={info.codepoint} className="flex items-center justify-between gap-2 text-on-surface">
                  <span className="truncate">
                    <strong>{info.name}</strong> <span className="text-on-surface-variant font-label-mono-xs">({info.codepoint})</span>
                  </span>
                  <span className="text-label-mono-md font-label-mono-md text-error font-semibold">Ã—{count}</span>
                </div>
              ))}
              <p className="pt-space-xs text-on-surface-variant font-body-sm text-body-sm">The cleaned copy (tracked characters removed) is above â€” copy or download it.</p>
            </div>
          )}
        </OutputPane>
      </div>
    </>
  );
}
