import Link from "next/link";
import Icon from "@/components/common/Icon";

interface BreadcrumbsProps {
  current: string;
  /** "tool" pages use brighter base text; hub uses outline text. */
  variant?: "tool" | "hub" | "pdf";
  /** Middle crumb for registry tools (label + href of the category page). */
  category?: { label: string; href: string };
}

/** Reference breadcrumb bar: Home / {Category} / {Current}. */
export default function Breadcrumbs({ current, variant = "tool", category }: BreadcrumbsProps) {
  if (variant === "hub") {
    // Stitch hub: Home / Categories / [PDF & Document Tools current-pill].
    return (
      <nav
        className="flex items-center gap-space-xs text-body-sm font-body-sm text-on-surface-variant mb-space-md"
        aria-label="Breadcrumb"
      >
        <Link
          className="hover:text-primary transition-colors flex items-center gap-1"
          href="/"
        >
          <Icon name="home" size={16} />
          <span>Home</span>
        </Link>
        <Icon name="chevron_right" size={14} className="text-outline" />
        <Link className="hover:text-primary transition-colors" href="/">
          Categories
        </Link>
        <Icon name="chevron_right" size={14} className="text-outline" />
        <span
          className="text-on-surface font-medium bg-surface-container-high px-2 py-0.5 rounded-full text-label-sm font-label-sm text-primary"
          aria-current="page"
        >
          {current}
        </span>
      </nav>
    );
  }

  if (variant === "pdf") {
    // Stitch tool page: Home / Categories / PDF & Document Tools / {Current}.
    return (
      <nav
        className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant overflow-x-auto whitespace-nowrap py-1 mb-space-sm"
        aria-label="Breadcrumb"
      >
        <Link
          className="hover:text-primary transition-colors flex items-center gap-1"
          href="/"
        >
          <Icon name="home" size={16} />
          <span>Home</span>
        </Link>
        <span className="text-outline-variant">/</span>
        <Link className="hover:text-primary transition-colors" href="/">
          Categories
        </Link>
        <span className="text-outline-variant">/</span>
        <Link className="hover:text-primary transition-colors" href="/tools/pdf">
          PDF &amp; Document Tools
        </Link>
        <span className="text-outline-variant">/</span>
        <span className="text-on-surface font-medium" aria-current="page">
          {current}
        </span>
      </nav>
    );
  }

  const base =
    variant === "tool"
      ? "flex items-center gap-space-xs text-label-mono-md font-label-mono-md text-on-surface-variant mb-space-md"
      : "flex items-center gap-space-xs text-label-mono-md font-label-mono-md text-outline mb-space-md";
  return (
    <nav className={base} aria-label="Breadcrumb">
      <Link className="hover:text-secondary transition-colors flex items-center gap-1" href="/">
        <Icon name="home" size={variant === "tool" ? 15 : 14} />
        <span>Home</span>
      </Link>
      <span className="text-outline-variant">/</span>
      <Link className="hover:text-secondary transition-colors" href={category?.href ?? "/developer-tools"}>
        {category?.label ?? "Developer Tools"}
      </Link>
      <span className="text-outline-variant">/</span>
      <span className="text-secondary font-semibold" aria-current="page">
        {current}
      </span>
    </nav>
  );
}
