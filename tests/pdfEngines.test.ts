/** PDF & Document Tools engine tests — pure functions only (vitest runs in node). */

import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { computeNUpPlacement, mmToPoints, nUpOrderMatters, parsePageRanges, PAPER_SIZES, type PagesPerSheet } from "@/features/pdf-tools/engines/pageMath";
import { paginateLines, wrapText } from "@/features/pdf-tools/engines/textWrap";
import { baseNameOf, fitContain, formatBytes, outputName, resolvePageDimensions } from "@/features/pdf-tools/engines/convertShared";
import { checkOfficeFile, checkPdfFile, checkTextishFile, sniffSignature, totalBytesTooLarge } from "@/features/pdf-tools/engines/validation";
import { bundleZip, extensionOf } from "@/features/pdf-tools/engines/zip";
import { computeStats, describeSavings, toOverallProgress } from "@/features/pdf-tools/engines/optimizeUtils";
import { sanitizeCss } from "@/features/pdf-tools/engines/sanitizeHtmlEngine";

/* --------------------------------- page math -------------------------------- */

describe("pageMath — parsePageRanges", () => {
  it("parses ranges into zero-based ascending indices", () => {
    expect(parsePageRanges("1-3, 5, 7-9", 10)).toEqual([0, 1, 2, 4, 6, 7, 8]);
  });

  it("normalizes out-of-order input", () => {
    expect(parsePageRanges("5,1,3", 10)).toEqual([0, 2, 4]);
  });

  it("clamps to the document page count and deduplicates", () => {
    expect(parsePageRanges("1,1,2,99", 2)).toEqual([0, 1]);
    expect(parsePageRanges("4-99", 4)).toEqual([3]);
  });

  it("skips malformed segments instead of throwing", () => {
    expect(parsePageRanges("abc, ,3-1-9,--2,2", 5)).toEqual([1]);
  });

  it("returns [] for empty documents or empty input", () => {
    expect(parsePageRanges("1-3", 0)).toEqual([]);
    expect(parsePageRanges("", 5)).toEqual([]);
  });
});

describe("pageMath — N-up placement", () => {
  it("horizontal 4-up fills rows left-to-right", () => {
    const cells = computeNUpPlacement(4, "horizontal", 4);
    expect(cells.map((c) => [c.col, c.row, c.pageIndex])).toEqual([
      [0, 0, 0],
      [1, 0, 1],
      [0, 1, 2],
      [1, 1, 3],
    ]);
  });

  it("vertical 4-up fills columns top-to-bottom", () => {
    const cells = computeNUpPlacement(4, "vertical", 4);
    expect(cells.map((c) => [c.col, c.row, c.pageIndex])).toEqual([
      [0, 0, 0],
      [0, 1, 1],
      [1, 0, 2],
      [1, 1, 3],
    ]);
  });

  it("2-up is identical for both orders (single row) and order doesn't matter", () => {
    expect(nUpOrderMatters(2)).toBe(false);
    const horizontal = computeNUpPlacement(2, "horizontal", 4).map((c) => c.pageIndex);
    const vertical = computeNUpPlacement(2, "vertical", 4).map((c) => c.pageIndex);
    expect(horizontal).toEqual(vertical);
    expect(nUpOrderMatters(4)).toBe(true);
  });

  it("wraps pages onto successive sheets", () => {
    const cells = computeNUpPlacement(2, "horizontal", 5);
    expect(cells).toHaveLength(5);
    expect(cells[4]).toMatchObject({ col: 0, row: 0 }); // second sheet, first cell
  });

  it("rejects unsupported pages-per-sheet values", () => {
    expect(() => computeNUpPlacement(3 as unknown as PagesPerSheet, "horizontal", 1)).toThrow(/Unsupported/);
  });

  it("converts millimeters to PostScript points", () => {
    expect(mmToPoints(25.4)).toBeCloseTo(72, 5);
    expect(mmToPoints(0)).toBe(0);
  });

  it("exposes labeled paper sizes", () => {
    expect(PAPER_SIZES.a4.label).toBe("A4");
    expect(PAPER_SIZES.letter.width).toBe(612);
  });
});

/* ---------------------------------- text wrap -------------------------------- */

