/**
 * Local replacement for `pdfjs-serverless`.
 *
 * `extract-pdf` loads its PDF.js build from a jsDelivr URL by default. That
 * would be a network request (and a privacy leak) in an otherwise local-only
 * pipeline, so the webpack config rewrites the request to this module. It
 * returns the pdf.js build that is already bundled with the app and points it
 * at the locally copied worker.
 */
import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function resolvePDFJS(): typeof pdfjs {
  return pdfjs;
}
