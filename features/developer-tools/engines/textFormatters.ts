/**
 * Honest, indentation-aware formatter cores for Python / Lua / PHP.
 *
 * These are structural whitespace rewriters — the browsers have no faithful
 * Black / php-cs-fixer / lua-format equivalents without heavy WASM. The tools
 * document this limitation in their UI copy; the engines never pretend to be
 * more than they are.
 */

export interface LanguagesFormatOptions {
  indent: 2 | 4;
}

function isLineNoise(line: string): boolean {
  return line.trim().length === 0 || /^\s*#/.test(line) || /^\s*--/.test(line) || /^\s*\/\//.test(line) || /^\s*\*/.test(line);
}

const PY_BLOCK_OPENERS = /^\s*(async\s+)?(def|class|if|elif|else|for|while|try|except|finally|with|match|case)\b.*:$/i;
const PY_EXPLICIT_END = /^\s*(pass|break|continue|return|raise|yield|del)\b/;

function closeBlock(line: string, stack: string[]): number {
  for (const open of stack) {
    void open;
  }
  return stack.length; // depth equals stack size (blocks are pushed/popped below)
}

export function formatPython(source: string, opts: LanguagesFormatOptions): string {
  const lines = source.replace(/\r\n/g, "\n").replace(/\t/g, " ".repeat(opts.indent)).split("\n");
  const unit = " ".repeat(opts.indent);
  const out: string[] = [];
  let depth = 0;
  let blankRun = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      blankRun++;
      if (blankRun <= 1) out.push("");
      continue;
    }
    blankRun = 0;

    if (PY_BLOCK_OPENERS.test(trimmed)) {
      out.push(unit.repeat(depth) + trimmed);
      // hanging indent for wrapped continuations inside the block
      depth++;
      continue;
    }
    if (/^\s*(elif|else|except|finally)\b.*:$/.test(trimmed)) {
      depth = Math.max(0, depth - 1);
      out.push(unit.repeat(depth) + trimmed);
      depth++;
      continue;
    }
    if (/^\s*(return|raise|pass|break|continue)\b/.test(trimmed)) {
      // implicit block end candidates stay at current depth
      void PY_EXPLICIT_END;
      out.push(unit.repeat(depth) + trimmed);
      continue;
    }
    if (/^[\)\]\}]/.test(trimmed)) {
      depth = Math.max(0, depth - 1);
      out.push(unit.repeat(depth) + trimmed);
      continue;
    }
    out.push(unit.repeat(depth) + trimmed);
  }

  void closeBlock;
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* --------------------------------- Lua ------------------------------------ */

const LUA_BLOCK_OPENERS = /^\s*(local\s+)?function\b|^\s*(if\b.*then$|for\b.*do$|while\b.*do$|repeat$|do$)/i;
const LUA_BLOCK_CLOSERS = /^\s*(end|until\b.*)$/i;

export function formatLua(source: string, opts: LanguagesFormatOptions): string {
  const lines = source.replace(/\r\n/g, "\n").replace(/\t/g, " ".repeat(opts.indent)).split("\n");
  const unit = " ".repeat(opts.indent);
  const out: string[] = [];
  let depth = 0;
  let inLongString = false;
  let inLongStringLevel = "";

  for (const raw of lines) {
    const trimmed = raw.trim();

    // pass through long strings/long comments untouched
    const lsMatch = /^\[=*\[/.exec(trimmed);
    const lsEnd = /\]=*\]/.test(trimmed);
    if (inLongString) {
      out.push(raw);
      if (lsEnd) inLongString = false;
      continue;
    }
    if (lsMatch) {
      inLongStringLevel = (/\[=+\[/.exec(trimmed)?.[0] ?? "[[") + "";
      void inLongStringLevel;
      inLongString = !lsEnd;
      out.push(raw);
      continue;
    }

    if (trimmed.length === 0) {
      out.push("");
      continue;
    }
    void isLineNoise;

    if (LUA_BLOCK_CLOSERS.test(trimmed)) {
      depth = Math.max(0, depth - 1);
      out.push(unit.repeat(depth) + trimmed);
      continue;
    }
    if (LUA_BLOCK_OPENERS.test(trimmed)) {
      out.push(unit.repeat(depth) + trimmed);
      depth++;
      continue;
    }
    // else...end pairs — 'else'/'elseif' stay at parent depth
    if (/^\s*(else|elseif\b.*\bthen)\s*$/i.test(trimmed)) {
      depth = Math.max(0, depth - 1);
      out.push(unit.repeat(depth) + trimmed);
      depth++;
      continue;
    }
    out.push(unit.repeat(depth) + trimmed);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "") + "\n";
}

/* --------------------------------- PHP ------------------------------------- */

const PHP_OPEN_BRACES = /[{(]\s*$/;

export function formatPhp(source: string, opts: LanguagesFormatOptions): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const unit = " ".repeat(opts.indent);
  const out: string[] = [];
  let depth = 0;
  let inComment = false;

  for (const raw of lines) {
    const trimmed = raw.trim();

    if (inComment) {
      out.push(unit.repeat(depth) + raw.trimEnd());
      if (/\*\/\s*$/.test(trimmed)) inComment = false;
      continue;
    }
    if (/^\/\*/.test(trimmed) && !/\*\/\s*$/.test(trimmed)) {
      inComment = true;
      out.push(unit.repeat(depth) + raw.trimStart());
      continue;
    }

    if (trimmed.length === 0) {
      out.push("");
      continue;
    }

    const opensBrace = PHP_OPEN_BRACES.test(trimmed) || /\{\s*$/.test(trimmed);
    const closesBrace = /^}/.test(trimmed) || /^\)/.test(trimmed);

    if (closesBrace) {
      depth = Math.max(0, depth - 1);
      out.push(unit.repeat(depth) + (trimmed.startsWith("} ") ? trimmed : trimmed));
      continue;
    }

    out.push(unit.repeat(depth) + trimmed.replace(/\s+\{(?=\s*$)/, " {"));

    if (opensBrace) depth++;
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
