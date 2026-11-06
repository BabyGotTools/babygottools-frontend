"use client";

import { useClipboard } from "@/hooks/useClipboard";
import Icon from "@/components/common/Icon";

interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  iconSize?: number;
  title?: string;
  /** Render as a compact icon-only button. */
  iconOnly?: boolean;
}

/** Reference-styled copy chip: `bg-*` variants are provided via className. */
export default function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied!",
  className = "inline-flex items-center gap-1.5 px-space-sm py-1 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 font-label-mono-md text-label-mono-md transition-all",
  iconSize = 16,
  title,
  iconOnly = false,
}: CopyButtonProps) {
  const { copied, copy } = useClipboard();

  return (
    <button
      type="button"
      onClick={() => void copy(value)}
      title={title ?? label}
      disabled={!value}
      aria-label={title ?? label}
      className={className}
    >
      <Icon name={copied ? "check" : "content_copy"} size={iconSize} />
      {!iconOnly && <span>{copied ? copiedLabel : label}</span>}
    </button>
  );
}
