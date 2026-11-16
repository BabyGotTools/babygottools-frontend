import Link from "next/link";
import Icon from "../common/Icon";
import type { ToolItem } from "@/data/tools";
/**
 * Homepage visual classes stay byte-identical; when a tool has a real route we
 * render the card as a next/link instead of a div — same look, clickable.
 * Keys must exactly match the titles in data/tools.ts.
 */
/** Exposed so other homepage sections (PopularTools) share the same lookup. */
export const toolRouteByTitle: Record<string, string> = {
  /* Programming & Developer Tools — featured glyph cards */
  "JSON Formatter": "/tools/json-formatter",
  "JWT Debugger & Decoder": "/tools/jwt-debugger",
  "Base64 Encoder / Decoder": "/tools/base64-encoder-decoder",
  "HTML Viewer & Prettifier": "/tools/html-viewer",
  "CSS Beautifier & Minifier": "/tools/css-beautifier",
  "SQL Query Formatter": "/tools/sql-query-formatter",
  "Regex Tester & Debugger": "/tools/regex-tester",
  "UUID / NanoID Generator": "/tools/uuid-generator",

  /* Programming & Developer Tools — "more" grid cards */
  "HTML Formatter": "/tools/html-formatter",
  "JavaScript Formatter": "/tools/javascript-formatter",
  "TypeScript Formatter": "/tools/typescript-formatter",
  "SQL Formatter": "/tools/sql-formatter",
  "JSON Compare": "/tools/json-compare",
  "GraphQL Formatter": "/tools/graphql-formatter",
  "YAML Formatter": "/tools/yaml-formatter",
  "Python Formatter": "/tools/python-formatter",
  "CSS Minifier": "/tools/css-minifier",
  "CSV to JSON Converter": "/tools/csv-to-json-converter",
  "JSON to CSV Converter": "/tools/json-to-csv-converter",
  "YAML to JSON Converter": "/tools/yaml-to-json-converter",
  "URL Encoder / Decoder": "/tools/url-encoder-decoder",
  "Unicode Text Inspector": "/tools/unicode-text-inspector",
  "Query String Parser": "/tools/query-string-parser",
  "HTTP Header Inspector": "/tools/http-header-inspector",
  "Lua Beautifier": "/tools/lua-beautifier",
  "Cron Expression Parser": "/tools/cron-parser",
  "Diff Checker": "/tools/diff-checker",
  "UUID v7 Batch Generator": "/tools/uuid-v7-generator",
  "PHP Beautifier": "/tools/php-beautifier",
  "API Response Mock Generator": "/tools/api-mock-generator",
  "Encrypt & Decrypt Text": "/tools/text-encryptor",
  "Token Generator": "/tools/token-generator",

  /* Unicode Security Inspector + Online Clipboard (homepage dev hub cards) */
  "Unicode Security Inspector": "/tools/unicode-security-inspector",

  /* Online Clipboard — relay tool (Sends-page card links here) */
  "Online Clipboard": "/tools/online-clipboard",

  /* PDF & Document Tools — the 29 live engines, titles verbatim from
     data/pdfTools.ts so every homepage card gets a real route. */
  "Image to PDF": "/tools/image-to-pdf",
  "Word to PDF": "/tools/word-to-pdf",
  "Excel to PDF": "/tools/excel-to-pdf",
  "PowerPoint to PDF": "/tools/powerpoint-to-pdf",
  "HTML to PDF": "/tools/html-to-pdf",
  "Text to PDF": "/tools/text-to-pdf",
  "Markdown to PDF": "/tools/markdown-to-pdf",
  "Merge PDF": "/tools/merge-pdf",
  "Insert Pages": "/tools/insert-pages",
  "Split PDF": "/tools/split-pdf",
  "Extract Pages": "/tools/extract-pages",
  "Organize PDF": "/tools/organize-pdf",
  "Delete Pages": "/tools/delete-pages",
  "Rotate Pages": "/tools/rotate-pages",
  "N-up PDF": "/tools/n-up-pdf",
  "Add Blank Page": "/tools/add-blank-page",
  "Compress PDF": "/tools/compress-pdf",
  "Linearize PDF": "/tools/linearize-pdf",
  "OCR PDF": "/tools/ocr-pdf",
  "Repair PDF": "/tools/repair-pdf",
  "Flatten PDF": "/tools/flatten-pdf",
  "Sanitize PDF": "/tools/sanitize-pdf",

  /* PDF & Document Tools — Converters from PDF (ported from the i love pdf
     project), titles verbatim from data/pdfTools.ts. */
  "PDF to Word": "/tools/pdf-to-word",
  "PDF to Excel": "/tools/pdf-to-excel",
  "PDF to JPG": "/tools/pdf-to-jpg",
  "PDF to PowerPoint": "/tools/pdf-to-powerpoint",
  "PDF to Markdown": "/tools/pdf-to-markdown",
  "PDF to Text": "/tools/pdf-to-text",
  "PDF to HTML": "/tools/pdf-to-html",

  /* Image & Media Tools — titles verbatim from data/tools.ts. */
  "Image Compressor": "/tools/image-compressor",
  "Image Resizer & Aspect Ratio": "/tools/image-resizer",
  "Image to Data URI / Base64": "/tools/image-to-data-uri",
  "Color Palette Extractor": "/tools/color-palette-extractor",
  "Favicon Package Generator": "/tools/favicon-generator",
  "EXIF Metadata Stripper": "/tools/exif-stripper",

  /* Text & Writing Tools — titles verbatim from data/tools.ts. */
  "Case Converter": "/tools/case-converter",
  "Side-by-Side Text Diff": "/tools/text-diff",
  "Remove Duplicate Lines": "/tools/remove-duplicate-lines",
  "Lorem Ipsum Generator": "/tools/lorem-ipsum-generator",
  "Markdown Live Preview": "/tools/markdown-live-preview",
  "Invisible Unicode Character": "/tools/invisible-unicode-character",
  "Word & Character Counter": "/tools/word-counter",

  /* Utility & productivity cards on the homepage. */
  "QR Code Generator": "/tools/qr-code-generator",
  "Password Generator": "/tools/password-generator",
};

export default function ToolCard({ tool }: { tool: ToolItem }) {
  const href = toolRouteByTitle[tool.title];
  const className = "tool-card";
  const content = (
    <>
      <div className="node">{tool.glyph ? tool.glyph : <Icon name={tool.icon ?? ""} size={20} />}</div>
      <div className="min-w-0 flex-1">
        <h3 className="font-body-md text-body-md text-on-surface font-medium truncate">{tool.title}</h3>
        <p className="font-label-mono-xs text-label-mono-xs text-tx-muted w-lxs truncate">{tool.desc}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${className} group`} data-accent={tool.accent || "hubchip"} tabIndex={0}>
        {content}
      </Link>
    );
  }
  return (
    <div className={`${className} relative overflow-hidden`} data-accent={tool.accent || "hubchip"} tabIndex={0}>
      {content}
    </div>
  );
}
