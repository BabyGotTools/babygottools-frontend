/**
 * Pure JSON engine — formatting, validation, repair, sorting, schema
 * inference, tree building, JSONPath filtering and error localization.
 * No DOM/navigator access: safe to unit-test in Node and reuse on the server.
 */

export type JsonIndent = 2 | 4 | "tabs";

export interface JsonErrorInfo {
  message: string;
  line?: number;
  column?: number;
  position?: number;
}

export interface JsonTreeNode {
  key: string;
  keyIndex?: number;
  value: unknown;
  children?: JsonTreeNode[];
  childCount?: number; // {n properties} / [n items]
}

export interface JsonPathPart {
  key: string;
  isIndex: boolean;
}

const INDENT_FILLER: Record<JsonIndent, string> = { 2: "  ", 4: "    ", tabs: "\t" };

function indentUnit(indent: JsonIndent): string {
  return indent === "tabs" ? "\t" : " ".repeat(indent);
}

/* ------------------------------- validate -------------------------------- */

/** Parse with detailed line/column extraction across V8/JSC message formats. */
export function parseJsonStrict(text: string): { ok: true; value: unknown } | { ok: false; error: JsonErrorInfo } {
  if (text.trim().length === 0) {
    return { ok: false, error: { message: "Awaiting input — paste or type JSON to begin validation." } };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: localizeJsonError(text, e instanceof Error ? e : new Error(String(e))) };
  }
}

/**
 * RFC 8259 syntax scanner. Walks the input and returns the char index of the
 * first grammar violation — independent of the JS engine's error wording
 * (V8 dropped "at position N" from messages in Node 20+, so scanning is the
 * only reliable source of error positions).
 */
