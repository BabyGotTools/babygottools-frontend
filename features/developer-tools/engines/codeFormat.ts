/**
 * Prettier-based code formatting engine. Each formatter type dynamic-imports
 * only its prettier parser plugin, keeping per-tool bundles tiny and keeping
 * every library out of the homepage bundle.
 */

export type FormatLanguage = "javascript" | "typescript" | "html" | "css" | "graphql";

/** Prettier's plugin shape (from the standalone runtime). */
type PrettierPlugin = import("prettier").Plugin;

export interface CodeFormatOptions {
  indent: 2 | 4 | "tabs";
  semi: boolean;
  singleQuote: boolean;
  useTabs: boolean;
}

export function prettierOptions(lang: FormatLanguage, opts: CodeFormatOptions): Record<string, unknown> {
  const parser =
    lang === "javascript" ? "babel" : lang === "typescript" ? "typescript" : lang === "html" ? "html" : lang === "css" ? "css" : "graphql";
  return {
    parser,
    tabWidth: opts.indent === "tabs" ? 2 : opts.indent,
    useTabs: opts.indent === "tabs",
    semi: opts.semi,
    singleQuote: opts.singleQuote,
    printWidth: 100,
  };
}

async function prettier() {
  return import("prettier/standalone");
}

export async function formatCode(
  source: string,
  lang: FormatLanguage,
  opts: CodeFormatOptions
): Promise<string> {
  const prettierStandalone = await prettier();
  const options = prettierOptions(lang, opts);
  const plugins: PrettierPlugin[] = [];
  switch (lang) {
    case "javascript":
      plugins.push(await import("prettier/plugins/babel"), await import("prettier/plugins/estree"));
      break;
    case "typescript":
      plugins.push(await import("prettier/plugins/typescript"), await import("prettier/plugins/estree"));
      break;
    case "html":
      plugins.push(await import("prettier/plugins/html"), await import("prettier/plugins/postcss"));
      break;
    case "css":
      plugins.push(await import("prettier/plugins/postcss"));
      break;
    case "graphql":
      plugins.push(await import("prettier/plugins/graphql"));
      break;
  }
  try {
    return await prettierStandalone.format(source, { ...options, plugins });
  } catch (e) {
    const err = e as Error;
    // Prettier error messages already include line/col — surface them verbatim.
    throw new Error(err.message || "Unable to format — the source contains syntax the parser could not read.");
  }
}

/** Minify HTML by collapsing inter-tag whitespace (format-then-compress). */
export async function minifyHtml(source: string): Promise<string> {
  const formatted = await formatCode(source, "html", {
    indent: 2,
    semi: true,
    singleQuote: false,
    useTabs: false,
  });
  return formatted
    .replace(/>\s*\n\s*</g, "><") // close + open on separate lines -> touching
    .replace(/\n{2,}/g, "\n")
    .trim();
}
