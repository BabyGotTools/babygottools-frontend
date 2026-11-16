/**
 * Unit tests for the NEW text & image tool engines (Baby Got Tools).
 * Pure functions only — no canvas / wasm / DOM required (vitest node env).
 */
import { describe, expect, it } from "vitest";

import {
  CASE_MODES,
  INVISIBLE_CHARS,
  computeTextStats,
  convertCase,
  generateLorem,
  keywordDensity,
  removeDuplicateLines,
  scanInvisibleChars,
  type CaseMode,
} from "@/features/text-tools/engines/textEngines";

import {
  FAVICON_SIZES,
  MAX_FILE_BYTES,
  buildIco,
  bytesToLabel,
  rgbToHsl,
  validateImageFile,
} from "@/features/image-tools/engines/imageEngine";

/* ============================ case converter ============================ */

describe("case converter", () => {
  const base = "hello world example";

  it("exposes exactly 12 modes with unique labels", () => {
    expect(CASE_MODES).toHaveLength(12);
    expect(new Set(CASE_MODES.map((m) => m.label)).size).toBe(12);
  });

  it("matches every mode's documented example", () => {
    for (const mode of CASE_MODES) {
      expect(convertCase(base, mode.value), `mode ${mode.value}`).toBe(mode.example);
    }
  });

  it("handles accents and mixed separators", () => {
    expect(convertCase("Héllo Wörld-Example", "camel")).toBe("hélloWörldExample");
    expect(convertCase("Héllo Wörld-Example", "snake")).toBe("héllo_wörld_example");
    expect(convertCase("Héllo Wörld-Example", "constant")).toBe("HÉLLO_WÖRLD_EXAMPLE");
  });

  it("title case keeps connector words lowercase after the first word", () => {
    expect(convertCase("the lord of the rings", "title")).toBe("The Lord of the Rings");
  });

  it("sentence case capitalizes after punctuation", () => {
    expect(convertCase("hi there. how are you? fine! ok", "sentence")).toBe("Hi there. How are you? Fine! Ok");
  });

  it("alternating restarts per word and skips punctuation", () => {
    expect(convertCase("ab, cd", "alternating")).toBe("aB, cD");
  });

  it("inverse swaps existing case", () => {
    expect(convertCase("Hello World", "inverse")).toBe("hELLO wORLD");
  });

  it("returns empty string for empty input", () => {
    for (const mode of CASE_MODES.map((m) => m.value) as CaseMode[]) {
      expect(convertCase("", mode)).toBe("");
    }
  });
});

/* ======================== remove duplicate lines ======================== */

describe("remove duplicate lines", () => {
  const defaults = { ignoreCase: false, trim: false, removeEmpty: false, sort: false, sortDesc: false };

  it("drops exact duplicates and reports stats", () => {
    const result = removeDuplicateLines("apple\nbanana\napple\ncherry\nbanana\napple", defaults);
    expect(result.output).toBe("apple\nbanana\ncherry");
    expect(result.stats).toEqual({ original: 6, unique: 3, removed: 3 });
  });

  it("supports case-insensitive matching", () => {
    const result = removeDuplicateLines("Apple\nAPPLE\napple\nApricot", { ...defaults, ignoreCase: true });
    expect(result.output).toBe("Apple\nApricot");
    expect(result.stats.removed).toBe(2);
  });

  it("trims lines before comparing when trim is enabled", () => {
    const result = removeDuplicateLines("  apple  \napple\n\tapple", { ...defaults, trim: true });
    expect(result.output).toBe("apple");
  });

  it("removes empty lines when requested", () => {
    const result = removeDuplicateLines("a\n\nb\n\n\nc", { ...defaults, removeEmpty: true });
    expect(result.output).toBe("a\nb\nc");
  });

  it("sorts ascending and descending (numeric aware)", () => {
    const input = "item10\nitem2\nitem1";
    expect(removeDuplicateLines(input, { ...defaults, sort: true }).output).toBe("item1\nitem2\nitem10");
    expect(removeDuplicateLines(input, { ...defaults, sort: true, sortDesc: true }).output).toBe("item10\nitem2\nitem1");
  });

  it("does not count a trailing newline as a phantom line", () => {
    const result = removeDuplicateLines("a\nb\n", defaults);
    expect(result.stats.original).toBe(2);
    expect(result.output).toBe("a\nb");
  });
});

