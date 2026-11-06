/** JWT debugger engine — decode-only, never verifies signatures. */

export interface JwtDecoded {
  header: unknown;
  payload: unknown;
  signature: string;
  algorithm?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  expired?: boolean;
  notBefore?: Date;
}

export type JwtDecodeResult =
  | { ok: true; token: JwtDecoded; warnings: string[] }
  | { ok: false; error: string; partial?: { header?: unknown; payload?: unknown; signature?: string } };

function base64UrlDecode(seg: string): string {
  const pad = seg.length % 4 === 0 ? "" : "=".repeat(4 - (seg.length % 4));
  const b64 = seg.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error("Segment is not valid Base64URL");
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(
      Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    );
  } catch {
    throw new Error("Segment contains non-Base64URL characters");
  }
}

export function decodeJwt(token: string): JwtDecodeResult {
  const raw = token.trim();
  if (raw.length === 0) return { ok: false, error: "Awaiting input — paste a JWT to decode." };
  const parts = raw.split(".");
  if (parts.length < 2) {
    return { ok: false, error: "Not a JWT — a token needs at least 2 dot-separated segments (header.payload)." };
  }

  const warnings: string[] = [];
  const partial: { header?: unknown; payload?: unknown; signature?: string } = {};

  let header: unknown;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]!));
    partial.header = header;
  } catch (e) {
    return {
      ok: false,
      error: `Invalid header segment: ${e instanceof Error ? e.message : "not decodable"}`,
      partial,
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]!));
    partial.payload = payload;
    partial.signature = parts[2];
  } catch (e) {
    return {
      ok: false,
      error: `Invalid payload segment: ${e instanceof Error ? e.message : "not decodable"}`,
      partial,
    };
  }

  if (parts.length === 2) {
    warnings.push("No signature segment present — this is an unsigned token.");
  }

  if (typeof header === "object" && header !== null) {
    const h = header as Record<string, unknown>;
    if (h.alg === "none") warnings.push('Algorithm "none" — token carries no signature; treat as untrusted.');
  }

  const decoded: JwtDecoded = { header, payload, signature: parts[2] ?? "" };
  if (typeof payload === "object" && payload !== null) {
    const p = payload as Record<string, unknown>;
    if (typeof p.exp === "number") {
      decoded.expiresAt = new Date(p.exp * 1000);
      decoded.expired = decoded.expiresAt.getTime() < Date.now();
    } else {
      warnings.push('No "exp" claim — expiry cannot be evaluated.');
    }
    if (typeof p.iat === "number") decoded.issuedAt = new Date(p.iat * 1000);
    if (typeof p.nbf === "number") decoded.notBefore = new Date(p.nbf * 1000);
    if (typeof p.alg === "string") decoded.algorithm = p.alg;
  } else {
    warnings.push('Payload is not a claims object — standard claims (exp/iat) are unavailable.');
  }

  if (typeof header === "object" && header !== null) {
    const h = header as Record<string, unknown>;
    if (typeof h.alg === "string") decoded.algorithm = h.alg;
  }

  warnings.push(
    "Decoding does not verify the signature. Without the issuer's key, this token must not be trusted as authentic."
  );

  return { ok: true, token: decoded, warnings };
}
