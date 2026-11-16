"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LATENCY_EVENT } from "@/components/tools/HeroMetricsCluster";

/**
 * Portal a workspace's control ribbon into the ToolPageShell hero slot.
 * Re-renders with the node on every render (unlike the older one-shot
 * usePortalRibbon), so stateful ribbon controls stay live.
 * No-op on the server.
 */
export function useRibbonPortal(node: React.ReactNode) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const slot = mounted ? document.getElementById("tool-ribbon-slot") : null;
  return mounted && slot ? createPortal(node, slot) : null;
}

/** Fire the hero latency metric read-out for the current tool. */
export function dispatchLatency(ms: number) {
  window.dispatchEvent(new CustomEvent<number>(LATENCY_EVENT, { detail: ms }));
}