function scanJsonErrorPos(text: string): number | null {
  let i = 0;
  const len = text.length;

  const skipWs = () => {
    while (i < len) {
      const c = text[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") i++;
      else break;
    }
  };

  const readString = (): number | null => {
    // assumes text[i] === '"'
    i++;
    while (i < len) {
      const c = text[i]!;
      if (c === '"') return i + 1;
      if (c === "\\") {
        i++;
        const e = text[i];
        if (e === undefined) return len;
        if (e === "u") {
          const hex = text.slice(i + 1, i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return i;
          i += 5;
        } else if ('"\\/bfnrt'.includes(e)) {
          i++;
        } else {
          return i;
        }
      } else if (c < " ") {
        return i; // raw control char inside a string
      } else {
        i++;
      }
    }
    return len; // unterminated
  };

  const readNumber = (): number => {
    const start = i;
    if (text[i] === "-") i++;
    if (text[i] === "0") i++;
    else if (/[1-9]/.test(text[i] ?? "")) while (i < len && /[0-9]/.test(text[i]!)) i++;
    else return start; // no digits — invalid
    if (text[i] === ".") {
      i++;
      if (!/[0-9]/.test(text[i] ?? "")) return i;
      while (i < len && /[0-9]/.test(text[i]!)) i++;
    }
    if (text[i] === "e" || text[i] === "E") {
      i++;
      if (text[i] === "+" || text[i] === "-") i++;
      if (!/[0-9]/.test(text[i] ?? "")) return i;
      while (i < len && /[0-9]/.test(text[i]!)) i++;
    }
    return i;
  };

  const readLiteral = (): number | null => {
    for (const lit of ["true", "false", "null"] as const) {
      if (text.startsWith(lit, i)) {
        i += lit.length;
        return i;
      }
    }
    return null;
  };

  const parseValue = (): number | null => {
    skipWs();
    if (i >= len) return len;
    const c = text[i]!;
    if (c === "{") return parseObject();
    if (c === "[") return parseArray();
    if (c === '"') {
      const next = readString();
      return next === null ? null : next;
    }
    if (c === "-" || /[0-9]/.test(c)) return readNumber();
    if (readLiteral() !== null) return i;
    return i; // unexpected char where a value should be
  };

  const parseObject = (): number | null => {
    i++; // {
    skipWs();
    if (i < len && text[i] === "}") {
      i++;
      return i;
    }
    while (true) {
      skipWs();
      if (i >= len) return len;
      if (text[i] !== '"') return i; // key must be a string
      const keyEnd = readString();
      if (keyEnd === null) return null;
      if (keyEnd > i) i = keyEnd;
      skipWs();
      if (text[i] !== ":") return i;
      i++;
      const v = parseValue();
      if (v === null) return null;
      if (v > i) i = v;
      skipWs();
      const cc = text[i];
      if (cc === ",") {
        i++;
        continue;
      }
      if (cc === "}") {
        i++;
        return i;
      }
      return i >= len ? len : i;
    }
  };

  const parseArray = (): number | null => {
    i++; // [
    skipWs();
    if (i < len && text[i] === "]") {
      i++;
      return i;
    }
    while (true) {
      skipWs();
      const inner = text[i];
      if (inner === "]") return i; // unexpected — trailing comma handled below via caller flow
      const v = parseValue();
      if (v === null) return null;
      if (v > i) i = v;
      skipWs();
      const cc = text[i];
      if (cc === ",") {
        i++;
        skipWs();
        if (text[i] === "]") return i; // trailing comma not allowed by RFC 8259
        continue;
      }
      if (cc === "]") {
        i++;
        return i;
      }
      return i >= len ? len : i;
    }
  };

  const end = parseValue();
  if (end === null) return null;
  i = Math.max(i, end);
  skipWs();
  if (i < len) return i; // non-whitespace content after the top-level value
  return null;
}

export function localizeJsonError(text: string, e: Error): JsonErrorInfo {
  const msg = e.message || "Invalid JSON";
  const info: JsonErrorInfo = { message: msg };

  let pos: number | undefined;
  const posMatch = /position\s+(\d+)/i.exec(msg);
  pos = posMatch ? Number(posMatch[1]) : undefined;
  const lineMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(msg);
  if (lineMatch) {
    info.line = Number(lineMatch[1]);
    info.column = Number(lineMatch[2]);
    return info;
  }

  if (typeof pos === "number" && pos >= 0 && pos <= text.length) {
    info.position = pos;
  } else {
    const scanned = scanJsonErrorPos(text);
    if (scanned !== null) {
      pos = scanned;
      info.position = scanned;
    }
  }

  if (typeof pos === "number") {
    const before = text.slice(0, Math.min(pos, text.length));
    const newlines = before.match(/\n/g)?.length ?? 0;
    info.line = newlines + 1;
    const lastNl = before.lastIndexOf("\n");
    info.column = pos - (lastNl + 1) + 1; // 1-based
  }
  return info;
}

/* ------------------------------- format ---------------------------------- */

export interface FormatResult {
  ok: boolean;
  output: string;
  error?: JsonErrorInfo;
  keys: number;
  bytes: number;
}

export function countKeys(value: unknown): number {
  let n = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === "object") {
      for (const k of Object.keys(v as Record<string, unknown>)) {
        n += 1;
        walk((v as Record<string, unknown>)[k]);
      }
    }
  };
  walk(value);
  return n;
}

export function formatJson(
  text: string,
  options: { indent: JsonIndent; minify?: boolean; sortKeys?: boolean }
): FormatResult {
  const parsed = parseJsonStrict(text);
  if (!parsed.ok) {
    return { ok: false, output: "", error: parsed.error, keys: 0, bytes: 0 };
  }
  let value = parsed.value;
  if (options.sortKeys) value = sortKeysDeep(value);
  const output = options.minify ? JSON.stringify(value) : JSON.stringify(value, null, indentUnit(options.indent));
  return { ok: true, output, keys: countKeys(value), bytes: byteLength(output) };
}

