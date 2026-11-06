/** Shared types for the developer-tools registry. */

export type DevToolCategory = "formatters" | "encoders" | "generators" | "security" | "parsers";

/** Icon/badge/hover color anchors mapped to theme tokens. */
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

export interface DevTool {
  slug: string;
  /** Card + navigation label */
  title: string;
  /** Hero H1 (defaults to title) */
  alias?: string;
  /** Card grid description */
  desc: string;
  /** Hero paragraph */
  heroDesc: string;
  icon: string;
  accent: AccentTone;
  category: DevToolCategory;
  popularity: number;
  tags: string[];
  /** Card grid badge chips */
  badges: ToolBadge[];
  /** Hero inline chips next to the H1 */
  heroChips: ToolHeroChip[];
  /** Hero right metric cluster */
  heroMetrics: HeroMetric[];
  /** "Engine Architecture" grid */
  capabilities: ToolCapability[];
  related: RelatedTool[];
  faqs: ToolFaq[];
  /** Section title above the boxed FAQ grid. */
  faqHeading?: string;
  sample?: string;
}

/**
 * Slim projection of DevTool used by the category hub. Keeps the RSC client
 * payload small (the hub only renders card-grid fields).
 */
export interface DevToolHubCard {
  slug: string;
  title: string;
  alias?: string;
  desc: string;
  icon: string;
  accent: AccentTone;
  category: DevToolCategory;
  popularity: number;
  tags: string[];
  badges: ToolBadge[];
}

/** Map a full registry tool onto its slim hub-card projection. */
export function toDevToolHubCard(tool: DevTool): DevToolHubCard {
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
    badges: tool.badges,
  };
}
