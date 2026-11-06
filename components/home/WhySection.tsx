"use client";

import Icon from "../common/Icon";
import { benefits } from "@/data/tools";
import { useReveal } from "@/hooks/useReveal";

/** "Why Baby Got Tools?" — trust, architecture & benefits. */
export default function WhySection() {
  const ref = useReveal();
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="reveal w-full max-w-7xl mx-auto px-gutter-desktop mb-24">
      <div className="why-box">
        {/* Ambient blobs */}
        <div
          className="why-glow -bottom-24 -right-24 w-80 h-80"
          style={{ background: "var(--why-glow-a)" }}
          aria-hidden="true"
        ></div>
        <div
          className="why-glow -top-24 -left-24 w-80 h-80"
          style={{ background: "var(--why-glow-b)" }}
          aria-hidden="true"
        ></div>

        <div className="max-w-2xl mb-12 relative z-10">
          <span className="why-badge">Engineered for Velocity</span>
          <h2 className="font-headline-xl text-headline-xl w-strong tracking-tight text-on-surface mt-3 mb-3">
            Why Baby Got Tools?
          </h2>
          <p className="font-body-md text-body-md text-tx-subtle">
            We build lean micro-engines that run directly in your browser. No bloated ad trackers,
            zero subscription friction, and no server leaks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="benefit-card" data-accent={benefit.accent}>
              <div>
                <div className="bic">
                  <Icon name={benefit.icon} size={22} />
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface w-med mb-1.5">
                  {benefit.title}
                </h3>
                <p className="font-body-sm text-body-sm text-wcard-desc leading-relaxed">
                  {benefit.desc}
                </p>
              </div>
              <span className="benefit-meta font-label-mono-xs text-label-mono-xs w-lxs mt-4 block">
                {benefit.meta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
