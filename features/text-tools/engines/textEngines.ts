/**
 * Text & Writing tools engines — pure string processing, zero dependencies.
 * Every function is deterministic and safe to run in the browser sandbox.
 */

/* ----------------------------- case converter ----------------------------- */

export type CaseMode =
  | "upper"
  | "lower"
  | "title"
  | "sentence"
  | "camel"
  | "pascal"
  | "snake"
  | "kebab"
  | "constant"
  | "dot"
  | "alternating"
  | "inverse";

export const CASE_MODES: { value: CaseMode; label: string; example: string }[] = [
  { value: "upper", label: "UPPER CASE", example: "HELLO WORLD EXAMPLE" },
  { value: "lower", label: "lower case", example: "hello world example" },
  { value: "title", label: "Title Case", example: "Hello World Example" },
  { value: "sentence", label: "Sentence case", example: "Hello world example" },
  { value: "camel", label: "camelCase", example: "helloWorldExample" },
  { value: "pascal", label: "PascalCase", example: "HelloWorldExample" },
  { value: "snake", label: "snake_case", example: "hello_world_example" },
  { value: "kebab", label: "kebab-case", example: "hello-world-example" },
  { value: "constant", label: "CONSTANT_CASE", example: "HELLO_WORLD_EXAMPLE" },
  { value: "dot", label: "dot.case", example: "hello.world.example" },
  { value: "alternating", label: "aLtErNaTiNg", example: "hElLo wOrLd eXaMpLe" },
  { value: "inverse", label: "iNVERSE CASE", example: "HELLO WORLD EXAMPLE" },
];

/** Split text into alphanumeric word tokens (accents included). */
function tokenize(text: string): string[] {
  const matches = text.match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)?/gu);
  return matches ?? [];
}

/** Uppercase the first letter of every word except small connector words. */
const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "if", "in", "nor", "of", "on", "or", "per", "the", "to", "vs", "via",
]);

export function convertCase(input: string, mode: CaseMode): string {
  if (input.length === 0) return "";
  switch (mode) {
    case "upper":
      return input.toUpperCase();
    case "lower":
      return input.toLowerCase();
    case "title": {
      // Preserve line structure: title-case each line independently.
      return input
        .split("\n")
        .map((line) =>
          tokenize(line)
            .map((w, i) => {
              const lower = w.toLowerCase();
              if (i > 0 && SMALL_WORDS.has(lower)) return lower;
              return lower.charAt(0).toUpperCase() + lower.slice(1);
            })
            .join(" ")
        )
        .join("\n");
    }
    case "sentence": {
      return input
        .toLowerCase()
        .replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_m, prefix: string, letter: string) => prefix + letter.toUpperCase());
    }
    case "camel": {
      const words = tokenize(input).map((w) => w.toLowerCase());
      if (words.length === 0) return input.toLowerCase();
      return words[0] + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    }
    case "pascal": {
      const words = tokenize(input).map((w) => w.toLowerCase());
      if (words.length === 0) return input;
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    }
    case "snake":
      return tokenize(input).map((w) => w.toLowerCase()).join("_") || input.toLowerCase();
    case "kebab":
      return tokenize(input).map((w) => w.toLowerCase()).join("-") || input.toLowerCase();
    case "constant":
      return tokenize(input).map((w) => w.toUpperCase()).join("_") || input.toUpperCase();
    case "dot":
      return tokenize(input).map((w) => w.toLowerCase()).join(".") || input.toLowerCase();
    case "alternating": {
      // aLtErNaTiNg restarts per word (matches the documented example chip).
      return input.replace(/\p{L}+/gu, (word) => {
        let index = 0;
        return word.replace(/\p{L}/gu, (letter) => (index++ % 2 === 0 ? letter.toLowerCase() : letter.toUpperCase()));
      });
    }
    case "inverse": {
      let out = "";
      for (const ch of input) {
        const lower = ch.toLowerCase();
        const upper = ch.toUpperCase();
        out += ch === lower && ch !== upper ? upper : lower;
      }
      return out;
    }
  }
}

/* --------------------------- remove duplicate lines --------------------------- */

export interface DedupeOptions {
  /** Compare lines case-insensitively. */
  ignoreCase: boolean;
  /** Trim leading/trailing whitespace before comparing (trims output too). */
  trim: boolean;
  /** Drop empty lines entirely. */
  removeEmpty: boolean;
  /** Sort the unique result alphabetically (natural-aware, locale compare). */
  sort: boolean;
  /** Sort direction when `sort` is enabled. */
  sortDesc: boolean;
}

