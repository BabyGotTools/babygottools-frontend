"use client";

/** Markdown Live Preview â€” GFM render + sanitized sandboxed iframe preview. */

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/common/Icon";
import CodeEditor from "@/components/tools/CodeEditor";
import CopyButton from "@/components/tools/CopyButton";
import DownloadButton from "@/components/tools/DownloadButton";
import { RIBBON_BTN, RIBBON_BTN_CLEAR, RIBBON_MAIN_ACTION, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import { markdownToHtml } from "@/features/pdf-tools/engines/markdownEngine";
import { useRibbonPortal } from "@/hooks/useRibbonPortal";

const SAMPLE = `# Hello, writer

This is a **live preview**. Edit the left pane and the right pane updates instantly.

- [x] supports task lists
- [ ] and tables

| Feature | Status |
| --- | --- |
| Tables | âœ“ |
| Code | \`inline\` |

> Blockquotes, images and links work too.

\`\`\`js
const hello = "world";
console.log(hello);
\`\`\``;

export function MarkdownPreviewWorkspace() {
  const [markdown, setMarkdown] = useState("");
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(true);

  const render = useCallback(async () => {
    if (markdown.trim().length === 0) {
      setHtml("");
      setWarnings([]);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await markdownToHtml(markdown, { highlightCode: highlight, customCss: "" });
      setHtml(result.html);
      setCss(result.css);
      setWarnings(result.warnings);
    } catch (e) {
      setHtml("");
      setError(e instanceof Error ? e.message : "Rendering failed.");
    } finally {
      setBusy(false);
    }
  }, [markdown, highlight]);

  // Live re-render (debounced so long documents don't thrash).
  useEffect(() => {
    const t = setTimeout(() => void render(), 250);
    return () => clearTimeout(t);
  }, [render]);

  const standaloneHtml = useMemo(
    () =>
      html
        ? `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Document</title>\n<style>\n${css}\nbody { max-width: 46rem; margin: 0 auto; padding: 2rem 1rem; }\n</style>\n</head>\n<body>\n${html}\n</body>\n</html>`
        : "",
    [html, css]
  );

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <button type="button" onClick={() => setMarkdown(SAMPLE)} className={RIBBON_BTN}>
          <Icon name="terminal" size={16} />
          <span>Sample Markdown</span>
        </button>
        <button type="button" onClick={() => setMarkdown("")} className={RIBBON_BTN_CLEAR}>
          <Icon name="delete_sweep" size={16} />
          <span>Clear</span>
        </button>
        <button
          type="button"
          onClick={() => setHighlight(!highlight)}
          aria-pressed={highlight}
          className={`px-space-sm py-1.5 rounded-lg text-label-mono-md font-label-mono-md transition-all cursor-pointer ${
            highlight ? "bg-secondary/10 text-secondary" : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Icon name={highlight ? "check_box" : "check_box_outline_blank"} size={16} />
          <span>Code highlighting</span>
        </button>
      </div>
      <button type="button" onClick={() => void render()} disabled={busy} className={`${RIBBON_MAIN_ACTION} ${busy ? "opacity-60" : ""}`}>
        <Icon name={busy ? "progress_activity" : "visibility"} size={16} className={busy ? "animate-spin" : ""} />
        <span>{busy ? "Renderingâ€¦" : "Re-render"}</span>
      </button>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  const previewSrcDoc = html ? `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}</body></html>` : "";

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        <CodeEditor
          value={markdown}
          onChange={setMarkdown}
          title="Markdown Source"
          chip="GFM"
          placeholder={"# Start writing markdownâ€¦"}
        />
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl relative">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">Live Preview</span>
              <span className="text-label-mono-xs font-label-mono-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant flex-shrink-0">
                SANITIZED
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <DownloadButton value={standaloneHtml} filename="markdown-preview.html" mime="text/html;charset=utf-8" title="Download standalone HTML" />
              <CopyButton value={standaloneHtml} label="Copy HTML" title="Copy standalone HTML" />
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest" style={{ height: 420, maxHeight: 560 }}>
            {error ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="error" size={36} className="text-error" />
                <p className="text-error font-semibold">{error}</p>
              </div>
            ) : previewSrcDoc ? (
              <iframe
                title="Markdown preview"
                sandbox=""
                srcDoc={previewSrcDoc}
                className="w-full h-full border-0 bg-white"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="visibility" size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">The rendered preview appears here as you type.</p>
              </div>
            )}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between flex-wrap gap-1 text-label-mono-xs font-label-mono-xs">
            <div className={`flex items-center gap-2 min-w-0 ${error ? "text-error" : html ? "text-secondary" : "text-on-surface-variant"}`}>
              <Icon name={error ? "close" : html ? "verified" : "hourglass_empty"} size={16} className="flex-shrink-0" />
              <span className="font-semibold truncate">
                {error ? error.slice(0, 72) : html ? "Rendered & sanitized â€¢ scripts stripped by DOMPurify" : "Awaiting input"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-on-surface-variant flex-shrink-0">
              {html && <span>{html.length.toLocaleString()} chars</span>}
              {warnings.length > 0 && <span className="text-tertiary">{warnings.length} note(s)</span>}
            </div>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-surface-container rounded-xl p-space-md mb-space-lg shadow-md">
          <div className="font-headline-sm text-headline-sm text-on-surface mb-space-sm flex items-center gap-2">
            <Icon name="info" size={18} className="text-tertiary" />
            Sanitizer Notes
          </div>
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li key={w} className="text-label-mono-md font-label-mono-md text-on-surface-variant flex items-start gap-2">
                <Icon name="warning" size={14} className="text-tertiary mt-0.5 flex-shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ribbonNode}
    </>
  );
}
