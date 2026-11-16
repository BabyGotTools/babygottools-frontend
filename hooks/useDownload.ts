/** Blob/object-URL download with an automatically inferred filename. */
export function downloadText(content: string, filename: string, mime = "text/plain;charset=utf-8") {
  if (typeof Blob === "undefined") return;
  downloadBlob(new Blob([content], { type: mime }), filename);
}

/** Download a pre-built Blob (binary outputs, images, ZIPs). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function bytesLabel(text: string): string {
  if (typeof Blob !== "undefined") {
    const size = new Blob([text]).size;
    if (size < 1024) return `${size} B`;
    return `${(size / 1024).toFixed(2)} KB`;
  }
  return `${text.length} chars`;
}
