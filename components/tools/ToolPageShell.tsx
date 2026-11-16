import type { ReactNode } from "react";
import type { DevTool } from "@/data/devToolTypes";
import Icon from "@/components/common/Icon";
import Breadcrumbs from "./Breadcrumbs";
import HeroMetricsCluster from "./HeroMetricsCluster";
import { EngineCapabilities, RelatedToolsRow, ToolFaqGrid } from "./ToolSections";
import { textTone } from "./tone";
import { devToolSchemas, toolCategoryTrail, JsonLdScript } from "@/lib/jsonld";

export interface ToolPageShellProps {
  tool: DevTool;
  /** Client-rendered control ribbon rendered inside the hero card. */
  ribbon?: ReactNode;
  /** Workspace area (p Editors, filter bars, …) rendered between hero and sections. */
  children?: ReactNode;
}

const chipClasses: Record<string, string> = {
  pulse: "inline-flex items-center gap-1 px-space-xs py-0.5 rounded bg-surface-container-high text-secondary text-label-mono-xs font-label-mono-xs",
  strong:
    "inline-flex items-center px-space-xs py-0.5 rounded bg-surface-container-highest text-primary text-label-mono-xs font-label-mono-xs font-semibold",
  soft: "inline-flex items-center px-space-xs py-0.5 rounded bg-surface-container-low text-on-surface-variant text-label-mono-xs font-label-mono-xs",
};

/** Derive the subject noun for section headings ("Image Compressor — WebP & AVIF" -> "Image Compressor"). */
function shortName(tool: DevTool): string {
  const base = tool.alias ?? tool.title;
  return base
    .replace(/\s*[\u2013\u2014].*$/, "") // em/en dash subtitle
    .replace(/\s*[&/].*$/, "") // "& Validator", "/ Scripts"
    .trim();
}

/** Category page for the middle breadcrumb crumb (matches BreadcrumbList JSON-LD). */
function categoryCrumb(tool: DevTool): { label: string; href: string } {
  const [trail] = toolCategoryTrail(tool);
  return { label: trail.name, href: trail.url ?? "/" };
}

/** Server-rendered tool page frame mirroring the Stitch tool-page layout. */
export default function ToolPageShell({ tool, ribbon, children }: ToolPageShellProps) {
  const title = tool.alias ?? tool.title;
  const short = shortName(tool);

  return (
    <div className="relative w-full overflow-hidden">
      {/* BreadcrumbList + FAQPage + WebApplication structured data */}
      {devToolSchemas(tool).map((node, i) => (
        <JsonLdScript key={i} node={node} />
      ))}

      {/* Ambient glow background decoration */}
      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-20 -left-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-7xl mx-auto px-gutter-desktop py-space-md relative">
        <Breadcrumbs current={title} category={categoryCrumb(tool)} />

        {/* Tool header card */}
        <div className="bg-surface-container rounded-xl p-space-lg mb-space-lg shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-full bg-gradient-to-l from-primary/5 via-secondary/5 to-transparent pointer-events-none"></div>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-space-lg relative z-10">
            <div className="flex items-start gap-space-md max-w-3xl">
              <div className="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center flex-shrink-0 shadow-inner group">
                <Icon
                  name={tool.icon}
                  size={32}
                  className={`${textTone[tool.accent]} group-hover:scale-110 transition-transform`}
                />
              </div>
              <div className="space-y-space-xs">
                <div className="flex flex-wrap items-center gap-space-xs">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">{title}</h1>
                  {tool.heroChips.map((chip) => (
                    <span key={chip.label} className={chipClasses[chip.style]}>
                      {chip.style === "pulse" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                      )}
                      {chip.label}
                    </span>
                  ))}
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">{tool.heroDesc}</p>
              </div>
            </div>

            {/* Quick metrics status cluster */}
            <HeroMetricsCluster metrics={tool.heroMetrics} />
          </div>

          {/* Control ribbon: either provided statically or a client portal slot */}
          {ribbon ?? <div id="tool-ribbon-slot" className="ribbon-slot-anchor" />}
        </div>

        {/* Workspace */}
        {children}

        {/* Engine capabilities */}
        <EngineCapabilities
          eyebrow="Engine Architecture"
          heading={
            tool.capabilities.length > 0 && tool.slug === "json-formatter"
              ? "Industrial Strength JSON Tooling"
              : `Engineered for ${short} Workflows`
          }
          items={tool.capabilities}
        />

        <RelatedToolsRow heading={tool.relatedHeading ?? "Complementary Developer Utilities"} items={tool.related} />

        <ToolFaqGrid heading={tool.faqHeading ?? `Working With ${title}`} faqs={tool.faqs} />
      </div>
    </div>
  );
}
