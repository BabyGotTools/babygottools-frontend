/** Diff Checker engine — Myers diff via the `diff` package. */

export type DiffGranularity = "lines" | "words" | "chars";

export interface DiffRow {
  type: "added" | "removed" | "same";
  oldIndex: number | null;
  newIndex: number | null;
  content: string;
}

export interface DiffResult {
  rows: DiffRow[];
  stats: { added: number; removed: number; changed: number; same: number };
}

export type DiffChangePart = { type: "added" | "removed" | "same"; value: string };

export async function computeDiff(
  oldText: string,
  newText: string,
  granularity: DiffGranularity
): Promise<DiffResult> {
  const D = await import("diff");
  const splitFn = granularity === "lines" ? "\n" : undefined;
  type Part = { value: string; added?: boolean; removed?: boolean };
  let parts: Part[];
  if (granularity === "lines") parts = D.diffLines(oldText, newText) as unknown as Part[];
  else if (granularity === "words") parts = D.diffWords(oldText, newText) as unknown as Part[];
  else parts = D.diffChars(oldText, newText) as unknown as Part[];

  if (granularity === "lines") {
    const rows: DiffRow[] = [];
    let oldIndex = 0;
    let newIndex = 0;
    for (const part of parts) {
      const lines = (part.value.endsWith("\n") ? part.value.slice(0, -1) : part.value).split("\n");
      if (part.value === "") continue;
      for (const line of lines) {
        if (part.added) {
          rows.push({ type: "added", oldIndex: null, newIndex, content: line });
          newIndex++;
        } else if (part.removed) {
          rows.push({ type: "removed", oldIndex, newIndex: null, content: line });
          oldIndex++;
        } else {
          rows.push({ type: "same", oldIndex, newIndex, content: line });
          oldIndex++;
          newIndex++;
        }
      }
      if (part.value.endsWith("\n") === false && parts.indexOf(part) < parts.length - 1) {
        /* partial trailing line — nothing to fix; content already counted */
      }
    }
    const added = rows.filter((r) => r.type === "added").length;
    const removed = rows.filter((r) => r.type === "removed").length;
    return { rows, stats: { added, removed, changed: Math.min(added, removed), same: rows.length - added - removed } };
  }

  // words/chars → grouped inline rows of changed chunks
  const rows: DiffRow[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  for (const part of parts) {
    if (part.added) {
      rows.push({ type: "added", oldIndex: null, newIndex, content: part.value });
      newIndex += part.value.length;
    } else if (part.removed) {
      rows.push({ type: "removed", oldIndex, newIndex: null, content: part.value });
      oldIndex += part.value.length;
    } else {
      rows.push({ type: "same", oldIndex, newIndex, content: part.value });
      oldIndex += part.value.length;
      newIndex += part.value.length;
    }
  }
  const added = rows.filter((r) => r.type === "added").length;
  const removed = rows.filter((r) => r.type === "removed").length;
  return { rows, stats: { added, removed, changed: Math.min(added, removed), same: rows.length - added - removed } };
}

/* --------------------------- structural JSON diff --------------------------- */

export type JsonChangeType = "added" | "removed" | "changed";
export interface JsonChange {
  path: string;
  type: JsonChangeType;
  before?: unknown;
  after?: unknown;
}

export function compareJsonValues(a: unknown, b: unknown, rootPath = "$"): JsonChange[] {
  const changes: JsonChange[] = [];
  walk(a, b, rootPath);
  return changes;

  function walk(av: unknown, bv: unknown, path: string): void {
    const aObj = av !== null && typeof av === "object" && !Array.isArray(av);
    const bObj = bv !== null && typeof bv === "object" && !Array.isArray(bv);
    const aArr = Array.isArray(av);
    const bArr = Array.isArray(bv);

    if (aObj && bObj) {
      const ao = av as Record<string, unknown>;
      const bo = bv as Record<string, unknown>;
      for (const key of Object.keys(ao)) {
        if (!(key in bo)) {
          changes.push({ path: `${path}.${key}`, type: "removed", before: ao[key] });
        } else walk(ao[key], bo[key], `${path}.${key}`);
      }
      for (const key of Object.keys(bo)) if (!(key in ao)) changes.push({ path: `${path}.${key}`, type: "added", after: bo[key] });
      return;
    }
    if (aArr && bArr) {
      const aa = av as unknown[];
      const ba = bv as unknown[];
      const n = Math.max(aa.length, ba.length);
      for (let i = 0; i < n; i++) {
        const p = `${path}[${i}]`;
        if (i >= aa.length) changes.push({ path: p, type: "added", after: ba[i] });
        else if (i >= ba.length) changes.push({ path: p, type: "removed", before: aa[i] });
        else walk(aa[i], ba[i], p);
      }
      return;
    }
    if (aObj !== bObj || aArr !== bArr || JSON.stringify(av) !== JSON.stringify(bv)) {
      changes.push({ path, type: "changed", before: av, after: bv });
    }
  }
}
