"use client";

/** Formatter workspaces built on the shared FormatterWorkbench. */

import { useMemo } from "react";
import FormatterWorkbench from "./FormatterWorkbench";
import { formatCode, minifyHtml, type CodeFormatOptions, type FormatLanguage } from "../engines/codeFormat";
import { formatSql, SQL_DIALECTS, type SqlDialect } from "../engines/sqlEngine";
import { formatYaml } from "../engines/yamlEngine";
import { minifyCss } from "../engines/cssMinify";
import { formatLua, formatPhp, formatPython } from "../engines/textFormatters";

/* ------------------------------- SQL tools -------------------------------- */

export function SqlWorkspace({ variant }: { variant: "interactive" | "scripts" }) {
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) => {
      const dialect = (opts.indent?.startsWith("sql:") ? opts.indent.slice(4) : "postgresql") as SqlDialect;
      return formatSql(input, {
        dialect,
        indent: 4,
        keywordCase: "upper",
      });
    },
    []
  );
  return (
    <FormatterWorkbench
      placeholder={"SELECT id, name FROM users WHERE active = true;"}
      sample={
        variant === "interactive"
          ? `SELECT u.id, u.email, COUNT(o.id) AS order_count\nFROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.deleted_at IS NULL AND o.created_at > '2024-01-01'\nGROUP BY u.id, u.email HAVING COUNT(o.id) > 3\nORDER BY order_count DESC LIMIT 50;`
          : `-- analytics: user activity rollup\nWITH daily AS (SELECT DATE(created_at) d, user_id, COUNT(*) n FROM events GROUP BY d, user_id)\nSELECT d, COUNT(DISTINCT user_id) users, SUM(n) events\nFROM daily GROUP BY d ORDER BY d DESC LIMIT 30;`
      }
      fileExtension=".sql"
      mime="application/sql;charset=utf-8"
      buttonLabel="Format SQL"
      buttonIcon="format_align_left"
      inputTitle="SQL Input"
      inputChip={variant === "scripts" ? "MULTI STATEMENT" : "PARSE TEXT"}
      outputTitle="Formatted SQL"
      outputChip="FORMATTED"
      outputPlaceholder="Formatted SQL appears here — press Format SQL."
      indentOptions={SQL_DIALECTS.map((d) => ({ label: d.label, value: `sql:${d.value}` }))}
      defaultIndent="sql:postgresql"
      run={run}
      outputStats={(out) => [{ label: "Statements", value: String((out.match(/;\s*$/gm) ?? []).length > 0 ? (out.match(/;\s*$/gm) ?? []).length : 1) }]}
      outputFooterNote="Parsed — never executed"
    />
  );
}

/* ------------------------------ JS / TS ----------------------------------- */

export function JsWorkspace({ language }: { language: "javascript" | "typescript" }) {
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) => {
      const options: CodeFormatOptions = {
        indent: opts.indent === "tabs" ? "tabs" : opts.indent === "4" ? 4 : 2,
        semi: opts.indent.startsWith("semi:off") ? false : true,
        singleQuote: opts.indent.startsWith("single:on"),
        useTabs: false,
      };
      return formatCode(input, language as FormatLanguage, options);
    },
    [language]
  );
  const options = useMemo(
    () => [
      { label: "2 Spaces", value: "2" },
      { label: "4 Spaces", value: "4" },
      { label: "Tabs", value: "tabs" },
      { label: "No Semi", value: "semi:off" },
      { label: "Single Quotes", value: "single:on" },
    ],
    []
  );
  const sample =
    language === "typescript"
      ? `interface Hub { id: string; title: string; tools: string[] }\nconst hubs=new Map<string, Hub>();\nexport function registerTool(hub: Hub) : void { if (hubs.has(hub.id)) throw new Error("dup");\nhubs.set(hub.id, hub); }`
      : `import { createClient } from "@bgt/client";\n\nexport const boot=async()=>{const client=createClient({"engine":"wasm",reactive:true});\nawait client.warm(["pdf","dev","image"]);const tools=client.list().filter(t=>t.enabled);\nreturn tools.map(tool=>tool.title).join(", ");};`;
  return (
    <FormatterWorkbench
      placeholder={language === "typescript" ? "const id: string = 'ts';" : "const x = 1;"}
      sample={sample}
      fileExtension={language === "typescript" ? ".ts" : ".js"}
      mime={language === "typescript" ? "text/plain;charset=utf-8" : "text/javascript;charset=utf-8"}
      buttonLabel={language === "typescript" ? "Format TypeScript" : "Format JavaScript"}
      buttonIcon="format_align_left"
      inputTitle="Source Code"
      inputChip={language === "typescript" ? "TYPESCRIPT" : "JAVASCRIPT"}
      outputTitle="Formatted Code"
      outputChip="PRINTED"
      outputPlaceholder="Beautified code appears here — the source is parsed, never executed."
      indentOptions={options}
      defaultIndent="2"
      run={run}
      outputStats={(out) => [{ label: "Lines", value: String(out.split("\n").length) }]}
      outputFooterNote="Parse-only"
    />
  );
}

