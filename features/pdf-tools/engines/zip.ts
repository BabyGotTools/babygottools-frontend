import { zipSync, type Zippable } from "fflate";

/**
 * Bundles generated files into a same-origin ZIP via fflate (pure JS, no
 * wasm download). Used by Split / Extract / OCR text outputs and anywhere a
 * tool produces more than one download.
 */

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

/** Collides on `name` are resolved by suffixing with a counter. */
export function bundleZip(
  entries: ZipEntry[],
  options: { level?: 0 | 6 | 9 } = {}
): Uint8Array {
  const used = new Set<string>();
  const tree: Zippable = {};

  for (const entry of entries) {
    let name = entry.name || "file.bin";
    let counter = 1;
    while (used.has(name.toLowerCase())) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const extension = dot > 0 ? name.slice(dot) : "";
      name = `${base} (${counter})${extension}`;
      counter += 1;
    }
    used.add(name.toLowerCase());
    tree[name] = [entry.bytes, { level: options.level ?? 6 }];
  }

  return zipSync(tree, { level: options.level ?? 6 });
}

/** Dot-extension of a filename, lowercased without the leading dot. */
export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}
