"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/common/Icon";
import type { DevToolCategory, DevToolHubCard } from "@/data/devToolTypes";
import { badgeTone, textTone } from "@/components/tools/tone";

const CATEGORIES: { value: DevToolCategory | "all"; label: string }[] = [
  { value: "all", label: "All Utilities" },
  { value: "formatters", label: "Formatters & Linters" },
  { value: "encoders", label: "Encoders & Decoders" },
  { value: "generators", label: "Generators" },
  { value: "security", label: "Security & Trust" },
  { value: "parsers", label: "Parsers & Inspectors" },
];

export interface HubClientProps {
  tools: DevToolHubCard[];
  /** Middle breadcrumb label (top crumb is always Home). */
  breadcrumbLabel?: string;
  /** H1 of the hub page. */
  title?: string;
  /** Intro paragraph under the H1. */
  intro?: string;
  /** Search input placeholder. */
  searchPlaceholder?: string;
  /** Search input aria-label. */
  searchAriaLabel?: string;
  /** Right-side stat cards in the hero. */
  stats?: { label: string; value: string; icon: string }[];
  /** Category tab row — hidden for single-category hubs when omitted. */
  categories?: { value: DevToolCategory | "all"; label: string }[];
  /** Per-card category chip label (defaults to the tab lookup). */
  categoryLabel?: string;
  /** Offline guarantee banner copy. */
  offlineNote?: { title: string; body: string };
}

const DEFAULT_STATS = [
  { label: "ACTIVE UTILITIES", value: "N", icon: "grid_view" },
  { label: "NETWORK LOG", value: "0 requests", icon: "cloud_off" },
  { label: "WASM ENGINE", value: "v2.1", icon: "memory" },
];

