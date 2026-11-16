/**
 * Text & Writing tools registry — mirrors the DevTool registry shape so the
 * shared ToolPageShell renders these pages identically to developer tools.
 */

import type {
  AccentTone,
  DevTool,
  HeroMetric,
  RelatedTool,
  ToolBadge,
  ToolCapability,
  ToolFaq,
  ToolHeroChip,
} from "./devToolTypes";

const pulseChip = (label: string): ToolHeroChip => ({ label, style: "pulse" });
const strongChip = (label = "100% Client-Side"): ToolHeroChip => ({ label, style: "strong" });
const softChip = (label = "Zero Data Retention"): ToolHeroChip => ({ label, style: "soft" });

const defaultHeroMetrics = (): HeroMetric[] => [
  { label: "Engine Latency", value: "0.00 ms", live: true },
  { label: "Security Sandboxing", value: "Isolated RAM", lock: true },
];

const privacyFaqs = (subject: string): ToolFaq[] => [
  {
    q: "Is my data confidential & secure?",
    a: `Yes, completely. ${subject} is never transmitted to a server — every transformation is executed inside your own browser sandbox and nothing is logged.`,
  },
  {
    q: "Does it work offline?",
    a: "Yes. Once the page has loaded, the tool keeps working fully offline. You can verify this from your browser's Network panel — zero requests are dispatched while you work.",
  },
];

const defaultCapabilities = (): ToolCapability[] => [
  {
    title: "100% Local Execution",
    icon: "shield",
    iconTone: "secondary" as AccentTone,
    desc: "Everything runs inside your browser sandbox using standard web APIs. Nothing is uploaded, logged, or retained.",
    metaLabel: "Network Isolation",
    metaValue: "Air-gapped",
    metaTone: "tertiary" as AccentTone,
  },
  {
    title: "Instant Feedback",
    icon: "speed",
    iconTone: "primary" as AccentTone,
    desc: "Results render as you type with sub-millisecond latency and clear, actionable error messages.",
    metaLabel: "Responsiveness",
    metaValue: "Real-time",
    metaTone: "secondary" as AccentTone,
  },
  {
    title: "Dead-Simple Export",
    icon: "download",
    iconTone: "tertiary" as AccentTone,
    desc: "One-click copy to clipboard and file downloads with meaningful names and correct MIME types.",
    metaLabel: "Transfer",
    metaValue: "Blob APIs",
    metaTone: "secondary" as AccentTone,
  },
  {
    title: "Keyboard First",
    icon: "keyboard",
    iconTone: "primary" as AccentTone,
    desc: "Full keyboard reachability with visible focus states, following the platform-wide design language.",
    metaLabel: "Accessibility",
    metaValue: "Keyboard-First",
    metaTone: "secondary" as AccentTone,
  },
];

const rel = (slug: string, title: string, subtitle: string, icon: string, iconTone: AccentTone): RelatedTool => ({
  slug,
  title,
  subtitle,
  icon,
  iconTone,
});

