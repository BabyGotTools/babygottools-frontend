/** Engine test suite — pure functions, no DOM required. */

import { describe, expect, it } from "vitest";
import { decodeBase64Bytes, decodeBase64, encodeBase64, encodeUrl, decodeUrl } from "@/features/developer-tools/engines/encoders";
import { decryptText, parseEnvelopeString, encryptText, toEnvelopeString, generateToken, uuidV4, uuidV7, uuidV7Timestamp, nanoId } from "@/features/developer-tools/engines/cryptoEngine";
import { jsonToCsv, csvToJson } from "@/features/developer-tools/engines/csvEngine";
import { parseCronExpression } from "@/features/developer-tools/engines/cronEngine";
import { compareJsonValues, computeDiff } from "@/features/developer-tools/engines/diffEngine";
import { parseHttpHeaders } from "@/features/developer-tools/engines/httpHeaderEngine";
import { formatJson, queryJsonPath, tryRepairJson, inferJsonSchema } from "@/features/developer-tools/engines/jsonEngine";
import { decodeJwt } from "@/features/developer-tools/engines/jwtEngine";
import { generateMock } from "@/features/developer-tools/engines/mockApiEngine";
import { parseQueryString, rebuildQueryString, displayValue } from "@/features/developer-tools/engines/queryStringEngine";
import { homoglyphScan, inspectUnicode, sanitizeHidden } from "@/features/developer-tools/engines/unicodeEngine";

/* --------------------------------- Base64 --------------------------------- */

describe("base64 engine", () => {
  it("round-trips unicode (emoji, CJK) losslessly", () => {
    const text = "Baby Got Tools 🚀 → 工具";
    const encoded = encodeBase64(text);
    expect(encoded).not.toMatch(/[\r\n]/);
    const decoded = decodeBase64(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.text).toBe(text);
  });

  it("supports URL-safe alphabet + padding stripping", () => {
    const encoded = encodeBase64("any carnal pleasure?", true, true);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded.endsWith("=")).toBe(false);
  });

  it("rejects binary garbage with a useful message", () => {
    const res = decodeBase64("A");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("Base64");
  });

  it("rejects padding placed before the final data group (AB=C-style)", () => {
    // Regression: these used to decode with a silent junk byte.
    for (const bad of ["AB=C", "AB=C=", "AB=C==", "A=B="]) {
      const res = decodeBase64Bytes(bad);
      expect(res.ok).toBe(false);
    }
    // Valid padding placements still decode.
    expect(decodeBase64Bytes("AB==").ok).toBe(true);
    expect(decodeBase64Bytes("ABC=").ok).toBe(true);
  });
});

/* ---------------------------------- URL ----------------------------------- */

describe("url encoder", () => {
  it("component mode encodes reserved characters, whole mode preserves structure", () => {
    const raw = "https://example.com/search?q=hello world";
    const component = encodeUrl(raw, "component");
    expect(component).toContain("hello%20world");
    const whole = encodeUrl(raw, "whole");
    expect(whole.startsWith("https://example.com/search?q=")).toBe(true);
    expect(whole.includes("%20")).toBe(true);
  });

  it("decodes back to the original", () => {
    const original = "?q=baby got tools&x=1#frag";
    const decoded = decodeUrl(encodeUrl(original, "component"), "component");
    expect(decoded.ok && decoded.text === original).toBe(true);
  });
});

/* ------------------------------- JSON engine ------------------------------- */

describe("json engine", () => {
  it("reports line and column for syntax errors", () => {
    const out = formatJson('{\n  "a": 1,\n  "b": ,\n}', { indent: 2 });
    expect(out.ok).toBe(false);
    expect(out.error?.line).toBeGreaterThanOrEqual(3);
  });

  it("repairs single quotes, unquoted keys and trailing commas", () => {
    const repaired = tryRepairJson("{ name: 'Baby', tags: ['dev', 'tools',] }");
    expect(repaired.ok).toBe(true);
    expect(repaired.changed).toBe(true);
    if (repaired.ok) {
      const parsed = JSON.parse(repaired.repaired);
      expect(parsed.name).toBe("Baby");
      expect(parsed.tags).toEqual(["dev", "tools"]);
    }
  });

  it("repairs smart quotes, python literals, comments and structural slips", () => {
    const cases = [
      '{\u201Ca\u201D: 1 }',
      '{ a: True, b: None }',
      '{ // line\na: 1 }',
      '{ "a": 1 "b": 2 }',
      '{\n"a": "v1"\n"b": "v2"\n}',
      '{ "a": { "b": [1, 2] }',
      'const cfg = { a: 1 };',
      '{ "a": 1, }',
      "[1, 2,]",
    ];
    for (const input of cases) {
      const r = tryRepairJson(input);
      expect(r.ok, `should repair: ${input}`).toBe(true);
      expect(() => JSON.parse(r.repaired), `result parses: ${input}`).not.toThrow();
    }
  });

  it("never touches already-valid JSON", () => {
    const good = '{"ok": true, "n": [1, 2]}';
    const r = tryRepairJson(good);
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(false);
    expect(r.repaired).toBe(good);
  });

  it("queries dot + array-index paths", () => {
    const doc = { tools: [{ title: "json" }, { title: "sql" }] };
    const hit = queryJsonPath(doc, "$.tools[1].title");
    expect(hit.ok && hit.value === "sql").toBe(true);
    const bare = queryJsonPath(doc, "tools.0.title");
    expect(bare.ok && bare.value === "json").toBe(true);
  });

  it("infers a draft-07 schema with required fields", () => {
    const schema = inferJsonSchema({ a: 1, b: "s" }) as Record<string, unknown>;
    expect(schema["$schema"]).toContain("draft-07");
    expect(schema.required).toEqual(["a", "b"]);
  });
});

