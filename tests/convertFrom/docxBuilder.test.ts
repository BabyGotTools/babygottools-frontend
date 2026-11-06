/**
 * Ported from the i love pdf project (src/lib/convertFrom/docxBuilder.test.ts)
 * — imports redirected to the ported engine module in features/pdf-tools.
 */
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import type { RenderedPageImage } from "@/features/pdf-tools/engines/convertFrom/convertFromTypes";
import { buildImageDocx, buildTextDocx } from "@/features/pdf-tools/engines/convertFrom/docxBuilder";
import type { ExtractedText } from "@/features/pdf-tools/engines/convertFrom/pdfTextExtractor";

function readDocx(bytes: Uint8Array) {
  const files = unzipSync(bytes);
  return {
    files,
    text: (path: string) => strFromU8(files[path]),
  };
}

function image(overrides: Partial<RenderedPageImage> = {}): RenderedPageImage {
  return {
    pageNumber: 1,
    mimeType: "image/png",
    bytes: new Uint8Array([1, 2, 3]),
    width: 100,
    height: 200,
    pageWidth: 612,
    pageHeight: 792,
    ...overrides,
  };
}

describe("buildTextDocx", () => {
  const extracted: ExtractedText = {
    text: "Big Title\nbody\nmore",
    emptyPages: [],
    totalChars: 18,
    pages: [
      {
        pageNumber: 1,
        text: "Big Title\nbody\nmore",
        charCount: 18,
        lineCount: 3,
        lines: [
          { text: "Big Title", x: 0, y: 100, fontSize: 20 },
          { text: "body", x: 0, y: 80, fontSize: 10 },
          { text: "more", x: 0, y: 60, fontSize: 10 },
        ],
      },
      {
        pageNumber: 2,
        text: "",
        charCount: 0,
        lineCount: 0,
        lines: [],
      },
    ],
  };

  it("builds a valid editable-text document", () => {
    const { text } = readDocx(buildTextDocx(extracted, "Report & Notes"));

    const document = text("word/document.xml");
    expect(document).toContain('<w:pStyle w:val="Heading1"/>');
    expect(document).toContain("Big Title");
    expect(document).toContain("body");
    expect(document).toContain('<w:br w:type="page"/>');
    expect(document).toContain("<w:pgSz");
    expect(text("word/styles.xml")).toContain("Heading1");
    expect(text("word/_rels/document.xml.rels")).toContain("styles.xml");
    expect(text("docProps/core.xml")).toContain("Report &amp; Notes");
    expect(text("[Content_Types].xml")).not.toContain('Extension="png"');
  });

  it("escapes XML in paragraph text", () => {
    const { text } = readDocx(
      buildTextDocx(
        {
          text: "<script>",
          emptyPages: [],
          totalChars: 8,
          pages: [
            {
              pageNumber: 1,
              text: "<script>",
              charCount: 8,
              lineCount: 1,
              lines: [
                { text: "<script>", x: 0, y: 0, fontSize: 10 },
              ],
            },
          ],
        },
        "x"
      )
    );
    expect(text("word/document.xml")).toContain("&lt;script&gt;");
    expect(text("word/document.xml")).not.toContain("<script>");
  });
});

describe("buildImageDocx", () => {
  it("embeds one image per page with matching page geometry", () => {
    const { files, text } = readDocx(
      buildImageDocx(
        [
          image({ pageNumber: 1, mimeType: "image/png" }),
          image({
            pageNumber: 2,
            mimeType: "image/jpeg",
            bytes: new Uint8Array([4, 5]),
            pageWidth: 792,
            pageHeight: 612,
          }),
        ],
        "Slides"
      )
    );

    expect(files["word/media/page-1.png"]).toEqual(new Uint8Array([1, 2, 3]));
    expect(files["word/media/page-2.jpg"]).toEqual(new Uint8Array([4, 5]));

    const document = text("word/document.xml");
    expect(document).toContain("PDF page 1");
    expect(document).toContain("PDF page 2");
    expect(document).toContain('r:embed="rIdImg1"');
    expect(document).toContain('r:embed="rIdImg2"');
    expect(document).toContain('cx="7772400"');
    expect(document).toContain('cy="10058400"');
    expect(document).toContain('<w:pgSz w:w="15840" w:h="12240"/>');
    expect(text("word/_rels/document.xml.rels")).toContain("media/page-1.png");
    expect(text("[Content_Types].xml")).toContain('Extension="png"');
    expect(text("[Content_Types].xml")).toContain('Extension="jpg"');
  });

  it("rejects an empty page list", () => {
    expect(() => buildImageDocx([], "empty")).toThrow("No pages");
  });
});
