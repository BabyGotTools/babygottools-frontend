/** Base64 / URL percent-encoding engines (UTF-8 safe, browser & Node parity). */

const B64_LOOKUP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const B64_REVERSE: Record<string, number> = Object.fromEntries(
  [...B64_LOOKUP].map((c, i) => [c, i] as [string, number])
);

/** Core bytes→Base64 transform shared by the crypto envelope. */
export function encodeBase64Bytes(bytes: Uint8Array, urlSafe = false, dropPadding = false): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += B64_LOOKUP[b0 >> 2];
    out += B64_LOOKUP[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64_LOOKUP[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64_LOOKUP[b2 & 63] : "=";
  }
  if (urlSafe) out = out.replace(/\+/g, "-").replace(/\//g, "_");
  if (dropPadding) out = out.replace(/=+$/g, "");
  return out;
}

/** UTF-8 text → Base64. */
export function encodeBase64(text: string, urlSafe = false, dropPadding = false): string {
  let bytes: Uint8Array;
  if (typeof TextEncoder !== "undefined") {
    bytes = new TextEncoder().encode(text);
  } else {
    bytes = Buffer.from(text, "utf8");
  }
  return encodeBase64Bytes(bytes, urlSafe, dropPadding);
}

/** Base64 → decoded bytes (tolerates missing padding and whitespace). */
export function decodeBase64Bytes(
  input: string,
  opts: { urlSafe?: boolean } = {}
): { ok: true; bytes: Uint8Array } | { ok: false; error: string } {
  let clean = input.replace(/\s+/g, "");
  if (opts.urlSafe) clean = clean.replace(/-/g, "+").replace(/_/g, "/");
  clean = clean.replace(/=+$/, "");
  if (clean.length % 4 === 1) {
    return { ok: false, error: "Invalid Base64 — the input length cannot form complete 4-character groups." };
  }
  clean += "=".repeat((4 - (clean.length % 4)) % 4);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    return { ok: false, error: "Invalid Base64 — input contains characters outside the alphabet." };
  }
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = clean[i]!;
    const b = clean[i + 1]!;
    const c = clean[i + 2]!;
    const d = clean[i + 3]!;
    const c0 = a === "=" ? -1 : B64_REVERSE[a] ?? -1;
    const c1 = b === "=" ? -1 : B64_REVERSE[b] ?? -1;
    const c2 = c === "=" ? -1 : B64_REVERSE[c] ?? -1;
    const c3 = d === "=" ? -1 : B64_REVERSE[d] ?? -1;
    if (c0 < 0 || c1 < 0) return { ok: false, error: "Invalid Base64 — malformed characters or padding." };
    // Padding may only appear in the last two positions of a group ("AB==" or
    // "ABC=", never "AB=C" or earlier).
    if (c2 < 0 && c === "=" && d !== "=") {
      return { ok: false, error: "Invalid Base64 — malformed characters or padding." };
    }
    if ((c2 < 0 && c !== "=") || (c3 < 0 && d !== "=")) {
      return { ok: false, error: "Invalid Base64 — malformed characters or padding." };
    }
    const triple =
      ((c0 & 0x3f) << 18) | (c1 << 12) | (c2 >= 0 ? (c2 & 0x3f) << 6 : 0) | (c3 >= 0 ? c3 & 0x3f : 0);
    bytes.push((triple >> 16) & 0xff);
    if (c !== "=") bytes.push((triple >> 8) & 0xff);
    if (d === "=" && c === "=") break;
    if (d !== "=") bytes.push(triple & 0xff);
    if (d === "=") break;
  }
  return { ok: true, bytes: new Uint8Array(bytes) };
}

/** Base64 → decoded UTF-8 text. */
export function decodeBase64(
  input: string,
  opts: { urlSafe?: boolean } = {}
): { ok: true; text: string } | { ok: false; error: string } {
  const decoded = decodeBase64Bytes(input, opts);
  if (!decoded.ok) return decoded;
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(decoded.bytes) };
  } catch {
    return {
      ok: false,
      error: "Decoded bytes are not valid UTF-8 text — is the input Base64 of binary data?",
    };
  }
}

/* --------------------------------- URL ----------------------------------- */

export type UrlMode = "component" | "whole";

export function encodeUrl(text: string, mode: UrlMode): string {
  return mode === "component" ? encodeURIComponent(text) : encodeURI(text);
}

export function decodeUrl(
  text: string,
  mode: UrlMode
): { ok: true; text: string } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: true, text: "" };
  try {
    return { ok: true, text: mode === "component" ? decodeURIComponent(trimmed) : decodeURI(trimmed) };
  } catch {
    return {
      ok: false,
      error:
        "Malformed percent-encoding — a lone % must be followed by two hex digits (use %25 for a literal %).",
    };
  }
}
