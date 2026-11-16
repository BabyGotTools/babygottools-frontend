/**
 * Structured tool metadata.
 * - popularTools: the 8 bento cards in the "Popular Tools" grid.
 * - hubs: the 4 detailed category sections. `tools` are always visible;
 *   `more` items are revealed by the "Show N more" toggle in the reference.
 */

export interface ToolItem {
  glyph?: string;
  icon?: string;
  title: string;
  desc: string;
  accent?: string;
}

export interface PopularTool {
  icon: string;
  category: string;
  title: string;
  desc: string;
  meta: { text: string; dot?: boolean };
  accent: string;
}

export interface Hub {
  id: string;
  icon: string;
  accent: string;
  title: string;
  count: number;
  subtitle: string;
  moreLabel: string | null;
  gridClass: string;
  tools: ToolItem[];
  more: ToolItem[];
}

export interface Benefit {
  icon: string;
  accent: string;
  title: string;
  desc: string;
  meta: string;
}

export interface Metric {
  value: string;
  label: string;
  cls: string;
}

export interface FooterLink {
  label: string;
  /** Internal route (Next <Link>) or external URL. */
  href: string;
}

export interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

export const popularTools: PopularTool[] = [
  {
    icon: "content_paste",
    category: "Productivity",
    title: "Online Clipboard",
    desc: "Share temporary text & snippets with a one-time expiring 6-character code.",
    meta: { text: "Self-deletes", dot: true },
    accent: "clipb",
  },
  {
    icon: "call_merge",
    category: "PDF Tools",
    title: "Merge PDF",
    desc: "Combine multiple PDF files into one clean, ordered document seamlessly.",
    meta: { text: "In-browser WASM" },
    accent: "mergepdf",
  },
  {
    icon: "compress",
    category: "Image Tools",
    title: "Image Compressor",
    desc: "Drastically reduce PNG, JPG, and WebP file weight without visible quality loss.",
    meta: { text: "WASM encoders" },
    accent: "imgcomp",
  },
  {
    icon: "data_object",
    category: "Developer",
    title: "JSON Formatter",
    desc: "Beautify, validate, minify, inspect syntax trees, and find subtle syntax bugs.",
    meta: { text: "Live Parser" },
    accent: "jsonf",
  },
  {
    icon: "qr_code_2",
    category: "Productivity",
    title: "QR Code Generator",
    desc: "Generate high-res vector SVG QR codes with custom styling, colors, and embedded logos.",
    meta: { text: "SVG & PNG Export" },
    accent: "qrgen",
  },
  {
    icon: "key",
    category: "Security",
    title: "Password Generator",
    desc: "Generate cryptographic passwords and passphrases with entropy analysis.",
    meta: { text: "Cryptographically secure" },
    accent: "passgen",
  },
  {
    icon: "format_list_numbered",
    category: "Text Tools",
    title: "Word & Character Counter",
    desc: "Real-time character count, word totals, speaking time, and keyword densities.",
    meta: { text: "Instant stats" },
    accent: "wordcount",
  },
  {
    icon: "call_split",
    category: "PDF Tools",
    title: "Split PDF",
    desc: "Extract custom page ranges or break multi-page documents into individual files.",
    meta: { text: "Zero upload needed" },
    accent: "splitpdf",
  },
];

