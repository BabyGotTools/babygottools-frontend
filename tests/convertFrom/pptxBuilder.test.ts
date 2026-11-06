/**
 * Ported from the i love pdf project (src/lib/convertFrom/pptxBuilder.test.ts)
 * — imports redirected to the ported engine module in features/pdf-tools.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPptx } from "@/features/pdf-tools/engines/convertFrom/pptxBuilder";

const state = vi.hoisted(() => ({
  instances: [] as Array<Record<string, unknown>>,
  writeOutput: new Uint8Array([9, 8, 7]).buffer as unknown,
}));

vi.mock("pptxgenjs", () => {
  class MockPptxGenJS {
    slides: Array<Record<string, unknown>> = [];
    defineLayout = vi.fn();
    layout = "";
    author = "";
    company = "";
    subject = "";
    title = "";

    constructor() {
      state.instances.push(this as unknown as Record<string, unknown>);
    }

    addSlide = vi.fn(() => {
      const slide = {
        background: undefined as unknown,
        addImage: vi.fn(),
      };
      this.slides.push(slide);
      return slide;
    });

    write = vi.fn(async () => state.writeOutput);
  }

  return { default: MockPptxGenJS };
});

function image(pageNumber = 1) {
  return {
    pageNumber,
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/png",
    pageWidth: 100,
    pageHeight: 200,
  };
}

function lastInstance() {
  const instance = state.instances[state.instances.length - 1] as {
    slides: Array<{
      background: unknown;
      addImage: ReturnType<typeof vi.fn>;
    }>;
    defineLayout: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    layout: string;
  };
  return instance;
}

describe("buildPptx", () => {
  beforeEach(() => {
    state.instances.length = 0;
    state.writeOutput = new Uint8Array([9, 8, 7]).buffer;
  });

  it("creates one full-slide image per page", async () => {
    const bytes = await buildPptx([image(1), image(2)], {
      slideSize: "16:9",
      title: "Deck",
    });

    const pptx = lastInstance();
    expect(bytes).toEqual(new Uint8Array([9, 8, 7]));
    expect(pptx.layout).toBe("LAYOUT_16x9");
    expect(pptx.defineLayout).not.toHaveBeenCalled();
    expect(pptx.slides).toHaveLength(2);
    expect(pptx.slides[0].background).toEqual({ color: "FFFFFF" });
    expect(pptx.slides[0].addImage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringMatching(/^data:image\/png;base64,/),
        x: expect.any(Number),
        y: 0,
        w: 3.75,
        h: 7.5,
        altText: "PDF page 1",
      })
    );
  });

  it("matches the first page's aspect ratio", async () => {
    await buildPptx([image()], { slideSize: "match", title: "Deck" });

    const pptx = lastInstance();
    expect(pptx.defineLayout).toHaveBeenCalledWith({
      name: "PDF_MATCH",
      width: 3.75,
      height: 7.5,
    });
    expect(pptx.layout).toBe("PDF_MATCH");
  });

  it("supports 4:3 slides", async () => {
    await buildPptx([image()], { slideSize: "4:3", title: "Deck" });
    expect(lastInstance().layout).toBe("LAYOUT_4x3");
  });

  it("sets document metadata", async () => {
    await buildPptx([image()], { slideSize: "16:9", title: "Q3 review" });
    const pptx = state.instances[0] as Record<string, unknown>;
    expect(pptx.author).toBe("PDF Intelligence Platform");
    expect(pptx.company).toBe("PDF Intelligence Platform");
    expect(pptx.subject).toBe("Q3 review");
    expect(pptx.title).toBe("Q3 review");
  });

  it("accepts Uint8Array, string, and Blob outputs", async () => {
    state.writeOutput = new Uint8Array([1, 2]);
    await expect(
      buildPptx([image()], { slideSize: "16:9", title: "x" })
    ).resolves.toEqual(new Uint8Array([1, 2]));

    state.writeOutput = "pptx";
    await expect(
      buildPptx([image()], { slideSize: "16:9", title: "x" })
    ).resolves.toEqual(new TextEncoder().encode("pptx"));

    state.writeOutput = new Blob([new Uint8Array([3, 4])]);
    await expect(
      buildPptx([image()], { slideSize: "16:9", title: "x" })
    ).resolves.toEqual(new Uint8Array([3, 4]));

    state.writeOutput = { unexpected: true };
    await expect(
      buildPptx([image()], { slideSize: "16:9", title: "x" })
    ).rejects.toThrow("unsupported output type");
  });

  it("rejects an empty page list", async () => {
    await expect(
      buildPptx([], { slideSize: "16:9", title: "x" })
    ).rejects.toThrow("No pages");
  });
});
