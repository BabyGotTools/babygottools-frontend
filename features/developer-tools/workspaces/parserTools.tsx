"use client";

/** Parser & inspector workspaces: regex, diff, json-compare, cron, query string,
 *  http headers, unicode inspectors, api mock generator. */

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/common/Icon";
import CodeEditor from "@/components/tools/CodeEditor";
import CopyButton from "@/components/tools/CopyButton";
import DownloadButton from "@/components/tools/DownloadButton";
import { LATENCY_EVENT } from "@/components/tools/HeroMetricsCluster";
import {
  INDENT_BTN_ACTIVE,
  INDENT_BTN_IDLE,
  RIBBON_BTN,
  RIBBON_BTN_CLEAR,
  RIBBON_INDENT_GROUP,
  RIBBON_MAIN_ACTION,
} from "@/components/tools/ribbonStyles";
import { usePortalRibbon } from "./securityIdTools";
import { computeDiff, compareJsonValues, type JsonChange } from "../engines/diffEngine";
import { explainCron, formatRun, parseCronExpression, suggestedTimeZones, type CronParseResult } from "../engines/cronEngine";
import { parseQueryString, rebuildQueryString, displayValue, type QueryParam } from "../engines/queryStringEngine";
import { headerDescription, isSecurityRelevant, parseHttpHeaders, type ParsedHeaders } from "../engines/httpHeaderEngine";
import { homoglyphScan, inspectUnicode, sanitizeHidden } from "../engines/unicodeEngine";
import { generateMock, MOCK_SCENARIOS, type MockScenario } from "../engines/mockApiEngine";

/* ------------------------------ Regex tester ------------------------------- */

const MAX_PATTERN = 2000;
const MAX_TEST_TEXT = 2_000_000;
const MAX_MATCHES = 10000;

