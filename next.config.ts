import path from "node:path";
import type { NextConfig } from "next";

const PDFJS_SERVERLESS_CDN =
  "https://cdn.jsdelivr.net/npm/pdfjs-serverless@1/+esm";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Both project folders live in the same workspace directory.
  outputFileTracingRoot: __dirname,
  // Dev convenience: proxy the platform API so the frontend stays same-origin.
  // In production, point the reverse proxy (or NEXT_PUBLIC_API_BASE) at the API host.
  async rewrites() {
    const apiTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiTarget}/api/v1/:path*`,
      },
    ];
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        // `@kreuzberg/wasm` probes for a Node worker runtime before falling
        // back to a browser Worker. The probe is unreachable in the browser,
        // but webpack still resolves the literal dynamic import.
        worker_threads: false,
      };

      // `pdfstudio` wraps qpdf's Emscripten glue, which imports `node:*`
      // builtins so it can detect a Node runtime. Its `node:fs/promises`
      // import is deliberately written as `import('node' + ':fs/promises')`
      // to dodge static analysis -- webpack constant-folds it back and then
      // dies with "UnhandledSchemeError: Reading from node:fs is not handled".
      //
      // That branch only runs when `globalThis.process?.versions?.node` is
      // set, which never happens in a browser, so ignoring the specifiers is
      // safe. `resolve.alias` is not enough here: webpack rejects the unknown
      // scheme before alias resolution runs.
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^node:/,
        })
      );
    }

    // Convert-from-PDF suite (ported from the "i love pdf" project):
    // `extract-pdf` ships a slim build whose default PDF.js loader points at
    // a jsDelivr URL. Rewrite that request (and the bare fallback) to the
    // locally bundled pdf.js build so the HTML converter never touches the
    // network. A `beforeResolve` hook is required: webpack rejects the
    // `https:` scheme before NormalModuleReplacementPlugin gets a chance.
    //
    // The same hook stubs optional `extract-pdf` integrations we never use
    // (remote Docling models, Node-only canvas, LiteParse). Webpack still
    // resolves every literal dynamic `import()` it can see, even when the
    // branch is unreachable at runtime.
    //
    // This applies to both the client and server compilations: Next also
    // traverses client components while building the server graph.
    const pdfjsShim = path.resolve(
      __dirname,
      "features/pdf-tools/engines/convertFrom/pdfjsServerlessShim.ts"
    );
    const emptyModule = path.resolve(
      __dirname,
      "features/pdf-tools/engines/convertFrom/emptyModule.ts"
    );
    const stubbedRequests = new Set([
      "@llamaindex/liteparse",
      "@llamaindex/liteparse-wasm",
      "@huggingface/transformers",
      "@napi-rs/canvas",
    ]);

    // Rewrite the CDN import at the source level. Webpack classifies URL
    // specifiers as external modules before `beforeResolve` runs, so the hook
    // alone cannot intercept it.
    config.module.rules.push({
      test: /extract-pdf[\\/]dist[\\/]pdf-to-html\.es\.js$/,
      use: [
        {
          loader: path.resolve(__dirname, "scripts/loaders/extract-pdf-loader.cjs"),
        },
      ],
    });

    config.plugins.push({
      apply(compiler: any) {
        compiler.hooks.normalModuleFactory.tap(
          "ConvertFromPdfjsResolver",
          (factory: any) => {
            factory.hooks.beforeResolve.tap(
              "ConvertFromPdfjsResolver",
              (data: { request?: string }) => {
                if (!data.request) return;
                if (
                  data.request === PDFJS_SERVERLESS_CDN ||
                  data.request === "pdfjs-serverless"
                ) {
                  data.request = pdfjsShim;
                  return;
                }
                if (stubbedRequests.has(data.request)) {
                  data.request = emptyModule;
                }
              }
            );
          }
        );
      },
    });

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // No explicit worker plugin is needed: webpack 5 recognises
    // `new Worker(new URL("./convertFromWorker.ts", import.meta.url))` on its
    // own and emits the worker as a separate chunk.

    return config;
  },
  async headers() {
    return [
      {
        source: "/pdf.worker.min.mjs",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/pdf.worker.v6.min.mjs",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/kreuzberg/kreuzberg_wasm_bg.wasm",
        headers: [
          {
            key: "Content-Type",
            value: "application/wasm",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/kreuzberg/kreuzberg_wasm.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/kreuzberg/pdfium.esm.wasm",
        headers: [
          {
            key: "Content-Type",
            value: "application/wasm",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/kreuzberg/pdfium.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
