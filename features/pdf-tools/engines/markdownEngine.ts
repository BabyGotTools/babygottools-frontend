import { sanitizeCss, sanitizeHtml } from "./sanitizeHtmlEngine";

/**
 * Markdown → sanitized HTML using marked + highlight.js. Output always runs
 * through sanitizeHtml before it reaches the preview iframe or the PDF
 * conversion host, so raw user markup can never execute.
 */

const MARKDOWN_CSS = `
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
  h1, h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25em; }
  code { background: #f3f4f6; padding: 0.15em 0.35em; border-radius: 4px; font-size: 0.92em; }
  pre { background: #f6f8fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; white-space: pre-wrap; word-break: break-word; }
  pre code { background: transparent; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 1em; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; }
  th { background: #f3f4f6; text-align: left; }
  blockquote { border-left: 4px solid #cbd5e1; color: #475569; padding-left: 1em; margin-left: 0; }
  img { max-width: 100%; }
  .hljs-comment, .hljs-quote { color: #6b7280; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal { color: #7c3aed; }
  .hljs-string, .hljs-attr { color: #047857; }
  .hljs-number, .hljs-symbol { color: #b45309; }
  .hljs-title, .hljs-section, .hljs-function { color: #1d4ed8; }
  .hljs-built_in, .hljs-type { color: #0e7490; }
  .hljs-variable, .hljs-template-variable { color: #be123c; }
`;

export { MARKDOWN_CSS };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface MarkdownRenderResult {
  html: string;
  css: string;
  warnings: string[];
}

export async function markdownToHtml(
  markdown: string,
  options: { highlightCode: boolean; customCss: string }
): Promise<MarkdownRenderResult> {
  if (!markdown.trim()) {
    throw new Error("Add some Markdown before converting");
  }

  const [{ Marked }] = await Promise.all([import("marked")]);
  const instance = new Marked({ gfm: true, breaks: true, async: false });

  if (options.highlightCode) {
    const { default: hljs } = await import("highlight.js");
    instance.use({
      renderer: {
        code({ text, lang }) {
          const language = lang && hljs.getLanguage(lang) ? lang : "";
          try {
            const highlighted = language
              ? hljs.highlight(text, { language }).value
              : text.length < 20_000
                ? hljs.highlightAuto(text).value
                : escapeHtml(text);
            const className = language ? `hljs language-${language}` : "hljs";
            return `<pre><code class="${className}">${highlighted}</code></pre>`;
          } catch {
            return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>`;
          }
        },
      },
    });
  }

  const parsed = await instance.parse(markdown);
  const html = typeof parsed === "string" ? parsed : "";
  const sanitized = await sanitizeHtml(html);
  const css = [MARKDOWN_CSS, sanitized.css, sanitizeCss(options.customCss)]
    .filter(Boolean)
    .join("\n");

  return {
    html: sanitized.html,
    css,
    warnings: sanitized.warnings,
  };
}
