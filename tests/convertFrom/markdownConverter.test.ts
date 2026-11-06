/**
 * Ported from the i love pdf project (src/lib/convertFrom/markdownConverter.test.ts)
 * — imports redirected to the ported engine module in features/pdf-tools.
 */
import { describe, expect, it, vi } from "vitest";
import type { MarkdownFromPdfOptions } from "@/features/pdf-tools/engines/convertFrom/convertFromTypes";
import { SCANNED_PDF_MESSAGE } from "@/features/pdf-tools/engines/convertFrom/convertFromUtils";
import { convertPdfToMarkdown } from "@/features/pdf-tools/engines/convertFrom/markdownConverter";
import type { TextLayerReport } from "@/features/pdf-tools/engines/convertFrom/pdfToImageUtils";

const textLayer: TextLayerReport = {
  hasText: true,
  totalChars: 100,
  pagesWithText: 1,
  sampledPages: 1,
  pageCount: 1,
};

const scannedLayer: TextLayerReport = {
  ...textLayer,
  hasText: false,
  totalChars: 0,
  pagesWithText: 0,
};

const options: MarkdownFromPdfOptions = {
  includeMetadata: true,
  chunkBy: "none",
  maxTokensPerChunk: 800,
};

interface TestConvertConfig {
  onProgress?: (progress: {
    stage: "loading" | "parsing" | "structuring" | "finalizing";
    currentPage?: number;
    totalPages?: number;
  }) => void;
}

function coreWith(result: Record<string, unknown>) {
  return {
    getPdfjs: vi.fn(async () => ({
      GlobalWorkerOptions: { workerSrc: "" },
    })),
    convert: vi.fn(
      async (_bytes: ArrayBuffer, _config: TestConvertConfig) => result
    ),
  };
}

function deps(
  core: ReturnType<typeof coreWith>,
  layer: TextLayerReport = textLayer
) {
  return {
    detectTextLayer: vi.fn(async () => layer),
    loadCore: vi.fn(
      async () => core as unknown as typeof import("@pdf2md/core")
    ),
  };
}

const successResult = {
  status: "success",
  markdown: "# Title\n\nBody",
  metadata: { title: "Doc", author: "Ada", keywords: ["pdf"] },
  stats: { pageCount: 2, wordCount: 3 },
  messages: [
    { severity: "warning", message: "Some layout was flattened" },
  ],
  chunks: [],
};