/* ============================== lorem ipsum ============================== */

describe("lorem ipsum generator", () => {
  it("produces exactly N words", () => {
    const words = generateLorem({ unit: "words", count: 12, classicStart: false }).split(/\s+/);
    expect(words).toHaveLength(12);
    expect(words.every((w) => /^[a-z]+$/.test(w))).toBe(true);
  });

  it("classicStart keeps the word count intact while opening canonically", () => {
    const out = generateLorem({ unit: "words", count: 10, classicStart: true });
    expect(out.split(/\s+/)).toHaveLength(10);
    expect(out.toLowerCase()).toContain("lorem ipsum dolor");
  });

  it("produces N sentences, optionally opening canonically", () => {
    const out = generateLorem({ unit: "sentences", count: 4, classicStart: true });
    const sentences = out.match(/[.!?]+/g)?.length ?? 0;
    expect(sentences).toBe(4);
    expect(out.startsWith("Lorem ipsum dolor sit amet")).toBe(true);
  });

  it("produces N double-newline-separated paragraphs", () => {
    const out = generateLorem({ unit: "paragraphs", count: 3, classicStart: false });
    expect(out.split("\n\n")).toHaveLength(3);
  });

  it("clamps absurd counts to the allowed maxima", () => {
    const out = generateLorem({ unit: "paragraphs", count: 99999, classicStart: false });
    expect(out.split("\n\n")).toHaveLength(50);
  });
});

/* ===================== invisible unicode characters ===================== */

describe("invisible unicode scanner", () => {
  const zwsp = "\u200B";
  const zwnj = "\u200C";

  it("counts each tracked character and reports the total", () => {
    const input = `a${zwsp}${zwsp}b${zwnj}c`;
    const result = scanInvisibleChars(input);
    expect(result.total).toBe(3);
    const byCode = new Map(result.counts.map((c) => [c.info.codepoint, c.count]));
    expect(byCode.get("U+200B")).toBe(2);
    expect(byCode.get("U+200C")).toBe(1);
  });

  it("strips tracked characters including NBSP lookalikes", () => {
    const result = scanInvisibleChars(`hello${zwsp} world${"\u00A0"}!`);
    expect(result.cleaned).toBe("hello world!");
    expect(result.total).toBe(2); // ZWSP + NBSP
  });

  it("returns zero counts for clean text", () => {
    const result = scanInvisibleChars("perfectly normal text");
    expect(result.total).toBe(0);
    expect(result.counts).toHaveLength(0);
  });

  it("tracks a known catalogue of dangerous invisibles (incl. RLM)", () => {
    expect(INVISIBLE_CHARS.some((c) => c.codepoint === "U+200F")).toBe(true); // RTL mark
    expect(INVISIBLE_CHARS.some((c) => c.codepoint === "U+FEFF")).toBe(true); // BOM
  });
});

/* ============================ text statistics ============================ */

describe("text statistics", () => {
  const stats = computeTextStats("Hello world. This is a test.\n\nSecond paragraph here.");

  it("counts characters, words and unique words", () => {
    expect(stats.words).toBe(9); // Hello world This is a test Second paragraph here
    expect(stats.uniqueWords).toBe(9);
    expect(stats.characters).toBe("Hello world. This is a test.\n\nSecond paragraph here.".length);
    expect(stats.charactersNoSpaces).toBe(stats.characters - 9); // 9 single spaces
  });

  it("counts sentences, paragraphs and lines", () => {
    expect(stats.sentences).toBe(3); // "Hello world." + "This is a test." + "Second paragraph here."
    expect(stats.paragraphs).toBe(2);
    expect(stats.lines).toBe(3);
  });

  it("formats reading/speaking time for wordy text", () => {
    const wordy = computeTextStats(Array.from({ length: 450 }, () => "word").join(" "));
    expect(wordy.readingTime).toBe("2m"); // 450 words ≈ 2 min at 225 wpm
  });

  it("handles empty input gracefully", () => {
    const empty = computeTextStats("");
    expect(empty.words).toBe(0);
    expect(empty.lines).toBe(0);
    expect(empty.avgWordLength).toBe(0);
  });
});

