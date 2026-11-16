/**
 * Curated per-tool SEO metadata (title + meta description).
 *
 * Strategy: the most-searched tools get hand-written, intent-matched titles
 * and descriptions; the long tail inherits a natural fallback built from the
 * registry (`{alias ?? title} — Free Online Tool` + unique `desc`), so every
 * page still has unique metadata without forcing one rigid template everywhere.
 *
 * Title length target: ≤ 60 chars INCLUDING the " | Baby Got Tools" suffix
 * appended by the layout title template (plain-string titles only).
 */

export interface ToolSeo {
  title: string;
  description: string;
}

export const SEO_BY_SLUG: Record<string, ToolSeo> = {
  /* ===================== Developer tools ===================== */

  "json-formatter": {
    title: "JSON Formatter & Validator — Free Online",
    description:
      "Format, validate and minify JSON instantly in your browser. Auto-detects syntax errors, explores syntax trees, and never uploads a byte — completely free.",
  },
  "jwt-debugger": {
    title: "JWT Debugger — Decode & Inspect Tokens",
    description:
      "Paste a JWT to decode its header, payload and signature instantly. Inspect every claim locally — nothing is sent to a server, ever.",
  },
  "base64-encoder-decoder": {
    title: "Base64 Encoder & Decoder — Text & Files",
    description:
      "Encode or decode Base64 from plain text or binary files, offline in your browser. Free, instant, and nothing is ever uploaded to a server.",
  },
  "csv-to-json-converter": {
    title: "CSV to JSON Converter — Free & Instant",
    description:
      "Convert delimited CSV data into clean JSON arrays right in your browser. Handles headers, quoting and custom delimiters — no upload, no sign-up.",
  },
  "json-compare": {
    title: "JSON Compare — Diff Two JSON Objects",
    description:
      "Compare two JSON documents side by side and instantly spot added, removed and changed keys — value-level diffs computed entirely in your browser.",
  },
  "uuid-generator": {
    title: "UUID Generator — v4, NanoID & Bulk IDs",
    description:
      "Generate UUID v4, time-ordered v7 and NanoID identifiers in bulk with cryptographic randomness — all computed locally, instantly and free.",
  },
  "token-generator": {
    title: "Token Generator — Secure Keys & Secrets",
    description:
      "Create cryptographically secure API keys, session secrets and alphanumeric tokens in bulk. Generated with your browser's CSPRNG — nothing leaves the tab.",
  },
  "text-encryptor": {
    title: "Text Encryptor — AES-256 in Your Browser",
    description:
      "Encrypt and decrypt text with AES-256-GCM entirely client-side. Your passphrase and plaintext never leave the browser — free and offline-capable.",
  },
  "css-beautifier": {
    title: "CSS Beautifier & Minifier — Free Online",
    description:
      "Format messy stylesheets or minify CSS for production in one place. Real-time beautify and compress modes, running 100% locally in your browser.",
  },
  "css-minifier": {
    title: "CSS Minifier — Online Compression Tool",
    description:
      "Strip whitespace, comments and redundant declarations to shrink CSS for production. Paste, minify and copy — instant results, zero uploads.",
  },
  "sql-query-formatter": {
    title: "SQL Formatter — PostgreSQL, MySQL & More",
    description:
      "Instantly beautify SQL queries with keyword casing, indentation and dialect support for PostgreSQL, MySQL, SQLite, Snowflake and more.",
  },
  "javascript-formatter": {
    title: "JavaScript Formatter — Prettify ES6+ Code",
    description:
      "Prettify JavaScript (ES6+) with configurable indentation and clean line breaks. Real-time formatting that never sends your code anywhere.",
  },
  "typescript-formatter": {
    title: "TypeScript Formatter — Instant & Free",
    description:
      "Format TypeScript and TSX code with clean type annotations and consistent indentation. Runs fully client-side — your source stays on your machine.",
  },
  "yaml-formatter": {
    title: "YAML Formatter & Validator Online",
    description:
      "Check YAML indentation strictly, normalize syntax and format documents error-free. Local parsing means instant feedback with zero risk.",
  },
  "graphql-formatter": {
    title: "GraphQL Formatter — Queries & SDL",
    description:
      "Format GraphQL queries, mutations, subscriptions and SDL schemas with proper indentation and syntax highlighting — free and fully client-side.",
  },
  "python-formatter": {
    title: "Python Formatter — PEP 8 Compliant",
    description:
      "Format Python scripts and snippets to PEP 8 style — correct indentation, spacing and line breaks. Instant results in your browser.",
  },
  "html-formatter": {
    title: "HTML Formatter — Clean Indented Markup",
    description:
      "Re-indent and clean HTML markup with tag alignment and self-closing element handling. Instantly readable code, parsed locally.",
  },
  "html-viewer": {
    title: "HTML Viewer — Preview & Inspect Markup",
    description:
      "Paste HTML to see a rendered preview and an interactive DOM tree, with live source formatting. A free markup inspector that runs in your browser.",
  },
  "regex-tester": {
    title: "Regex Tester — Live Match Highlighting",
    description:
      "Test, debug and visualize regular expressions with live match highlighting and capture group breakdown — instant results with zero server round-trips.",
  },
  "cron-parser": {
    title: "Cron Expression Parser — Next Run Times",
    description:
      "Translate cron expressions into plain English, validate schedules and preview the next 10 execution times — a free, instant developer utility.",
  },
  "diff-checker": {
    title: "Diff Checker — Compare Text Side by Side",
    description:
      "Spot character, word and line-level changes between two texts or code snippets. A free side-by-side diff tool that runs fully in your browser.",
  },
  "unicode-text-inspector": {
    title: "Unicode Inspector — Codepoints & Graphemes",
    description:
      "Inspect Unicode codepoints, surrogate pairs and grapheme clusters of any text — a precise, free reference tool for debugging encoding issues.",
  },
  "url-encoder-decoder": {
    title: "URL Encoder & Decoder — Percent-Encoding",
    description:
      "Encode special characters for query strings or decode percent-encoding back to plain text. Instant, free and processed entirely in your browser.",
  },
  "query-string-parser": {
    title: "Query String Parser — Decode URL Params",
    description:
      "Deconstruct complex URLs into structured key-value maps with repeated-parameter support. Paste a URL, get instant clarity — fully client-side.",
  },
  "http-header-inspector": {
    title: "HTTP Header Inspector — Parse & Audit",
    description:
      "Parse raw HTTP request and response headers with clear formatting and a security-oriented read-out. Free, instant and never leaves your browser.",
  },
  "online-clipboard": {
    title: "Online Clipboard — Share Text Anywhere",
    description:
      "Beam text between devices with a one-time 6-character code. Messages auto-delete within minutes — no accounts, no sign-up, no tracking.",
  },

  /* ===================== Text & writing tools ===================== */

  "word-counter": {
    title: "Word & Character Counter — Live Stats",
    description:
      "Count words, characters, sentences, reading and speaking time live as you type. Keyword density and paragraph stats included — nothing is uploaded.",
  },
  "case-converter": {
    title: "Case Converter — 12 Text Formats Online",
    description:
      "Convert text to UPPER, lower, Title, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE and more. Instant, free and fully in-browser.",
  },
  "text-diff": {
    title: "Text Diff — Compare Two Texts Side-by-Side",
    description:
      "Spot every change between two texts with a Myers diff at line, word or character granularity. Ignore-case option included — nothing is uploaded.",
  },
  "remove-duplicate-lines": {
    title: "Remove Duplicate Lines — Clean Lists Fast",
    description:
      "De-duplicate large lists instantly, with case sensitivity, trim and sort options. Perfect for cleaning email lists and logs — processed locally.",
  },
  "lorem-ipsum-generator": {
    title: "Lorem Ipsum Generator — Placeholder Text",
    description:
      "Generate classic or modern lorem ipsum by paragraphs, sentences or words with HTML wrapping options. Free, instant and runs entirely in-browser.",
  },
  "markdown-live-preview": {
    title: "Markdown Live Preview — Render to HTML",
    description:
      "Write GitHub-flavored Markdown and see a sanitized live preview instantly. Copy or download clean standalone HTML — no upload, no tracking.",
  },
  "invisible-unicode-character": {
    title: "Invisible Character — Copy Blank Space",
    description:
      "Copy zero-width spaces and other invisible Unicode characters instantly. Includes a scanner that finds hidden characters in pasted text.",
  },

  /* ===================== Image & media tools ===================== */

  "image-compressor": {
    title: "Image Compressor — PNG, JPG, WebP & AVIF",
    description:
      "Compress PNG, JPEG and WebP images in your browser with native and WASM encoders. Batch support, quality control and ZIP export — zero uploads.",
  },
  "image-resizer": {
    title: "Image Resizer — Custom Dimensions & Aspect",
    description:
      "Resize images to exact pixel dimensions with aspect-ratio locking and quick presets. Batch processing and ZIP download — fully client-side.",
  },
  "image-to-data-uri": {
    title: "Image to Data URI — Base64 Converter",
    description:
      "Convert any image to a Base64 data URI with ready-made HTML and CSS snippets plus an overhead report. Byte-exact, instant and in-browser.",
  },
  "color-palette-extractor": {
    title: "Color Palette Extractor — HEX from Photos",
    description:
      "Extract HEX, RGB and HSL palettes from any photo with median-cut quantization and share stats. Export as CSS variables or JSON — no upload.",
  },
  "favicon-generator": {
    title: "Favicon Generator — All Sizes + ICO",
    description:
      "Generate a full favicon package: 16–512px PNGs, multi-resolution .ico, web manifest and paste-ready link tags. Square-safe, processed locally.",
  },
  "exif-stripper": {
    title: "EXIF Stripper — Remove Photo Metadata",
    description:
      "Inspect and strip EXIF metadata including GPS location from photos. Re-encodes clean copies in your browser — your images are never uploaded.",
  },

  /* ===================== Utility tools ===================== */

  "qr-code-generator": {
    title: "QR Code Generator — SVG & PNG Export",
    description:
      "Create high-resolution QR codes with custom colors, size, error correction and logo overlay. Vector SVG and PNG export — no tracking pixels.",
  },
  "password-generator": {
    title: "Password Generator — Secure & Random",
    description:
      "Generate cryptographically secure passwords and passphrases with unbiased CSPRNG sampling, entropy analysis and bulk export. Nothing is stored.",
  },

  /* ===================== PDF & document tools ===================== */

  "merge-pdf": {
    title: "Merge PDF — Combine Files Online Free",
    description:
      "Combine multiple PDFs into one clean, ordered document in seconds. Drag, drop, reorder and export — processed entirely in your browser, completely free.",
  },
  "split-pdf": {
    title: "Split PDF — Extract Pages or Ranges",
    description:
      "Divide a PDF by custom page ranges, bookmarks or one file per page. Extract exactly what you need — fast, free and processed locally in your browser.",
  },
  "compress-pdf": {
    title: "Compress PDF — Shrink File Size Online",
    description:
      "Reduce PDF file size by optimizing embedded images, subsetting fonts and downsampling streams — with quality controls, fully client-side and free.",
  },
  "image-to-pdf": {
    title: "Image to PDF — Convert JPG & PNG Online",
    description:
      "Convert JPG, PNG, WEBP and TIFF images into a standardized PDF with custom DPI, page size and borders. 100% in-browser — files never leave your device.",
  },
  "word-to-pdf": {
    title: "Word to PDF Converter — Free Online",
    description:
      "Turn DOCX documents into pixel-perfect PDFs with embedded font synthesis. No sign-up, no upload processing — everything happens inside your browser.",
  },
  "excel-to-pdf": {
    title: "Excel to PDF — Convert XLSX Sheets Online",
    description:
      "Convert spreadsheets into PDF with customizable sheet pagination, gridline visibility and margins. Private, instant and free — no uploads required.",
  },
  "powerpoint-to-pdf": {
    title: "PowerPoint to PDF — Convert PPTX Slides",
    description:
      "Convert slide decks into high-resolution PDF pages with full vector fidelity preserved. Works entirely in your browser — nothing is uploaded.",
  },
  "pdf-to-word": {
    title: "PDF to Word — Editable DOCX Conversion",
    description:
      "Turn PDFs into editable Word documents using precise page rendering or extracted text. Free, private, and processed locally in your browser.",
  },
  "pdf-to-excel": {
    title: "PDF to Excel — Table Extraction to XLSX",
    description:
      "Detect tables inside PDFs and export them as an XLSX workbook with one selectable sheet per table. In-browser conversion with zero uploads.",
  },
  "pdf-to-jpg": {
    title: "PDF to JPG — Export Pages as Images",
    description:
      "Render PDF pages as high-quality JPG or PNG images, zipped automatically when there are several. Fast, free and fully browser-side.",
  },
  "ocr-pdf": {
    title: "OCR PDF — Searchable Text from Scans",
    description:
      "Extract text from scanned PDFs with local OCR and make documents searchable — zero uploads, no remote APIs, completely free.",
  },
  "organize-pdf": {
    title: "Organize PDF — Reorder Pages Visually",
    description:
      "Rearrange PDF pages in a visual drag-and-drop thumbnail grid. Sort, reset and re-export your document in seconds — all locally in your browser.",
  },
  "delete-pages": {
    title: "Delete PDF Pages — Remove Pages Online",
    description:
      "Remove unwanted or blank pages from a PDF without breaking the remaining document. Select, delete and download — instantly and privately.",
  },
  "rotate-pages": {
    title: "Rotate PDF — Fix Page Orientation",
    description:
      "Rotate individual pages or the whole document in 90° steps. Fix upside-down scans in seconds — free and processed entirely in your browser.",
  },
  "pdf-to-text": {
    title: "PDF to Text — Clean Text Extraction",
    description:
      "Extract clean plain text from PDFs with visual line reconstruction and hyphen rejoining. Free, private, and runs fully in your browser.",
  },
  "markdown-to-pdf": {
    title: "Markdown to PDF — Styled GFM Reports",
    description:
      "Convert GitHub Flavored Markdown into styled PDF reports with syntax-highlighted code blocks. In-browser rendering, no uploads, no sign-up.",
  },
  "html-to-pdf": {
    title: "HTML to PDF — Render Pages & Code Online",
    description:
      "Render HTML markup into print-ready PDF pages with CSS handling. Paste code and export instantly — everything executes in your browser.",
  },
  "json-to-csv-converter": {
    title: "JSON to CSV Converter — Export Instantly",
    description:
      "Flatten JSON arrays into downloadable CSV spreadsheets with custom column keys. Paste, convert and download — fully client-side, free and instant.",
  },
  "yaml-to-json-converter": {
    title: "YAML to JSON Converter — Two-Way & Lossless",
    description:
      "Convert YAML to JSON and back without losing structure. Perfect for pipelines, configs and specs — instant two-way conversion in your browser.",
  },
  "uuid-v7-generator": {
    title: "UUID v7 Generator — Bulk Time-Ordered IDs",
    description:
      "Generate time-ordered UUID v7 identifiers in batches — sortable, database-index friendly and cryptographically secure. Computed locally, free.",
  },
  "api-mock-generator": {
    title: "API Mock Generator — Test Payloads",
    description:
      "Synthesize realistic JSON mock payloads from schema definitions to unblock frontend development. No backend needed — generated in your browser.",
  },
  "unicode-security-inspector": {
    title: "Unicode Security Inspector — Spoof Check",
    description:
      "Reveal hidden Unicode characters, zero-width spaces and RTL bidi markers used in phishing and spoofing attacks. Free analysis, fully offline.",
  },
  "lua-beautifier": {
    title: "Lua Beautifier — Clean Indented Scripts",
    description:
      "Format messy Lua scripts with clean indentation and block structure. Paste, beautify and copy — instant, free and running entirely client-side.",
  },
  "php-beautifier": {
    title: "PHP Beautifier — PSR-12 Formatting",
    description:
      "Format PHP code to PSR-12 style with correct indentation, spacing and brace placement. A free, instant formatter that never uploads your code.",
  },
};
