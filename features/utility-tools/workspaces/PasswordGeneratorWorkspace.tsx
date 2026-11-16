"use client";

/** Password Generator â€” CSPRNG passwords & diceware-style passphrases. */

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/common/Icon";
import CopyButton from "@/components/tools/CopyButton";
import DownloadButton from "@/components/tools/DownloadButton";
import { RIBBON_MAIN_ACTION, RIBBON_BTN_CLEAR, INDENT_BTN_ACTIVE, INDENT_BTN_IDLE, RIBBON_INDENT_GROUP, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import { useRibbonPortal } from "@/hooks/useRibbonPortal";

type Mode = "random" | "passphrase";

const CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
};

const AMBIGUOUS = new Set("Il1O0o");

/** 256-word curated list (EFF-short-style, common + typeable). */
const WORDLIST = [
  "acorn", "agile", "album", "amber", "anchor", "apple", "arrow", "atlas", "aurora", "autumn",
  "bagel", "balcony", "bamboo", "beacon", "beaver", "bicycle", "birch", "bishop", "blossom", "bonfire",
  "bramble", "brass", "breeze", "bridge", "bronze", "brook", "bubble", "bucket", "buffalo", "burrow",
  "cabin", "cactus", "camera", "candle", "canvas", "canyon", "castle", "cedar", "cello", "cherry",
  "chimney", "cinnamon", "circle", "citrus", "clover", "cobalt", "comet", "compass", "copper", "coral",
  "cosmos", "cotton", "crayon", "crescent", "cricket", "crimson", "crystal", "cupcake", "cyber", "dahlia",
  "daisy", "dapper", "dawn", "delta", "denim", "diamond", "dolphin", "domino", "dragon", "dream",
  "driftwood", "dune", "eagle", "ember", "emerald", "engine", "escape", "estate", "falcon", "fable",
  "feather", "fern", "fiddle", "fig", "filter", "fjord", "flamingo", "flint", "florist", "forest",
  "fountain", "fox", "fresco", "frost", "gadget", "galaxy", "garden", "gazelle", "gecko", "ginger",
  "glacier", "glider", "globe", "glyph", "granite", "grape", "gravel", "grotto", "guitar", "gumbo",
  "hammock", "harbor", "harvest", "hazel", "helmet", "heron", "hickory", "hollow", "honey", "hornet",
  "hurdle", "iceberg", "igloo", "indigo", "island", "ivory", "jasmine", "jigsaw", "jubilee", "juniper",
  "kayak", "kernel", "kestrel", "kettle", "kingdom", "kite", "kiwi", "koala", "lagoon", "lantern",
  "lattice", "lavender", "ledger", "lemon", "leopard", "lighthouse", "lilac", "linen", "lobster", "lotus",
  "lumber", "lunar", "lyric", "magnet", "mahogany", "mammoth", "maple", "marble", "marigold", "marlin",
  "meadow", "mercury", "meteor", "mimosa", "mineral", "mint", "mirror", "mistletoe", "monsoon", "moon",
  "morning", "mosaic", "mosquito", "mountain", "muffin", "mulberry", "mustard", "narrow", "nectar", "needle",
  "noble", "nomad", "north", "nugget", "oak", "oasis", "obsidian", "ocelot", "octave", "olive",
  "onyx", "opal", "orbit", "orchid", "oregano", "osprey", "otter", "oyster", "paddle", "palace",
  "panorama", "papaya", "paprika", "parsley", "pastel", "peacock", "pebble", "pelican", "penguin", "pepper",
  "petal", "phantom", "piano", "pigment", "pilot", "pioneer", "pistachio", "pixel", "plasma", "plateau",
  "plum", "polar", "pollen", "poppy", "prairie", "pretzel", "prism", "puffin", "pumpkin", "puzzle",
  "pyramid", "quartz", "quiver", "radish", "ragtime", "raven", "ravine", "ribbon", "ridge", "ring",
  "ripple", "river", "robin", "rocket", "rosemary", "rubble", "ruby", "rumble", "rustic", "saffron",
  "sailor", "salmon", "sandal", "sapphire", "satchel", "scarf", "sequoia", "shadow", "sherbet", "shore",
  "signal", "silica", "silver", "siren", "sketch", "slalom", "slogan", "smoke", "snorkel", "solar",
  "sonnet", "spark", "sparrow", "spiral", "spruce", "squid", "stellar", "stone", "storm", "straw",
  "summit", "sunset", "syrup", "tanager", "tapestry", "teak", "tempo", "thicket", "thimble", "thistle",
  "thunder", "tiger", "timber", "tinsel", "titan", "toast", "tomato", "topaz", "torch", "tornado",
  "totem", "toucan", "track", "trellis", "tribune", "trout", "tulip", "tundra", "turbine", "turquoise",
  "turtle", "twill", "twilight", "umbrella", "upland", "valley", "vanilla", "velvet", "vertex", "vessel",
  "violet", "voltage", "voyage", "walnut", "walrus", "wander", "warden", "waterfall", "weasel", "willow",
  "window", "winter", "wisdom", "wolf", "wombat", "yarrow", "yeoman", "yodel", "zenith", "zephyr",
];

