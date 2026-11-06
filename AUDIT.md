# Baby Got Tools — Bugs & Vulnerabilities Audit

**Scope:** full project — backend (Express/Mongo), frontend (Next.js engines), Docker config, SEO layer, dependencies.
**Date:** 2026-11-05 · **Audited at:** current `master` (b817cee)

**Automated ground truth at audit time:**

| Check | Result |
|---|---|
| `tsc --noEmit` backend / frontend | ✅ / ✅ |
| vitest backend | ✅ 19/19 |
| vitest frontend | ✅ 155/155 |
| `npm audit` backend | 🔴 1 high (zod) |
| `npm audit` frontend | 🔴 1 critical (tar, transitive) + 5 high + 1 moderate |
| Slug registry ↔ workspaces ↔ backend allow-list | ✅ 63/63 aligned, no orphans/dupes |

---

## 🔴 HIGH — Security

### H1. MongoDB is exposed to the host with no authentication
**File:** `docker-compose.yml:5-16`
```
ports:
  - "27017:27017"
```
mongo:7 runs with no `MONGO_INITDB_ROOT_USERNAME/PASSWORD` and publishes `27017` on the host. Anyone who can reach the machine on that port (LAN, corporate network, or the host itself if port-forwarded) can read/write all collections directly — including clipboard relay messages (often private cross-device text) and feedback (which stores optionally provided email addresses = PII).

**Fix**
- Remove the `ports` mapping (the `api` service reaches mongo over the compose network regardless), or
- Add auth credentials and connect with `mongodb://user:pass@mongo:27017/babygottools?authSource=admin`.

---

### H2. Vulnerable dependency directly on the attack path: `pdfjs-dist` — arbitrary JavaScript execution
**Advisory:** GHSA-hq66-cqwq-w95j (HIGH) — *"PDF.js: Arbitrary JavaScript execution upon opening a malicious PDF"*, affects `pdfjs-dist ≥3.0.279, <6.2.108` and also pulls in vulnerable `canvas` → vulnerable `tar` (CRITICAL, GHSA-34x7-hfp2-rcv et al.). Also flagged: `image-size` DoS (HIGH), `postcss` via `next` (HIGH ×4).

A site whose core job is opening untrusted files in the browser rendered with a vulnerable PDF.js is the textbook target for this advisory (embedded JavaScript inside a user-uploaded PDF executing in the renderer context).

**Fix:** `npm audit fix` in `frontend/` (bump `pdfjs-dist` to ≥ 6.2.108 and `image-size`), verify the worker bundles and the `pdf.worker.v5.min.mjs` header route still resolve after the major-version jump, then run the 155-test suite + a smoke of the PDF tools.
**Fix (backend):** `zod@^3.25.76 → ≥4.6.6` (GHSA-mrhx-c7xc-m3w5, HIGH — memory exhaustion validating oversized constrained collections). This one is a **breaking major** bump — it comes with the Phase 2 code changes in `validate.ts`/schemas.

---

## 🟠 MEDIUM — Security / Privacy consistency

### M1. Rate-limit bypass via forged `X-Forwarded-For` (unconditional `trust proxy` in production)
**File:** `backend/src/app.ts:19`; `backend/src/config/env.ts:43`
```ts
app.set("trust proxy", env.trustProxy); // trustProxy = nodeEnv === "production"
```
In production, **every** upstream is trusted. If the app is ever reachable other than directly behind a proxy that *overwrites* `X-Forwarded-For` (cloud LBs do, plain `docker run -p 4000:4000` does not), a client can rotate forged `X-Forwarded-For` values to defeat the per-IP limiters (write endpoints allow 20/min/IP). This protects the clipboard relay, feedback and usage counters from flooding.

**Fix:** set an explicit hop count (`app.set("trust proxy", 1)`) or a specific CIDR for the actual proxy, or gate `trustProxy` behind an explicit `TRUST_PROXY=true` env var instead of inferring it from `NODE_ENV`.

