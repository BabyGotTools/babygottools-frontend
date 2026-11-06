"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/common/Icon";
import type { HeroMetric } from "@/data/devToolTypes";

export const LATENCY_EVENT = "bgt:engine-latency";

/**
 * Hero right-side metric cluster from the reference:
 * [Engine Latency · live] | [Security Sandboxing · Isolated RAM]
 */
export default function HeroMetricsCluster({ metrics }: { metrics: HeroMetric[] }) {
  const [latency, setLatency] = useState<string | null>(null);

  useEffect(() => {
    const onLatency = (e: Event) => {
      const ms = (e as CustomEvent<number>).detail;
      if (typeof ms === "number" && Number.isFinite(ms)) {
        setLatency(`${Math.max(ms, 0).toFixed(2)} ms`);
      }
    };
    window.addEventListener(LATENCY_EVENT, onLatency);
    return () => window.removeEventListener(LATENCY_EVENT, onLatency);
  }, []);

  return (
    <div className="flex items-center gap-space-md self-end lg:self-center bg-surface-container-lowest px-space-md py-space-sm rounded-xl">
      {metrics.map((metric, i) => (
        <div key={metric.label} className={i > 0 ? "flex items-center gap-space-md" : "contents"}>
          {i > 0 && <div className="w-px h-8 bg-surface-container-highest"></div>}
          <div className="text-right">
            <div className="text-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wider">
              {metric.label}
            </div>
            {metric.lock ? (
              <div className="flex items-center gap-1 text-label-mono-md font-label-mono-md text-on-surface font-semibold">
                <Icon name="lock" size={16} className="text-secondary" />
                <span>{metric.value}</span>
              </div>
            ) : metric.live ? (
              <div className="text-label-mono-lg font-label-mono-lg text-secondary font-bold">
                {latency ?? metric.value}
              </div>
            ) : (
              <div className="text-label-mono-lg font-label-mono-lg text-secondary font-bold">{metric.value}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