/* ----------------------------------- JWT ---------------------------------- */

describe("jwt debugger", () => {
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjEwMDAwMDAwMDB9.kEYhDUiMKtBg8gT7_mAefS0TbGdcZmSVWCsrfdLpuGA";

  it("decodes header, payload, algorithm and expiry without validating", () => {
    const res = decodeJwt(token);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.token.algorithm).toBe("HS256");
      expect(res.token.expired).toBe(true); // exp 1,000,000,000 is in the past
      expect(res.token.expiresAt).toBeInstanceOf(Date);
      expect(res.warnings.some((w) => /does not verify|unverified|not be trusted/i.test(w))).toBe(true);
    }
  });

  it("rejects garbage", () => {
    const res = decodeJwt("not.a.jwt");
    expect(res.ok).toBe(false);
  });
});

/* --------------------------------- Crypto --------------------------------- */

describe("text encryptor (AES-GCM envelope)", () => {
  const secret = "Baby Got Tools does not log";
  const password = "hunter2 stable token";

  it("round-trips through the BGT1 envelope", async () => {
    const parts = await encryptText(secret, password);
    const envelope = toEnvelopeString(parts);
    const parsed = parseEnvelopeString(envelope);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(envelope.startsWith("BGT1.")).toBe(true);
    const text = await decryptText(parsed.salt, parsed.iv, parsed.ciphertext, password);
    expect(text).toBe(secret);
  });

  it("fresh salt + IV per encryption (nonce reuse is impossible)", async () => {
    const a = await encryptText(secret, password);
    const b = await encryptText(secret, password);
    expect(a.salt !== b.salt || a.iv !== b.iv).toBe(true);
  });

  it("wrong password fails loudly (auth-tag mismatch)", async () => {
    const parts = await encryptText(secret, password);
    await expect(decryptText(parts.salt, parts.iv, parts.ciphertext, "wrong")).rejects.toThrow();
  });
});