/* ------------------------------- YAML ------------------------------------- */

export function YamlWorkspace() {
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) => {
      const res = await formatYaml(input, { indent: opts.indent === "4" ? 4 : 2 });
      if (!res.ok) throw new Error(`${res.error?.message ?? "Invalid YAML"}${res.error?.line ? ` (line ${res.error.line})` : ""}`);
      return res.output;
    },
    []
  );
  return (
    <FormatterWorkbench
      placeholder="service:\n  name: baby-got-tools"
      sample={`service:\n  name: baby-got-tools\n  version: "1.0.0"\n  replicas: 2\n  ports:\n    - 3000\n    - 8080\n  labels:\n    team: core\n    tier: edge`}
      fileExtension=".yaml"
      mime="application/yaml;charset=utf-8"
      buttonLabel="Format YAML"
      buttonIcon="format_align_left"
      inputTitle="YAML Input"
      inputChip="STRICT 1.2"
      outputTitle="Normalized YAML"
      outputChip="OUTPUT"
      outputPlaceholder="Normalized YAML appears here — parse errors report the offending line."
      indentOptions={[
        { label: "2 Spaces", value: "2" },
        { label: "4 Spaces", value: "4" },
      ]}
      defaultIndent="2"
      run={run}
      validate={(text) => null}
      outputStats={(out) => [{ label: "Lines", value: String(out.split("\n").length) }]}
      outputFooterNote="YAML 1.2 • Lossless"
    />
  );
}

/* ------------------------------ GraphQL ----------------------------------- */

export function GraphqlWorkspace() {
  const run = useMemo(
    () => async (input: string) => formatCode(input, "graphql", { indent: 2, semi: true, singleQuote: false, useTabs: false }),
    []
  );
  return (
    <FormatterWorkbench
      placeholder="query { me { id name } }"
      sample={`query ProductSearch($term: String!, $first: Int = 10) {\n  search(term: $term, first: $first) { edges { node { ... on Product { id title price } ... on Article { id headline } } } }\n}`}
      fileExtension=".graphql"
      mime="application/graphql;charset=utf-8"
      buttonLabel="Format GraphQL"
      buttonIcon="format_align_left"
      inputTitle="GraphQL Document"
      inputChip="SDL + OPERATIONS"
      outputTitle="Formatted Document"
      outputChip="PRINTED"
      outputPlaceholder="Formatted documents appear here — never sent to any API."
      run={run}
      outputStats={(out) => [{ label: "Lines", value: String(out.split("\n").length) }]}
      outputFooterNote="Parse-only"
    />
  );
}

/* ------------------------------- CSS -------------------------------------- */

export function CssBeautifierWorkspace() {
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) =>
      formatCode(input, "css", { indent: opts.indent === "4" ? 4 : 2, semi: true, singleQuote: true, useTabs: false }),
    []
  );
  return (
    <FormatterWorkbench
      placeholder="body { color: #fff }"
      sample={`:root { --brand: #5de6ff; }\n.header { background: var(--brand); padding: .5rem 1rem }\n.header input:focus { border: 1px solid #8b5cf6; outline: none; \n  /* comments stay readable until you minify */ }\n@media (min-width: 640px) { .header { padding: 1rem 2rem } }`}
      fileExtension=".css"
      mime="text/css;charset=utf-8"
      buttonLabel="Beautify CSS"
      buttonIcon="format_align_left"
      inputTitle="CSS Input"
      inputChip="MODERN CSS"
      outputTitle="Beautified CSS"
      outputChip="FORMATTED"
      outputPlaceholder="Formatted stylesheet appears here — semantics preserved."
      indentOptions={[
        { label: "2 Spaces", value: "2" },
        { label: "4 Spaces", value: "4" },
      ]}
      defaultIndent="2"
      run={run}
      outputStats={(out) => [{ label: "Rules", value: String((out.match(/\{/g) ?? []).length) }]}
      outputFooterNote="Syntax-aware"
    />
  );
}

export function CssMinifierWorkspace() {
  const run = useMemo(
    () => async (input: string) => {
      const res = await minifyCss(input);
      if (!res.ok) throw new Error(res.error ?? "CSS could not be minified.");
      return res.css;
    },
    []
  );
  return (
    <FormatterWorkbench
      placeholder="body { color: #ffffff; margin: 0px; }"
      sample={`:root { --brand: #5de6ff; }\n.header { background: var(--brand); padding: .5rem 1rem }\n.header input:focus { border: 1px solid #8b5cf6; outline: none; \n  /* comments die here */ }\n@media (min-width: 640px) { .header { padding: 1rem 2rem } }`}
      fileExtension=".min.css"
      mime="text/css;charset=utf-8"
      buttonLabel="Minify CSS"
      buttonIcon="compress"
      inputTitle="CSS Input"
      inputChip="csso ENGINE"
      outputTitle="Minified CSS"
      outputChip="PRODUCTION"
      outputPlaceholder="Compressed stylesheet appears here — AST-based, no regex hacks."
      run={run}
    />
  );
}