export function byteLength(s: string): number {
  if (typeof TextEncoder !== "undefined") {
    const enc = new TextEncoder();
    return enc.encode(s).length;
  }
  // UTF-8 length fallback for non-browser environments
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdfff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/* ------------------------------ sort keys -------------------------------- */

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/* ------------------------------ auto repair ------------------------------ */

function parsesJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Convert 'single quoted' strings to "double quoted" outside string literals. */
function fixSingleQuotes(src: string): string {
  let out = "";
  let inDouble = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inDouble) {
      out += ch;
      if (ch === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === "'") {
      // consume until closing '
      let j = i + 1;
      let val = "";
      while (j < src.length && src[j] !== "'") {
        if (src[j] === "\\") {
          val += src[j] + (src[j + 1] ?? "");
          j += 2;
          continue;
        }
        val += src[j];
        j++;
      }
      out += '"' + val.replace(/"/g, '\\"') + '"';
      i = j + 1;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/* ---- pass one: normalise smart/curly quotes (outside real strings) ---- */

function normalizeSmartQuotes(src: string): string {
  let out = "";
  let inString = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === "\u201C" || ch === "\u201D") out += '"';
    else if (ch === "\u2018" || ch === "\u2019") out += "'";
    else out += ch;
    i++;
  }
  return out;
}

/* ---- pass two: strip line and block comments outside string literals ---- */

function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      // copy the whole string literal verbatim (comments inside are data)
      let j = i + 1;
      out += ch;
      while (j < src.length) {
        if (src[j] === "\\") {
          out += src[j] + (src[j + 1] ?? "");
          j += 2;
          continue;
        }
        if (src[j] === '"') break;
        out += src[j];
        j++;
      }
      out += src[j] ?? "";
      i = j + 1;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/* ---- pass three: python/js non-JSON literals outside string literals ---- */

function normalizeLiterals(src: string): string {
  let out = "";
  let inString = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    const rest = src.slice(i);
    const m = /^(True|False|None|undefined|NaN|Infinity|-Infinity)([\s,}\]])/.exec(rest);
    if (m) {
      const map: Record<string, string> = {
        True: "true",
        False: "false",
        None: "null",
        undefined: "null",
        NaN: "null",
        Infinity: "null",
        "-Infinity": "null",
      };
      out += map[m[1]];
      i += m[1].length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/* ---- pass four: quote bare identifiers used as object keys ---- */

function quoteUnquotedKeys(src: string): string {
  let out = "";
  let inString = false;
  let i = 0;
  while (i < src.length) {
    if (inString) {
      out += src[i];
      if (src[i] === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (src[i] === '"') inString = false;
      i++;
      continue;
    }
    if (src[i] === '"') {
      inString = true;
      out += src[i];
      i++;
      continue;
    }
    // at object value position, an identifier followed by : is a bare key
    const tail = src.slice(i);
    const m = /^([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/.exec(tail);
    if (m) {
      out += `${m[1]}"${m[2]}"${m[3]}`;
      i += m[0].length;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

/* ---- pass five: remove trailing commas ---- */

function removeTrailingCommas(src: string): string {
  let out = "";
  let inString = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < src.length) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    const nextMeaning = /^(\s*)([}\]])/.exec(src.slice(i + 1));
    if (ch === "," && nextMeaning) {
      // skip the comma; keep the whitespace so indentation survives
      out += nextMeaning[1];
      i += 1 + nextMeaning[1].length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/* ---- pass six: insert missing commas between values ---- */

function insertMissingCommas(src: string): string {
  let out = "";
  let i = 0;
  let pendingComma = false; // a value just completed; a following value-start needs a comma

  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "{" || ch === "[" || /[A-Za-z0-9._+\-]/.test(ch)) {
      // a value-start token: insert the missing comma before it
      if (pendingComma) {
        out += ",";
        pendingComma = false;
      }
      if (ch === '"') {
        let j = i + 1;
        while (j < src.length) {
          if (src[j] === "\\") {
            j += 2;
            continue;
          }
          if (src[j] === '"') break;
          j++;
        }
        out += src.slice(i, j + 1);
        i = j + 1;
        // key or value? peek the next non-space char
        let k = i;
        while (k < src.length && /\s/.test(src[k])) k++;
        pendingComma = src[k] !== ":"; // string followed by ":" is a key
        continue;
      }
      if (ch === "{" || ch === "[") {
        out += ch;
        pendingComma = false;
        i++;
        continue;
      }
      // number / literal / bare-word chunk
      let j = i;
      while (j < src.length && /[A-Za-z0-9._+\-]/.test(src[j])) j++;
      const chunk = src.slice(i, j);
      out += chunk;
      // only numerals and JSON literals qualify as comma-worthy values; bare
      // words (e.g. `const`) must NOT trigger comma insertion
      pendingComma = /^-?\d/.test(chunk) || /^(true|false|null|NaN|undefined)(?![A-Za-z0-9_$])/.test(chunk);
      i = j;
      continue;
    }
    if (/[}\]]/.test(ch)) {
      out += ch;
      pendingComma = true;
      i++;
      continue;
    }
    if (ch === "," || ch === ":") {
      out += ch;
      pendingComma = false;
      i++;
      continue;
    }
    // whitespace and anything else — copied verbatim, comma state preserved
    out += ch;
    i++;
  }
  return out;
}

/* ---- pass seven: append missing closing brackets ---- */

function closeOpenBrackets(src: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      const open = stack.pop();
      if (open !== (ch === "}" ? "{" : "[")) return src; // mismatched — not auto-fixable
    }
  }
  if (inString) return src; // unterminated string — not auto-fixable
  let app = "";
  let open = stack.pop();
  while (open) {
    app += open === "{" ? "}" : "]";
    open = stack.pop();
  }
  return app.length > 0 ? src + app : src;
}

/* ---- pass eight: drop a JS assignment prefix / trailing semicolon ---- */

function peelAssignmentWrapper(src: string): string {
  const stripped = src.trim();
  const m = /^(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*([\s\S]+?);?\s*$/.exec(stripped);
  if (m && parsesJson(m[1])) return m[1];
  return src;
}

/**
 * Heuristic multi-pass repair for pasted near-JSON. Every pass is string-aware
 * so valid data inside string literals is never touched; passes only run when
 * the raw input already fails strict parsing, so valid input is untouched.
 * Pure local string processing — no eval, no network.
 */
export function tryRepairJson(text: string): { repaired: string; changed: boolean; ok: boolean } {
  if (parsesJson(text)) return { repaired: text, changed: false, ok: true };

  let candidate = normalizeSmartQuotes(text);

  const passes: Array<(s: string) => string> = [
    stripComments,
    normalizeLiterals,
    fixSingleQuotes,
    quoteUnquotedKeys,
    insertMissingCommas,
    removeTrailingCommas,
    closeOpenBrackets,
    peelAssignmentWrapper,
  ];

  for (const pass of passes) {
    const next = pass(candidate);
    if (next !== candidate) candidate = next;
    if (parsesJson(candidate)) break;
  }

  const ok = parsesJson(candidate);
  return { repaired: candidate, changed: candidate !== text, ok };
}

/* --------------------------- syntax highlighting -------------------------- */

export type JsonTokenKind = "punct" | "key" | "string" | "number" | "bool" | "null" | "text";
export interface JsonToken {
  kind: JsonTokenKind;
  text: string;
}

const TOKEN_RE =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],])/g;

