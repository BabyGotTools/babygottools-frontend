import type { PdfTool } from "@/data/pdfToolTypes";

/**
 * Stitch 3-step guided workflow with ghost numerals. Copy is derived from
 * the tool's own registry metadata so each page reads concretely rather
 * than with filler text.
 */

const CATEGORY_STEP2: Record<PdfTool["category"], { title: string; desc: (tool: PdfTool) => string }> = {
  convert: {
    title: "Choose Page Setup & Convert",
    desc: (tool) =>
      `Pick the page size, orientation and margins, then run the ${tool.title} engine. Output geometry is applied per document with nothing leaving the tab.`,
  },
  organize: {
    title: "Arrange, Select or Insert Pages",
    desc: () =>
      "Use the thumbnail grid to select, reorder, rotate or remove pages — every action maps to a real structural operation, never a cosmetic overlay.",
  },
  optimize: {
    title: "Tune the Engine Profile",
    desc: () =>
      "Select a processing profile and optional fine-tuning. The engine reports exactly what it changed — no synthetic progress, no placebo outputs.",
  },
  security: {
    title: "Inspect, Then Apply",
    desc: () =>
      "Review the honest inspection report first, choose what to strip or bake, and run the operation. Findings and removals are listed item by item.",
  },
  export: {
    title: "Pick Export Options & Convert",
    desc: (tool) =>
      `Choose how the ${tool.title} output is structured — modes, ranges and fidelity are set before the run — then convert the document entirely inside your browser.`,
  },
};

/** Short subject noun ("Compress PDF" → "Compress"). */
function shortName(tool: PdfTool): string {
  const base = tool.alias ?? tool.title;
  return base.replace(/\s*(to PDF|&).*$/i, "").trim();
}

export default function HowToSteps({ tool }: { tool: PdfTool }) {
  const step2 = CATEGORY_STEP2[tool.category];
  const heading = `How to ${shortName(tool).replace(/^PDF /, "")} with the In-Memory Sandbox`;

  return (
    <section className="mt-space-md flex flex-col gap-space-md" aria-label="How to steps">
      <div className="flex flex-col gap-1">
        <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">{heading}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Browser-side binary processing without uploading data to untrusted remote cloud infrastructure.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {[
          {
            numeral: "01",
            n: "1",
            tone: "bg-primary-container/20 text-primary",
            title: `Load the ${tool.category === "convert" ? "source file" : "PDF"} into Local Memory`,
            desc: "Select or drag the file in. It is held safely in a browser Blob memory stream — strictly avoiding any external transmission or server queue.",
          },
          {
            numeral: "02",
            n: "2",
            tone: "bg-secondary-container/20 text-secondary",
            title: step2.title,
            desc: step2.desc(tool),
          },
          {
            numeral: "03",
            n: "3",
            tone: "bg-tertiary-container/20 text-tertiary",
            title: "Instant In-Memory Retrieval",
            desc: "The engine yields the finished document in your tab. Save it straight to your local file system with the full zero-retention guarantee.",
          },
        ].map((step) => (
          <div
            key={step.numeral}
            className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-3 relative overflow-hidden"
          >
            <span className="text-surface-container font-headline-lg text-[4rem] font-black absolute -right-2 -bottom-4 select-none pointer-events-none">
              {step.numeral}
            </span>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold font-label-md ${step.tone}`}>
              {step.n}
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{step.title}</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
