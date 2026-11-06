/** YAML 1.2 engine built on the `yaml` package (parse + stringify). */

export interface YamlFormatOptions {
  indent: 2 | 4;
  lineWidth?: number;
}

export interface YamlParseError {
  message: string;
  line?: number;
  column?: number;
}

export async function parseYaml(text: string): Promise<{ ok: true; value: unknown } | { ok: false; error: YamlParseError }> {
  if (text.trim().length === 0) {
    return { ok: false, error: { message: "Awaiting input — paste YAML to begin." } };
  }
  try {
    const YAML = await import("yaml");
    const doc = YAML.parseDocument(text, { strict: false, merge: true });
    const value: unknown = doc.toJS({ mapAsMap: false });
    if (doc.errors.length > 0) {
      const e = doc.errors[0]!;
      return {
        ok: false,
        error: {
          message: e.message || "Invalid YAML",
          line: e.linePos?.[0]?.line,
          column: e.linePos?.[0]?.col,
        },
      };
    }
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: { message: e instanceof Error ? e.message : "Invalid YAML" } };
  }
}

function lineOf(text: string, index: number): number {
  return text.slice(0, Math.min(index, text.length)).split("\n").length;
}

function columnOf(text: string, index: number): number {
  const upto = text.slice(0, Math.min(index, text.length));
  const lastNl = upto.lastIndexOf("\n");
  return index - lastNl;
}
void lineOf;
void columnOf;

export async function formatYaml(text: string, opts: YamlFormatOptions): Promise<{ ok: boolean; output: string; error?: YamlParseError }> {
  const parsed = await parseYaml(text);
  if (!parsed.ok) return { ok: false, output: "", error: parsed.error };
  const YAML = await import("yaml");
  const output = YAML.stringify(parsed.value, {
    indent: opts.indent,
    lineWidth: opts.lineWidth ?? 100,
  });
  return { ok: true, output };
}

export async function yamlToJson(text: string, jsonIndent: 2 | 4): Promise<{ ok: boolean; output: string; error?: YamlParseError }> {
  const parsed = await parseYaml(text);
  if (!parsed.ok) return { ok: false, output: "", error: parsed.error };
  return { ok: true, output: JSON.stringify(parsed.value, null, jsonIndent) };
}

export async function jsonToYaml(text: string, opts: YamlFormatOptions): Promise<{ ok: boolean; output: string; error?: string }> {
  if (text.trim().length === 0) return { ok: false, output: "", error: "Awaiting input — paste JSON to begin." };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid JSON" };
  }
  const YAML = await import("yaml");
  return { ok: true, output: YAML.stringify(value, { indent: opts.indent, lineWidth: 100 }) };
}
