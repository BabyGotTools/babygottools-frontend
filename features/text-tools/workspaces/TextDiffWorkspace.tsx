"use client";

/** Side-by-Side Text Diff workspace â€” Myers diff via the shared diff engine. */

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/common/Icon";
import CodeEditor from "@/components/tools/CodeEditor";
import { LATENCY_EVENT } from "@/components/tools/HeroMetricsCluster";
import {
  INDENT_BTN_ACTIVE,
  INDENT_BTN_IDLE,
  RIBBON_BTN,
  RIBBON_BTN_CLEAR,
  RIBBON_INDENT_GROUP,
  RIBBON_MAIN_ACTION, RIBBON_ROW
} from "@/components/tools/ribbonStyles";
import { computeDiff, type DiffRow } from "@/features/developer-tools/engines/diffEngine";
import { useRibbonPortal } from "@/hooks/useRibbonPortal";

type Granularity = "lines" | "words" | "chars";

const GRANULARITY_LABEL: Record<Granularity, string> = {
  lines: "Lines",
  words: "Words",
  chars: "Characters",
};

const ROW_STYLES: Record<DiffRow["type"], string> = {
  added: "bg-secondary-container/20 text-on-surface",
  removed: "bg-error-container/25 text-on-surface",
  same: "text-on-surface-variant",
};

const MARK: Record<DiffRow["type"], string> = { added: "+", removed: "âˆ’", same: " " };

export function TextDiffWorkspace() {
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("lines");
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [rows, setRows] = useState<DiffRow[]>([]);
  const [stats, setStats] = useState<{ added: number; removed: number; changed: number; same: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalize = useCallback((t: string) => (ignoreCase ? t.toLowerCase() : t), [ignoreCase]);

  const compare = useCallback(async () => {
    if (oldText.length === 0 && newText.length === 0) {
      setError("Paste text into both panes to compare.");
      return;
    }
    if (normalize(oldText) === normalize(newText)) {
      setRows([]);
      setStats(null);
      setError("The two texts are identical â€” nothing to diff.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const started = performance.now();
      const result = await computeDiff(oldText, newText, granularity === "lines" ? "lines" : granularity);
      setRows(result.rows);
      setStats(result.stats);
      window.dispatchEvent(new CustomEvent<number>(LATENCY_EVENT, { detail: performance.now() - started }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diff failed.");
    } finally {
      setBusy(false);
    }
  }, [oldText, newText, granularity, normalize]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void compare();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compare]);

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <button
          type="button"
          onClick={() => {
            setOldText("Baby Got Tools â€” the original draft.\nThis line stays the same.\nThis line will be edited.\nThe end.");
            setNewText("Baby Got Tools â€” the revised draft.\nThis line stays the same.\nThis line has been edited carefully.\nA brand new closing line.\nThe end.");
          }}
          className={RIBBON_BTN}
        >
          <Icon name="terminal" size={16} />
          <span>Sample Texts</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setOldText("");
            setNewText("");
            setRows([]);
            setStats(null);
            setError(null);
          }}
          className={RIBBON_BTN_CLEAR}
        >
          <Icon name="delete_sweep" size={16} />
          <span>Clear Both</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className={RIBBON_INDENT_GROUP}>
          {(Object.keys(GRANULARITY_LABEL) as Granularity[]).map((g) => (
            <button key={g} type="button" onClick={() => setGranularity(g)} className={granularity === g ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
              {GRANULARITY_LABEL[g]}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setIgnoreCase(!ignoreCase)} aria-pressed={ignoreCase} className={ignoreCase ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
          Ignore case
        </button>
        <button type="button" onClick={() => void compare()} disabled={busy} className={`${RIBBON_MAIN_ACTION} ${busy ? "opacity-60" : ""}`}>
          <Icon name={busy ? "progress_activity" : "difference"} size={16} className={busy ? "animate-spin" : ""} />
          <span>{busy ? "Diffingâ€¦" : "Compare"}</span>
        </button>
      </div>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor value={oldText} onChange={setOldText} title="Original Text" chip="BEFORE" placeholder="The older version of your text" />
        <CodeEditor value={newText} onChange={setNewText} title="Changed Text" chip="AFTER" placeholder="The newer version of your text" />
      </div>

      {/* diff result */}
      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
        <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-space-sm min-w-0">
            <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">Diff Result</span>
            {stats && (
              <span className="flex items-center gap-2 text-label-mono-xs font-label-mono-xs flex-shrink-0">
                <span className="px-2 py-0.5 rounded bg-secondary-container/20 text-secondary font-semibold">+{stats.added} added</span>
                <span className="px-2 py-0.5 rounded bg-error-container/25 text-error font-semibold">âˆ’{stats.removed} removed</span>
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">{stats.same} unchanged</span>
              </span>
            )}
          </div>
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant flex-shrink-0">Myers diff â€¢ 100% Client Memory</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md font-label-mono-md text-label-mono-md overflow-auto" style={{ height: 340, maxHeight: 560 }}>
          {error ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2">
              <Icon name={error.includes("identical") ? "check_circle" : "error"} size={36} className={error.includes("identical") ? "text-secondary" : "text-error"} />
              <p className={error.includes("identical") ? "text-secondary font-semibold" : "text-error font-semibold"}>{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2">
              <Icon name="difference" size={36} className="text-outline-variant" />
              <p className="text-on-surface-variant font-body-sm text-body-sm">Press Compare (or âŒ˜+â†µ) to see changes side-by-side.</p>
            </div>
          ) : (
            <div className="min-w-0">
              {rows.map((row, i) => (
                <div key={i} className={`flex gap-2 px-2 py-px rounded ${ROW_STYLES[row.type]}`}>
                  <span className="select-none opacity-60 w-4 flex-shrink-0">{MARK[row.type]}</span>
                  <span className="whitespace-pre-wrap break-words min-w-0">{row.content || " "}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {ribbonNode}
    </>
  );
}