describe("keyword density", () => {
  it("ranks repeated words with correct density", () => {
    const result = keywordDensity("lorem lorem lorem ipsum dolor sit amet", 6);
    expect(result[0]).toEqual({ word: "lorem", count: 3, density: 42.9 }); // 3/7 words
  });

  it("ignores stopwords and 1–2 letter words", () => {
    const result = keywordDensity("the cat and the dog of it", 6);
    expect(result.map((r) => r.word)).not.toContain("the");
    expect(result.map((r) => r.word)).not.toContain("it");
  });

  it("returns an empty array for empty input", () => {
    expect(keywordDensity("")).toEqual([]);
  });
});

/* ============================ image engine (pure) ============================ */

describe("image engine helpers", () => {
  it("formats byte sizes human-readably", () => {
    expect(bytesToLabel(0)).toBe("0 B");
    expect(bytesToLabel(1023)).toBe("1023 B");
    expect(bytesToLabel(1024)).toBe("1.0 KB");
    expect(bytesToLabel(1536)).toBe("1.5 KB");
    expect(bytesToLabel(5 * 1024 * 1024)).toBe("5.00 MB");
  });

  it("accepts supported image files", () => {
    const png = new File([new Uint8Array(8)], "a.png", { type: "image/png" });
    const svg = new File([new Uint8Array(8)], "a.svg", { type: "image/svg+xml" });
    expect(validateImageFile(png)).toBeNull();
    expect(validateImageFile(svg)).toBeNull();
  });

  it("rejects empty, oversized and unsupported files", () => {
    expect(validateImageFile(new File([new Uint8Array(0)], "empty.png", { type: "image/png" }))).toMatch(/empty/i);

    const big = new File([new ArrayBuffer(8)], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: MAX_FILE_BYTES + 1 });
    expect(validateImageFile(big)).toMatch(/limit/);

    const exe = new File([new ArrayBuffer(8)], "evil.exe", { type: "application/octet-stream" });
    expect(validateImageFile(exe)).toMatch(/Unsupported file type/);
  });

  it("converts RGB to HSL correctly", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl(0, 0, 255)).toEqual({ h: 240, s: 100, l: 50 });
    expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 100 });
    expect(rgbToHsl(128, 128, 128).s).toBe(0);
  });

  it("defines the full favicon size ladder", () => {
    const sizes = FAVICON_SIZES.map((s) => s.size);
    expect(sizes).toEqual([16, 32, 48, 96, 180, 192, 512]);
    for (const spec of FAVICON_SIZES) expect(spec.label).toMatch(/\.png$/);
  });
});

describe("buildIco (.ico container)", () => {
  it("writes a valid ICONDIR + ICONDIRENTRY layout for PNG payloads", async () => {
    const pngA = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    const pngB = new Blob([new Uint8Array([5, 6, 7, 8, 9, 10])], { type: "image/png" });
    const ico = await buildIco([
      { size: 16, blob: pngA },
      { size: 32, blob: pngB },
    ]);

    const bytes = new Uint8Array(await ico.arrayBuffer());
    const view = new DataView(bytes.buffer);

    // ICONDIR: reserved=0, type=1 (icon), count=2
    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);

    // Entry 0: 16×16, payload 4 bytes at offset 6 + 2*16 = 38
    expect(view.getUint8(6)).toBe(16);
    expect(view.getUint8(7)).toBe(16);
    expect(view.getUint32(6 + 8, true)).toBe(4);
    expect(view.getUint32(6 + 12, true)).toBe(38);
    expect([...bytes.slice(38, 42)]).toEqual([1, 2, 3, 4]);

    // Entry 1: payload 6 bytes directly after entry 0
    expect(view.getUint32(6 + 16 + 8, true)).toBe(6);
    expect(view.getUint32(6 + 16 + 12, true)).toBe(42);
    expect([...bytes.slice(42, 48)]).toEqual([5, 6, 7, 8, 9, 10]);

    // Total length = 6 + 2*16 + 4 + 6 = 48
    expect(bytes.length).toBe(48);
  });

  it("encodes 256px entries as 0 (ICO spec)", async () => {
    const png = new Blob([new Uint8Array([9])], { type: "image/png" });
    const ico = await buildIco([{ size: 256, blob: png }]);
    const view = new DataView(await ico.arrayBuffer());
    expect(view.getUint8(6)).toBe(0);
    expect(view.getUint8(7)).toBe(0);
  });
});