export const textTools: DevTool[] = [
  {
    slug: "case-converter",
    title: "Case Converter",
    desc: "camelCase, snake_case, Title Case and nine more transforms.",
    heroDesc:
      "Convert text between twelve case styles — UPPER, lower, Title, Sentence, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, dot.case, aLtErNaTiNg and iNVERSE — instantly as you type, with word-aware handling that keeps acronyms and accents intact.",
    icon: "text_fields",
    accent: "primary",
    category: "text",
    popularity: 91,
    tags: ["case", "converter", "uppercase", "camelcase", "snake", "kebab", "title"],
    badges: [{ label: "Instant", tone: "tertiary" }],
    heroChips: [pulseChip("12 Transforms"), strongChip(), softChip()],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "Word-Aware Parsing",
        icon: "match_case",
        iconTone: "primary",
        desc: "camelCase and Title Case splits use Unicode word boundaries (\\p{L}\\p{N}) so accented words and numbers tokenize correctly.",
        metaLabel: "Tokenizer",
        metaValue: "Unicode",
        metaTone: "secondary",
      },
      {
        title: "Title Case Small Words",
        icon: "text_fields",
        iconTone: "secondary",
        desc: "Connector words like “a”, “of”, “the” stay lowercase mid-title per editorial style rules — first words always capitalize.",
        metaLabel: "Style",
        metaValue: "Editorial",
        metaTone: "primary",
      },
      {
        title: "Line Structure Preserved",
        icon: "format_line_spacing",
        iconTone: "tertiary",
        desc: "Multi-line input keeps its line breaks — every line is converted independently, never flattened.",
        metaLabel: "Layout",
        metaValue: "Preserved",
        metaTone: "secondary",
      },
      defaultCapabilities()[0],
    ],
    related: [
      rel("word-counter", "Word Counter", "Live text statistics", "analytics", "primary"),
      rel("remove-duplicate-lines", "Duplicate Remover", "De-duplicate lists", "playlist_remove", "secondary"),
      rel("lorem-ipsum-generator", "Lorem Ipsum", "Placeholder text", "article", "tertiary"),
    ],
    faqHeading: "Working With the Case Converter",
    faqs: [
      ...privacyFaqs("Your text"),
      {
        q: "Which case styles are supported?",
        a: "Twelve: UPPER CASE, lower case, Title Case, Sentence case, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, dot.case, aLtErNaTiNg case and iNVERSE case.",
      },
      {
        q: "Will my acronyms survive camelCase conversion?",
        a: "Acronyms are lower-cased as words (e.g. “HTML parser” becomes htmlParser). The tokenizer treats every letter/number run as one word, so punctuation and spacing are normalized away — that's what makes the output valid identifiers.",
      },
    ],
    sample: "the quick brown fox jumps over the lazy dog",
  },

  {
    slug: "word-counter",
    title: "Word & Character Counter",
    desc: "Real-time character count, word totals, speaking time, and keyword densities.",
    heroDesc:
      "Live character, word, sentence, paragraph and line totals — plus reading/speaking time estimates, average lengths and a keyword-density breakdown for SEO copy checks. All stats update as you type, entirely in your browser.",
    icon: "analytics",
    accent: "secondary",
    category: "text",
    popularity: 93,
    tags: ["word count", "character count", "reading time", "speaking", "keyword density", "seo"],
    badges: [{ label: "Instant Stats", tone: "secondary" }],
    heroChips: [pulseChip("Live Stats"), strongChip(), softChip()],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "True Word Tokenization",
        icon: "match_case",
        iconTone: "primary",
        desc: "Words are counted with Unicode word boundaries, so “don’t” is one word and CJK/accented text counts correctly.",
        metaLabel: "Tokenizer",
        metaValue: "Unicode",
        metaTone: "secondary",
      },
      {
        title: "Reading & Speaking Time",
        icon: "schedule",
        iconTone: "secondary",
        desc: "Estimated at 225 wpm silent reading and 130 wpm presentation speaking — the standard copywriting benchmarks.",
        metaLabel: "Benchmarks",
        metaValue: "225/130 wpm",
        metaTone: "primary",
      },
      {
        title: "Keyword Density Report",
        icon: "query_stats",
        iconTone: "tertiary",
        desc: "Top keywords with percentage density, common stop-words excluded — ideal for SEO copy review.",
        metaLabel: "Analysis",
        metaValue: "Top 6",
        metaTone: "secondary",
      },
      defaultCapabilities()[0],
    ],
    related: [
      rel("case-converter", "Case Converter", "Twelve case styles", "text_fields", "primary"),
      rel("markdown-live-preview", "Markdown Preview", "Render GFM live", "markdown", "secondary"),
      rel("remove-duplicate-lines", "Duplicate Remover", "De-duplicate lists", "playlist_remove", "secondary"),
    ],
    faqHeading: "Working With the Word Counter",
    faqs: [
      ...privacyFaqs("Your text"),
      {
        q: "How are reading and speaking times calculated?",
        a: "Silent reading uses 225 words per minute (the widely cited adult average) and speaking uses 130 wpm (a comfortable presentation pace). Both are estimates — real pacing varies by content and audience.",
      },
      {
        q: "What counts as a word?",
        a: "Any maximal run of letters or numbers. Em-dashes, slashes and emoji separators are ignored, which matches how most word processors count.",
      },
    ],
    sample:
      "Paste an essay, blog post or product description here. The counter updates every stat instantly — characters, words, sentences, reading time and keyword density.",
  },

  {
    slug: "text-diff",
    title: "Side-by-Side Text Diff",
    desc: "Compare changes line-by-line with instant highlighting.",
    heroDesc:
      "Compare two texts and see added, removed and unchanged lines highlighted side-by-side. The classic Myers diff algorithm runs locally, so even long documents compare in milliseconds without leaving your browser.",
    icon: "difference",
    accent: "tertiary",
    category: "text",
    popularity: 89,
    tags: ["diff", "compare", "text", "side-by-side", "changes"],
    badges: [{ label: "Myers Diff", tone: "engine" }],
    heroChips: [pulseChip("Myers Engine"), strongChip(), softChip()],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "Word-Level Precision",
        icon: "center_focus_strong",
        iconTone: "primary",
        desc: "Character and word granularity pinpoints exactly which parts of a changed line differ, not just that the line changed.",
        metaLabel: "Granularity",
        metaValue: "3 levels",
        metaTone: "secondary",
      },
      {
        title: "Change Statistics",
        icon: "query_stats",
        iconTone: "tertiary",
        desc: "Live added/removed/unchanged counters summarize the edit distance between the two inputs.",
        metaLabel: "Report",
        metaValue: "4 metrics",
        metaTone: "secondary",
      },
      {
        title: "Ignore-Case Compare",
        icon: "match_case",
        iconTone: "secondary",
        desc: "Optionally normalize case before diffing so capitalization tweaks don't drown out real edits.",
        metaLabel: "Sensitivity",
        metaValue: "Optional",
        metaTone: "primary",
      },
      defaultCapabilities()[0],
    ],
    related: [
      rel("diff-checker", "Diff Checker", "Developer diff view", "compare_arrows", "primary"),
      rel("json-compare", "JSON Compare", "Structural JSON diff", "data_object", "secondary"),
      rel("remove-duplicate-lines", "Duplicate Remover", "List cleanup", "playlist_remove", "tertiary"),
    ],
    faqHeading: "Working With the Text Diff",
    faqs: [
      ...privacyFaqs("Both texts"),
      {
        q: "How large can the texts be?",
        a: "Line-level diffs comfortably handle documents with thousands of lines. Word and character granularity are O(n·m), so for very large files prefer the line view.",
      },
      {
        q: "Is this the same engine as the Diff Checker?",
        a: "Yes — both use the same Myers diff implementation. This tool presents it side-by-side for prose and copy editing; the Diff Checker is tuned for code with per-token highlighting.",
      },
    ],
    sample: "",
  },

  {
    slug: "remove-duplicate-lines",
    title: "Remove Duplicate Lines",
    desc: "De-duplicate and sort large lists with live statistics.",
    heroDesc:
      "Strip duplicate lines from any list — with case-insensitive matching, whitespace trimming, empty-line removal and natural-aware sorting. A live report shows exactly how many lines were removed, so you always know what happened to your data.",
    icon: "playlist_remove",
    accent: "secondary",
    category: "text",
    popularity: 85,
    tags: ["duplicate", "dedupe", "unique", "lines", "sort", "list", "clean"],
    badges: [{ label: "List Cleaner", tone: "secondary" }],
    heroChips: [pulseChip("Set-Based Engine"), strongChip(), softChip()],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "Case-Insensitive Mode",
        icon: "match_case",
        iconTone: "primary",
        desc: "Treat “Apple” and “apple” as duplicates when enabled — perfect for cleaning email lists or tag clouds.",
        metaLabel: "Matching",
        metaValue: "Optional",
        metaTone: "secondary",
      },
      {
        title: "Natural-Aware Sorting",
        icon: "sort",
        iconTone: "secondary",
        desc: "Numeric suffixes sort in human order (item2 before item10) using locale-aware natural comparison.",
        metaLabel: "Order",
        metaValue: "Natural",
        metaTone: "primary",
      },
      {
        title: "Removal Report",
        icon: "inventory",
        iconTone: "tertiary",
        desc: "Original count, unique count and removed count update live so the transformation is never silent.",
        metaLabel: "Transparency",
        metaValue: "3 metrics",
        metaTone: "primary",
      },
      defaultCapabilities()[0],
    ],
    related: [
      rel("case-converter", "Case Converter", "Normalize casing first", "text_fields", "primary"),
      rel("text-diff", "Text Diff", "See what changed", "difference", "secondary"),
      rel("word-counter", "Word Counter", "List statistics", "analytics", "tertiary"),
    ],
    faqHeading: "Working With the Duplicate Remover",
    faqs: [
      ...privacyFaqs("Your lists"),
      {
        q: "Which line endings are handled?",
        a: "Windows (CRLF) and Unix (LF) line endings both work — carriage returns are stripped automatically so mixed-origin files dedupe correctly.",
      },
      {
        q: "Does it keep the first or last occurrence?",
        a: "The first occurrence is kept, in the original order — unless sorting is enabled, which reorders the unique set alphabetically (natural-aware).",
      },
    ],
    sample: "apple\nBanana\napple\ncherry\nbanana\napple\ncherry\ndate",
  },

  {
    slug: "lorem-ipsum-generator",
    title: "Lorem Ipsum Generator",
    desc: "Custom paragraph, sentence and word generators.",
    heroDesc:
      "Generate classic Lorem ipsum placeholder text by paragraphs, sentences or word count — with the canonical “Lorem ipsum dolor sit amet…” opening, ready for wireframes, mockups and CMS placeholder content.",
    icon: "article",
    accent: "tertiary",
    category: "text",
    popularity: 78,
    tags: ["lorem", "ipsum", "placeholder", "dummy text", "wireframe"],
    badges: [{ label: "Generator", tone: "tertiary" }],
    heroChips: [pulseChip("Instant Generate"), strongChip(), softChip()],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "Three Units",
        icon: "layers",
        iconTone: "tertiary",
        desc: "Generate by paragraphs (4–7 sentences each), individual sentences, or an exact word count.",
        metaLabel: "Granularity",
        metaValue: "3 units",
        metaTone: "secondary",
      },
      {
        title: "Classic Opening",
        icon: "format_quote",
        iconTone: "primary",
        desc: "Optionally start the output with the traditional “Lorem ipsum dolor sit amet…” phrase like real design fixtures.",
        metaLabel: "Style",
        metaValue: "Authentic",
        metaTone: "primary",
      },
      {
        title: "Punctuation Safe",
        icon: "spellcheck",
        iconTone: "secondary",
        desc: "Sentences are properly capitalized and punctuated, so generated copy looks production-ready in layouts.",
        metaLabel: "Quality",
        metaValue: "Proofed",
        metaTone: "secondary",
      },
      defaultCapabilities()[0],
    ],
    related: [
      rel("word-counter", "Word Counter", "Check the length", "analytics", "primary"),
      rel("case-converter", "Case Converter", "Normalize placeholder text", "text_fields", "secondary"),
    ],
    faqHeading: "Working With the Lorem Ipsum Generator",
    faqs: [
      ...privacyFaqs("Generated text"),
      {
        q: "What is Lorem ipsum?",
        a: "A scrambled excerpt from Cicero's “De Finibus Bonorum et Malorum” (45 BC), used as standard dummy text in typesetting since the 1500s. It has a natural letter distribution that makes layouts look realistic.",
      },
      {
        q: "How long can the output be?",
        a: "Up to 50 paragraphs, 200 sentences, or 5,000 words per generation — enough for any wireframe, and it regenerates instantly.",
      },
    ],
  },

  {
    slug: "markdown-live-preview",
    title: "Markdown Live Preview",
    desc: "Render GFM markdown into HTML as you type.",
    heroDesc:
      "Write GitHub-flavored Markdown and watch it render into sanitized HTML instantly — headings, tables, code blocks with highlighting, task lists and more. The preview runs in a sandboxed iframe; raw markup can never execute on this page.",
    icon: "markdown",
    accent: "primary",
    category: "text",
    popularity: 88,
    tags: ["markdown", "gfm", "preview", "html", "editor", "renderer"],
    badges: [{ label: "Live Preview", tone: "engine" }],
    heroChips: [pulseChip("GFM Engine"), strongChip("Sanitized Output"), softChip()],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "GitHub-Flavored Markdown",
        icon: "code",
        iconTone: "primary",
        desc: "Tables, task lists, strikethrough, autolinks and fenced code blocks render exactly like a GitHub README.",
        metaLabel: "Spec",
        metaValue: "GFM",
        metaTone: "secondary",
      },
      {
        title: "Sanitized HTML",
        icon: "security",
        iconTone: "tertiary",
        desc: "Every render passes through DOMPurify, so pasted <script> or onerror attributes are stripped before display.",
        metaLabel: "Safety",
        metaValue: "Enforced",
        metaTone: "tertiary",
      },
      {
        title: "Syntax Highlighting",
        icon: "palette",
        iconTone: "secondary",
        desc: "Fenced code blocks are highlighted with highlight.js across 190+ languages.",
        metaLabel: "Languages",
        metaValue: "190+",
        metaTone: "primary",
      },
      defaultCapabilities()[0],
    ],
    related: [
      rel("markdown-to-pdf", "Markdown to PDF", "Turn markdown into documents", "picture_as_pdf", "primary"),
      rel("html-viewer", "HTML Viewer", "Inspect rendered markup", "html", "secondary"),
    ],
    relatedHeading: "Related Tools",
    faqHeading: "Working With the Markdown Preview",
    faqs: [
      ...privacyFaqs("Your markdown"),
      {
        q: "Which Markdown flavor is supported?",
        a: "GitHub-flavored Markdown (GFM): tables, task lists, strikethrough, autolinks, fenced code blocks with language hints, and standard CommonMark syntax.",
      },
      {
        q: "Can I paste untrusted markdown?",
        a: "Yes. The rendered HTML is sanitized with DOMPurify and displayed in a sandboxed iframe — scripts, event handlers and dangerous URLs never execute.",
      },
    ],
    sample:
      "# Hello, writer\n\nThis is a **live preview**. Edit the left pane and the right pane updates instantly.\n\n- [x] supports task lists\n- [ ] and tables\n\n| Feature | Status |\n| --- | --- |\n| Tables | ✓ |\n| Code | `inline` |\n\n```js\nconst hello = \"world\";\n```",
  },

  {
    slug: "invisible-unicode-character",
    title: "Invisible Unicode Character",
    desc: "Copy blank zero-width spaces and invisible characters.",
    heroDesc:
      "Copy invisible Unicode characters — zero-width space, zero-width joiner, word joiner, blank braille and more — for usernames, game chats, formatting tricks and blank messages. Each character ships with its codepoint and a note on what it actually does, plus a scanner to verify your paste worked.",
    icon: "visibility_off",
    accent: "error",
    category: "text",
    popularity: 76,
    tags: ["invisible", "zero-width", "blank", "unicode", "empty text", "character"],
    badges: [{ label: "Copy & Paste", tone: "neutral" }],
    heroChips: [pulseChip("10 Characters"), strongChip("Documented Effects"), softChip()],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "Ten Curated Characters",
        icon: "format_shapes",
        iconTone: "primary",
        desc: "Every character is listed with its exact codepoint and real-world behavior — no mystery glyphs.",
        metaLabel: "Catalog",
        metaValue: "10 chars",
        metaTone: "secondary",
      },
      {
        title: "Paste Verifier",
        icon: "content_paste_search",
        iconTone: "secondary",
        desc: "Paste any text to count hidden characters inside it — confirm a copy actually captured the invisible glyph.",
        metaLabel: "Verification",
        metaValue: "Built-in",
        metaTone: "primary",
      },
      {
        title: "Cleanup Tool",
        icon: "cleaning_services",
        iconTone: "tertiary",
        desc: "Strip the tracked invisible characters out of pasted text in one click when you need the opposite operation.",
        metaLabel: "Utility",
        metaValue: "One-click",
        metaTone: "secondary",
      },
      defaultCapabilities()[0],
    ],
    related: [
      rel("unicode-text-inspector", "Unicode Inspector", "Full codepoint breakdown", "format_shapes", "primary"),
      rel("unicode-security-inspector", "Security Inspector", "Detect hidden chars & spoofing", "visibility_off", "secondary"),
    ],
    relatedHeading: "Related Tools",
    faqHeading: "Working With Invisible Characters",
    faqs: [
      ...privacyFaqs("Your text"),
      {
        q: "Which invisible character should I use?",
        a: "For a “blank” username or message, the zero-width space (U+200B) or braille blank (U+2800, renders with width) are the most common. Some platforms strip zero-width characters — the paste verifier tells you instantly whether yours survived.",
      },
      {
        q: "Are invisible characters dangerous?",
        a: "They can be, when used maliciously — hidden identifiers and spoofed text are real attack vectors. That's why the Unicode Security Inspector exists; use these characters knowingly, and scan anything you receive from others.",
      },
    ],
  },
];
