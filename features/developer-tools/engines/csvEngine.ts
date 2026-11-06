/**
 * CSV ⇄ JSON engine. Parsing uses PapaParse (RFC 4180 state machine);
 * serialization implements RFC 4180 escaping exactly.
 */

export async function csvToJson(
  text: string,
  options: { delimiter: string | "auto"; headers: boolean; skipEmpty?: boolean }
): Promise<unknown[]> {
  const Papa = await import("papaparse");
  const result = Papa.parse<Record<string, string> | string[]>(text.trim(), {
    delimiter: options.delimiter === "auto" ? undefined : options.delimiter,
    skipEmptyLines: options.skipEmpty === false ? false : "greedy",
  });
  if (result.errors.length > 0) {
    const e = result.errors[0];
    throw new Error(`CSV parse error: ${e.message} (row ${(e.row ?? 0) + 1})`);
  }
  const rows = result.data;
  if (!options.headers) return rows;
  if (rows.length === 0) return [];
  const header = rows[0] as unknown as string[];
  const body = rows.slice(1) as unknown as string[][];
  const usedNames = new Map<string, number>();
  return body.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((name, i) => {
      const base = String(name ?? "").trim() || `column_${i + 1}`;
      // Duplicate header names get a suffix instead of silently dropping data.
      const n = usedNames.get(base) ?? 0;
      usedNames.set(base, n + 1);
      const key = n === 0 ? base : `${base}_${n + 1}`;
      obj[key] = row?.[i] ?? "";
    });
    return obj;
  });
}

/** RFC 4180 escaping: wrap if needed and double embedded quotes. */
export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Flatten objects into dot-notation keys; arrays degrade to JSON strings. */
export function flattenForCsv(value: unknown, prefix = ""): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix.length === 0 ? { "": value } : { [prefix]: value };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = prefix.length === 0 ? k : `${prefix}.${k}`;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flattenForCsv(v, key));
    } else if (Array.isArray(v)) {
      out[key] = JSON.stringify(v);
    } else {
      out[key] = v;
    }
  }
  return out;
}

export async function jsonToCsv(
  text: string,
  options: { delimiter: string }
): Promise<{ rows: string[][]; csv: string }> {
  if (text.trim().length === 0) throw new Error("Awaiting input — paste a JSON array of objects to begin.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Invalid JSON");
  }
  const arr = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).data)
      ? ((parsed as Record<string, unknown>).data as unknown[])
      : null;
  if (!arr) throw new Error("Expected a JSON array of objects (or an object with a top-level `data` array).");

  const flatObjects = arr.map((item): Record<string, unknown> => {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      return flattenForCsv(item);
    }
    return { value: item };
  });

  const columns: string[] = [];
  for (const obj of flatObjects) {
    for (const key of Object.keys(obj)) if (!columns.includes(key)) columns.push(key);
  }
  const rows: string[][] = [columns, ...flatObjects.map((obj) => columns.map((c) => String(obj[c] ?? "")))];
  const csv = rows.map((row) => row.map(csvEscape).join(options.delimiter)).join("\r\n");
  return { rows, csv };
}
