/**
 * Ported from the i love pdf project (src/lib/convertFrom/pdfTextExtractor.test.ts)
 * — imports redirected to the ported engine module in features/pdf-tools.
 * The pdfToImageUtils dependency is mocked through its alias-resolved path.
 */
import { describe, expect, it, vi } from "vitest";
import {
  SCANNED_PDF_MESSAGE,
} from "@/features/pdf-tools/engines/convertFrom/convertFromUtils";
import {
  extractPdfText,
  extractTextFromDocument,
  groupTextItemsIntoLines,
} from "@/features/pdf-tools/engines/convertFrom/pdfTextExtractor";

vi.mock("@/features/pdf-tools/engines/convertFrom/pdfToImageUtils", () => ({
  loadPdfDocument: vi.fn(),
}));

import { loadPdfDocument } from "@/features/pdf-tools/engines/convertFrom/pdfToImageUtils";

interface Item {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

function item(
  str: string,
  x: number,
  y: number,
  width = str.length * 5,
  height = 10
): Item {
  return { str, transform: [1, 0, 0, 1, x, y], width, height };
}

function fakePage(items: Item[], cleanup = vi.fn()) {
  return {
    getTextContent: vi.fn(async () => ({ items })),
    cleanup,
  };
}

function fakePdf(pages: Item[][]) {
  const cleanup = vi.fn();
  return {
    numPages: pages.length,
    getPage: vi.fn(async (pageNumber: number) => {
      const page = pages[pageNumber - 1];
      if (!page) throw new Error(`Missing page ${pageNumber}`);
      return fakePage(page, cleanup);
    }),
    destroy: vi.fn(async () => undefined),
    cleanup,
  };
}

describe("groupTextItemsIntoLines", () => {
  it("sorts lines top-to-bottom and runs left-to-right", () => {
    const lines = groupTextItemsIntoLines([
      item("second", 10, 50),
      item("world", 60, 100),
      item("first", 10, 100),
    ]);

    expect(lines.map((line) => line.text)).toEqual(["first world", "second"]);
  });

  it("inserts a space only for a visible gap", () => {
    const tight = groupTextItemsIntoLines([
      item("Hello", 10, 100, 20),
      item("world", 30, 100, 25),
    ]);
    expect(tight[0].text).toBe("Helloworld");

    const spaced = groupTextItemsIntoLines([
      item("Hello", 10, 100, 20),
      item("world", 40, 100, 25),
    ]);
    expect(spaced[0].text).toBe("Hello world");
  });

  it("clusters runs with slightly different baselines", () => {
    const lines = groupTextItemsIntoLines([
      item("Hello", 10, 100),
      item("world", 40, 98),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("Hello world");
  });

  it("filters blank runs and keeps the largest font size", () => {
    const lines = groupTextItemsIntoLines([
      item("", 10, 100),
      item("Title", 10, 100, 40, 24),
      item("subtitle", 55, 100, 40, 9),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].fontSize).toBe(24);
  });
});

describe("extractTextFromDocument", () => {
  it("joins pages, tracks empty pages, and reports progress", async () => {
    const pdf = fakePdf([
      [item("Hello", 10, 100)],
      [],
      [item("Third page", 10, 100)],
    ]);
    const progress = vi.fn();

    const result = await extractTextFromDocument(pdf as never, [0, 1, 2], {
      onPageProgress: progress,
    });

    expect(result.text).toBe("Hello\n\nThird page");
    expect(result.emptyPages).toEqual([2]);
    expect(result.totalChars).toBe("Hello".length + "Thirdpage".length);
    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3]);
    expect(progress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(pdf.cleanup).toHaveBeenCalledTimes(3);
  });

  it("rejoins words hyphenated across a line break", async () => {
    const pdf = fakePdf([
      [item("inter-", 10, 100), item("national", 10, 80)],
    ]);

    const result = await extractTextFromDocument(pdf as never, [0], {
      preserveLineBreaks: true,
    });
    expect(result.text).toBe("international");
  });

  it("uses spaces instead of line breaks when requested", async () => {
    const pdf = fakePdf([
      [item("inter-", 10, 100), item("national", 10, 80)],
    ]);

    const result = await extractTextFromDocument(pdf as never, [0], {
      preserveLineBreaks: false,
    });
    expect(result.text).toBe("inter- national");
  });
});

describe("extractPdfText", () => {
  it("throws the shared scanned-PDF error when no text is found", async () => {
    const pdf = fakePdf([[]]);
    vi.mocked(loadPdfDocument).mockResolvedValueOnce(pdf as never);

    await expect(extractPdfText(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      SCANNED_PDF_MESSAGE
    );
    expect(pdf.destroy).toHaveBeenCalled();
  });

  it("honours the page range and always destroys the document", async () => {
    const pdf = fakePdf([
      [item("one", 10, 100)],
      [item("two", 10, 100)],
      [item("three", 10, 100)],
    ]);
    vi.mocked(loadPdfDocument).mockResolvedValueOnce(pdf as never);

    const result = await extractPdfText(new Uint8Array([1, 2, 3]), {
      pageRange: "2",
    });

    expect(result.text).toBe("two");
    expect(result.pages.map((page) => page.pageNumber)).toEqual([2]);
    expect(pdf.destroy).toHaveBeenCalled();
  });

  it("rejects an empty page selection", async () => {
    const pdf = fakePdf([[item("one", 10, 100)]]);
    vi.mocked(loadPdfDocument).mockResolvedValueOnce(pdf as never);

    await expect(
      extractPdfText(new Uint8Array([1]), { pageRange: "9" })
    ).rejects.toThrow("No pages matched");
    expect(pdf.destroy).toHaveBeenCalled();
  });
});