export function RegexWorkspace() {
  const [pattern, setPattern] = useState("(\\w+)@(babygottools\\.[a-z]{2,})");
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState("Contact ada@babygottools.dev for the PDF tool. Unused: admin@babygottools.io");

  const analysis = useMemo(() => {
    if (pattern.length === 0) return null;
    if (pattern.length > MAX_PATTERN) return { error: `Pattern longer than ${MAX_PATTERN} characters — refused to protect the tab.` };
    if (text.length > MAX_TEST_TEXT) return { error: "Test text exceeds the 2MB safety cap — trim the input and retry." };
    try {
      const re = new RegExp(pattern, flags);
      const matches: { text: string; index: number; length: number; groups: string[] }[] = [];
      let exec: RegExpExecArray | null;
      // g-less patterns only ever match once — avoid an infinite loop
      const loopable = flags.includes("g");
      let guard = 0;
      do {
        exec = re.exec(text);
        if (!exec) break;
        matches.push({
          text: exec[0],
          index: exec.index,
          length: exec[0].length,
          groups: exec.slice(1).map((g) => g ?? "—"),
        });
        if (!loopable) break;
      } while (exec && guard++ < MAX_MATCHES);
      if (guard >= MAX_MATCHES) {
        return { matches, error: `Match loop stopped at ${MAX_MATCHES} — pathological pattern guarded, results may be partial.` };
      }
      return { matches, error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Invalid pattern" };
    }
  }, [pattern, flags, text]);

  return (
    <>
      <div className="bg-surface-container rounded-xl p-space-lg mb-space-lg shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-space-md">
          <label className="block">
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Pattern</span>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="mt-1 w-full px-space-sm py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary font-mono"
              placeholder="\\w+@\\w+\\.\\w+"
              aria-label="Regular expression pattern"
            />
            {analysis?.error && <span className="text-label-mono-xs font-label-mono-xs text-error mt-1 block">{analysis.error}</span>}
          </label>
          <div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Flags</span>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {["g", "i", "m", "s", "u", "y"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFlags((cur) => (cur.includes(f) ? cur.replace(f, "") : cur + f))}
                  className={`px-2 py-1 rounded font-label-mono-md text-label-mono-md ${
                    flags.includes(f) ? "bg-surface-container text-secondary font-semibold" : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
                  }`}
                  aria-pressed={flags.includes(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor value={text} onChange={setText} title="Test Text" chip="SUBJECT" placeholder="Paste the text to scan…" minHeight={330} />
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Matches &amp; Captures</span>
            </div>
            <div className="flex items-center gap-1">
              <CopyButton value={(analysis?.matches ?? []).map((m) => m.text).join("\n")} />
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest p-space-md font-label-mono-md text-label-mono-md overflow-auto max-h-[330px]">
            {!analysis ? (
              <span className="text-on-surface-variant">Enter a pattern to see matches.</span>
            ) : analysis.error && (!analysis.matches || analysis.matches.length === 0) ? (
              <span className="text-error flex items-center gap-2">
                <Icon name="error" size={16} />
                {analysis.error}
              </span>
            ) : (analysis.matches ?? []).length === 0 ? (
              <span className="text-on-surface-variant">No matches — adjust the pattern or flags.</span>
            ) : (
              <div className="space-y-1">
                {(analysis.matches ?? []).map((m, i) => (
                  <div key={`${m.index}-${i}`} className="px-2 py-1 rounded hover:bg-surface-container/40">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-primary break-all">
                        #{i + 1} {m.text}
                      </code>
                      <span className="text-label-mono-xs font-label-mono-xs text-outline-variant flex-shrink-0">
                        @{m.index} len {m.length}
                      </span>
                    </div>
                    {m.groups.length > 0 && (
                      <div className="text-label-mono-xs font-label-mono-xs text-on-surface-variant mt-0.5">
                        groups: [{m.groups.map((g) => `"${g}"`).join(", ")}]
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            <span className={analysis?.error ? "text-error font-semibold" : "text-secondary font-semibold"}>
              {(analysis?.matches ?? []).length} matches
              {analysis?.error ? " (guarded)" : " • live engine"}
            </span>
            <span>flags: /{flags || "none"}</span>
          </div>
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Native JavaScript engine semantics • runaway patterns guarded (10k cap)</span>
        </div>
      )}
    </>
  );
}

/* -------------------------------- Diff checker ----------------------------- */

export function DiffWorkspace() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [granularity, setGranularity] = useState<"lines" | "words" | "chars">("lines");
  const [inline, setInline] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof computeDiff>> | null>(null);

  const runCompare = useCallback(async () => {
    if (left.length === 0 && right.length === 0) {
      setResult(null);
      return;
    }
    const res = await computeDiff(left, right, granularity);
    setResult(res);
  }, [left, right, granularity]);

  useEffect(() => {
    const id = setTimeout(() => void runCompare(), 250);
    return () => clearTimeout(id);
  }, [runCompare]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor value={left} onChange={setLeft} title="Original" chip="BASE" placeholder="Paste the original text…" minHeight={300} />
        <CodeEditor value={right} onChange={setRight} title="Changed" chip="MODIFIED" placeholder="Paste the modified text…" minHeight={300} />
      </div>

      <div className="bg-surface-container rounded-xl p-space-md mb-space-lg shadow-md flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs">
          <div className={RIBBON_INDENT_GROUP}>
            {(
              [
                { label: "Lines", value: "lines" },
                { label: "Words", value: "words" },
                { label: "Chars", value: "chars" },
              ] as const
            ).map((o) => (
              <button key={o.value} type="button" onClick={() => setGranularity(o.value)} className={granularity === o.value ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
                {o.label}
              </button>
            ))}
            <button type="button" onClick={() => setInline((v) => !v)} className={`px-2 py-1 rounded ${inline ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}`}>
              {inline ? "Inline View" : "Side-by-Side"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-space-xs text-label-mono-xs font-label-mono-xs">
          <span className="text-secondary font-semibold">+{result?.stats.added ?? 0} added</span>
          <span className="text-error font-semibold">−{result?.stats.removed ?? 0} removed</span>
          <button
            type="button"
            onClick={() => {
              setLeft("");
              setRight("");
              setResult(null);
            }}
            className={RIBBON_BTN_CLEAR}
          >
            <Icon name="delete_sweep" size={16} />
            <span>Clear Both</span>
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl mb-space-lg border border-outline-variant/30 max-h-[480px] overflow-y-auto">
          <div className={`grid ${inline ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"} text-label-mono-md font-label-mono-md leading-[22px]`}>
            {result.rows.map((row, i) => {
              const tone =
                row.type === "added"
                  ? "bg-secondary/10 text-secondary"
                  : row.type === "removed"
                    ? "bg-error/10 text-error"
                    : "text-on-surface";
              return inline ? (
                <div key={i} className={`${tone} px-space-md py-1 border-b border-surface-container/40 break-all whitespace-pre-wrap`}>
                  {row.type === "added" ? "＊+ " : row.type === "removed" ? "＊− " : "＝  "}
                  {row.content}
                </div>
              ) : (
                <div key={i} className="contents">
                  {row.type !== "added" && (
                    <div className={`${row.type === "removed" ? tone : ""} text-outline/60 px-space-sm py-1 border-r border-surface-container/40 break-all whitespace-pre-wrap`}>
                      {row.oldIndex !== null ? `${row.oldIndex + 1}: ` : "  :"}
                      {row.content}
                    </div>
                  )}
                  {row.type === "added" && <div className="bg-transparent px-space-sm py-1 border-r border-surface-container/40"></div>}
                  {row.type !== "removed" && (
                    <div className={`${row.type === "added" ? tone : ""} text-outline/60 px-space-sm py-1 break-all whitespace-pre-wrap`}>
                      {row.newIndex !== null ? `${row.newIndex + 1}: ` : "  :"}
                      {row.content}
                    </div>
                  )}
                  {row.type === "removed" && <div className="bg-transparent px-space-sm py-1"></div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Myers diff algorithm • changes render as you type</span>
        </div>
      )}
    </>
  );
}

/* ------------------------------- JSON compare ------------------------------- */

export function JsonCompareWorkspace() {
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<JsonChange[] | null>(null);

  const runCompare = useCallback(() => {
    setError(null);
    setChanges(null);
    if (leftText.trim().length === 0 || rightText.trim().length === 0) {
      setError("Both documents are required — paste JSON on the left and right.");
      return;
    }
    try {
      const a = JSON.parse(leftText);
      const b = JSON.parse(rightText);
      const found = compareJsonValues(a, b);
      setChanges(found);
      dispatchLatency(performance.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [leftText, rightText]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (leftText.trim().length > 0 && rightText.trim().length > 0) runCompare();
    }, 300);
    return () => clearTimeout(id);
  }, [leftText, rightText, runCompare]);

  const counts = useMemo(() => {
    const c = { added: 0, removed: 0, changed: 0 };
    for (const ch of changes ?? []) c[ch.type]++;
    return c;
  }, [changes]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor value={leftText} onChange={setLeftText} title="Document A (Before)" chip="JSON" placeholder="{\n  …\n}" errorMessage={error ?? undefined} minHeight={300} />
        <CodeEditor value={rightText} onChange={setRightText} title="Document B (After)" chip="JSON" placeholder="{\n  …\n}" minHeight={300} footerSlot={<span>Key order is ignored • arrays compared positionally</span>} />
      </div>

      {error && (
        <div className="bg-error-container/10 text-error rounded-xl p-space-md mb-space-lg font-label-mono-md text-label-mono-md flex items-center gap-2">
          <Icon name="error" size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
        <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs flex items-center justify-between">
          <span className="font-semibold text-secondary">Structural Diff Ledger</span>
          <span className="text-on-surface-variant">
            <span className="text-secondary">+{counts.added}</span> • <span className="text-error">−{counts.removed}</span> • <span className="text-tertiary">~{counts.changed}</span>
          </span>
        </div>
        <div className="max-h-[420px] overflow-auto">
          {!changes ? (
            <div className="h-32 flex items-center justify-center text-on-surface-variant font-body-sm text-body-sm">Differences appear here after comparing two documents.</div>
          ) : changes.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2">
              <Icon name="verified" size={28} className="text-secondary" />
              <span className="text-secondary font-label-mono-md text-label-mono-md font-semibold">Documents are semantically identical</span>
            </div>
          ) : (
            changes.map((ch, i) => (
              <div key={`${ch.path}-${i}`} className="px-space-md py-1.5 border-b border-surface-container/30 flex items-start gap-space-sm">
                <span className={`px-1.5 py-0.5 rounded text-label-mono-xs font-label-mono-xs flex-shrink-0 ${
                  ch.type === "added" ? "bg-secondary-container/20 text-secondary" : ch.type === "removed" ? "bg-error-container/30 text-error" : "bg-tertiary-container/30 text-tertiary"
                }`}>
                  {ch.type}
                </span>
                <code className="text-on-surface font-label-mono-md text-label-mono-md">{ch.path}</code>
                <div className="text-label-mono-xs font-label-mono-xs text-on-surface-variant min-w-0 break-all">
                  {ch.before !== undefined && <div>before: <span className="text-outline">{JSON.stringify(ch.before)}</span></div>}
                  {ch.after !== undefined && <div>after: <span className="text-outline">{JSON.stringify(ch.after)}</span></div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <div className="flex items-center gap-space-xs">
            <button type="button" onClick={runCompare} className={RIBBON_MAIN_ACTION}>
              <Icon name="difference" size={16} />
              <span>Compare JSON</span>
            </button>
            <CopyButton value={(changes ?? []).map((c) => `${c.type} ${c.path}${c.before !== undefined ? `  before=${JSON.stringify(c.before)}` : ""}${c.after !== undefined ? `  after=${JSON.stringify(c.after)}` : ""}`).join("\n")} label="Copy Ledger" />
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------- Cron parser ------------------------------- */

export function CronWorkspace() {
  const [expr, setExpr] = useState("*/15 9-17 * * 1-5");
  const [zone, setZone] = useState<string>("UTC");
  const [result, setResult] = useState<CronParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    const res = await parseCronExpression(expr, { timeZone: zone, count: 10 });
    if (res.ok) {
      setResult(res);
      setError(null);
    } else {
      setResult(null);
      setError(res.error ?? "Invalid cron expression.");
    }
  }, [expr, zone]);

  useEffect(() => {
    const id = setTimeout(() => void run(), 300);
    return () => clearTimeout(id);
  }, [run]);

  return (
    <>
      <div className="bg-surface-container rounded-xl p-space-lg mb-space-lg shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-space-md">
          <label>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Cron Expression</span>
            <input
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              className="mt-1 w-full px-space-sm py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary font-mono"
              aria-label="Cron expression"
            />
          </label>
          <label>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Time Zone</span>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="mt-1 w-full px-space-sm py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
              aria-label="Time zone"
            >
              {suggestedTimeZones().map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <div className="mt-space-sm text-label-mono-md font-label-mono-md text-error flex items-center gap-2">
            <Icon name="error" size={16} />
            {error}
          </div>
        )}
        {result && (
          <div className="mt-space-md space-y-space-sm">
            <div className="text-label-mono-xs font-label-mono-xs text-secondary uppercase tracking-widest">
              Dialect: {result.dialect === "classic-5" ? "5-field classic cron" : "6-field (with seconds)"}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-space-sm">
              {result.explain?.map((f) => (
                <div key={f.label} className="bg-surface-container-low rounded-lg p-space-sm">
                  <div className="font-semibold text-on-surface text-label-mono-md font-label-mono-md">{f.label}</div>
                  <code className="text-primary text-label-mono-xs font-label-mono-xs">{f.raw}</code>
                  <div className="text-outline-variant text-label-mono-xs font-label-mono-xs mt-0.5">{f.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
        <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant flex items-center justify-between">
          <span className="font-semibold text-secondary">Next 10 Executions — {zone}</span>
          <span>DST-aware • 5 &amp; 6 field kept separate</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md space-y-1 max-h-[380px] overflow-auto">
          {!result?.nextRuns ? (
            <div className="h-24 flex items-center justify-center text-on-surface-variant font-body-sm text-body-sm">Scheduled times appear here.</div>
          ) : (
            result.nextRuns.map((iso, i) => (
              <div key={iso} className="flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container/40">
                <span className="text-label-mono-md font-label-mono-md text-secondary">#{i + 1}</span>
                <code className="text-on-surface">{formatRun(iso, zone)}</code>
                <span className="text-outline-variant text-label-mono-xs font-label-mono-xs hidden sm:inline">{iso}</span>
              </div>
            ))
          )}
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Plain-language explanations per field • IANA timezone resolution</span>
        </div>
      )}
    </>
  );
}

/* ---------------------------- Query string parser ---------------------------- */

export function QueryStringWorkspace() {
  const [input, setInput] = useState("https://babygottools.com/tools?category=dev&category=pdf&q=hello%20world&flag");
  const [params, setParams] = useState<QueryParam[]>([]);
  const [baseUrl, setBaseUrl] = useState<string | undefined>();

  useEffect(() => {
    const parsed = parseQueryString(input);
    setParams(parsed.params.map((p) => ({ key: p.key, values: p.values.map(displayValue) })));
    setBaseUrl(parsed.baseUrl);
  }, [input]);

  const rebuilt = useMemo(() => rebuildQueryString(params), [params]);

  return (
    <>
      <CodeEditor
        value={input}
        onChange={setInput}
        title="URL / Query String"
        chip="LOSSLESS"
        placeholder="https://…  or  ?a=1&b=2"
        minHeight={140}
        footerSlot={
          <span className="flex items-center gap-2 justify-between w-full">
            <span>Repeated keys &amp; percent-decoding handled</span>
            {baseUrl && <span className="text-outline-variant truncate">base: {baseUrl}</span>}
          </span>
        }
      />

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg mt-space-md">
        <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant flex items-center justify-between">
          <span className="font-semibold text-secondary">{params.reduce((n, p) => n + p.values.length, 0)} values across {params.length} keys</span>
          <div className="flex items-center gap-1">
            <DownloadButton value={JSON.stringify(params, null, 2)} filename="query-params.json" mime="application/json;charset=utf-8" />
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto">
          {params.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-on-surface-variant font-body-sm text-body-sm">Parameters appear here after parsing.</div>
          ) : (
            <div className="divide-y divide-surface-container/40">
              {params.map((p, i) => (
                <div key={`${p.key}-${i}`} className="px-space-md py-2">
                  <div className="flex items-center gap-space-sm">
                    <input
                      value={p.key}
                      onChange={(e) =>
                        setParams((cur) => cur.map((q, qi) => (qi === i ? { ...q, key: e.target.value } : q)))
                      }
                      className="w-40 px-2 py-1 rounded bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
                      aria-label={`Key ${i + 1}`}
                    />
                    <button
                      type="button"
                      title="Remove parameter"
                      onClick={() => setParams((cur) => cur.filter((_, qi) => qi !== i))}
                      className="text-outline-variant hover:text-error transition-colors"
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {p.values.map((v, vi) => (
                      <div key={vi} className="flex items-center gap-space-sm">
                        <input
                          value={v}
                          onChange={(e) =>
                            setParams((cur) => cur.map((q, qi) => (qi === i ? { ...q, values: q.values.map((val, vali) => (vali === vi ? e.target.value : val)) } : q)))
                          }
                          className="flex-1 px-2 py-1 rounded bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
                          aria-label={`Value ${vi + 1} of key ${p.key}`}
                        />
                        {p.values.length > 1 && (
                          <button
                            type="button"
                            title="Remove value"
                            onClick={() =>
                              setParams((cur) => cur.map((q, qi) => (qi === i ? { ...q, values: q.values.filter((_, vali) => vali !== vi) } : q)))
                            }
                            className="text-outline-variant hover:text-error transition-colors"
                          >
                            <Icon name="remove_circle_outline" size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setParams((cur) => cur.map((q, qi) => (qi === i ? { ...q, values: [...q.values, ""] } : q)))}
                      className="text-label-mono-xs font-label-mono-xs text-secondary hover:underline"
                    >
                      + add value (repeated key)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between gap-2">
          <code className="text-secondary font-label-mono-md text-label-mono-md break-all min-w-0">?{rebuilt}</code>
          <CopyButton value={`${baseUrl ?? ""}?${rebuilt}`} />
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Edit the table → the rebuilt query string updates below it • round-trip lossless</span>
        </div>
      )}
    </>
  );
}

/* --------------------------- HTTP header inspector --------------------------- */

export function HttpHeaderWorkspace() {
  const [raw, setRaw] = useState<string>(sampleHeaders);
  const [parsed, setParsed] = useState<ParsedHeaders | null>(null);

  useEffect(() => {
    if (raw.trim().length === 0) {
      setParsed(null);
      return;
    }
    const res = parseHttpHeaders(raw);
    setParsed(res.ok ? res.parsed : null);
  }, [raw]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor
          value={raw}
          onChange={setRaw}
          title="Raw Headers"
          chip="RFC 9110"
          placeholder={"HTTP/2 200\ncache-control: no-store"}
          minHeight={360}
          footerSlot={
            <span>Paste request or response headers from your browser&apos;s Network panel</span>
          }
        />
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Structured Table</span>
            </div>
            <div className="flex items-center gap-1">
              <CopyButton
                value={(parsed?.headers ?? []).map((h) => `${h.name}: ${h.value}`).join("\n")}
              />
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest p-space-md overflow-auto max-h-[360px]">
            {!parsed ? (
              <div className="h-full flex items-center justify-center text-on-surface-variant font-body-sm text-body-sm">Parsed headers appear here.</div>
            ) : (
              <div className="divide-y divide-surface-container/30">
                {parsed.headers.map((h, i) => (
                  <div key={`${h.name}-${i}`} className="py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label-mono-md font-label-mono-md text-secondary font-semibold flex items-center gap-1">
                        {isSecurityRelevant(h.name) && <Icon name="shield" size={14} className="text-tertiary" />}
                        {h.name}
                        {h.duplicate && <span className="px-1 py-0.5 rounded bg-error-container/30 text-error text-label-mono-xs font-label-mono-xs">dup</span>}
                      </span>
                      <code className="text-on-surface font-label-mono-md text-label-mono-md text-right break-all">{h.value}</code>
                    </div>
                    {headerDescription(h.name) && (
                      <div className="text-label-mono-xs font-label-mono-xs text-on-surface-variant mt-0.5">{headerDescription(h.name)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs flex items-center gap-2 flex-wrap">
            <Icon name="shield" size={16} className="text-tertiary" />
            <span className="text-tertiary font-semibold">No URL fetching (CORS/SSR-safe)</span>
            <span className="text-outline-variant">• {(parsed?.headers.length ?? 0).toString()} headers parsed</span>
          </div>
        </div>
      </div>

      {parsed && parsed.notices.length > 0 && (
        <div className="bg-surface-container rounded-xl p-space-md mb-space-lg shadow-md">
          <div className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Audit Notes</div>
          <ul className="space-y-1">
            {parsed.notices.map((n, i) => (
              <li key={i} className={`text-label-mono-md font-label-mono-md flex items-start gap-2 ${n.kind === "warn" ? "text-error" : n.kind === "status-line" || n.kind === "request-line" ? "text-secondary" : "text-on-surface-variant"}`}>
                <Icon name={n.kind === "warn" ? "warning" : "info"} size={14} className="mt-0.5 flex-shrink-0" />
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <button type="button" onClick={() => setRaw(sampleHeaders)} className={RIBBON_BTN}>
            <Icon name="terminal" size={16} />
            <span>Sample Headers</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRaw("");
              setParsed(null);
            }}
            className={RIBBON_BTN_CLEAR}
          >
            <Icon name="delete_sweep" size={16} />
            <span>Clear</span>
          </button>
        </div>
      )}
    </>
  );
}

const sampleHeaders = `HTTP/2 200
content-type: application/json; charset=utf-8
content-security-policy: default-src 'self'
strict-transport-security: max-age=63072000
x-content-type-options: nosniff
referrer-policy: origin-when-cross-origin
x-custom-header: alpha
x-custom-header: beta`;

/* --------------------------- Unicode text inspector --------------------------- */

export function UnicodeTextWorkspace() {
  const [text, setText] = useState("Baby Got Tools — est. 2025 🚀");
  const report = useMemo(() => inspectUnicode(text), [text]);

  return (
    <>
      <CodeEditor value={text} onChange={setText} title="Input Text" chip="UAX #29 GRAPHEMES" minHeight={140} footerSlot={<span>Paste emoji, CJK, combining marks — surrogate pairs are decoded correctly</span>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md mb-space-lg mt-space-md">
        {(
          [
            { label: "Graphemes", value: report.graphemes.length, icon: "format_shapes" },
            { label: "Code Points", value: report.codePointCount, icon: "straighten" },
            { label: "UTF-16 units", value: report.utf16Count, icon: "swap_horiz" },
            { label: "UTF-8 bytes", value: report.utf8Bytes, icon: "data_usage" },
          ] as const
        ).map((s) => (
          <div key={s.label} className="bg-surface-container rounded-xl p-space-md shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">{s.label}</span>
              <Icon name={s.icon} size={16} className="text-secondary" />
            </div>
            <div className="text-headline-md text-on-surface font-bold mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
        <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant flex items-center justify-between">
          <span className="font-semibold text-secondary">Per-Character Breakdown</span>
          {report.hiddenCount > 0 && <span className="text-error font-semibold">{report.hiddenCount} invisible segments detected</span>}
        </div>
        <div className="max-h-[420px] overflow-auto divide-y divide-surface-container/30">
          {report.graphemes.slice(0, 300).map((g) => (
            <div key={g.graphemeIndex} className="px-space-md py-1.5 flex items-center gap-space-md">
              <span className="w-16 text-label-mono-xs font-label-mono-xs text-outline-variant">#{g.graphemeIndex + 1}</span>
              <span className={`w-14 grid place-items-center rounded bg-surface-container-highest text-label-mono-md font-label-mono-md ${g.hidden ? "text-error" : "text-on-surface"}`}>
                {g.codePoints[0]?.char || "␲"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-label-mono-md font-label-mono-md text-on-surface flex flex-wrap gap-2">
                  {g.codePoints.map((cp) => (
                    <span key={cp.hex} className={cp.invisible ? "text-error" : cp.surrogate ? "text-tertiary" : "text-secondary"}>
                      {cp.hex}
                    </span>
                  ))}
                </div>
                <div className="text-label-mono-xs font-label-mono-xs text-on-surface-variant truncate">
                  {g.codePoints.map((cp) => cp.name).join(" + ")} · UTF-8 [{g.codePoints.flatMap((cp) => cp.utf8).map((b) => `0x${b.toString(16).toUpperCase().padStart(2, "0")}`).join(" ")}]
                </div>
              </div>
              <CopyButton value={g.codePoints.map((cp) => cp.hex).join(" ")} iconOnly />
            </div>
          ))}
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Code points • UTF-8 bytes • UTF-16 units — all counted honestly, per segment</span>
        </div>
      )}
    </>
  );
}

/* -------------------------- Unicode security inspector -------------------------- */

export function UnicodeSecurityWorkspace() {
  const [text, setText] = useState("Safe text with hidden​zero‍width chars and ‮reversed‬risks…");
  const report = useMemo(() => inspectUnicode(text), [text]);
  const homoglyphs = useMemo(() => homoglyphScan(text), [text]);
  const sanitizer = useMemo(() => sanitizeHidden(text), [text]);

  const risky = report.graphemes.filter((g) => g.hidden);

  return (
    <>
      <CodeEditor
        value={text}
        onChange={setText}
        title="Suspicious Text"
        chip="SPOOF AUDIT"
        errorMessage={risky.length > 0 || homoglyphs.length > 0 ? `${risky.length} hidden characters, ${homoglyphs.length} homoglyph candidates` : undefined}
        minHeight={140}
        footerSlot={
          <div className="flex items-center justify-between w-full">
            <span>Zero-width, bidi overrides, joiners &amp; confusables flagged positionally</span>
            <CopyButton value={sanitizer.cleaned} label="Copy Cleaned" />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mb-space-lg mt-space-md">
        <div className="bg-surface-container rounded-xl p-space-md shadow-md">
          <div className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Hidden Characters</div>
          <div className={`text-headline-md font-bold mt-1 ${risky.length > 0 ? "text-error" : "text-secondary"}`}>{risky.length}</div>
          <div className="text-label-mono-xs font-label-mono-xs text-outline-variant mt-1">invisible &amp; control code points found</div>
        </div>
        <div className="bg-surface-container rounded-xl p-space-md shadow-md">
          <div className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Homoglyph Watchlist</div>
          <div className={`text-headline-md font-bold mt-1 ${homoglyphs.length > 0 ? "text-tertiary" : "text-secondary"}`}>{homoglyphs.length}</div>
          <div className="text-label-mono-xs font-label-mono-xs text-outline-variant mt-1">look-alike characters (Cyrillic/Greek)</div>
        </div>
        <div className="bg-surface-container rounded-xl p-space-md shadow-md">
          <div className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Sanitized Preview</div>
          <div className="text-label-mono-md font-label-mono-md text-on-surface mt-1 break-all max-h-16 overflow-auto">{sanitizer.cleaned || "—"}</div>
          <div className="text-label-mono-xs font-label-mono-xs text-outline-variant mt-1">{sanitizer.removed} characters would be stripped</div>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
        <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs flex items-center justify-between">
          <span className="font-semibold text-secondary">Findings Ledger</span>
          <span>{report.graphemes.length} segments scanned</span>
        </div>
        <div className="max-h-[380px] overflow-auto divide-y divide-surface-container/30">
          {risky.length === 0 && homoglyphs.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2">
              <Icon name="verified" size={28} className="text-secondary" />
              <span className="text-secondary font-label-mono-md text-label-mono-md font-semibold">No hidden characters or homoglyphs found</span>
            </div>
          ) : (
            <>
              {risky.map((g, i) => (
                <div key={`r-${i}`} className="px-space-md py-1.5 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-error-container/30 text-error text-label-mono-xs font-label-mono-xs">hidden</span>
                  <code className="text-error">{g.codePoints.find((cp) => cp.invisible)?.hex}</code>
                  <span className="text-on-surface-variant text-label-mono-xs font-label-mono-xs">
                    segment #{g.graphemeIndex + 1} • {g.codePoints.find((cp) => cp.invisible)?.name}
                  </span>
                </div>
              ))}
              {homoglyphs.map((h, i) => (
                <div key={`h-${i}`} className="px-space-md py-1.5 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-tertiary-container/30 text-tertiary text-label-mono-xs font-label-mono-xs">confusable</span>
                  <code className="text-tertiary">{h.grapheme}</code>
                  <span className="text-on-surface-variant text-label-mono-xs font-label-mono-xs">{h.note}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <button
            type="button"
            onClick={() => setText(sanitizer.cleaned)}
            className="inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-label-mono-md font-label-mono-md transition-all"
          >
            <Icon name="cleaning_services" size={16} />
            <span>Apply Sanitizer to Input</span>
          </button>
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">analysis is offline &amp; local</span>
        </div>
      )}
    </>
  );
}

/* --------------------------- API mock generator --------------------------- */

export function ApiMockWorkspace() {
  const [scenario, setScenario] = useState<MockScenario>("success");
  const [resource, setResource] = useState("users");
  const [count, setCount] = useState(5);
  const [ts, setTs] = useState(true);
  const [output, setOutput] = useState("");

  const generate = useCallback(() => {
    const started = performance.now();
    const mock = generateMock({ scenario, resource, count, includeTimestamps: ts });
    setOutput(JSON.stringify(mock, null, 2));
    window.dispatchEvent(new CustomEvent<number>(LATENCY_EVENT, { detail: performance.now() - started }));
  }, [scenario, resource, count, ts]);

  return (
    <>
      <div className="bg-surface-container rounded-xl p-space-lg mb-space-lg shadow-xl">
        <div className="font-headline-md text-headline-md text-on-surface mb-space-md">Mock Controls — static fixtures, zero live calls</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
          <label className="block">
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Scenario</span>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as MockScenario)}
              className="mt-1 w-full px-space-sm py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              {MOCK_SCENARIOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Resource</span>
            <input
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              className="mt-1 w-full px-space-sm py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
              placeholder="users / orders / items"
            />
          </label>
          <label className="block">
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Items ({count})</span>
            <input type="range" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full mt-3 accent-[var(--color-tertiary)]" />
          </label>
          <label className="block">
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">Timestamps</span>
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setTs((v) => !v)}
                className={`px-2 py-1 rounded ${ts ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE} bg-surface-container-highest`}
                aria-pressed={ts}
              >
                {ts ? "Included" : "Omitted"}
              </button>
            </div>
          </label>
        </div>
        <div className="mt-space-md flex flex-wrap items-center gap-space-xs">
          <button type="button" onClick={generate} className={RIBBON_MAIN_ACTION}>
            <Icon name="api" size={16} />
            <span>Generate Mock</span>
          </button>
          <CopyButton value={output} />
          <DownloadButton value={output} filename="mock-response.json" mime="application/json;charset=utf-8" label="Download JSON" />
        </div>
      </div>

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl mb-space-lg">
        <div className="bg-surface-container-low px-space-md py-2 text-label-mono-xs font-label-mono-xs text-on-surface-variant flex items-center justify-between">
          <span className="font-semibold text-secondary">{MOCK_SCENARIOS.find((s) => s.value === scenario)?.label}</span>
          <span>generated locally • deterministic pools</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md min-h-[280px] max-h-[440px] overflow-auto">
          {output ? (
            <pre className="text-on-surface font-label-mono-md text-label-mono-md leading-[22px] overflow-x-auto whitespace-pre-wrap break-words">
              <code>{output}</code>
            </pre>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center gap-2">
              <Icon name="api" size={32} className="text-outline-variant" />
              <span className="text-on-surface-variant font-body-sm text-body-sm">Press “Generate Mock” — a realistic fixture response appears here.</span>
            </div>
          )}
        </div>
      </div>
      {usePortalRibbon(
        <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Presets: success • paginated • 401 • 404 • 422 validation • 500</span>
        </div>
      )}
    </>
  );
}

function dispatchLatency(ms: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<number>(LATENCY_EVENT, { detail: ms }));
  }
}
