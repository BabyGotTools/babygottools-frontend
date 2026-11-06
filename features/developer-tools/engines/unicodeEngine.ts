/**
 * Unicode inspection engine: grapheme segmentation, code points, UTF-8 bytes,
 * invisible/control-character radar and a cleaned-output sanitizer.
 */

export interface CharInfo {
  /** Visually rendered grapheme (may span several code points). */
  grapheme: string;
  graphemeIndex: number;
  /** Code points inside the grapheme with their details. */
  codePoints: CodePointInfo[];
  /** True when any contained code point is invisible/controlled. */
  hidden: boolean;
}

export interface CodePointInfo {
  codePoint: number;
  hex: string;
  char: string;
  utf8: number[];
  utf16Units: number;
  name: string;
  invisible: boolean;
  control: boolean;
  surrogate: boolean;
}

const NAMED_CONTROLS: Record<number, string> = {
  0: "NULL (NUL)",
  7: "BELL (BEL)",
  8: "BACKSPACE (BS)",
  9: "CHARACTER TABULATION (TAB)",
  10: "LINE FEED (LF)",
  11: "LINE TABULATION (VT)",
  12: "FORM FEED (FF)",
  13: "CARRIAGE RETURN (CR)",
  27: "ESCAPE (ESC)",
  127: "DELETE (DEL)",
};

const INVISIBLE_SET = new Set<number>([
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2060, 0x2061, 0x2062, 0x2063,
  0x2064, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff, 0x180e, 0x061c, 0x00ad,
]);

const WHITESPACE_VISIBLE_ONLY = new Set<number>([0x20, 0x09, 0x0a, 0x0d]);

function escapeName(offset: number): string {
  if (NAMED_CONTROLS[offset]) return NAMED_CONTROLS[offset]!;
  if (INVISIBLE_SET.has(offset)) {
    return invisibleLabel(offset);
  }
  // Common ranges fallback (no full name tables in browsers)
  const block = blockName(offset);
  return `${block} U+${offset.toString(16).toUpperCase().padStart(4, "0")}`;
}

