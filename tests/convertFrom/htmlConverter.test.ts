/**
 * Ported from the i love pdf project (src/lib/convertFrom/htmlConverter.test.ts)
 * — imports redirected to the ported engine module in features/pdf-tools.
 */
import { describe, expect, it, vi } from "vitest";
import type { HtmlFromPdfOptions } from "@/features/pdf-tools/engines/convertFrom/convertFromTypes";
import { SCANNED_PDF_MESSAGE } from "@/features/pdf-tools/engines/convertFrom/convertFromUtils";
import { convertPdfToHtml } from "@/features/pdf-tools/engines/convertFrom/htmlConverter";
import type { TextLayerReport } from "@/features/pdf-tools/engines/convertFrom/pdfToImageUtils";

const textLayer: TextLayerReport = {
  hasText: true,
  totalChars: 100,
  pagesWithText: 2,
  sampledPages: 2,
  pageCount: 2,
};

const options: HtmlFromPdfOptions = {
  includePageNumbers: true,
  includeCitation: true,
};

function deps(
  convertPDFToHTML: ReturnType<typeof vi.fn>,
  layer: TextLayerReport = textLayer
) {
  return {
    detectTextLayer: vi.fn(async () => layer),
    loadExtractPdf: vi.fn(
      async () =>
        ({ convertPDFToHTML }) as unknown as typeof import("extract-pdf")
    ),
  };
}

describe("convertPdfToHtml", () => {
  it("rejects scanned PDFs before loading extract-pdf", async () => {
    const convert = vi.fn();
    const dependencies = deps(convert, {
      ...textLayer,
      hasText: false,
      totalChars: 0,
      pagesWithText: 0,
    });

    await expect(
      convertPdfToHtml(new Uint8Array([1]), options, "scan.pdf", undefined, dependencies)
    ).rejects.toThrow(SCANNED_PDF_MESSAGE);

    expect(dependencies.loadExtractPdf).not.toHaveBeenCalled();
  });

  it("wraps the fragment in a standalone document with a citation", async () => {
    const convert = vi.fn(async () => ({
      html: "<h1>Title</h1><p>Body</p>",
      title: "Doc",
      author: "Ada",
      format: "pdf",
    }));

    const output = await convertPdfToHtml(
      new Uint8Array([1, 2]),
      options,
      "report.pdf",
      undefined,
      deps(convert)
    );

    expect(output.html).toContain("<!doctype html>");
    expect(output.html).toContain("<title>Doc</title>");
    expect(output.html).toContain('<meta name="author" content="Ada"/>');
    expect(output.html).toContain('<header class="pdf-citation">');
    expect(output.html).toContain("<h1>Doc</h1>");
    expect(output.html).toContain("By Ada");
    expect(output.html).toContain("<h1>Title</h1><p>Body</p>");
    expect(output.title).toBe("Doc");
    expect(output.author).toBe("Ada");
    expect(output.warnings).toEqual([]);

    expect(convert).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.objectContaining({
        addPageNumbers: true,
        addCitation: true,
        method: "ts-block-algorithm",
        processor: "frontend",
      })
    );
  });

  it("strips executable and remote-content markup", async () => {
    const convert = vi.fn(async () => ({
      html: [
        "<script>alert(1)</script>",
        "<iframe src='https://example.com'></iframe>",
        "<object data='x'></object>",
        "<embed src='x'>",
        '<p onclick="evil()">Click</p>',
        '<a href="javascript:alert(1)">link</a>',
        "<p>Safe</p>",
      ].join(""),
      title: "Doc",
    }));

    const output = await convertPdfToHtml(
      new Uint8Array([1]),
      options,
      "report.pdf",
      undefined,
      deps(convert)
    );

    expect(output.html).not.toContain("<script");
    expect(output.html).not.toContain("<iframe");
    expect(output.html).not.toContain("<object");
    expect(output.html).not.toContain("<embed");
    expect(output.html).not.toContain("onclick");
    expect(output.html).not.toContain("javascript:");
    expect(output.html).toContain("<p>Safe</p>");
  });

  it("omits the citation when disabled", async () => {
    const convert = vi.fn(async () => ({
      html: "<p>Body</p>",
      title: "Doc",
      author: "Ada",
    }));

    const output = await convertPdfToHtml(
      new Uint8Array([1]),
      { includePageNumbers: false, includeCitation: false },
      "report.pdf",
      undefined,
      deps(convert)
    );

    expect(output.html).not.toContain('<header class="pdf-citation">');
    expect(output.html).not.toContain("By Ada");
    expect(convert).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.objectContaining({ addCitation: false, addPageNumbers: false })
    );
  });

  it("falls back to the source name when the PDF has no title", async () => {
    const convert = vi.fn(async () => ({ html: "<p>Body</p>" }));

    const output = await convertPdfToHtml(
      new Uint8Array([1]),
      options,
      "report.pdf",
      undefined,
      deps(convert)
    );

    expect(output.title).toBeUndefined();
    expect(output.html).toContain("<title>report.pdf</title>");
    expect(output.html).not.toContain('<header class="pdf-citation">');
  });

  it("warns when sampled pages had no text", async () => {
    const convert = vi.fn(async () => ({ html: "<p>Body</p>" }));

    const output = await convertPdfToHtml(
      new Uint8Array([1]),
      options,
      "report.pdf",
      undefined,
      deps(convert, { ...textLayer, pagesWithText: 1, sampledPages: 3 })
    );

    expect(output.warnings[0]).toContain("no extractable text");
  });

  it("surfaces extract-pdf errors", async () => {
    const convert = vi.fn(async () => ({ error: "Parser failed" }));

    await expect(
      convertPdfToHtml(
        new Uint8Array([1]),
        options,
        "report.pdf",
        undefined,
        deps(convert)
      )
    ).rejects.toThrow("Parser failed");
  });

  it("treats an empty fragment as a scanned PDF", async () => {
    const convert = vi.fn(async () => ({ html: "" }));

    await expect(
      convertPdfToHtml(
        new Uint8Array([1]),
        options,
        "report.pdf",
        undefined,
        deps(convert)
      )
    ).rejects.toThrow(SCANNED_PDF_MESSAGE);
  });

  it("reports progress", async () => {
    const convert = vi.fn(async () => ({ html: "<p>Body</p>" }));
    const progress = vi.fn();

    await convertPdfToHtml(
      new Uint8Array([1]),
      options,
      "report.pdf",
      progress,
      deps(convert)
    );

    const phases = progress.mock.calls.map(([value]) => value.phase);
    expect(phases).toEqual(["preparing", "converting", "finalizing"]);
  });
});
