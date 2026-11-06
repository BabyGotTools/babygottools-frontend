# Baby Got Tools — Frontend

Privacy-first toolbox frontend: **every tool runs 100% client-side** (JS/WASM engines
in the browser). Nothing about the tools depends on the backend.

The optional companion API lives in the separate
`babygottools-backend` repo (usage counters, feedback,
anonymous clipboard relay, PDF job analytics). The frontend works fully standalone
and simply serves an honest `503`-backed state when the backend is absent.

## Stack

- **Next.js 15** (App Router) + **React 19** + TypeScript
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Vitest** engine test suite (155 tests) + Puppeteer-based E2E scripts
- 63 client-side tools: 34 developer tools + 29 PDF/document tools

## Structure

```
frontend/
├── app/                  routes — /, /developer-tools, /tools/pdf, /tools/[slug] ×63,
│                         sitemap, robots, opengraph-image
├── components/           layout/, home/, tools/ (shell, ribbon, sections), common/
├── features/             developer-tools/ (34 workspaces + engines)
│                         pdf-tools/ (29 workspaces + engines + registry)
├── data/                 devTools.ts (34), pdfTools.ts (29), types, categories, SEO
├── hooks/                useClipboard / useDownload / useReveal / useTheme
├── lib/                  site.ts, jsonld.tsx (JSON-LD)
├── scripts/              Puppeteer E2E: browser-e2e.mjs, pdf-smoke.mjs, loaders
├── tests/                vitest suites (engines + convert-from)
└── public/               tesseract/, tesseract-core/, kreuzberg/, pdfstudio/, fonts/
```

## Running

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # prerenders 71 pages (63 under /tools/*)
npm run typecheck
npx vitest run       # 155 engine tests
```

## Browser engines (bundled, no server needed)

`pdf-lib` + `pdfjs-dist` (merge/split/organize), qpdf WASM via `pdfstudio`
(compress/repair), `tesseract.js` OCR, `@pdf2md/core` (→ Markdown),
`extract-pdf` (→ HTML), `pptxgenjs` (→ PowerPoint), Kreuzberg WASM
(table extraction, assets served from `/public/kreuzberg`), `reamkit`,
plus format tooling: `papaparse`, `sql-formatter`, `yaml`, `graphql`,
`marked` + `highlight.js` + `dompurify`, `csso`, `fflate`, `heic2any`, `html2canvas`.

## Environment

Copy `.env.example` → `.env`:

- `NEXT_PUBLIC_SITE_URL` — canonical origin (sitemap/robots/canonical/og:url)
- `API_PROXY_TARGET` — dev proxy target for the optional API (default `127.0.0.1:4000`)
- `NEXT_PUBLIC_API_BASE` — browser-side API base (default same-origin `/api/v1`)

`next.config.ts` rewrites `/api/v1/*` to the API in dev so dev runs same-origin.

## Deployment

One origin, reverse proxy split (nginx/Caddy/Vercel rewrite):

```
browser → reverse proxy
            ├── /*            → this frontend
            └── /api/v1/*     → babygottools-backend api:4000
```

Frontend-only deployments are valid; platform features just degrade.

## Scope history

This app previously lived in the `Baby Got Tools` monorepo (full history archived
at `BabyGotTools/BabyGotTools` on GitHub) and was split out into its own repo.
`AUDIT.md` is the workspace-wide audit kept for reference.
