"use client";

import Icon from "../common/Icon";
import Link from "next/link";
import { ViewAllLink } from "../common/SectionHeading";
import { popularTools, type PopularTool } from "@/data/tools";
import { toolRouteByTitle } from "@/components/tools/ToolCard";
import { useReveal } from "@/hooks/useReveal";

interface PopularToolsProps {
  tools?: PopularTool[];
}

/** 4-column bento grid of high-impact utility cards. */
export default function PopularTools({ tools = popularTools }: PopularToolsProps) {
  const ref = useReveal();
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="reveal w-full max-w-7xl mx-auto px-gutter-desktop mb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-headline-lg text-headline-lg w-strong tracking-tight text-on-surface">
              Popular Tools
            </h2>
            <span className="trend-tag">🔥 Trending</span>
          </div>
          <p className="font-body-md text-body-md text-tx-subtle">
            The high-impact utilities developers and creators keep coming back to.
          </p>
        </div>
        <ViewAllLink />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tools.map((tool) => {
          const href = toolRouteByTitle[tool.title];
          const card = (
            <div className="pop-card relative overflow-hidden" data-accent={tool.accent} tabIndex={0}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="ic-chip">
                    <Icon name={tool.icon} size={22} />
                  </div>
                  <span className="chip-mini">{tool.category}</span>
                </div>
                <div>
                  <h3 className="pop-title w-med font-headline-sm text-headline-sm text-on-surface transition-colors">
                    {tool.title}
                  </h3>
                  <p className="font-body-sm text-body-sm text-pop-desc mt-1">{tool.desc}</p>
                </div>
              </div>
              <div className="pop-foot">
                <span
                  className="font-label-mono-xs text-label-mono-xs w-lxs"
                  style={{ color: "var(--pop-meta)" }}
                >
                  {tool.meta.dot ? (
                    <>
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block mr-1"
                        style={{ background: "var(--pop-dot)" }}
                        aria-hidden="true"
                      ></span>
                      {tool.meta.text}
                    </>
                  ) : (
                    tool.meta.text
                  )}
                </span>
                <Icon
                  name="east"
                  size={18}
                  className="pop-arrow transition-all"
                  style={{ color: "var(--tx-faint)" }}
                />
              </div>
            </div>
          );
          /* identical visuals — but tools with real routes navigate like everything else */
          return href ? (
            <Link key={tool.title} href={href} className="block">
              {card}
            </Link>
          ) : (
            <div key={tool.title}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}