export const hubs: Hub[] = [
  {
    id: "cat-dev",
    icon: "terminal",
    accent: "hubdev",
    title: "Programming & Developer Tools",
    count: 34,
    subtitle: "Zero-latency decoders, formatters, code linters, and generation utilities.",
    moreLabel: "Show 26 more Developer Tools",
    gridClass: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
    tools: [
      { glyph: "{ }", title: "JSON Formatter", desc: "Lint, beautify, minify", accent: "n-violet" },
      { glyph: "JWT", title: "JWT Debugger & Decoder", desc: "Header, claims, signature", accent: "n-indigo" },
      { glyph: "B64", title: "Base64 Encoder / Decoder", desc: "Text & binary converter", accent: "n-emerald" },
      { glyph: "</>", title: "HTML Viewer & Prettifier", desc: "Inspect DOM structure", accent: "n-rose" },
      { glyph: "CSS", title: "CSS Beautifier & Minifier", desc: "Format stylesheets", accent: "n-sky" },
      { glyph: "SQL", title: "SQL Query Formatter", desc: "Postgres, MySQL, SQLite", accent: "n-cyan" },
      { glyph: ".*", title: "Regex Tester & Debugger", desc: "Real-time match highlights", accent: "n-amber" },
      { glyph: "UID", title: "UUID / NanoID Generator", desc: "v4, v7 batches in bulk", accent: "n-purple" },
    ],
    more: [
      { icon: "html", title: "HTML Formatter", desc: "Clean & indent markup" },
      { icon: "javascript", title: "JavaScript Formatter", desc: "Beautify scripts" },
      { icon: "type_specimen", title: "TypeScript Formatter", desc: "Strict TS formatting" },
      { icon: "gpp_maybe", title: "Unicode Security Inspector", desc: "Hidden characters & spoofing" },
      { icon: "content_paste", title: "Online Clipboard", desc: "Expiring cross-device relay" },
      { icon: "database", title: "SQL Formatter", desc: "Pretty-print queries" },
      { icon: "difference", title: "JSON Compare", desc: "Spot changed keys" },
      { icon: "account_tree", title: "GraphQL Formatter", desc: "Format SDL schemas" },
      { icon: "data_object", title: "YAML Formatter", desc: "Validate & sort keys" },
      { icon: "code", title: "Python Formatter", desc: "PEP 8 style output" },
      { icon: "code", title: "CSS Minifier", desc: "Shrink stylesheets" },
      { icon: "swap_horiz", title: "CSV to JSON Converter", desc: "Delimiter-safe exports" },
      { icon: "swap_horiz", title: "JSON to CSV Converter", desc: "Nested arrays flattened" },
      { icon: "swap_horiz", title: "YAML to JSON Converter", desc: "Two-way conversion" },
      { icon: "link", title: "URL Encoder / Decoder", desc: "Safe query escaping" },
      { icon: "spellcheck", title: "Unicode Text Inspector", desc: "Codepoints & graphemes" },
      { icon: "manage_search", title: "Query String Parser", desc: "Key/value breakdown" },
      { icon: "http", title: "HTTP Header Inspector", desc: "Decode raw headers" },
      { icon: "terminal", title: "Lua Beautifier", desc: "Indent Lua source" },
      { icon: "schedule", title: "Cron Expression Parser", desc: "Human-readable schedules" },
      { icon: "compare_arrows", title: "Diff Checker", desc: "Line-level compare" },
      { icon: "fingerprint", title: "UUID v7 Batch Generator", desc: "Time-ordered batches" },
      { icon: "code", title: "PHP Beautifier", desc: "Tidy legacy PHP" },
      { icon: "api", title: "API Response Mock Generator", desc: "Realistic fake payloads" },
      { icon: "enhanced_encryption", title: "Encrypt & Decrypt Text", desc: "AES in-browser vault" },
      { icon: "key", title: "Token Generator", desc: "API keys & secrets" },
    ],
  },
  {
    id: "cat-pdf",
    icon: "picture_as_pdf",
    accent: "hubpdf",
    title: "PDF & Document Tools",
    count: 29,
    subtitle: "Private document operations that process 100% inside your browser.",
    moreLabel: "Show 21 more PDF Tools",
    gridClass: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
    tools: [
      { icon: "merge", title: "Merge PDF", desc: "Order & stitch documents" },
      { icon: "splitscreen", title: "Split PDF", desc: "Extract target sheets" },
      { icon: "compress", title: "Compress PDF", desc: "Reduce MB size cleanly" },
      { icon: "image", title: "Image to PDF", desc: "Combine pictures to booklet" },
      { icon: "description", title: "Word to PDF", desc: "Preserve text hierarchy" },
      { icon: "document_scanner", title: "OCR PDF", desc: "Make scans searchable" },
      { icon: "swap_vert", title: "Organize PDF", desc: "Drag-and-drop page order" },
      { icon: "rotate_right", title: "Rotate Pages", desc: "Fix inverted scan orientations" },
    ],
    more: [
      { icon: "table_chart", title: "Excel to PDF", desc: "Sheets to printable pages" },
      { icon: "slideshow", title: "PowerPoint to PDF", desc: "One slide per page" },
      { icon: "code", title: "HTML to PDF", desc: "Markup to crisp output" },
      { icon: "text_fields", title: "Text to PDF", desc: "Typeset plain text" },
      { icon: "markdown", title: "Markdown to PDF", desc: "GFM to styled document" },
      { icon: "content_cut", title: "Extract Pages", desc: "Pull ranges into new file" },
      { icon: "delete_sweep", title: "Delete Pages", desc: "Remove unwanted pages" },
      { icon: "post_add", title: "Insert Pages", desc: "Merge one PDF into another" },
      { icon: "grid_view", title: "N-up PDF", desc: "2 or 4 pages per sheet" },
      { icon: "note_add", title: "Add Blank Page", desc: "Insert spacers anywhere" },
      { icon: "line_weight", title: "Linearize PDF", desc: "Fast web-view streams" },
      { icon: "build", title: "Repair PDF", desc: "Rebuild broken xref tables" },
      { icon: "security", title: "Sanitize PDF", desc: "Strip scripts & metadata" },
      { icon: "layers_clear", title: "Flatten PDF", desc: "Bake forms & annotations" },
      { icon: "article", title: "PDF to Word", desc: "Layout or editable DOCX" },
      { icon: "grid_on", title: "PDF to Excel", desc: "Tables to spreadsheets" },
      { icon: "photo_library", title: "PDF to JPG", desc: "Pages to JPG or PNG" },
      { icon: "co_present", title: "PDF to PowerPoint", desc: "Pages to editable slides" },
      { icon: "topic", title: "PDF to Markdown", desc: "GFM for LLM pipelines" },
      { icon: "notes", title: "PDF to Text", desc: "Clean UTF-8 extraction" },
      { icon: "web", title: "PDF to HTML", desc: "Standalone web page" },
    ],
  },
  {
    id: "cat-image",
    icon: "photo_camera",
    accent: "hubimage",
    title: "Image & Media Tools",
    count: 6,
    subtitle: "Compression, resizing and metadata tools that process 100% inside your browser.",
    moreLabel: null,
    gridClass: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    tools: [
      { icon: "compress", title: "Image Compressor", desc: "Shrink PNG, JPG & WebP files" },
      { icon: "aspect_ratio", title: "Image Resizer & Aspect Ratio", desc: "Custom dimension scaling" },
      { icon: "raw_on", title: "Image to Data URI / Base64", desc: "Instant inline code for HTML/CSS" },
      { icon: "colorize", title: "Color Palette Extractor", desc: "HEX/RGB palette from any photo" },
      { icon: "crop_free", title: "Favicon Package Generator", desc: "Outputs 16x16, 32x32, 192x192 icons" },
      { icon: "info", title: "EXIF Metadata Stripper", desc: "Remove GPS location and camera tags" },
    ],
    more: [],
  },
  {
    id: "cat-text",
    icon: "notes",
    accent: "hubtext",
    title: "Text & Writing Tools",
    count: 7,
    subtitle: "Editorial helpers, text cleaners and typography converters, all running live.",
    moreLabel: null,
    gridClass: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    tools: [
      { glyph: "Aa", title: "Case Converter", desc: "camelCase, snake_case, Title Case" },
      { icon: "difference", title: "Side-by-Side Text Diff", desc: "Compare changes line-by-line" },
      { icon: "playlist_remove", title: "Remove Duplicate Lines", desc: "De-duplicate and sort large lists" },
      { glyph: "¶", title: "Lorem Ipsum Generator", desc: "Custom paragraph and word generator" },
      { icon: "markdown", title: "Markdown Live Preview", desc: "Render GFM markdown into HTML" },
      { icon: "space_bar", title: "Invisible Unicode Character", desc: "Copy blank zero-width spaces" },
    ],
    more: [],
  },
];

