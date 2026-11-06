/** Shared types for the PDF & Document Tools registry. */

/** Tool groups shown as filter pills on the category hub. */
export type PdfToolCategory =
  | "convert"
  | "export"
  | "organize"
  | "optimize"
  | "security";

/** Icon/badge/hover color anchors — same tone system as developer tools. */
export type AccentTone = "primary" | "secondary" | "tertiary" | "error" | "neutral" | "engine" | "on-surface";

export interface ToolBadge {
  label: string;
  tone: AccentTone;
}

export interface ToolCapability {
  icon: string;
  iconTone: AccentTone;
  title: string;
  desc: string;
  metaLabel: string;
  metaValue: string;
  metaTone: AccentTone;
}

export interface ToolFaq {
  q: string;
  a: string;
}

export interface HeroMetric {
  label: string;
  value: string;
  /** Small caption under the value ("per megabyte", "0 KB Network"). */
  note?: string;
  /** Value is replaced at runtime by the tool workspace (latency read-outs). */
  live?: boolean;
  /** Show a lock glyph beside a text value (security sandbox column). */
  lock?: boolean;
}

export interface ToolHeroChip {
  label: string;
  style: "pulse" | "strong" | "soft";
}

export interface RelatedTool {
  title: string;
  subtitle: string;
  slug: string;
  icon: string;
  iconTone: AccentTone;
}

/** One row in the "Component Byte Breakdown" style spec cards. */
export interface EngineSpecCell {
  label: string;
  value: string;
  tone?: "primary" | "secondary" | "tertiary" | "on-surface";
}

export interface PdfTool {
  slug: string;
  /** Card + navigation label */
  title: string;
  /** Hero H1 (defaults to title) */
  alias?: string;
  /** Card grid description */
  desc: string;
  /** Hero paragraph (body-lg line under the title) */
  heroDesc: string;
  /** Small mono line under the hero title chips */
  heroMeta: string;
  icon: string;
  accent: AccentTone;
  category: PdfToolCategory;
  popularity: number;
  tags: string[];
  /** Hero inline chips next to the H1 */
  heroChips: ToolHeroChip[];
  /** Hero right metric cluster (SPEED / SANDBOX / output stat) */
  heroMetrics: HeroMetric[];
  /** Telemetry card eyebrow label in the right-hand column */
  telemetryLabel: string;
  /** Engine version chip shown next to the "sandbox ready" pill */
  engineVersion: string;
  /** "Engine Architecture" grid */
  capabilities: ToolCapability[];
  related: RelatedTool[];
  faqs: ToolFaq[];
  /** Section title above the boxed FAQ grid. */
  faqHeading?: string;
  /** Runtime engine specs card (right column, bottom) */
  engineSpecs: EngineSpecCell[];
  /** Free-form acceptance note shown under the dropzone ("Max 250MB • In-Memory Processing") */
  dropzoneMeta: string;
}

/**
 * Slim projection of PdfTool used by the category hub page. The hub only
 * renders card-grid fields — passing the full registry (FAQs, capabilities,
 * engine specs…) as client props serializes ~100 KB of unused data into the
 * page payload and measurably hurts TBT on mobile.
 */
export interface PdfToolHubCard {
  slug: string;
  title: string;
  alias?: string;
  desc: string;
  icon: string;
  accent: AccentTone;
  category: PdfToolCategory;
  popularity: number;
  tags: string[];
  /** Number of "Engine Architecture" entries — powers the "scope" sort. */
  capabilityCount: number;
  heroChips: ToolHeroChip[];
}

/** Map a full registry tool onto its slim hub-card projection. */
export function toPdfToolHubCard(tool: PdfTool): PdfToolHubCard {
  return {
    slug: tool.slug,
    title: tool.title,
    ...(tool.alias ? { alias: tool.alias } : {}),
    desc: tool.desc,
    icon: tool.icon,
    accent: tool.accent,
    category: tool.category,
    popularity: tool.popularity,
    tags: tool.tags,
    capabilityCount: tool.capabilities.length,
    heroChips: tool.heroChips,
  };
}

/** Hub filter pills (lives with the hub, not the heavy registry module). */
export const PDF_HUB_CATEGORIES: { value: PdfToolCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "convert", label: "Converters to PDF" },
  { value: "export", label: "Converters from PDF" },
  { value: "organize", label: "Page Operations & Organize" },
  { value: "optimize", label: "Optimization & Fix" },
  { value: "security", label: "Advanced & Security" },
];
