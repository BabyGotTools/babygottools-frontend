import { metrics } from "@/data/tools";
import { devTools } from "@/data/devTools";
import { PDF_TOOLS } from "@/data/pdfTools";

/**
 * Live metrics & callout strip. The tool count is derived from the registries
 * (never hard-coded) so it stays accurate as tools ship. No invented ratings
 * or unmeasurable claims.
 */
export default function MetricsStrip() {
  const total = devTools.length + PDF_TOOLS.length;
  const all = [{ value: String(total), label: "Free Tools Online", cls: "m1" }, ...metrics];

  return (
    <section className="w-full max-w-7xl mx-auto px-gutter-desktop mb-24">
      <div className="metrics-strip">
        {all.map((m) => (
          <div className="text-center p-3" key={m.label}>
            <div className={`font-headline-xl text-headline-xl font-bold ${m.cls}`}>{m.value}</div>
            <div className="font-label-mono-xs text-label-mono-xs uppercase mt-1 text-tx-muted w-lxs">
              {m.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