### M2. Rate limiter uses the default in-memory store
**File:** `backend/src/middleware/rateLimiter.ts:4-19`
Counters reset on every restart and are per-process — two `api` replicas (or any restart loop) multiply the effective budget. Acceptable for a single instance today; if scaling out, switch to a shared store (e.g. `express-rate-limit` + Redis/mongo store) or accept and document it.

### M3. Server logs record client IPs while the code claims "no raw IP retention"
**File:** `backend/src/server.ts:21`, `backend/src/config/env.ts:42`
```ts
logFormat: nodeEnv === "production" ? "combined" : "dev",
```
Morgan `combined` logs raw `:remote-addr` (client IP) for every request; `server.ts` simultaneously prints `"[api] privacy stance: no raw IP retention"`. Controllers store no IPs — but access *logs* do, so the printed privacy stance is false as long as `combined` is on in production.

**Fix:** strip IPs in a custom morgan stream (`:remote-addr` → fixed token) or switch to a privacy filter (e.g. mask last octet) and keep the claim/document an exception with log rotation/retention bound.

### M4. Feedback never expires — UI/privacy copy claims it does
**File:** `backend/src/models/feedback.model.ts:13-21` (no `expiresAt`, no TTL index) vs
**`frontend/features/contact/ContactForm.tsx:64-66`** ("…stored anonymously and **expires automatically**") and **`:152-154`** ("…**expire automatically**").
Feedback messages (and provided emails) are stored forever. Either:
- add a retention field + `FeedbackSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })` set at creation (e.g. 90 days), **or**
- correct the copy on both spots (and mention opt-in email retention honestly in the privacy policy).

### M5. CORS rejection and body-size failures surface as 500 "Something went wrong"
**File:** `backend/src/app.ts:26-35` (cors), `backend/src/app.ts:24` (global `express.json({limit:"16kb"})`), middleware: `backend/src/middleware/errorHandler.ts:20-32`.
Any error that is not an `HttpError` loses its status: the CORS middleware rejects disallowed origins with a generic `Error` → clients get **500 INTERNAL** instead of a CORS denial signal; body-parser's `PayloadTooLargeError` (status 413) also comes out as **500**, and the log records it as an unexpected failure. Not exploitable, but a real status-mapping hole that pollutes logs and confuses API consumers.
**Fix:** in `errorHandler.ts`, map known body-parser errors (`err.type === "entity.too.large"` → 413, CORS errors → 403 with `code: "CORS"`) before the generic branch.

---

## 🟡 LOW — Bugs (functional)

### L1. `usePdfFiles` — `maxFiles` guard does not actually block extra files
**File:** `frontend/features/pdf-tools/components/usePdfFiles.ts:41-47`
```ts
setFiles((current) => {
  if (current.length + list.length > maxFiles) {
    setNotice(`This tool accepts up to ${maxFiles} files at a time.`);
    return current;          // ← notice shown… but nothing is blocked here
  }
  return current;
});
```
- Both branches return `current` → this updater is a pure notice-shower **and** the real append below (`:80-92`) is never gated by `maxFiles` again. Example: tray has 18 of 20 slots, user drops 5 → banner warns + **all 5 are still added** (23 files).
- Correct pattern: compute the allowed slice **outside** the updater, show the notice once via `useEffect`/event, then `setFiles(c => [...c, ...parsed.slice(0, room)])`.
- Also: calling `setNotice()` from inside the updater is an impure updater side effect (double-invoked in StrictMode/dev).

### L2. `/api/v1/pdf/inspect` size-contract drift — three conflicting limits, one unreachable
**Files:** `backend/src/routes/pdf.routes.ts:24-35` (`express.json({limit:"3mb"})` + comment "≤ ~2MB decoded"), `pdf.routes.ts:31` (zod `max(20_000)` chars ≈ 15 KB decoded), `backend/src/services/pdfInspect.service.ts:16` (`MAX_INSPECT_BYTES = 10_000`).
- The **global 16 kb parser** (`app.ts:24`) rejects >16 kb bodies before the route's 3 mb parser is ever reached → the "3mb" contract is dead code.
- zod's 20k-char ceiling is itself unreachable (20,000 chars > 16 kb body limit).
- A payload between ~13.3 KB and 15 KB base64 would pass zod but 413 at the service — the layered message ("browser tools accept far more") is misleading.

