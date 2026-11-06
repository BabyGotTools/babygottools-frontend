import type { ReactNode } from "react";

/**
 * Stitch main workspace grid: 7-col configuration pane + 5-col output panel.
 * Each side is a slot so workspaces keep the same geometry on every tool.
 */
export default function PdfWorkspaceGrid({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <main className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
      <section className="lg:col-span-7 flex flex-col gap-space-md">{left}</section>
      <aside className="lg:col-span-5 flex flex-col gap-space-md">{right}</aside>
    </main>
  );
}