/** Tokenize a formatted JSON string into spans for the highlighted output view. */
export function tokenizeFormattedJson(formatted: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(formatted))) {
    if (m.index > last) tokens.push({ kind: "text", text: formatted.slice(last, m.index) });
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        tokens.push({ kind: "key", text: m[1] });
        tokens.push({ kind: "punct", text: m[2] });
      } else tokens.push({ kind: "string", text: m[1] });
    } else if (m[3] !== undefined) tokens.push({ kind: "number", text: m[3] });
    else if (m[4] !== undefined) tokens.push({ kind: "bool", text: m[4] });
    else if (m[5] !== undefined) tokens.push({ kind: "null", text: "null" });
    else if (m[6] !== undefined) tokens.push({ kind: "punct", text: m[6] });
    last = m.index + m[0].length;
  }
  if (last < formatted.length) tokens.push({ kind: "text", text: formatted.slice(last) });
  return tokens;
}

/* ------------------------------ tree builder ----------------------------- */

export function buildJsonTree(value: unknown, rootKey = "root"): JsonTreeNode {
  return nodeFor(rootKey, value);
}

function nodeFor(key: string, value: unknown, keyIndex?: number): JsonTreeNode {
  const node: JsonTreeNode = { key, keyIndex, value };
  if (Array.isArray(value)) {
    node.childCount = value.length;
    node.children = value.map((v, i) => nodeFor(String(i), v, i));
  } else if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    node.childCount = entries.length;
    node.children = entries.map(([k, v], i) => nodeFor(k, v, i));
  }
  return node;
}

