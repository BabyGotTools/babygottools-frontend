/** Query string parser — repeated keys kept in order, lossless rebuild. */

export interface QueryParam {
  key: string;
  values: string[];
}

export interface ParsedQuery {
  /** Base URL when a full URL was pasted (strips protocol/host/path). */
  baseUrl?: string;
  params: QueryParam[];
  rawQuery: string;
}

export function parseQueryString(input: string): ParsedQuery {
  let raw = input.trim();
  let baseUrl: string | undefined;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      baseUrl = `${u.protocol}//${u.host}${u.pathname}${u.hash ? u.hash : ""}`;
      raw = u.search.startsWith("?") ? u.search.slice(1) : u.search;
    } catch {
      /* fall through to raw parsing */
    }
  } else {
    // cut a path/query combined form like /path?x=1
    const q = raw.indexOf("?");
    if (q !== -1) raw = raw.slice(q + 1);
  }

  const params: QueryParam[] = [];
  if (raw.length === 0) return { baseUrl, params, rawQuery: raw };

  for (const pair of raw.split("&")) {
    if (pair.length === 0) continue;
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? "" : pair.slice(eq + 1);
    const key = safeDecode(rawKey) ? rawKey.replace(/\+/g, " ") : rawKey;
    const value = safeDecode(rawValue) ? rawValue.replace(/\+/g, " ") : rawValue;
    const existing = params.find((p) => p.key === key);
    if (existing) existing.values.push(value);
    else params.push({ key, values: [value] });
  }
  return { baseUrl, params, rawQuery: raw };
}

function safeDecode(v: string): boolean {
  return !v.includes("%") || !/%(?![0-9a-fA-F]{2})/.test(v);
}

/** Rebuild the query string from an editable param list (order preserved). */
export function rebuildQueryString(params: QueryParam[]): string {
  return params
    .flatMap((p) =>
      p.values.map((v) => {
        const encKey = encodeURIComponent(p.key);
        const encValue = encodeURIComponent(v);
        return v.length === 0 && p.values.length === 1 ? encKey : `${encKey}=${encValue}`;
      })
    )
    .join("&");
}

/** Decode lossy display values for the param table. */
export function displayValue(v: string): string {
  const once = decodePercentOnce(v);
  return once;
}

function decodePercentOnce(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v; // broken encoding — surface as-is rather than failing
  }
}
