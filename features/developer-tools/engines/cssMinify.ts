/**
 * CSS minification engine using csso (AST-based structural optimizer).
 * Used by the CSS Minifier tool; the beautifier path uses Prettier instead.
 */

export interface CssMinifyResult {
  ok: boolean;
  css: string;
  error?: string;
  /** csso reports a structures size delta vs the input parse. */
  notes?: string[];
}

export async function minifyCss(source: string): Promise<CssMinifyResult> {
  if (source.trim().length === 0) {
    return { ok: false, css: "", error: "Awaiting input — paste CSS to compress." };
  }
  try {
    const csso = await import("csso");
    const result = csso.minify(source, { restructure: true, comments: false });
    const notes: string[] = [];
    // csso diagnostics type (v5) exposes warnings? keep it tolerant
    const diagnostics = (result as unknown as { diagnostics?: unknown[] }).diagnostics;
    if (Array.isArray(diagnostics) && diagnostics.length > 0) {
      notes.push(`${diagnostics.length} parser notes were produced during minification.`);
    }
    return { ok: true, css: result.css, notes };
  } catch (e) {
    return {
      ok: false,
      css: "",
      error: e instanceof Error ? e.message : "CSS could not be parsed for minification.",
    };
  }
}