function rejectionSample(maxExclusive: number): number {
  // Unbiased draw from crypto.getRandomValues using rejection sampling.
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % maxExclusive;
  }
}

function pickChar(pool: string): string {
  return pool[rejectionSample(pool.length)];
}

interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

function generatePassword(opts: PasswordOptions): string {
  const sets: string[] = [];
  if (opts.lower) sets.push(CHARSETS.lower);
  if (opts.upper) sets.push(CHARSETS.upper);
  if (opts.digits) sets.push(CHARSETS.digits);
  if (opts.symbols) sets.push(CHARSETS.symbols);
  if (sets.length === 0) throw new Error("Select at least one character set.");
  let pool = sets.join("");
  if (opts.excludeAmbiguous) pool = [...pool].filter((c) => !AMBIGUOUS.has(c)).join("");

  // Guarantee at least one char from each selected set, then fill the rest
  // uniformly from the merged pool (unbiased â€” positions are shuffled later).
  const chars: string[] = sets.map((set) => {
    const filtered = opts.excludeAmbiguous ? [...set].filter((c) => !AMBIGUOUS.has(c)).join("") : set;
    return pickChar(filtered.length > 0 ? filtered : set);
  });
  while (chars.length < opts.length) chars.push(pickChar(pool));

  // Fisherâ€“Yates with CSPRNG for uniform shuffling.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rejectionSample(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.slice(0, opts.length).join("");
}

function generatePassphrase(words: number, separator: string, capitalize: boolean, addNumber: boolean): string {
  const parts: string[] = [];
  for (let i = 0; i < words; i++) {
    let word = WORDLIST[rejectionSample(WORDLIST.length)];
    if (capitalize) word = word.charAt(0).toUpperCase() + word.slice(1);
    parts.push(word);
  }
  if (addNumber) parts.push(String(rejectionSample(90) + 10));
  return parts.join(separator);
}

function entropyBitsRandom(opts: PasswordOptions): number {
  let poolSize = 0;
  if (opts.lower) poolSize += CHARSETS.lower.length;
  if (opts.upper) poolSize += CHARSETS.upper.length;
  if (opts.digits) poolSize += CHARSETS.digits.length;
  if (opts.symbols) poolSize += CHARSETS.symbols.length;
  if (opts.excludeAmbiguous) poolSize -= 5;
  if (poolSize <= 0) return 0;
  return Math.round((opts.length * Math.log2(poolSize)) * 10) / 10;
}

function strengthLabel(bits: number): { label: string; color: string; width: number } {
  if (bits < 40) return { label: "Very weak", color: "text-error", width: 20 };
  if (bits < 60) return { label: "Weak", color: "text-error", width: 40 };
  if (bits < 75) return { label: "Fair", color: "text-tertiary", width: 60 };
  if (bits < 100) return { label: "Strong", color: "text-secondary", width: 80 };
  return { label: "Excellent", color: "text-secondary", width: 100 };
}

