/** HTTP header inspector — parses pasted raw header blocks locally, no fetching. */

export interface HttpHeader {
  name: string;
  value: string;
  duplicate: boolean;
}

export interface HttpHeaderNotice {
  kind: "request-line" | "status-line" | "security" | "info" | "warn";
  text: string;
}

const SECURITY_HEADERS: Record<string, { desc: string }> = {
  "content-security-policy": { desc: "Restricts resource loading & inline scripts (XSS defense)." },
  "strict-transport-security": { desc: "Forces HTTPS for future visits (HSTS)." },
  "x-content-type-options": { desc: "nosniff stops MIME-sniffing attacks." },
  "x-frame-options": { desc: "Legacy clickjacking defense (prefer CSP frame-ancestors)." },
  "referrer-policy": { desc: "Controls how much referrer data leaves your pages." },
  "permissions-policy": { desc: "Grants/denies browser features (camera, geolocation…)." },
  "cross-origin-opener-policy": { desc: "Isolates the browsing context group (COOP)." },
  "cross-origin-embedder-policy": { desc: "Require CORS on embedded content (COEP)." },
  "cross-origin-resource-policy": { desc: "Restricts who may load this resource (CORP)." },
  "access-control-allow-origin": { desc: "CORS: which origins may read this response." },
  "x-xss-protection": { desc: "Deprecated legacy XSS auditor header." },
  "cache-control": { desc: "Caching directives for intermediaries and browsers." },
  "set-cookie": { desc: "Session cookie — check Secure, HttpOnly & SameSite flags." },
  "content-type": { desc: "Payload media type & charset." },
  "content-encoding": { desc: "Compression applied to the body (gzip, br…)." },
  "vary": { desc: "Cache key dimensions for content negotiation." },
};

export interface ParsedHeaders {
  statusLine: string | null;
  headers: HttpHeader[];
  notices: HttpHeaderNotice[];
}

export function parseHttpHeaders(input: string): { ok: true; parsed: ParsedHeaders } | { ok: false; error: string } {
  if (input.trim().length === 0) return { ok: false, error: "Awaiting input — paste raw HTTP headers to inspect." };
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const headers: HttpHeader[] = [];
  const notices: HttpHeaderNotice[] = [];
  let statusLine: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (i === 0 && /^HTTP\/[\d.]+ \d{3}/i.test(line)) {
      statusLine = line;
      notices.push({ kind: "status-line", text: `Response status line detected: ${line}` });
      continue;
    }
    if (statusLine === null && headers.length === 0 && i === 0 && /^[A-Z]+ [^ ]+ HTTP\//i.test(line)) {
      statusLine = line;
      notices.push({ kind: "request-line", text: `Request line detected: ${line}` });
      continue;
    }
    if (line.trim().length === 0) continue;

    // obs-fold: continuation line belongs to the previous header
    if (/^\s/.test(line) && headers.length > 0) {
      const last = headers[headers.length - 1]!;
      last.value = `${last.value} ${line.trim()}`;
      continue;
    }

    const m = /^([A-Za-z0-9_\-\.]+)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      notices.push({ kind: "warn", text: `Line ${i + 1} is not a valid header (missing "Name: value") — skipped.` });
      continue;
    }
    headers.push({ name: m[1]!, value: m[2]!, duplicate: false });
  }

  // detect duplicates
  const seen = new Map<string, number>();
  for (const h of headers) {
    const lower = h.name.toLowerCase();
    seen.set(lower, (seen.get(lower) ?? 0) + 1);
  }
  for (const h of headers) h.duplicate = (seen.get(h.name.toLowerCase()) ?? 0) > 1;
  for (const [name, count] of seen) {
    if (count > 1) {
      notices.push({
        kind: "warn",
        text: `Header "${name}" appears ${count}× — intentional for some headers (Set-Cookie), accidental for others.`,
      });
    }
  }

  // security header coverage
  const present = new Set(headers.map((h) => h.name.toLowerCase()));
  if (statusLine) {
    const recommended = ["content-security-policy", "strict-transport-security", "x-content-type-options", "referrer-policy"];
    const missing = recommended.filter((h) => !present.has(h));
    if (missing.length > 0) {
      notices.push({ kind: "info", text: `Missing common security headers: ${missing.join(", ")}.` });
    }
  } else {
    notices.push({ kind: "info", text: "No status/request line detected — treating input as a bare header block." });
  }

  return { ok: true, parsed: { statusLine, headers, notices } };
}

export function headerDescription(name: string): string | undefined {
  return SECURITY_HEADERS[name.toLowerCase()]?.desc;
}

export function isSecurityRelevant(name: string): boolean {
  return name.toLowerCase() in SECURITY_HEADERS;
}