export interface DedupeResult {
  output: string;
  stats: { original: number; unique: number; removed: number };
}

export function removeDuplicateLines(input: string, opts: DedupeOptions): DedupeResult {
  const originalLines = input.split("\n");
  // A trailing newline produces a phantom final "" line — drop it from input stats.
  const lines = originalLines.length > 1 && originalLines[originalLines.length - 1] === "" ? originalLines.slice(0, -1) : originalLines;

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of lines) {
    const line = opts.trim ? raw.trim() : raw;
    if (opts.removeEmpty && line.trim().length === 0) continue;
    const key = opts.ignoreCase ? line.toLowerCase() : line;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }

  if (opts.sort) {
    unique.sort((a, b) => {
      const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      return opts.sortDesc ? -cmp : cmp;
    });
  }

  return {
    output: unique.join("\n"),
    stats: { original: lines.length, unique: unique.length, removed: lines.length - unique.length },
  };
}

/* ----------------------------- lorem ipsum ----------------------------- */

const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do", "eiusmod", "tempor",
  "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo", "consequat", "duis", "aute", "irure",
  "in", "reprehenderit", "voluptate", "velit", "esse", "cillum", "eu", "fugiat", "nulla", "pariatur", "excepteur",
  "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia", "deserunt", "mollit", "anim",
  "id", "est", "laborum", "curabitur", "pretium", "tincidunt", "lacus", "nulla", "gravida", "orci", "a", "odio",
  "nullam", "varius", "turpis", "commodo", "condimentum", "luctus", "nec", "ullamcorper", "mattis", "pulvinar",
  "dapibus", "leo", "vivamus", "elementum", "semper", "nisi", "suspendisse", "potenti", "maecenas", "faucibus",
  "interdum", "posuere", "cubilia", "curae", "praesent", "sodales", "ligula", "suscipit", "metus", "auctor",
];

const LOREM_OPENING =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

function randomWords(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)].toLowerCase());
  }
  return out;
}

function sentence(minWords = 6, maxWords = 18): string {
  const count = minWords + Math.floor(Math.random() * (maxWords - minWords + 1));
  const words = randomWords(count);
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

export type LoremUnit = "paragraphs" | "sentences" | "words";

export interface LoremOptions {
  unit: LoremUnit;
  count: number;
  /** Begin the output with the canonical "Lorem ipsum dolor sit amet…" opening. */
  classicStart: boolean;
}

export function generateLorem(opts: LoremOptions): string {
  const count = Math.max(1, Math.min(opts.unit === "paragraphs" ? 50 : opts.unit === "sentences" ? 200 : 5000, opts.count));

  if (opts.unit === "words") {
    let words = randomWords(count);
    if (opts.classicStart) {
      const opener = LOREM_OPENING.replace(/[,.]/g, "").toLowerCase().split(" ");
      words = [...opener, ...words.slice(Math.min(opener.length, words.length))];
      words = words.slice(0, count);
    }
    return words.join(" ");
  }

  if (opts.unit === "sentences") {
    const sentences: string[] = [];
    for (let i = 0; i < count; i++) {
      if (i === 0 && opts.classicStart) sentences.push(LOREM_OPENING);
      else sentences.push(sentence());
    }
    return sentences.join(" ");
  }

  // paragraphs: 4–7 sentences per paragraph.
  const paragraphs: string[] = [];
  for (let i = 0; i < count; i++) {
    const parts: string[] = [];
    if (i === 0 && opts.classicStart) {
      parts.push(LOREM_OPENING);
      parts.push(sentence());
    } else {
      const n = 4 + Math.floor(Math.random() * 4);
      for (let s = 0; s < n; s++) parts.push(sentence());
    }
    paragraphs.push(parts.join(" "));
  }
  return paragraphs.join("\n\n");
}

/* ------------------------- invisible unicode characters ------------------------- */

export interface InvisibleChar {
  name: string;
  char: string;
  codepoint: string;
  desc: string;
}

export const INVISIBLE_CHARS: InvisibleChar[] = [
  { name: "Zero-Width Space", char: "\u200B", codepoint: "U+200B", desc: "Suggests a break opportunity without visible space — common in scraped/spun text." },
  { name: "Zero-Width Non-Joiner", char: "\u200C", codepoint: "U+200C", desc: "Prevents ligature joining in scripts like Arabic and Devanagari." },
  { name: "Zero-Width Joiner", char: "\u200D", codepoint: "U+200D", desc: "Joins characters into ligatures/emoji sequences; abused for invisible identifiers." },
  { name: "Word Joiner", char: "\u2060", codepoint: "U+2060", desc: "Invisible glue that prevents line breaks between words." },
  { name: "No-Break Space", char: "\u00A0", codepoint: "U+00A0", desc: "Space that forbids line wrapping — looks identical to a normal space." },
  { name: "BOM / ZWNBSP", char: "\uFEFF", codepoint: "U+FEFF", desc: "Byte-order mark; invisible garbage when it appears mid-text." },
  { name: "Left-to-Right Mark", char: "\u200E", codepoint: "U+200E", desc: "Invisible directionality control." },
  { name: "Right-to-Left Mark", char: "\u200F", codepoint: "U+200F", desc: "Invisible directionality control; can flip rendering order around it." },
  { name: "Braille Blank", char: "\u2800", codepoint: "U+2800", desc: "Blank braille pattern — a visible-width character that looks empty." },
  { name: "Hangul Filler", char: "\u3164", codepoint: "U+3164", desc: "Unfilled Hangul letter that renders as blank space." },
];

export interface InvisibleScanResult {
  /** Per-character occurrences of each tracked invisible char. */
  counts: { info: InvisibleChar; count: number }[];
  total: number;
  /** Copy of the input with the tracked invisible characters removed. */
  cleaned: string;
}

export function scanInvisibleChars(input: string): InvisibleScanResult {
  const counts = INVISIBLE_CHARS.map((info) => ({
    info,
    count: input.split("").filter((c) => c === info.char).length,
  })).filter((c) => c.count > 0);
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const tracked = new Set(INVISIBLE_CHARS.map((c) => c.char));
  // BOM/ZWNBSP and the fixed-width lookalikes are stripped; regular spaces stay.
  const cleaned = input
    .split("")
    .filter((c) => !tracked.has(c))
    .join("");
  return { counts, total, cleaned };
}

/* ------------------------------ text statistics ------------------------------ */

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  uniqueWords: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingTime: string;
  speakingTime: string;
  avgWordLength: number;
  avgSentenceLength: number;
}