**Fix:** align to one story — either raise the global limit just for this route before the global parser, or shrink the comment + zod ceiling to ≤ 13.3 KB and delete the 3 mb route parser.

### L3. Stale comments claim unknown tool slugs are "accepted but flagged"
**Files:** `backend/src/config/toolSlugs.ts:3-5` ("Unknown slugs are still counted (the endpoint returns 202)… flipping VALIDATE_SLUGS"), `backend/src/models/toolUsage.model.ts:20-21` ("bump requests are accepted but flagged").
Actual behavior: `backend/src/services/usage.service.ts:17-19` **throws 422 UNKNOWN_TOOL** for any slug not in the allow-list, and no `VALIDATE_SLUGS` flag exists. Comments describe a nonexistent feature — future contributors can easily "not fix" a bug believing it's intended.

### L4. `csvToJson` — duplicate header names silently overwrite (data loss)
**File:** `frontend/features/developer-tools/engines/csvEngine.ts:24-30`
```ts
header.forEach((name, i) => { obj[String(name ?? `column_${i+1}`).trim()] = row?.[i] ?? ""; });
```
Two columns named `id` → the first is silently dropped. Fix: dedupe as `id`, `id_2`.

### L5. `jsonToCsv` — unreachable ternary branch (dead code)
**File:** `frontend/features/developer-tools/engines/csvEngine.ts:70-76`
The third arm (`: Array.isArray(parsed) ? parsed : null`) is unreachable — `Array.isArray(parsed)` was already the first condition. Simplify to a 3-arm ternary testing the `data` wrapper then `null`.

### L6. Base64 decoder accepts malformed padding groups (`AB=C`-style) producing a junk byte
**File:** `frontend/features/developer-tools/engines/encoders.ts:52-73`
Harness-verified cases like `"AB=C"`/`"AB=C="` decode "successfully": the `=` in position 3 is zeroed out and bits from the following non-padding char leak into the output. Spec-strict inputs are unaffected, but a corrupted envelope decodes instead of failing loudly. Fix: when `c === "="` and `d !== "="` → reject ("Invalid Base64 — malformed padding").
Also: `csvEngine` email regex in `backend/.../feedback.routes.ts:19` accepts trailing-dot/dash TLDs (`a@b.c-`) — cosmetic.

### L7. Cron engine — dead nullish fallback
**File:** `frontend/features/developer-tools/engines/cronEngine.ts:92`
`next.toISOString() ?? next.toDate().toISOString()` — `toISOString()` never returns nullish, so the `??` arm is unreachable; if that API ever disappears from cron-parser's `CronDate` the fallback silently doesn't exist. Verify against the pinned cron-parser version and drop the dead arm.

### L8. Clipboard receive — 404 vs 410 distinguishability + UI retry semantics
**File:** `backend/src/controllers/clipboard.controller.ts:21-35`
410 (expired) vs 404 (unknown) tells a guesser the code *existed*. Trivial in an ~887 M codespace behind `readLimiter` (120/min/IP) — flagging for completeness, no action needed unless you want uniform 404s.
Minor UI: `CopyIconButton` fallback `document.execCommand("copy")` (`OnlineClipboardWorkspace.tsx:109`) copies nothing without a selection — harmless last-resort, consider dropping it to avoid confusion.

### L9. Engine-detection probes run serially
**File:** `backend/src/services/engineDetection.service.ts:64-73`
Four `execFileAsync` probes in sequence (4 s timeout each) → a genuinely slow host can make `/api/v1/pdf/engines` answer in up to ~16 s on a cold cache. `Promise.all` the probes.

---

## 💠 Info — Hardening / notes