export default function DeveloperToolsHubClient({
  tools,
  breadcrumbLabel = "Developer Tools",
  title = "Developer Tools Hub",
  intro = "One console for every developer utility on Baby Got Tools — formatters, encoders, generators, inspectors and security auditors. Every tool runs 100% inside your browser: no uploads, no accounts, no telemetry.",
  searchPlaceholder,
  searchAriaLabel = "Search developer tools",
  stats,
  categories = CATEGORIES,
  categoryLabel,
  offlineNote = {
    title: "Works fully offline",
    body: "Every utility on this hub is a static client bundle. Open the Network panel while working — you will see zero outbound requests. Your code, tokens and headers never touch a server.",
  },
}: HubClientProps) {
  const TOOL_COUNT = tools.length;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DevToolCategory | "all">("all");
  const [sort, setSort] = useState<"popularity" | "name">("popularity");
  const [view, setView] = useState<"grid" | "list">("grid");

  const statCards = stats ?? DEFAULT_STATS.map((s) => ({ ...s, value: s.value === "N" ? String(TOOL_COUNT) : s.value }));

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tools.length };
    for (const t of tools) counts[t.category] = (counts[t.category] ?? 0) + 1;
    return counts;
  }, [tools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tools.filter((t) => {
      const inCategory = category === "all" || t.category === category;
      const inQuery =
        q.length === 0 ||
        t.title.toLowerCase().includes(q) ||
        (t.alias ?? "").toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q));
      return inCategory && inQuery;
    });
    return list.sort((a, b) => (sort === "popularity" ? b.popularity - a.popularity : a.title.localeCompare(b.title)));
  }, [tools, query, category, sort]);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Ambient glow decoration */}
      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-20 -left-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-7xl mx-auto px-gutter-desktop py-space-md relative">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-space-lg">
          <Link href="/" className="text-label-mono-md font-label-mono-md text-outline hover:text-on-surface transition-colors">
            Home
          </Link>
          <Icon name="chevron_right" size={14} className="text-outline-variant" />
          <span className="text-label-mono-md font-label-mono-md text-on-surface font-semibold">{breadcrumbLabel}</span>
        </nav>

        {/* Hero */}
        <div className="bg-surface-container rounded-xl p-space-lg mb-space-lg shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-full bg-gradient-to-l from-primary/5 via-secondary/5 to-transparent pointer-events-none"></div>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-space-lg relative z-10">
            <div className="max-w-3xl space-y-space-sm">
              <span className="inline-flex items-center gap-1 px-space-xs py-0.5 rounded bg-surface-container-highest text-primary text-label-mono-xs font-label-mono-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                {TOOL_COUNT} UTILITIES RUNNING IN-BROWSER
              </span>
              <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
                {title}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {intro}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-space-sm flex-shrink-0">
              {statCards.map((s) => (
                <div key={s.label} className="bg-surface-container-low rounded-xl p-space-md min-w-24 text-center">
                  <Icon name={s.icon} size={18} className="text-secondary mx-auto mb-1" />
                  <div className="text-label-mono-xs font-label-mono-xs text-outline-variant">{s.label}</div>
                  <div className="font-headline-sm text-on-surface font-bold">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Search + controls */}
        <div className="bg-surface-container rounded-xl p-space-md mb-space-md shadow-lg flex flex-col lg:flex-row lg:items-center gap-space-sm">
          <div className="flex-1 relative">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? `Search ${TOOL_COUNT} utilities — try “jwt”, “csv”, “uuid”…`}
              aria-label={searchAriaLabel}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-surface-container-highest text-on-surface font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-secondary placeholder:text-outline-variant"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-on-surface"
                aria-label="Clear search"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-space-xs flex-shrink-0">
            <div className="bg-surface-container-high rounded-lg px-3 py-1.5 text-label-mono-xs font-label-mono-xs text-on-surface-variant">
              {filtered.length} / {tools.length} tools
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "popularity" | "name")}
              aria-label="Sort tools"
              className="px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface text-label-mono-md font-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              <option value="popularity">Popular first</option>
              <option value="name">A → Z</option>
            </select>
            <div className="flex rounded-lg overflow-hidden bg-surface-container-highest">
              {(
                [
                  { key: "grid", icon: "grid_view" },
                  { key: "list", icon: "view_list" },
                ] as const
              ).map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  aria-label={`${v.key} view`}
                  aria-pressed={view === v.key}
                  className={`px-2.5 py-1.5 ${view === v.key ? "bg-surface-container-low text-secondary" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  <Icon name={v.icon} size={18} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category tabs */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-space-xs mb-space-lg">
            {categories.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-mono-md font-label-mono-md transition-all ${
                category === c.value
                  ? "bg-surface-container-highest text-secondary font-semibold"
                  : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span>{c.label}</span>
              <span className="px-1.5 rounded bg-surface-container-low text-outline-variant">{categoryCounts[c.value] ?? 0}</span>
            </button>
          ))}
          </div>
        )}

        {/* Tool cards */}
        {filtered.length === 0 ? (
          <div className="bg-surface-container rounded-xl p-space-xl text-center shadow-md">
            <Icon name="search_off" size={40} className="text-outline-variant mx-auto mb-2" />
            <p className="text-on-surface-variant font-body-md text-body-md">No utilities match “{query}” in {categories.find((c) => c.value === category)?.label ?? breadcrumbLabel}.</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md mb-space-xl">
            {filtered.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group bg-surface-container rounded-xl p-space-lg shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all border border-transparent hover:border-outline-variant/30 focus-visible:outline-2 focus-visible:outline-secondary"
              >
                <div className="flex items-start justify-between gap-2 mb-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-lowest shadow-inner flex items-center justify-center flex-shrink-0">
                    <Icon name={tool.icon} size={22} className={`${textTone[tool.accent]} group-hover:scale-110 transition-transform`} />
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {tool.badges.map((b) => (
                      <span key={b.label} className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide ${badgeTone[b.tone]}`}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="font-headline-sm text-on-surface font-semibold mb-1">{tool.alias ?? tool.title}</div>
                <p className="text-label-mono-md font-label-mono-md text-on-surface-variant leading-relaxed line-clamp-2">{tool.desc}</p>
                <div className="mt-space-md flex items-center justify-between text-label-mono-xs font-label-mono-xs">
                  <span className="text-outline-variant">{categoryLabel ?? CATEGORIES.find((c) => c.value === tool.category)?.label}</span>
                  <span className="inline-flex items-center gap-1 text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <Icon name="arrow_forward" size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-space-sm mb-space-xl">
            {filtered.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group flex items-center gap-space-md bg-surface-container rounded-xl p-space-md shadow-md hover:shadow-xl border border-transparent hover:border-outline-variant/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-container-lowest shadow-inner flex items-center justify-center flex-shrink-0">
                  <Icon name={tool.icon} size={22} className={textTone[tool.accent]} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-headline-sm text-on-surface font-semibold">{tool.alias ?? tool.title}</div>
                  <p className="text-label-mono-md font-label-mono-md text-on-surface-variant truncate">{tool.desc}</p>
                </div>
                <div className="hidden md:flex flex-wrap gap-1 flex-shrink-0">
                  {tool.badges.map((b) => (
                    <span key={b.label} className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide ${badgeTone[b.tone]}`}>
                      {b.label}
                    </span>
                  ))}
                </div>
                <Icon name="arrow_forward" size={18} className="text-outline-variant group-hover:text-secondary transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}

        {/* Offline guarantee banner */}
        <div className="bg-tertiary-container/10 border border-tertiary/20 rounded-xl p-space-lg mb-space-xl flex flex-col md:flex-row items-center gap-space-md">
          <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center flex-shrink-0 shadow-inner">
            <Icon name="cloud_off" size={24} className="text-tertiary" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="font-headline-sm text-on-surface font-semibold">{offlineNote.title}</div>
            <p className="text-body-sm text-on-surface-variant">
              {offlineNote.body}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