export const benefits: Benefit[] = [
  {
    icon: "bolt",
    accent: "bolt",
    title: "Fast & Lightweight",
    desc: "Executed natively in WebAssembly and vanilla JavaScript — no server round-trips, results the moment you click.",
    meta: "Real-Time Results",
  },
  {
    icon: "money_off",
    accent: "free",
    title: "100% Free",
    desc: "No arbitrary tier restrictions, no paywalls hiding high-res downloads, and no limit on file passes.",
    meta: "No Paywalls",
  },
  {
    icon: "no_accounts",
    accent: "signup",
    title: "No Signups Required",
    desc: "Drop in, process your document or transform your JSON, and close the tab. No email requests.",
    meta: "Zero Onboarding",
  },
  {
    icon: "enhanced_encryption",
    accent: "privacy",
    title: "Client-Side Privacy",
    desc: "Tool workloads (files, PDFs, code) run inside your browser's memory — nothing is uploaded. The online clipboard relay is the single documented exception.",
    meta: "0-Upload Processing",
  },
  {
    icon: "devices",
    accent: "devices",
    title: "Cross-Device Ready",
    desc: "Fully responsive touch and keyboard targets tailored equally for workstation multi-screens and mobile browsers.",
    meta: "iOS • Android • Desktop",
  },
  {
    icon: "update",
    accent: "grow",
    title: "Constantly Growing",
    desc: "New formatters, converters and utilities are added regularly based on community feedback.",
    meta: "Growing Suite",
  },
];

export const metrics: Metric[] = [
  // NOTE: the tool-count metric is prepended by MetricsStrip from the live
  // registries so the number can never drift from reality.
  { value: "0 KB", label: "Files Uploaded", cls: "m2" },
  { value: "100%", label: "Browser-Side Processing", cls: "m3" },
  { value: "0", label: "Accounts Required", cls: "m4" },
];

export const trendingQueries: string[] = [
  "PDF Merge",
  "Image Compressor",
  "JSON Formatter",
  "Online Clipboard",
  "QR Generator",
  "Password Generator",
  "JWT Decoder",
];

export const footerLinks: FooterColumn[] = [
  {
    heading: "Popular Tools",
    links: [
      { label: "JSON Formatter", href: "/tools/json-formatter" },
      { label: "Merge PDF", href: "/tools/merge-pdf" },
      { label: "Online Clipboard", href: "/tools/online-clipboard" },
      { label: "Regex Tester", href: "/tools/regex-tester" },
      { label: "Compress PDF", href: "/tools/compress-pdf" },
    ],
  },
  {
    heading: "Categories",
    links: [
      { label: "Developer Tools", href: "/developer-tools" },
      { label: "PDF & Document Tools", href: "/tools/pdf" },
      { label: "All Tools", href: "/" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal & Trust",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];