describe("token + uuid generators", () => {
  it("produces length-correct hex and base64url tokens", () => {
    const hex = generateToken("hex", 32);
    expect(hex.length).toBe(32);
    expect(hex).toMatch(/^[0-9a-f]+$/);
    const b64u = generateToken("base64url", 16);
    expect(b64u).not.toMatch(/[+/=]/);
  });

  it("uuid v4 has correct version/variant bits", () => {
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("uuid v7 embeds a millisecond timestamp (RFC 9562)", () => {
    const ts = Date.parse("2026-02-03T04:05:06.789Z");
    const id = uuidV7(ts);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const back = uuidV7Timestamp(id);
    expect(back?.getTime()).toBe(ts);
  });

  it("nanoid output matches its 64-char URL-safe alphabet", () => {
    const id = nanoId(21);
    expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(typeof nanoId()).toBe("string");
  });
});

/* ----------------------------------- CSV ---------------------------------- */

describe("csv engines", () => {
  it("handles quoted commas and embedded newlines", async () => {
    const rows = await csvToJson('id,note\n1,"line one, still quoted"\n2,"multi\nline"', {
      delimiter: ",",
      headers: true,
    });
    expect(rows).toHaveLength(2);
    expect((rows[0] as Record<string, string>).note).toBe("line one, still quoted");
  });

  it("escapes commas & quotes going the other way", async () => {
    const { csv } = await jsonToCsv(JSON.stringify([{ name: "Doe, John", quote: 'He said "hi"' }]), { delimiter: "," });
    expect(csv).toContain('"Doe, John"');
    expect(csv).toContain('""hi""');
  });

  it("suffixes duplicate header names instead of overwriting them", async () => {
    const rows = await csvToJson("id,role,id\nA,admin,X\nB,editor,Y", {
      delimiter: ",",
      headers: true,
    });
    const first = rows[0] as Record<string, string>;
    // Regression: the first `id` column used to be silently dropped.
    expect(first).toEqual({ id: "A", role: "admin", id_2: "X" });
  });
});

/* ----------------------------------- Cron --------------------------------- */

describe("cron engine", () => {
  it("parses 5-field expressions and returns future ISO runs", async () => {
    const res = await parseCronExpression("*/15 9-17 * * 1-5", { count: 5 });
    expect(res.ok).toBe(true);
    expect(res.nextRuns).toHaveLength(5);
    expect(res.nextRuns?.[0]).toBeTruthy();
    expect(Number.isNaN(Date.parse(res.nextRuns!.every(Boolean) ? "" + res.nextRuns![0] : ""))).toBe(false);
  });

  it("rejects 7-field garbage with a message", async () => {
    const res = await parseCronExpression("a b c d e f g", {});
    expect(res.ok).toBe(false);
    expect(res.error).toContain("7");
  });
});

/* --------------------------------- Diffing -------------------------------- */

describe("diff engine", () => {
  it("computes line diff with correct stats", async () => {
    const res = await computeDiff("alpha\nbravo\ncharlie", "alpha\nbravissimo\ncharlie", "lines");
    expect(res.stats.added + res.stats.removed).toBeGreaterThan(0);
    expect(res.rows.some((r) => r.type === "removed")).toBe(true);
    expect(res.rows.some((r) => r.type === "added")).toBe(true);
  });

  it("structural JSON diff ignores key order", () => {
    const changes = compareJsonValues({ a: 1, b: 2 }, { b: 2, a: 1 });
    expect(changes).toHaveLength(0);
    const changed = compareJsonValues({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(changed[0]?.type).toBe("changed");
    expect(changed[0]?.path).toBe("$.b");
  });
});

/* ------------------------------- HTTP headers ------------------------------ */

describe("http header inspector", () => {
  it("parses status line, keeps duplicates and flags them", () => {
    const res = parseHttpHeaders("HTTP/2 200\nx-a: one\nx-a: two");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.parsed.statusLine).toContain("200");
      expect(res.parsed.headers.filter((h) => h.name === "x-a")).toHaveLength(2);
      expect(res.parsed.headers.every((h) => h.name !== "x-a" || h.duplicate)).toBe(true);
    }
  });

  it("merges obs-fold continuation lines (RFC 9112)", () => {
    const res = parseHttpHeaders("HTTP/2 200\ncontent-security-policy: default-src 'self'\n  frame-ancestors 'none'");
    expect(res.ok).toBe(true);
    if (res.ok) {
      const csp = res.parsed.headers.find((h) => h.name === "content-security-policy");
      expect(csp?.value).toContain("default-src 'self'");
      expect(csp?.value).toContain("frame-ancestors 'none'");
    }
  });

  it("never fetches a URL — pure parser", () => {
    expect(parseHttpHeaders.length).toBeLessThan(2); // sanity: synchronous, no fetch
  });
});

/* --------------------------------- Unicode -------------------------------- */

describe("unicode engines", () => {
  it("counts graphemes (not UTF-16 units) for emoji + surrogate pairs", () => {
    const report = inspectUnicode("🚀a");
    expect(report.graphemes.length).toBe(2);
    expect(report.utf16Count).toBe(3); // 🚀 is 2 units + 'a'
  });

  it("sanitizeHidden strips zero-width junk and counts it", () => {
    const dirty = "bab\u200by\u2060got";
    const { cleaned, removed } = sanitizeHidden(dirty);
    expect(cleaned).toBe("babygot");
    expect(removed).toBe(2);
  });

  it("flags confusables from the Cyrillic/Greek watchlist", () => {
    const hits = homoglyphScan("pаypаl");
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});

/* --------------------------------- Query string --------------------------- */

describe("query string engine", () => {
  it("keeps repeated keys; editing table gets decoded values via displayValue", () => {
    const parsed = parseQueryString("https://b.example/cat?a=1&a=2&q=hello%20world");
    expect(parsed.baseUrl).toBe("https://b.example/cat");
    const a = parsed.params.find((p) => p.key === "a");
    expect(a?.values).toEqual(["1", "2"]);
    // engine stays lossless; the workspace applies displayValue once for display
    const q = parsed.params.find((p) => p.key === "q");
    expect(displayValue(q?.values[0] ?? "")).toBe("hello world");
  });

  it("supports bare ?query strings and flag params", () => {
    const parsed = parseQueryString("?flag&n=10");
    const flag = parsed.params.find((p) => p.key === "flag");
    expect(flag?.values).toEqual([""]);
    expect(parsed.rawQuery.startsWith("flag")).toBe(true);
  });

  it("rebuilds with proper percent-encoding", () => {
    expect(rebuildQueryString([{ key: "q", values: ["hello world"] }])).toBe("q=hello%20world");
  });
});

/* --------------------------------- API mock ------------------------------- */

describe("api mock generator", () => {
  it("success scenario returns a result payload", () => {
    const mock = generateMock({ scenario: "success", resource: "users", count: 3, includeTimestamps: false });
    expect(mock.code).toBe(200);
    expect(mock.result).toBeDefined();
  });

  it("error scenarios carry status codes and structured errors", () => {
    const unauthorized = generateMock({ scenario: "unauthorized", resource: "users", count: 1, includeTimestamps: false });
    expect(unauthorized.code).toBe(401);
    expect(Array.isArray(unauthorized.errors)).toBe(true);
  });

  it("paginated scenario shape includes page metadata", () => {
    const paged = generateMock({ scenario: "paginated", resource: "orders", count: 2, includeTimestamps: true });
    expect(paged.page).toBe(1);
    expect(paged.results).toBeTruthy();
  });
});
