import type { ReactNode } from "react";
import Icon from "@/components/common/Icon";
import Breadcrumbs from "@/components/tools/Breadcrumbs";
import { EngineCapabilities } from "@/components/tools/ToolSections";
import { textTone } from "@/components/tools/tone";
import type { PdfTool } from "@/data/pdfToolTypes";
import PdfFaqAccordion from "./PdfFaqAccordion";
import HowToSteps from "./HowToSteps";
import PdfRelatedRow from "./PdfRelatedRow";
import { pdfToolSchemas, JsonLdScript } from "@/lib/jsonld";

interface PdfToolShellProps {
  tool: PdfTool;
  /** Workspace (client) rendered between the hero card and the sections. */
  children?: ReactNode;
}

/**
 * Server-rendered PDF tool page frame mirroring the Stitch
 * baby_got_tools_compress_pdf layout: breadcrumb + telemetry row, 12-col
 * header with telemetry bento card, workspace slots, 3-step how-to,
 * engine capabilities, complementary utilities and the FAQ accordion.
 */
export default function PdfToolShell({ tool, children }: PdfToolShellProps) {
  const title = tool.alias ?? tool.title;

  return (
    <div className="relative w-full overflow-hidden">
      {/* BreadcrumbList + FAQPage + WebApplication structured data */}
      {pdfToolSchemas(tool).map((node, i) => (
        <JsonLdScript key={i} node={node} />
      ))}

      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 -left-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto px-gutter-desktop py-space-lg flex flex-col gap-space-lg relative">
        {/* Top breadcrumb & status telemetry */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-xs border-b border-outline-variant/40">
          <Breadcrumbs current={title} variant="pdf" />
          <div className="flex items-center gap-2 text-label-sm font-label-sm">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed/40 text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              WASM SANDBOX READY
            </span>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-mono-xs font-label-mono-xs">
              {tool.engineVersion}
            </span>
          </div>
        </div>

        {/* Header: heroic details + live specs bento card */}
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
          <div className="lg:col-span-8 flex flex-col gap-space-sm">
            <div className="flex items-center gap-space-md">
              <div className="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-sm shrink-0">
                <Icon name={tool.icon} size={32} className={textTone[tool.accent]} />
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
                    {title}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-mono-xs font-label-mono-xs uppercase tracking-wide">
                    {tool.engineVersion}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed/40 text-tertiary font-label-mono-xs font-label-mono-xs">
                    100% In-Memory
                  </span>
                </div>
                <p className="font-label-md text-label-md text-on-surface-variant mt-0.5">{tool.heroMeta}</p>
              </div>
            </div>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl leading-relaxed">
              {tool.heroDesc}
            </p>
          </div>

          {/* Live telemetry card */}
          <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-1.5 text-on-surface font-label-md text-label-md font-semibold">
                <Icon name="speed" size={18} className="text-primary" />
                {tool.telemetryLabel}
              </div>
              <span className="px-1.5 py-0.5 rounded bg-secondary-fixed/50 text-secondary text-label-sm font-label-sm">
                Active
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {tool.heroMetrics.map((metric, index) => (
                <div key={`${metric.label}-${index}`} className="flex flex-col p-2 rounded-lg bg-surface-container-low">
                  <span className="text-label-sm font-label-sm text-outline uppercase">{metric.label}</span>
                  <span
                    className={`font-headline-sm text-headline-sm font-bold mt-0.5 ${
                      index === 1 ? "text-tertiary" : "text-on-surface"
                    }`}
                  >
                    {metric.value}
                    {metric.lock && <Icon name="lock" size={11} className="inline ml-0.5" />}
                  </span>
                  <span className="text-label-sm font-label-sm text-outline">{metric.note ?? ""}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Interactive workspace (client) */}
        {children}

        <HowToSteps tool={tool} />

        {/* Engine capabilities */}
        <div className="mt-space-md">
          <EngineCapabilities
            eyebrow="Engine Architecture"
            heading={`Engineered for Local ${title.replace(/\s*PDF$/, "")} Workflows`}
            items={tool.capabilities}
          />
        </div>

        <PdfRelatedRow items={tool.related} />

        {/* FAQ accordion */}
        <section className="mt-space-md mb-space-lg flex flex-col gap-space-md">
          <div className="flex flex-col gap-1">
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Everything you need to know about the air-gapped document sandbox.
            </p>
          </div>
          <PdfFaqAccordion faqs={tool.faqs} />
        </section>
      </div>
    </div>
  );
}