describe("convertPdfToMarkdown", () => {
  it("rejects scanned PDFs before loading the converter", async () => {
    const core = coreWith(successResult);
    const dependencies = deps(core, scannedLayer);

    await expect(
      convertPdfToMarkdown(new Uint8Array([1]), options, "scan.pdf", undefined, dependencies)
    ).rejects.toThrow(SCANNED_PDF_MESSAGE);

    expect(dependencies.loadCore).not.toHaveBeenCalled();
  });

  it("adds YAML front matter and preserves warnings", async () => {
    const core = coreWith(successResult);
    const dependencies = deps(core);

    const output = await convertPdfToMarkdown(
      new Uint8Array([1, 2]),
      options,
      "report.pdf",
      undefined,
      dependencies
    );

    expect(output.markdown).toContain('title: "Doc"');
    expect(output.markdown).toContain('author: "Ada"');
    expect(output.markdown).toContain("keywords:\n  - \"pdf\"");
    expect(output.markdown).toContain('source: "report.pdf"');
    expect(output.markdown).toContain("pages: 2");
    expect(output.markdown).toContain("# Title");
    expect(output.markdown.endsWith("\n")).toBe(true);
    expect(output.warnings).toEqual(["Some layout was flattened"]);
    expect(output.metadata.pageCount).toBe(2);
    expect(output.metadata.wordCount).toBe(3);

    expect(core.convert).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.objectContaining({
        includeMetadata: true,
        outputFormat: "markdown",
        yamlFrontMatter: false,
      })
    );
    expect(core.getPdfjs).toHaveBeenCalled();
  });

  it("omits front matter when metadata is disabled", async () => {
    const core = coreWith(successResult);
    const output = await convertPdfToMarkdown(
      new Uint8Array([1]),
      { ...options, includeMetadata: false },
      "report.pdf",
      undefined,
      deps(core)
    );

    expect(output.markdown.startsWith("---")).toBe(false);
    expect(output.markdown).toBe("# Title\n\nBody\n");
  });

  it("formats chunks with page and section context", async () => {
    const core = coreWith({
      ...successResult,
      chunks: [
        {
          pageStart: 1,
          pageEnd: 2,
          markdown: "First chunk",
          sectionPath: ["Intro", "Overview"],
        },
        {
          pageStart: 2,
          pageEnd: 2,
          markdown: "Second chunk",
          sectionPath: [],
        },
      ],
    });

    const output = await convertPdfToMarkdown(
      new Uint8Array([1]),
      { ...options, chunkBy: "page" },
      "report.pdf",
      undefined,
      deps(core)
    );

    expect(output.markdown).toContain(
      "<!-- chunk 1 · pages 1–2 · page · Intro › Overview -->"
    );
    expect(output.markdown).toContain("<!-- chunk 2 · page 2 · page -->");
    expect(output.markdown).toContain("First chunk");
    expect(output.markdown).toContain("Second chunk");
    expect(output.markdown.match(/^---$/gm)).toHaveLength(3);
  });

  it("falls back to the full markdown when chunking produces no chunks", async () => {
    const core = coreWith({ ...successResult, chunks: [] });
    const output = await convertPdfToMarkdown(
      new Uint8Array([1]),
      { ...options, chunkBy: "token" },
      "report.pdf",
      undefined,
      deps(core)
    );
    expect(output.markdown).toContain("# Title");
  });

  it("clears pdf.js v4's global fake-worker handler before v5 conversion", async () => {
    const globals = globalThis as { pdfjsWorker?: unknown };
    globals.pdfjsWorker = { WorkerMessageHandler: {} };
    const core = coreWith(successResult);
    core.convert.mockImplementationOnce(async () => {
      expect(globals.pdfjsWorker).toBeUndefined();
      return successResult;
    });

    try {
      await convertPdfToMarkdown(
        new Uint8Array([1]),
        options,
        "report.pdf",
        undefined,
        deps(core)
      );
    } finally {
      delete globals.pdfjsWorker;
    }
  });

  it("surfaces parser failures", async () => {
    const core = coreWith({
      status: "failed",
      markdown: "",
      messages: [{ severity: "error", message: "Parser exploded" }],
    });

    await expect(
      convertPdfToMarkdown(
        new Uint8Array([1]),
        options,
        "report.pdf",
        undefined,
        deps(core)
      )
    ).rejects.toThrow("Parser exploded");
  });

  it("treats an empty markdown result as a scanned PDF", async () => {
    const core = coreWith({ status: "success", markdown: "   ", messages: [] });

    await expect(
      convertPdfToMarkdown(
        new Uint8Array([1]),
        options,
        "report.pdf",
        undefined,
        deps(core)
      )
    ).rejects.toThrow(SCANNED_PDF_MESSAGE);
  });

  it("reports parser progress", async () => {
    const core = coreWith(successResult);
    core.convert.mockImplementationOnce(async (_bytes, config) => {
      config.onProgress?.({
        stage: "parsing",
        currentPage: 1,
        totalPages: 2,
      });
      config.onProgress?.({ stage: "structuring" });
      config.onProgress?.({ stage: "finalizing" });
      return successResult;
    });
    const progress = vi.fn();

    await convertPdfToMarkdown(
      new Uint8Array([1]),
      options,
      "report.pdf",
      progress,
      deps(core)
    );

    const percents = progress.mock.calls.map(([value]) => value.percent);
    expect(percents).toContain(45);
    expect(percents).toContain(88);
    expect(percents).toContain(94);
  });
});