function invisibleLabel(cp: number): string {
  const map: Record<number, string> = {
    0x200b: "ZERO WIDTH SPACE",
    0x200c: "ZERO WIDTH NON-JOINER",
    0x200d: "ZERO WIDTH JOINER",
    0x200e: "LEFT-TO-RIGHT MARK",
    0x200f: "RIGHT-TO-LEFT MARK",
    0x202a: "LEFT-TO-RIGHT EMBEDDING",
    0x202b: "RIGHT-TO-LEFT EMBEDDING",
    0x202c: "POP DIRECTIONAL FORMATTING",
    0x202d: "LEFT-TO-RIGHT OVERRIDE",
    0x202e: "RIGHT-TO-LEFT OVERRIDE",
    0x2060: "WORD JOINER",
    0x2066: "LEFT-TO-RIGHT ISOLATE",
    0x2067: "RIGHT-TO-LEFT ISOLATE",
    0x2068: "FIRST STRONG ISOLATE",
    0x2069: "POP DIRECTIONAL ISOLATE",
    0xfeff: "ZERO WIDTH NO-BREAK SPACE (BOM)",
    0x180e: "MONGOLIAN VOWEL SEPARATOR",
    0x061c: "ARABIC LETTER MARK",
    0x00ad: "SOFT HYPHEN",
    0x2061: "FUNCTION APPLICATION",
    0x2062: "INVISIBLE TIMES",
    0x2063: "INVISIBLE SEPARATOR",
    0x2064: "INVISIBLE PLUS",
  };
  const label = map[cp];
  if (label) return label;
  return `INVISIBLE/CONTROL U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

function blockName(cp: number): string {
  const blocks: [number, string][] = [
    [0x30, "ASCII digits region"],
    [0x41, "ASCII letters region (Basic Latin)"],
    [0x80, "Latin-1 Supplement"],
    [0x100, "Latin Extended-A"],
    [0x370, "Greek and Coptic"],
    [0x400, "Cyrillic"],
    [0x590, "Hebrew"],
    [0x600, "Arabic"],
    [0x900, "Devanagari"],
    [0xe00, "Thai"],
    [0x1100, "Hangul Jamo"],
    [0x2000, "General Punctuation"],
    [0x2070, "Superscripts / subscripts"],
    [0x20a0, "Currency Symbols"],
    [0x2190, "Arrows"],
    [0x25a0, "Geometric shapes"],
    [0x3000, "CJK Symbols and Punctuation"],
    [0x4e00, "CJK Unified Ideographs"],
    [0xac00, "Hangul Syllables"],
    [0xdc00, "Low surrogates (private encoding area)"],
    [0xd800, "High surrogates"],
    [0xe000, "Private Use Area"],
    [0x1f300, "Emoji & Symbols (Misc Symbols and Pictographs)"],
    [0x1f600, "Emoticons (Emoji)"],
    [0x10000, "Astral plane (SMP)"],
  ];
  let name = "Unassigned / other";
  for (const [start, label] of blocks) {
    if (cp >= start) name = label;
  }
  return name;
}

function codePointName(start: number, isPair: boolean): string {
  if (isPair) return `Astral code point U+${start.toString(16).toUpperCase()} (surrogate pair)`;
  return escapeName(start);
}

function utf8Bytes(cp: number): number[] {
  if (cp <= 0x7f) return [cp];
  if (cp <= 0x7ff) return [0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)];
  if (cp <= 0xffff) return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)];
  return [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)];
}

function codePointInfoAt(text: string, index: number): { info: CodePointInfo; next: number } {
  const char = text[index]!;
  const hi = char.codePointAt(0)!;
  const isSurrogateStart = hi >= 0xd800 && hi <= 0xdbff;

  let cp: number;
  let width: number;
  if (isSurrogateStart && index + 1 < text.length) {
    const lo = text[index + 1]!.codePointAt(0)!;
    if (lo >= 0xdc00 && lo <= 0xdfff) {
      cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      width = 2;
    } else {
      cp = hi;
      width = 1;
    }
  } else {
    cp = hi;
    width = 1;
  }

  const control = cp < 0x20 || (cp >= 0x7f && cp < 0xa0);
  const invisible = INVISIBLE_SET.has(cp) || (control && !WHITESPACE_VISIBLE_ONLY.has(cp));
  const info: CodePointInfo = {
    codePoint: cp,
    hex: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
    char: cp > 0x1f && cp !== 0x7f ? text.slice(index, index + width) : "",
    utf8: utf8Bytes(cp),
    utf16Units: width,
    name: codePointName(cp, width === 2),
    invisible,
    control,
    surrogate: isSurrogateStart,
  };
  return { info, next: index + width };
}

export interface UnicodeReport {
  graphemes: CharInfo[];
  codePointCount: number;
  utf16Count: number;
  utf8Bytes: number;
  hiddenCount: number;
}

export function inspectUnicode(text: string): UnicodeReport {
  const graphemes: CharInfo[] = [];
  const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

  let graphemeIndex = 0;
  if (segmenter) {
    for (const seg of segmenter.segment(text) as Iterable<{ segment: string; index: number }>) {
      const cps: CodePointInfo[] = [];
      let i = 0;
      let hidden = false;
      while (i < seg.segment.length) {
        const { info, next } = codePointInfoAt(seg.segment, i);
        cps.push(info);
        if (info.invisible) hidden = true;
        i = next;
      }
      graphemes.push({ grapheme: seg.segment, graphemeIndex: graphemeIndex++, codePoints: cps, hidden });
    }
  } else {
    for (let i = 0; i < text.length; ) {
      const { info, next } = codePointInfoAt(text, i);
      graphemes.push({ grapheme: text.slice(i, next), graphemeIndex: graphemeIndex++, codePoints: [info], hidden: info.invisible });
      i = next;
    }
  }

  const codePointCount = [...text].length;
  const utf8Count = utf8ByteCount(text);
  return {
    graphemes,
    codePointCount,
    utf16Count: text.length,
    utf8Bytes: utf8Count,
    hiddenCount: graphemes.reduce((n, g) => n + (g.hidden ? 1 : 0), 0),
  };
}

export function utf8ByteCount(text: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
  let bytes = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of text) bytes++;
  return bytes;
}

/** Remove invisible & control characters (keeps normal whitespace). */
export function sanitizeHidden(text: string): { cleaned: string; removed: number } {
  let removed = 0;
  let out = "";
  for (let i = 0; i < text.length; ) {
    const { info, next } = codePointInfoAt(text, i);
    if (info.invisible) removed++;
    else out += text.slice(i, next);
    i = next;
  }
  return { cleaned: out, removed };
}

/* ---------------------------- confusables watch --------------------------- */

const CONFUSABLES: Record<string, string> = {
  "а": "Cyrillic а (looks like Latin a)",
  "е": "Cyrillic е (looks like Latin e)",
  "о": "Cyrillic о (looks like Latin o)",
  "р": "Cyrillic р (looks like Latin p)",
  "с": "Cyrillic с (looks like Latin c)",
  "х": "Cyrillic х (looks like Latin x)",
  "у": "Cyrillic у (looks like Latin y)",
  "і": "Cyrillic і (looks like Latin i)",
  "ѕ": "Cyrillic ѕ (looks like Latin s)",
  "ο": "Greek omicron (looks like Latin o)",
  "ɑ": "Latin alpha (looks like Latin a)",
  "﻿": "BOM/zero-width no-break space",
};

export interface HomoglyphHit {
  grapheme: string;
  note: string;
  /** UTF-16 index of the first occurrence. */
  index: number;
  /** Consecutive-run length (positions stayed grouped). */
  count: number;
}

export function homoglyphScan(text: string): HomoglyphHit[] {
  const hits: HomoglyphHit[] = [];
  // Code-point walk so indices stay aligned across surrogate pairs.
  let index = 0;
  for (const ch of text) {
    const note = CONFUSABLES[ch];
    if (note) {
      const last = hits[hits.length - 1];
      if (last && last.grapheme === ch && last.index + last.count === index) {
        last.count += 1;
      } else {
        hits.push({ grapheme: ch, note, index, count: 1 });
      }
    }
    index += ch.length;
  }
  return hits;
}
