"use client";

import Icon from "../common/Icon";
import ToolCard from "../tools/ToolCard";
import type { Hub, ToolItem } from "@/data/tools";
import { useReveal } from "@/hooks/useReveal";

interface ToolCategorySectionProps {
  hub: Hub;
  tools: ToolItem[];
  expanded?: boolean;
  onToggleMore?: () => void;
}

/**
 * Detailed category hub: section header + dense tool card grid +
 * "Show N more" / "Show less" expansion toggle.
 */
export default function ToolCategorySection({
  hub,
  tools,
  expanded = false,
  onToggleMore,
}: ToolCategorySectionProps) {
  const ref = useReveal();
  const hasMore = hub.more.length > 0;

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="reveal w-full max-w-7xl mx-auto px-gutter-desktop mb-20"
      id={hub.id}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="hub-ic" data-accent={hub.accent}>
            <Icon name={hub.icon} size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-headline-lg text-headline-lg w-strong tracking-tight text-on-surface">
                {hub.title}
              </h2>
              <span className="hub-chip" data-accent={hub.accent}>
                {`${hub.count} tools`}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-hub-desc">{hub.subtitle}</p>
          </div>
        </div>
      </div>

      <div className={`${hub.gridClass} gap-3.5 mb-6`}>
        {tools.map((tool) => (
          <ToolCard key={tool.title} tool={tool} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button type="button" className="show-more-btn" onClick={onToggleMore} aria-expanded={expanded}>
            <span>{expanded ? "Show less" : hub.moreLabel}</span>
            <Icon name={expanded ? "expand_less" : "expand_more"} size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