1. **`JsonLdScript` doesn't escape `<`/`>` in JSON** — `frontend/lib/jsonld.tsx:134-141`. Data comes from the static registry today; standard hardening is `.replace(/</g, "\\u003c")` (and `\u2028/\u2029`) so a future CMS/user-data integration can't break out of the `<script>` context.
2. **No ReDoS found** — scanned all dev-tool engine regexes (`jsonEngine`, `textFormatters`, `unicodeEngine`, `queryStringEngine`, `diffEngine`, `httpHeaderEngine`): all linear-time patterns. The user-supplied-regex `regex-tester` can freeze the *user's own tab* on pathological input — acceptable by design (client-scoped), worth a tooltip warning.
3. **JWT engine is decode-only with correct warnings** (`jwtEngine.ts`) — no signature confusion, no trust placed in tokens; good.
4. **Crypto engine is strong** (`cryptoEngine.ts`) — AES-256-GCM, PBKDF2-SHA-256 @ 600k iters, random salt+IV per message, rejection-sampled tokens (no modulo bias), UUID v7 per RFC 9562. No findings.
5. **Clipboard relay end-to-end** — CSPRNG 6-char codes (31-alphabet, 887M space), TTL index enforced, no PII, confine-to-5000-chars validated both client & server, content rendered as text (`<pre>`, no HTML sink). Good.
6. **`/api/v1/pdf/*` never touches document bytes** beyond a ≤10 KB head sniff — a deliberately safe server-side profile. Keep it that way.
7. **No eval / new Function / dynamic-code paths anywhere in `frontend/`** (grep-verified).
8. **Docker runtime posture is decent** — multi-stage build, `npm ci --omit=dev`, `USER node` in `backend/Dockerfile:15`.
9. **Deployment wiring gap (docs):** nothing in `docker-compose.yml` serves `frontend/`; `NEXT_PUBLIC_API_BASE=/api/v1` assumes a same-origin reverse proxy in production. Worth a README deployment section.
10. **`serialize-error` hygiene** — error `details` are flattened zod field errors only; no stack leakage in prod (`errorHandler.ts:24-32` correctly gates dev messages).

---

## Fix priority order (Phase 2, suggested)

1. **H1** — close/expose-safe Mongo (1-line compose change + optional auth) → biggest win for lowest effort.
2. **H2** — `npm audit fix` frontend (pdfjs-dist/image-size), carefully re-test PDF workers; plan the backend **zod@4** upgrade together with its breaking-change code adjustments.
3. **M3** — stop logging raw IPs (or fix the claim).
4. **M1/M2** — explicit `trust proxy` semantics; shared store if/when scaled.
5. **M4** — either add feedback TTL or correct copy on the contact page + privacy policy.
6. **M5** — status mapping for body-parser/CORS errors in `errorHandler`.
7. L1 (`usePdfFiles` guard), L2 (inspect limits), L3 (comments), L4-L9 as housekeeping.

## What checked out clean

- Backend validation is double-enforced everywhere (zod route schema + service checks + mongoose schema limits); no NoSQL-injection sink (`findOne({accessCode: <string>})`, `body.toolSlug` regex-pinned, ObjectId pre-validated).
- All rate-limited: 20/min write, 120/min read, per route — no unprotected endpoint.
- Result-list caps (100 feedback / 100 jobs / 50 usage) are enforced in the services, not just controllers.
- TS strict mode compiles clean on both halves; **174 automated tests all green**.
- Slug registry, sitemap (`63` URLs), robots and tool workspaces are mutually consistent; no dead links found.

*End of audit report.*

---

## Remediation log — applied 2026-11-05

All fixes verified with `tsc --noEmit` + full vitest suites on both halves, post-change:

| Check | Result |
|---|---|
| `npx tsc --noEmit` backend / frontend | ✅ / ✅ |
| vitest backend | ✅ 22/22 (3 new regression tests) |
| vitest frontend | ✅ 157/157 (2 new regression tests) |
| `npm audit` backend (prod) | ✅ **0 vulnerabilities** |
| `npm audit` frontend (prod) | ⚠️ 1 residual (postcss-via-next@15, build-time only — fix = Next 16 major migration, deliberately deferred) |

**Applied**

