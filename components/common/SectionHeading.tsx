import Icon from "./Icon";

interface SectionHeadingProps {
  title: string;
  label: string;
  size?: "sm" | "lg";
}

/** Heading row used above sections (title left, small mono label right). */
export default function SectionHeading({ title, label, size = "sm" }: SectionHeadingProps) {
  const titleCls =
    size === "lg"
      ? "font-headline-lg text-headline-lg w-strong tracking-tight text-on-surface"
      : "font-headline-sm text-headline-sm w-strong tracking-tight text-on-surface";
  return (
    <div className={size === "lg" ? "mb-6" : "mb-4"}>
      <div className="flex items-center justify-between">
        <h2 className={titleCls}>{title}</h2>
        <span className="font-label-mono-xs text-label-mono-xs uppercase text-tx-muted font-medium w-lxs">
          {label}
        </span>
      </div>
    </div>
  );
}

export function ViewAllLink({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href="#cat-dev"
      onClick={onClick}
      className="view-all inline-flex items-center gap-1.5 font-label-mono-md text-label-mono-md font-medium group transition-colors"
    >
      View all 120+ tools
      <Icon name="arrow_forward" size={16} className="group-hover:translate-x-1 transition-transform" />
    </a>
  );
}
