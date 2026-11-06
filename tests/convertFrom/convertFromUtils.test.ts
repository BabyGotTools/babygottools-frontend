/**
 * Ported from the i love pdf project (src/lib/convertFrom/convertFromUtils.test.ts)
 * — imports redirected to the ported engine module in features/pdf-tools.
 */
import { describe, expect, it } from "vitest";
import {
  CONVERT_FROM_MAX_SCALE,
  SCANNED_PDF_MESSAGE,
  baseNameOf,
  bytesToBase64,
  bytesToDataUrl,
  clampQuality,
  clampScale,
  describeConvertFromError,
  describePageRange,
  extensionOf,
  formatBytes,
  imageExtension,
  imageMimeType,
  isPdfFile,
  outputNameFor,
  resolveSelectedPages,
  safeSheetName,
  truncateMiddle,
  validatePdfFile,
} from "@/features/pdf-tools/engines/convertFrom/convertFromUtils";

function fileOf(name: string, type = "", size = 16): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("file helpers", () => {
  it("strips directories and extensions", () => {
    expect(baseNameOf("C:\\docs\\invoice.pdf")).toBe("invoice");
    expect(baseNameOf("report.final.docx")).toBe("report.final");
    expect(baseNameOf(".env")).toBe(".env");
    expect(baseNameOf("")).toBe("document");
  });

  it("reads lowercase extensions", () => {
    expect(extensionOf("Report.PDF")).toBe(".pdf");
    expect(extensionOf("no-extension")).toBe("");
  });

  it("detects PDFs by MIME type or extension", () => {
    expect(isPdfFile(fileOf("a.pdf", "application/pdf"))).toBe(true);
    expect(isPdfFile(fileOf("a.PDF"))).toBe(true);
    expect(isPdfFile(fileOf("a.txt", "text/plain"))).toBe(false);
  });
});

describe("validatePdfFile", () => {
  it("accepts a normal PDF", () => {
    expect(validatePdfFile(fileOf("a.pdf", "application/pdf"))).toBeNull();
  });

  it("rejects empty files", () => {
    expect(validatePdfFile(fileOf("empty.pdf", "application/pdf", 0))).toContain(
      "empty"
    );
  });

  it("rejects files over 150 MB", () => {
    const big = fileOf(
      "big.pdf",
      "application/pdf",
      150 * 1024 * 1024 + 1
    );
    expect(validatePdfFile(big)).toContain("150 MB");
  });

  it("rejects non-PDF files", () => {
    expect(validatePdfFile(fileOf("a.docx", "application/msword"))).toContain(
      "choose a PDF"
    );
  });
});

describe("page selection", () => {
  it("returns every page for blank or 'all'", () => {
    expect(resolveSelectedPages("", 3)).toEqual([0, 1, 2]);
    expect(resolveSelectedPages("ALL", 3)).toEqual([0, 1, 2]);
  });

  it("parses and clamps ranges", () => {
    expect(resolveSelectedPages("1-3, 5", 5)).toEqual([0, 1, 2, 4]);
    expect(resolveSelectedPages("3-99", 4)).toEqual([2, 3]);
    expect(resolveSelectedPages("5,1,3", 5)).toEqual([0, 2, 4]);
  });

  it("ignores malformed segments", () => {
    expect(resolveSelectedPages("3-1-9, -2, 0, abc", 5)).toEqual([]);
  });

  it("describes the selection", () => {
    expect(describePageRange([0, 1, 2], 3)).toBe("All pages");
    expect(describePageRange([], 3)).toBe("No pages selected");
    expect(describePageRange([1], 3)).toBe("Page 2");
    expect(describePageRange([0, 2], 3)).toBe("2 pages selected");
  });
});

