/**
 * Webpack loader for `extract-pdf`'s browser bundle.
 *
 * The bundle loads its PDF.js build from a jsDelivr URL:
 *
 *   import("https://cdn.jsdelivr.net/npm/pdfjs-serverless@1/+esm")
 *
 * Webpack treats that as an external ESM module, which (a) would be a network
 * request at runtime and (b) cannot be emitted for the web worker target. The
 * URL is rewritten to the bare `pdfjs-serverless` specifier before parsing;
 * `next.config.ts` then aliases that specifier to our local shim.
 */
const CDN_URL = "https://cdn.jsdelivr.net/npm/pdfjs-serverless@1/+esm";

module.exports = function extractPdfLoader(source) {
  if (typeof source !== "string") return source;
  if (!source.includes(CDN_URL)) return source;
  return source.split(CDN_URL).join("pdfjs-serverless");
};