describe("textWrap — wrapText", () => {
  const measure = (value: string) => value.length; // synthetic measurer

  it("wraps words at the width boundary", () => {
    const lines = wrapText("alpha bravo charlie", 11, measure);
    expect(lines).toEqual(["alpha bravo", "charlie"]);
  });

  it("breaks single words longer than the line", () => {
    const lines = wrapText("extraordinarily", 5, measure);
    expect(lines).toEqual(["extra", "ordin", "arily"]);
  });

  it("keeps paragraph breaks and drops trailing blanks", () => {
    const lines = wrapText("one two\n\nthree\n", 8, measure);
    expect(lines).toEqual(["one two", "", "three"]);
  });

  it("expands tabs to spaces (collapsed by word splitting)", () => {
    expect(wrapText("a\tb", 4, measure)).toEqual(["a b"]);
  });

  it("always returns at least one line", () => {
    expect(wrapText("", 10, measure)).toEqual([""]);
  });
});

describe("textWrap — paginateLines", () => {
  it("chunks lines into even pages and preserves content", () => {
    const pages = paginateLines(["a", "b", "c", "d", "e"], 1, 2);
    expect(pages.map((page) => page.length)).toEqual([2, 2, 1]);
    expect(pages.flat()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("deals with degenerate dimensions", () => {
    expect(paginateLines(["x"], 0, 0)).toEqual([["x"]]);
    expect(paginateLines([], 10, 10)).toEqual([[""]]);
  });
});

/* -------------------------------- convertShared ------------------------------ */

describe("convertShared", () => {
  it("fitContain preserves aspect and never exceeds the box", () => {
    expect(fitContain(100, 50, 200, 100)).toEqual({ width: 100, height: 50 });
    expect(fitContain(100, 100, 400, 200)).toEqual({ width: 100, height: 50 });
    expect(fitContain(50, 100, 100, 100)).toEqual({ width: 50, height: 50 });
  });

  it("fitContain rejects degenerate images", () => {
    expect(fitContain(100, 100, 0, 0)).toEqual({ width: 0, height: 0 });
  });

  it("formatBytes stays human-readable", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });

  it("baseNameOf/outputName strip paths and add the extension", () => {
    expect(baseNameOf("C:\\docs\\report.final.pdf")).toBe("report.final");
    expect(baseNameOf("no-extension")).toBe("no-extension");
    expect(outputName("report")).toBe("report.pdf");
  });

  it("resolvePageDimensions applies orientation swaps", () => {
    expect(resolvePageDimensions("a4", "portrait")).toEqual({ width: 595.28, height: 841.89 });
    expect(resolvePageDimensions("a4", "landscape")).toEqual({ width: 841.89, height: 595.28 });
    expect(resolvePageDimensions("auto", "portrait", { width: 800, height: 600 })).toEqual({
      width: 600,
      height: 800,
    });
    expect(resolvePageDimensions("auto", "landscape", { width: 600, height: 800 })).toEqual({
      width: 800,
      height: 600,
    });
  });
});

/* --------------------------------- validation -------------------------------- */

const bytes = (...values: number[]) => Uint8Array.from(values);
const utf8 = (text: string) => new TextEncoder().encode(text);
const fakeFile = (name: string, size: number) => ({ name, size }) as Pick<File, "name" | "size">;

describe("validation — magic-byte sniffing", () => {
  it("recognizes real signatures", () => {
    expect(sniffSignature(utf8("%PDF-1.7 …"))).toBe("pdf");
    expect(sniffSignature(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(sniffSignature(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffSignature(bytes(0x50, 0x4b, 0x03, 0x04), "x.docx")).toBe("ooxml");
    expect(sniffSignature(bytes(0x50, 0x4b, 0x03, 0x04), "x.zip")).toBe("zip");
    expect(sniffSignature(utf8("plain ascii text file"))).toBe("text");
  });

  it("refuses renamed binaries — extension lies are ignored", () => {
    const exe = bytes(0x4d, 0x5a, 0x90, 0x00);
    expect(sniffSignature(exe, "totally-a-pdf.pdf")).toBe("unknown");
    expect(checkPdfFile(fakeFile("invoice.pdf", 1000), exe)).toMatchObject({ ok: false, kind: "unknown" });
  });

  it("checkPdfFile enforces the 250MB cap and the %PDF signature", () => {
    expect(checkPdfFile(fakeFile("big.pdf", 251 * 1024 * 1024), utf8("%PDF-1.7"))).toMatchObject({ ok: false });
    expect(checkPdfFile(fakeFile("big.pdf", 1000), utf8("%PDF-1.7"))).toMatchObject({ ok: true, kind: "pdf" });
    expect(checkPdfFile(fakeFile("fake.pdf", 1000), utf8("PK-ZIP-CONTENTS"))).toMatchObject({ ok: false });
  });

  it("checkOfficeFile separates OOXML from generic zip and legacy binaries", () => {
    expect(checkOfficeFile(fakeFile("a.docx", 10), bytes(0x50, 0x4b, 0x03, 0x04))).toMatchObject({ ok: true });
    expect(checkOfficeFile(fakeFile("a.zip", 10), bytes(0x50, 0x4b, 0x03, 0x04)).reason).toContain("generic ZIP");
    expect(checkOfficeFile(fakeFile("a.doc", 10), utf8("legacy CFB binary"))).toMatchObject({ ok: false });
    expect(checkOfficeFile(fakeFile("a.doc", 10), utf8("legacy CFB binary")).reason).toContain("docx");
  });

  it("checkTextishFile rejects binary payloads", () => {
    expect(checkTextishFile(fakeFile("a.txt", 10), utf8("hello world"))).toMatchObject({ ok: true });
    expect(checkTextishFile(fakeFile("a.txt", 10), bytes(0x00, 0x01, 0x02, 0x03))).toMatchObject({ ok: false });
  });

  it("totalBytesTooLarge guards the in-memory budget", () => {
    expect(totalBytesTooLarge(499 * 1024 * 1024)).toBe(false);
    expect(totalBytesTooLarge(501 * 1024 * 1024)).toBe(true);
  });
});

/* ------------------------------------ zip ------------------------------------ */

describe("zip bundler", () => {
  it("produces a real zip container with deduplicated entry names", () => {
    const zip = bundleZip([
      { name: "page-1.pdf", bytes: utf8("one") },
      { name: "page-1.pdf", bytes: utf8("two") },
    ]);
    const magic = zip.slice(0, 4);
    expect([...magic]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    // fflate listing is deterministic; verify by re-unzipping.
    const opened = unzipSync(zip);
    expect(Object.keys(opened).sort()).toEqual(["page-1 (1).pdf", "page-1.pdf"]);
    expect(new TextDecoder().decode(opened["page-1.pdf"])).toBe("one");
    expect(new TextDecoder().decode(opened["page-1 (1).pdf"])).toBe("two");
  });

  it("extensionOf handles paths and dotfiles", () => {
    expect(extensionOf("a/b/c.PDF")).toBe("pdf");
    expect(extensionOf(".gitignore")).toBe("");
    expect(extensionOf("plain")).toBe("");
  });
});

/* ------------------------------- optimize utils ------------------------------ */

describe("optimizeUtils", () => {
  it("computeStats reports honest savings", () => {
    const stats = computeStats(1000, 400);
    expect(stats).toEqual({ originalSize: 1000, outputSize: 400, bytesSaved: 600, percentSaved: 60 });
    expect(computeStats(0, 0).percentSaved).toBe(0);
  });

  it("describeSavings never dresses up growth as success", () => {
    const good = describeSavings(computeStats(1000, 400));
    expect(good.tone).toBe("good");
    const neutral = describeSavings(computeStats(1000, 1000));
    expect(neutral.headline).toBe("No size change");
    const warn = describeSavings(computeStats(1000, 1200));
    expect(warn.tone).toBe("warn");
    expect(warn.headline).toContain("larger");
  });

  it("toOverallProgress maps phases onto fixed monotonic spans", () => {
    expect(toOverallProgress({ phase: "reading", percent: 100 })).toBe(5);
    expect(toOverallProgress({ phase: "analyzing", percent: 0 })).toBe(5);
    expect(toOverallProgress({ phase: "rebuilding", percent: 50 })).toBe(50);
    expect(toOverallProgress({ phase: "writing", percent: 0 })).toBe(85);
    expect(toOverallProgress({ phase: "writing", percent: 100 })).toBe(100);
    expect(toOverallProgress({ phase: "done", percent: 0 })).toBe(100);
  });
});

/* ------------------------------- sanitize (CSS) ------------------------------ */

describe("sanitizeCss", () => {
  it("strips @import, remote url() and expression() from authored CSS", () => {
    const dirty = "@import url(https://evil.example/x.css); body { color: red; background: url('//evil/x.png') } .x { width: expression(alert(1)) }";
    const clean = sanitizeCss(dirty);
    expect(clean).not.toContain("@import");
    expect(clean).not.toContain("evil");
    expect(clean).not.toContain("expression(");
    expect(clean).toContain("body");
  });

  it("removes </style breakout attempts", () => {
    expect(sanitizeCss("</style><script>alert(1)</script>")).not.toContain("</style");
  });

  it("keeps local data-uri gradients intact", () => {
    const css = "body { background: linear-gradient(red, blue); color: green }";
    expect(sanitizeCss(css)).toContain("linear-gradient(red, blue)");
  });
});