describe("output names", () => {
  it("maps formats to extensions and MIME types", () => {
    expect(imageExtension("jpeg")).toBe("jpg");
    expect(imageExtension("png")).toBe("png");
    expect(imageMimeType("jpeg")).toBe("image/jpeg");
    expect(imageMimeType("png")).toBe("image/png");
  });

  it("builds a name for every tool", () => {
    expect(outputNameFor("word", "C:\\docs\\Q3.pdf")).toBe("Q3.docx");
    expect(outputNameFor("excel", "Q3.pdf")).toBe("Q3-tables.xlsx");
    expect(outputNameFor("image", "Q3.pdf", { format: "png" })).toBe(
      "Q3-images.zip"
    );
    expect(
      outputNameFor("image", "Q3.pdf", { format: "jpeg", singlePage: 1 })
    ).toBe("Q3-page-2.jpg");
    expect(outputNameFor("powerpoint", "Q3.pdf")).toBe("Q3.pptx");
    expect(outputNameFor("markdown", "Q3.pdf")).toBe("Q3.md");
    expect(outputNameFor("text", "Q3.pdf")).toBe("Q3.txt");
    expect(outputNameFor("html", "Q3.pdf")).toBe("Q3.html");
  });
});

describe("number and text formatting", () => {
  it("formats byte counts", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });

  it("clamps render scale to the supported range", () => {
    expect(clampScale(2)).toBe(2);
    expect(clampScale(99)).toBe(CONVERT_FROM_MAX_SCALE);
    expect(clampScale(0.01)).toBe(0.25);
    expect(clampScale(Number.NaN)).toBe(2);
  });

  it("clamps JPEG quality", () => {
    expect(clampQuality(0.9)).toBe(0.9);
    expect(clampQuality(2)).toBe(1);
    expect(clampQuality(0.1)).toBe(0.5);
    expect(clampQuality(Number.NaN)).toBe(0.9);
  });

  it("truncates long names in the middle", () => {
    expect(truncateMiddle("short", 10)).toBe("short");
    expect(truncateMiddle("abcdefghij", 5)).toBe("ab…ij");
  });

  it("creates safe, unique-ish Excel sheet names", () => {
    expect(safeSheetName("Table 1 (page 2)", 0)).toBe("Table 1 (page 2)");
    expect(safeSheetName("a/b:c*?[d]", 0)).toBe("a b c d");
    expect(safeSheetName("   ", 2)).toBe("Table 3");
    expect(safeSheetName("x".repeat(60), 0)).toHaveLength(31);
  });
});

describe("base64 helpers", () => {
  it("encodes bytes in chunks without exceeding call limits", () => {
    const bytes = new Uint8Array(70_000);
    for (let index = 0; index < bytes.length; index++) bytes[index] = index % 256;
    const encoded = bytesToBase64(bytes);
    expect(encoded.length).toBeGreaterThan(90_000);
    expect(encoded).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("builds a data URL", () => {
    expect(bytesToDataUrl(new Uint8Array([104, 105]), "text/plain")).toBe(
      "data:text/plain;base64,aGk="
    );
  });
});

describe("describeConvertFromError", () => {
  it("maps scanned-PDF errors to the shared message", () => {
    expect(
      describeConvertFromError(new Error("this PDF appears to be scanned"), "word")
    ).toBe(SCANNED_PDF_MESSAGE);
    expect(
      describeConvertFromError(new Error("no extractable text found"), "text")
    ).toBe(SCANNED_PDF_MESSAGE);
  });

  it("maps password errors", () => {
    expect(
      describeConvertFromError(new Error("PDF is encrypted"), "word")
    ).toContain("password-protected");
  });

  it("maps memory errors", () => {
    expect(
      describeConvertFromError(new Error("allocation failed"), "image")
    ).toContain("ran out of memory");
  });

  it("maps table errors and points to the OCR tool", () => {
    expect(
      describeConvertFromError(new Error("No tables were detected"), "excel")
    ).toContain("OCR PDF tool first");
  });

  it("maps timeouts and worker failures", () => {
    expect(
      describeConvertFromError(new Error("operation timed out"), "html")
    ).toContain("took too long");
    expect(
      describeConvertFromError(new Error("worker crashed"), "markdown")
    ).toContain("worker could not start");
  });

  it("passes unknown errors through", () => {
    expect(describeConvertFromError(new Error("boom"), "word")).toBe("boom");
    expect(describeConvertFromError(null, "word")).toBe("PDF to Word failed");
  });
});