- **H1** — `docker-compose.yml`: mongo bound to `127.0.0.1` only (loopback dev workflow preserved; `api` unaffected on the internal network). Shared-hosting guidance documented inline.
- **H2** — root `pdfjs-dist` → `4.10.38` (last v4, advisory-patched) with `public/pdf.worker.min.mjs` re-copied to match; nested `@pdf2md/core` pdf.js forced to the patched `6.2.108` via npm `overrides`, its worker re-copied as `public/pdf.worker.v6.min.mjs` (renamed from the stale `v5` naming, refs updated in `next.config.ts` + `markdownConverter.ts`). `image-size` → `2.0.4` override (pptx tests green). Backend `zod` → `4.6.7` directly (advisory patched; full API test suite passes, `flatten()` compat confirmed).
- **M1** — `trust proxy` no longer inferred from `NODE_ENV`: explicit `TRUST_PROXY` opt-in (`env.ts`, `app.ts`, docs in `.env.example`, README deployment section).
- **M2** — shared-store scaling requirement documented in `rateLimiter.ts`.
- **M3** — access logs no longer retain raw client IPs: custom `:masked-addr` morgan token replaces `:remote-addr` in the production-combined format (`app.ts`), keeping the "no raw IP retention" stance honest.
- **M4** — feedback now genuinely expires: `expiresAt` + TTL index on the collection (`feedback.model.ts`), retention stamped at creation from `FEEDBACK_TTL_DAYS` (1–3650, default 90; `env.ts` + `feedback.service.ts`). Matches the contact-form and privacy-page claims.
- **M5** — `errorHandler.ts` maps infrastructure errors to their real statuses: body-parser `entity.too.large` → 413 `PAYLOAD_TOO_LARGE`, `entity.parse.failed` → 422 `BAD_JSON_BODY`, disallowed CORS origins → 403 `CORS_ORIGIN_BLOCKED`, plus a generic 4xx passthrough. Regression-tested.
- **L1** — `usePdfFiles.ts` reworked: tray mutations decided once via an authoritative ref (`commit`), `maxFiles` reservations happen before parsing (over-limit files genuinely rejected with an accurate notice), byte-budget check moved out of updaters. StrictMode-impure updaters eliminated.
- **L2** — `/pdf/inspect` tiered contract: transport ceiling 15,000 base64 chars (~11.25 KB) under the 16 kb envelope + service diagnostic budget 10 KB enforced as 413 TOO_LARGE; dead 3 mb route parser removed; route + controller schemas kept in sync; stale "≤ ~2MB decoded" comments corrected.
- **L3** — stale allow-list comments corrected (`toolSlugs.ts`, `toolUsage.model.ts`) — unknown slugs are rejected 422, never "accepted but flagged".
- **L4** — `csvToJson` suffixes duplicate header names (`id`, `id_2`) instead of dropping data. Regression-tested.
- **L5** — unreachable ternary branch in `jsonToCsv` removed.
- **L6** — base64 decoder rejects padding before the final data group (`AB=C`, `A=B=` …) instead of emitting junk bytes. Regression-tested.
- **L7** — cron `toISOString()` fallback kept, now as an explicit typed-null branch with a comment (cron-parser v5 types it `string | null`).
- **L9** — engine probes run in parallel (`Promise.all`), worst-case cold latency = one probe timeout.
- **Docs** — README: feedback TTL in the tree/API table, corrected the clipboard "5-char code/consume" inaccuracies, access-log masking statement, and a new **Deployment wiring** section documenting the proxy + `TRUST_PROXY` + `NEXT_PUBLIC_SITE_URL` story.
- **Info1** — `JsonLdScript` escapes `<`, `\u2028`, `\u2029` so structured data can never break out of its script context.

**Residual (documented, not fixed)**

- `postcss` (via `next@15`) advisories — build-time CSS pipeline only; remediation requires the Next 16 major migration. Track separately.
- `tinypool` (via `vitest@3`) — dev/test runtime only, no production exposure; will be handled with the vitest 5 upgrade.
- M2 in-memory rate-limit store — code-level decision deferred until multi-replica scaling is actually needed.