/* ------------------------------- JSONPath -------------------------------- */

/**
 * Minimal JSONPath subset: dot notation, bracket indexes and the
 * "$" root. e.g. `$.telemetry.throughput_rps`, `items[2].name`, `$.tags[0]`.
 */
export function queryJsonPath(root: unknown, path: string): { ok: boolean; value?: unknown; error?: string } {
  let raw = path.trim();
  if (raw.length === 0) return { ok: false, error: "Enter a path" };
  raw = raw.replace(/^\$/, "").trim();
  if (raw.startsWith(".")) raw = raw.slice(1);
  if (raw.length === 0) return { ok: true, value: root };

  const parts: JsonPathPart[] = [];
  const keyRe = /^\.?([A-Za-z_$][\w$\-]*)/;
  const idxRe = /^\[(\d+)\]/;
  let i = 0;
  while (i < raw.length) {
    const rest = raw.slice(i);
    if (rest[0] === "[") {
      const m = idxRe.exec(rest);
      if (!m) return { ok: false, error: `Unsupported path syntax near "${rest.slice(0, 12)}"` };
      parts.push({ key: m[1]!, isIndex: true });
      i += m[0].length;
      continue;
    }
    const m = keyRe.exec(rest);
    if (!m) {
      // dot-separated numeric index (e.g. tools.0.title) behaves like [0]
      const num = /^\.?(\d+)(?=$|[.\[])/.exec(rest);
      if (!num) return { ok: false, error: `Unsupported path syntax near "${rest.slice(0, 12)}"` };
      parts.push({ key: num[1]!, isIndex: true });
      i += num[0].length;
      continue;
    }
    parts.push({ key: m[1]!, isIndex: false });
    i += m[0].length;
  }

  let current: unknown = root;
  for (const part of parts) {
    if (part.isIndex) {
      if (!Array.isArray(current)) return { ok: false, error: `Index "${part.key}" used on a non-array value` };
      current = current[Number(part.key)];
    } else {
      if (current === null || typeof current !== "object" || Array.isArray(current)) {
        return { ok: false, error: `Key "${part.key}" used on a non-object value` };
      }
      current = (current as Record<string, unknown>)[part.key];
    }
    if (current === undefined) return { ok: false, error: `Path does not resolve — "${part.key}" is missing` };
  }
  return { ok: true, value: current };
}

/* ----------------------------- schema infer ------------------------------ */

export function inferJsonSchema(value: unknown, title = "GeneratedPayloadSchema"): unknown {
  const schema: Record<string, unknown> = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title,
  };
  Object.assign(schema, schemaFor(value));
  return schema;
}

function schemaFor(value: unknown): Record<string, unknown> {
  if (value === null) return { type: "null" };
  switch (typeof value) {
    case "string":
      return { type: "string" };
    case "boolean":
      return { type: "boolean" };
    case "number":
      return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
    case "object": {
      if (Array.isArray(value)) {
        if (value.length === 0) return { type: "array" };
        const itemTypes = new Set(value.map((v) => scalarOrTypeName(v)));
        const items =
          itemTypes.size === 1
            ? itemValueSchema(value[0])
            : { oneOf: Array.from(itemTypes).map((t) => ({ type: t })) };
        return { type: "array", items };
      }
      const obj = value as Record<string, unknown>;
      return {
        type: "object",
        required: Object.keys(obj),
        properties: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, schemaFor(v)])),
      };
    }
    default:
      return { type: "string" };
  }
}

/** Items keep their full object schema; scalars degrade to {type}. */
function itemValueSchema(v: unknown): Record<string, unknown> {
  if (v !== null && typeof v === "object") return schemaFor(v);
  return { type: scalarOrTypeName(v) };
}

function scalarOrTypeName(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v) || typeof v === "object") return "object";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v; // "string" | "number" | "boolean"
}