/* ------------------------------- HTML ------------------------------------- */

export function HtmlFormatterWorkspace({ withPreview = false }: { withPreview?: boolean }) {
  void withPreview; // HTML Viewer has its own bespoke workspace below
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) =>
      formatCode(input, "html", {
        indent: opts.indent === "4" ? 4 : opts.indent === "tabs" ? "tabs" : 2,
        semi: true,
        singleQuote: false,
        useTabs: false,
      }),
    []
  );
  return (
    <FormatterWorkbench
      placeholder="<!-- paste HTML -->"
      sample={`<!DOCTYPE html>\n<html lang="en">\n  <body>\n      <section id="hero"><h1>Baby Got Tools</h1><p>Little tools. <strong>Big possibilities.</strong></p>\n      </section>\n  </body>\n</html>`}
      fileExtension=".html"
      mime="text/html;charset=utf-8"
      buttonLabel="Format HTML"
      buttonIcon="format_align_left"
      inputTitle="HTML Input"
      inputChip="AST PARSER"
      outputTitle="Formatted HTML"
      outputChip="PRINTED"
      outputPlaceholder="Formatted markup appears here — parser-level errors are reported verbatim."
      indentOptions={[
        { label: "2 Spaces", value: "2" },
        { label: "4 Spaces", value: "4" },
        { label: "Tabs", value: "tabs" },
      ]}
      defaultIndent="2"
      run={run}
      outputStats={(out) => [{ label: "Lines", value: String(out.split("\n").length) }]}
      outputFooterNote="Parse-only"
    />
  );
}

/* --------------------------- scripted languages ---------------------------- */

interface ScriptFormatterProps {
  engine: "python" | "lua" | "php";
}

export function ScriptFormatterWorkspace({ engine }: ScriptFormatterProps) {
  const config = {
    python: {
      buttonLabel: "Format Python",
      chip: "PYTHON 3",
      icon: "terminal",
      sample: `def process(hubs,*,verbose=False):\n    out=[]\n    for hub,n in hubs.items():\n        if   n>10: out.append((hub,n))\n        elif verbose: print("skip",hub)\n    return {"strong":dict(out),"total":sum(hubs.values())}`,
      note: "Indentation/whitespace rewriter — not a Black/AutoPEP8 equivalent (honest limitation).",
    },
    lua: {
      buttonLabel: "Format Lua",
      chip: "LUA 5.x",
      icon: "code_blocks",
      sample: `local function boot(engine, opts)\n    opts = opts or { reactive = true }\n  \n    for _,theme in ipairs({"dark","light"}) do\n      if not engine.themes[theme] then\n        engine:load(theme)\n      end\n    end\n                                                                 return engine\nend`,
      note: "Block-aware indentation — deep semantic rewrites are out of the client-side scope.",
    },
    php: {
      buttonLabel: "Format PHP",
      chip: "PSR-12-ish",
      icon: "php",
      sample: `<?php\ndeclare(strict_types=1);\nnamespace Bgt\\Hubs;\nfinal class HubBoot {public function __construct(private array $tools){ }\npublic function boot(string $theme): bool\n{ if (empty($this->tools)) { return false; }\nreturn $this->tools[$theme] ?? FALSE; }}`,
      note: "Indentation, braces and spacing — run php-cs-fixer in CI for full policy enforcement.",
    },
  }[engine];
  const run = useMemo(
    () => async (input: string, opts: { indent: string }) => {
      const width = opts.indent === "2" ? 2 : 4;
      if (engine === "python") return formatPython(input, { indent: width });
      if (engine === "lua") return formatLua(input, { indent: width });
      return formatPhp(input, { indent: width });
    },
    [engine]
  );
  return (
    <FormatterWorkbench
      placeholder={`Paste ${engine} source…`}
      sample={config.sample}
      fileExtension={engine === "python" ? ".py" : engine === "lua" ? ".lua" : ".php"}
      mime="text/plain;charset=utf-8"
      buttonLabel={config.buttonLabel}
      buttonIcon="format_align_left"
      inputTitle="Source Code"
      inputChip={config.chip}
      outputTitle="Formatted Source"
      outputChip="REWRITTEN"
      outputPlaceholder={`Formatted ${engine} appears here. ${config.note}`}
      indentOptions={[
        { label: "2 Spaces", value: "2" },
        { label: "4 Spaces", value: "4" },
      ]}
      defaultIndent="4"
      run={run}
      outputStats={(out) => [{ label: "Lines", value: String(out.split("\n").length) }]}
      outputFooterNote="Execute: never"
    />
  );
}

/** Minify-HTML helper reused by the HTML Viewer workspace. */
export { minifyHtml };