export function computeTextStats(input: string): TextStats {
  const characters = input.length;
  const charactersNoSpaces = input.replace(/\s/g, "").length;
  const wordList = tokenize(input);
  const words = wordList.length;
  const uniqueWords = new Set(wordList.map((w) => w.toLowerCase())).size;

  const sentenceList = input.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  const sentences = sentenceList.length;
  const paragraphs = input.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const lines = input.length === 0 ? 0 : input.split("\n").length;

  const readingSeconds = (words / 225) * 60; // average silent reading ≈ 225 wpm
  const speakingSeconds = (words / 130) * 60; // average presentation speaking ≈ 130 wpm
  const fmt = (seconds: number) => {
    if (words === 0) return "0s";
    if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
    const minutes = Math.floor(seconds / 60);
    const rem = Math.round(seconds % 60);
    return rem > 0 ? `${minutes}m ${rem}s` : `${minutes}m`;
  };

  return {
    characters,
    charactersNoSpaces,
    words,
    uniqueWords,
    sentences,
    paragraphs,
    lines,
    readingTime: fmt(readingSeconds),
    speakingTime: fmt(speakingSeconds),
    avgWordLength: words > 0 ? Number((charactersNoSpaces / words).toFixed(1)) : 0,
    avgSentenceLength: sentences > 0 ? Number((words / sentences).toFixed(1)) : 0,
  };
}

export interface KeywordStat {
  word: string;
  count: number;
  density: number; // percent of total words
}

export function keywordDensity(input: string, topN = 6): KeywordStat[] {
  const words = tokenize(input).map((w) => w.toLowerCase());
  if (words.length === 0) return [];
  const stop = new Set([
    "the", "and", "a", "to", "of", "in", "is", "it", "you", "that", "was", "for", "on", "are", "with", "as", "this",
    "be", "at", "or", "from", "but", "not", "have", "has", "had", "your", "they", "we", "an", "by", "i", "s", "t",
  ]);
  const counts = new Map<string, number>();
  for (const w of words) {
    if (stop.has(w) || w.length < 3) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count, density: Number(((count / words.length) * 100).toFixed(1)) }));
}
