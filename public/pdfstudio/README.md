# Vendored pdfstudio (qpdf WASM)

Verbatim copy of the `pdfstudio` npm package's `dist/`, served as static
assets and loaded at runtime as native ES modules by
`features/pdf-tools/engines/pdfStudio.ts` via
`import(/* webpackIgnore: true */ "/pdfstudio/index.js")`.

## Why vendored instead of bundled

The package is browser-first, but its dist contains two Node-only dynamic
imports behind environment guards that never execute in a browser:

- `wasm/qpdf.js` (Emscripten glue): `await import("node:module")` guarded by
  `ENVIRONMENT_IS_NODE` (only true under real Node.js).
- `runner.js`: `await import('node' + ':fs/promises')` for `file:` URLs, only
  reachable when the wasm URL uses the `file:` protocol.

Webpack constant-folds `'node' + ':fs/promises'` and tries to resolve both
specifiers at build time, failing the Next.js production build with
`UnhandledSchemeError: Reading from "node:fs/promises" is not handled by
plugins`. Serving the files verbatim from /public keeps them out of the
webpack graph while the browser runtime path (fetch + compile the wasm) is
byte-identical to what `scripts/pdf-smoke.mjs` exercises under Node.

## Contents (from pdfstudio@0.4.0, Apache-2.0)

| File             | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `index.js`       | High-level `PdfToolkit` / `createPdfToolkit` |
| `runner.js`      | qpdf job runner (MEMFS staging, stdout capture) |
| `errors.js`      | `PdfError` / `PdfPasswordError`            |
| `images.js`      | JPEG → PDF writer (pure TS, no wasm)       |
| `wasm/qpdf.js`   | Emscripten glue for the qpdf wasm binary   |
| `wasm/qpdf.wasm` | qpdf compiled to WebAssembly (~2.2 MB)     |

## Updating

Re-copy from `node_modules/pdfstudio/dist/` whenever the dependency version
in `frontend/package.json` changes:

```sh
cp node_modules/pdfstudio/dist/{index.js,runner.js,errors.js,images.js} public/pdfstudio/
cp node_modules/pdfstudio/dist/wasm/{qpdf.js,qpdf.wasm} public/pdfstudio/wasm/
```

The type definitions still come from the npm package (`import type ... from
"pdfstudio"`), so a version bump that changes the API will surface as a
TypeScript error rather than a silent runtime mismatch.
