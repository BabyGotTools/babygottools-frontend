"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "../common/EmptyState";
import HeroSection from "../home/HeroSection";
import CategoryNavigation from "../home/CategoryNavigation";
import PopularTools from "../home/PopularTools";
import ToolCategorySection from "../home/ToolCategorySection";
import WhySection from "../home/WhySection";
import MetricsStrip from "../home/MetricsStrip";
import MainLayout from "../layout/MainLayout";
import { hubs, popularTools } from "@/data/tools";

/** Case-insensitive search across tool name, description and category. */
function matches(query: string, ...texts: string[]) {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return texts.some((t) => t.toLowerCase().includes(q));
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "cat-dev": false, "cat-pdf": false });
  const searchRef = useRef<HTMLInputElement | null>(null);

  const focusSearch = useCallback(() => {
    if (searchRef.current) {
      searchRef.current.focus();
      searchRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  /* ⌘K / Ctrl+K focuses the global search (per the reference script) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focusSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusSearch]);

  const searching = query.trim().length > 0;

  const filteredHubs = useMemo(
    () =>
      hubs
        .map((hub) => {
          if (searching) {
            const visibleTools = [...hub.tools, ...hub.more].filter((t) => matches(query, t.title, t.desc));
            return { hub, visibleTools, foundAny: visibleTools.length > 0 };
          }
          const isExpanded = Boolean(expanded[hub.id]);
          return {
            hub,
            visibleTools: isExpanded ? [...hub.tools, ...hub.more] : hub.tools,
            foundAny: true,
          };
        })
        .filter((entry) => entry.foundAny),
    [query, searching, expanded]
  );

  const filteredPopular = useMemo(
    () =>
      searching
        ? popularTools.filter((t) => matches(query, t.title, t.desc, t.category))
        : popularTools,
    [query, searching]
  );

  const nothingFound = searching && filteredHubs.length === 0 && filteredPopular.length === 0;

  const toggleMore = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <MainLayout onSearchFocus={focusSearch}>
      <HeroSection query={query} onQueryChange={setQuery} searchRef={searchRef} />
      <CategoryNavigation />

      {filteredPopular.length > 0 && <PopularTools tools={filteredPopular} />}

      {filteredHubs.map(({ hub, visibleTools }) => (
        <ToolCategorySection
          key={hub.id}
          hub={hub}
          tools={visibleTools}
          expanded={Boolean(expanded[hub.id])}
          onToggleMore={() => toggleMore(hub.id)}
        />
      ))}

      {nothingFound && <EmptyState query={query.trim()} />}

      <WhySection />
      <MetricsStrip />
    </MainLayout>
  );
}
