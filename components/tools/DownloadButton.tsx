"use client";

import { useState } from "react";
import { downloadText } from "@/hooks/useDownload";
import Icon from "@/components/common/Icon";

interface DownloadButtonProps {
  value: string;
  filename: string;
  mime?: string;
  label?: string;
  className?: string;
  iconSize?: number;
  title?: string;
  iconOnly?: boolean;
}

/** Blob + objectURL download styled like the reference icon buttons. */
export default function DownloadButton({
  value,
  filename,
  mime = "text/plain;charset=utf-8",
  label,
  className = "p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-secondary transition-colors",
  iconSize = 18,
  title = "Download output",
  iconOnly = false,
}: DownloadButtonProps) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={!value}
      className={className}
      onClick={() => {
        if (!value) return;
        downloadText(value, filename, mime);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      <Icon name={done ? "check" : "download"} size={iconSize} />
      {!iconOnly && label && <span>{label}</span>}
    </button>
  );
}
