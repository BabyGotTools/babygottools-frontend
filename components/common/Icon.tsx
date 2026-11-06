import type { CSSProperties } from "react";

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** Material Symbols Outlined glyph (subsetted webfont, ligature-based). */
export default function Icon({ name, size = 20, className = "", style }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, ...style }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