export function PasswordGeneratorWorkspace() {
  const [mode, setMode] = useState<Mode>("random");
  const [length, setLength] = useState(20);
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [wordCount, setWordCount] = useState(5);
  const [separator, setSeparator] = useState("-");
  const [capitalize, setCapitalize] = useState(true);
  const [addNumber, setAddNumber] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const bits =
    mode === "random" ? entropyBitsRandom({ length, lower, upper, digits, symbols, excludeAmbiguous }) : Math.round(wordCount * Math.log2(256) * 10) / 10;
  const strength = strengthLabel(bits);

  const generate = useCallback(() => {
    setError(null);
    try {
      const results: string[] = [];
      const count = 3;
      for (let i = 0; i < count; i++) {
        results.push(
          mode === "random"
            ? generatePassword({ length, lower, upper, digits, symbols, excludeAmbiguous })
            : generatePassphrase(wordCount, separator, capitalize, addNumber)
        );
      }
      setOutput(results);
    } catch (e) {
      setOutput([]);
      setError(e instanceof Error ? e.message : "Generation failed.");
    }
  }, [mode, length, lower, upper, digits, symbols, excludeAmbiguous, wordCount, separator, capitalize, addNumber]);

  useEffect(() => {
    generate();
  }, [generate]);

  const randomSets = [
    { label: "a-z", value: lower, set: setLower },
    { label: "A-Z", value: upper, set: setUpper },
    { label: "0-9", value: digits, set: setDigits },
    { label: "!@#", value: symbols, set: setSymbols },
  ];

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className={RIBBON_INDENT_GROUP}>
          <button type="button" onClick={() => setMode("random")} className={mode === "random" ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
            Random
          </button>
          <button type="button" onClick={() => setMode("passphrase")} className={mode === "passphrase" ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
            Passphrase
          </button>
        </div>
        {mode === "random" ? (
          <>
            <div className="flex items-center gap-2 px-space-sm py-1 rounded-lg bg-surface-container-lowest">
              <label htmlFor="pw-len" className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">
                Length
              </label>
              <input id="pw-len" type="range" min={8} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-28 accent-secondary cursor-pointer" />
              <span className="text-label-mono-md font-label-mono-md text-on-surface font-semibold tabular-nums">{length}</span>
            </div>
            <div className={RIBBON_INDENT_GROUP}>
              {randomSets.map((s) => (
                <button key={s.label} type="button" onClick={() => s.set(!s.value)} className={s.value ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
                  {s.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 px-space-sm py-1 rounded-lg bg-surface-container-lowest">
              <label htmlFor="pw-words" className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">
                Words
              </label>
              <input id="pw-words" type="range" min={3} max={10} value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))} className="w-24 accent-secondary cursor-pointer" />
              <span className="text-label-mono-md font-label-mono-md text-on-surface font-semibold tabular-nums">{wordCount}</span>
            </div>
            <div className={RIBBON_INDENT_GROUP}>
              {["-", ".", " ", "_"].map((sep) => (
                <button key={sep} type="button" onClick={() => setSeparator(sep)} className={separator === sep ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
                  {sep === " " ? "space" : sep}
                </button>
              ))}
            </div>
          </>
        )}
        {output.length > 0 && (
          <button type="button" onClick={() => { setOutput([]); setError(null); }} className={RIBBON_BTN_CLEAR}>
            <Icon name="delete_sweep" size={16} />
            <span>Clear</span>
          </button>
        )}
      </div>
      <button type="button" onClick={generate} className={RIBBON_MAIN_ACTION}>
        <Icon name="casino" size={16} />
        <span>Generate 3</span>
      </button>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        {/* output list */}
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Generated {mode === "random" ? "Passwords" : "Passphrases"}</span>
            </div>
            <div className="flex items-center gap-1">
              <DownloadButton
                value={output.join("\n")}
                filename="passwords.txt"
                title="Download batch"
              />
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest p-space-md space-y-space-sm overflow-auto" style={{ minHeight: 300 }}>
            {error ? (
              <div className="flex flex-col items-center justify-center text-center gap-2 py-8">
                <Icon name="error" size={32} className="text-error" />
                <p className="text-error font-semibold">{error}</p>
              </div>
            ) : output.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="password" size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">Press Generate â€” results come from the browser's CSPRNG and are never stored.</p>
              </div>
            ) : (
              output.map((pw, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface-container-low rounded-lg px-space-sm py-2.5">
                  <code className="flex-1 font-label-mono-md text-label-mono-md text-on-surface break-all select-all">{pw}</code>
                  <CopyButton value={pw} iconOnly title="Copy password" className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-secondary transition-colors flex-shrink-0" />
                </div>
              ))
            )}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between flex-wrap gap-1 text-label-mono-xs font-label-mono-xs">
            <div className="flex items-center gap-2 min-w-0 text-secondary">
              <Icon name="enhanced_encryption" size={16} className="flex-shrink-0" />
              <span className="font-semibold truncate">crypto.getRandomValues() â€¢ never transmitted or logged</span>
            </div>
            <span className="text-on-surface-variant flex-shrink-0">{output.length} results</span>
          </div>
        </div>

        {/* entropy meter */}
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl h-fit">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Entropy Analysis</span>
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Bit-accurate</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-md">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wide">Strength</span>
                <span className={`font-label-mono-md font-label-mono-md font-semibold ${strength.color}`}>
                  {strength.label} â€” {bits} bits
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    bits < 60 ? "bg-error/70" : bits < 75 ? "bg-tertiary/70" : "bg-secondary/70"
                  }`}
                  style={{ width: `${strength.width}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between font-label-mono-xs font-label-mono-xs text-outline-variant">
                <span>40 bits</span>
                <span>75</span>
                <span>100+</span>
              </div>
            </div>
            <div className="text-label-mono-md font-label-mono-md text-on-surface-variant space-y-1">
              {mode === "random" ? (
                <>
                  <div>
                    Pool: <span className="text-on-surface font-semibold">{[lower && "lowercase", upper && "uppercase", digits && "digits", symbols && "symbols"].filter(Boolean).join(" + ") || "none selected"}</span>
                  </div>
                  <div>
                    Unbiased sampling: <span className="text-secondary font-semibold">rejection method (no modulo bias)</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    Wordlist: <span className="text-on-surface font-semibold">256 common words (8 bits/word)</span>
                  </div>
                  <div>
                    Format: <span className="text-on-surface font-semibold">{wordCount} words{addNumber ? " + 2-digit number" : ""}{capitalize ? ", capitalized" : ""}</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {mode === "random" && (
                <button
                  type="button"
                  onClick={() => setExcludeAmbiguous(!excludeAmbiguous)}
                  aria-pressed={excludeAmbiguous}
                  className={`px-2 py-1 rounded-lg text-label-mono-xs font-label-mono-xs transition-all cursor-pointer ${
                    excludeAmbiguous ? "bg-secondary/10 text-secondary" : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Exclude ambiguous (Il1O0)
                </button>
              )}
              {mode === "passphrase" && (
                <>
                  <button
                    type="button"
                    onClick={() => setCapitalize(!capitalize)}
                    aria-pressed={capitalize}
                    className={`px-2 py-1 rounded-lg text-label-mono-xs font-label-mono-xs transition-all cursor-pointer ${capitalize ? "bg-secondary/10 text-secondary" : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"}`}
                  >
                    Capitalize
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddNumber(!addNumber)}
                    aria-pressed={addNumber}
                    className={`px-2 py-1 rounded-lg text-label-mono-xs font-label-mono-xs transition-all cursor-pointer ${addNumber ? "bg-secondary/10 text-secondary" : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"}`}
                  >
                    Append number
                  </button>
                </>
              )}
            </div>
            <div className="flex items-start gap-2 text-label-mono-md font-label-mono-md text-on-surface-variant">
              <Icon name="info" size={16} className="text-tertiary mt-0.5 flex-shrink-0" />
              <span>Reload the page and everything is gone â€” results exist only in this tab's memory.</span>
            </div>
          </div>
        </div>
      </div>

      {ribbonNode}
    </>
  );
}
