/**
 * Width-aware word wrapping for the plain-text PDF tool.
 *
 * `measure` returns the rendered width of a string at the chosen font size, so
 * this module stays free of pdf-lib and can be unit-tested with a synthetic
 * measurer.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number
): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  const paragraphs = normalized.split("\n");
  const lines: string[] = [];

  for (let p = 0; p < paragraphs.length; p++) {
    const paragraph = paragraphs[p];
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";

    const pushLongWord = (word: string) => {
      let chunk = "";
      for (const char of word) {
        const next = chunk + char;
        if (chunk && measure(next) > maxWidth) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = next;
        }
      }
      if (chunk) lines.push(chunk);
    };

    for (const word of words) {
      if (!current) {
        if (measure(word) <= maxWidth) {
          current = word;
        } else {
          pushLongWord(word);
        }
        continue;
      }

      const candidate = `${current} ${word}`;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = "";
        if (measure(word) <= maxWidth) {
          current = word;
        } else {
          pushLongWord(word);
        }
      }
    }

    if (current) lines.push(current);
  }

  // A trailing newline is a terminator, not an extra blank page.
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length > 0 ? lines : [""];
}

export function paginateLines(
  lines: string[],
  lineHeight: number,
  maxHeight: number
): string[][] {
  const safeLineHeight = Math.max(1, lineHeight);
  const safeHeight = Math.max(safeLineHeight, maxHeight);
  const linesPerPage = Math.max(1, Math.floor(safeHeight / safeLineHeight));
  const pages: string[][] = [];

  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }

  return pages.length > 0 ? pages : [[""]];
}
