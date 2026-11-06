import Icon from "@/components/common/Icon";
import type { EngineSpecCell } from "@/data/pdfToolTypes";

const toneClass: Record<string, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  "on-surface": "text-on-surface",
};

/** Stitch "WASM Runtime Engine Specs" card (right column, bottom). */
export default function EngineSpecsCard({
  specs,
  title = "WASM Runtime Engine Specs",
  icon = "memory",
}: {
  specs: EngineSpecCell[];
  title?: string;
  icon?: string;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2.5">
      <div className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface font-bold">
        <Icon name={icon} size={20} className="text-secondary" />
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2 text-label-sm font-label-sm pt-1">
        {specs.map((cell) => (
          <div key={cell.label} className="flex flex-col p-2 rounded bg-surface-container-low">
            <span className="text-outline">{cell.label}</span>
            <span className={`text-on-surface font-bold ${toneClass[cell.tone ?? "on-surface"] ?? ""}`}>
              {cell.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
