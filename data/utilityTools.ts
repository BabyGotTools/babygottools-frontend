/**
 * Utility & Productivity registry — standalone popular tools that are not
 * part of a category hub (QR Generator, Password Generator).
 */

import type {
  DevTool,
  HeroMetric,
  RelatedTool,
  ToolCapability,
  ToolFaq,
  ToolHeroChip,
} from "./devToolTypes";

const pulseChip = (label: string): ToolHeroChip => ({ label, style: "pulse" });
const strongChip = (label = "100% Client-Side"): ToolHeroChip => ({ label, style: "strong" });
const softChip = (label = "Zero Data Retention"): ToolHeroChip => ({ label, style: "soft" });

const defaultHeroMetrics = (): HeroMetric[] => [
  { label: "Engine Latency", value: "0.00 ms", live: true },
  { label: "Security Sandboxing", value: "Isolated RAM", lock: true },
];

const rel = (slug: string, title: string, subtitle: string, icon: string, iconTone: "primary" | "secondary" | "tertiary" | "error" | "neutral" | "engine" | "on-surface"): RelatedTool => ({
  slug,
  title,
  subtitle,
  icon,
  iconTone,
});

export const utilityTools: DevTool[] = [
  {
    slug: "qr-code-generator",
    title: "QR Code Generator",
    desc: "High-res QR codes with custom colors, size and embedded logos.",
    heroDesc:
      "Generate crisp QR codes from any URL, text or contact data — with custom foreground/background colors, size and margin controls, error-correction levels, and optional center-logo embedding for branding. Export as vector SVG or high-resolution PNG.",
    icon: "qr_code_2",
    accent: "primary",
    category: "utility",
    popularity: 95,
    tags: ["qr", "code", "generator", "svg", "png", "logo", "url"],
    badges: [{ label: "SVG & PNG Export", tone: "engine" }],
    heroChips: [pulseChip("SVG Vector Output"), strongChip("Works Offline"), softChip("No Tracking Pixels")],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "Vector + Raster Export",
        icon: "format_shapes",
        iconTone: "primary",
        desc: "Scalable SVG for print and design tools, or pixel-perfect PNG at up to 2000×2000 for direct sharing.",
        metaLabel: "Formats",
        metaValue: "SVG + PNG",
        metaTone: "secondary",
      },
      {
        title: "Logo Embedding",
        icon: "image",
        iconTone: "secondary",
        desc: "Overlay a logo in the code's center; the error-correction level compensates for the covered modules.",
        metaLabel: "Branding",
        metaValue: "Optional",
        metaTone: "primary",
      },
      {
        title: "Contrast Guard",
        icon: "contrast",
        iconTone: "tertiary",
        desc: "Foreground/background color pairs are checked for sufficient contrast so scanners stay reliable.",
        metaLabel: "Reliability",
        metaValue: "Validated",
        metaTone: "secondary",
      },
      {
        title: "Error-Correction Control",
        icon: "settings",
        iconTone: "primary",
        desc: "L / M / Q / H EC levels trade capacity for resilience — H survives 30% damage or a logo overlay.",
        metaLabel: "Levels",
        metaValue: "4 presets",
        metaTone: "secondary",
      },
    ],
    related: [
      rel("url-encoder-decoder", "URL Encoder", "Prepare tracked URLs", "link", "tertiary"),
      rel("token-generator", "Token Generator", "Pair codes with secrets", "password", "secondary"),
    ],
    relatedHeading: "Related Tools",
    faqHeading: "Working With the QR Code Generator",
    faqs: [
      {
        q: "Is my QR content sent to a server?",
        a: "No. The QR matrix is computed locally with the `qrcode` library inside your browser — nothing is transmitted, and the generated image contains no tracking pixels.",
      },
      {
        q: "Which error-correction level should I choose?",
        a: "M is the everyday default (15% recovery). Use H when adding a logo overlay or when the code will be printed outdoors where it may get scuffed — H recovers up to 30% damage.",
      },
      {
        q: "How much data fits in one QR code?",
        a: "Up to about 4,296 alphanumeric characters at the lowest EC level, but shorter content produces simpler, faster-scanning codes. Keep URLs under ~300 characters for reliable phone scans.",
      },
      {
        q: "Do QR codes expire?",
        a: "A QR code is just an encoded string — it never expires and works offline forever. What expires is whatever service it points to, so encode stable URLs.",
      },
    ],
  },

  {
    slug: "password-generator",
    title: "Password Generator",
    desc: "Cryptographic passwords and passphrases with entropy analysis.",
    heroDesc:
      "Generate cryptographically secure passwords and memorable passphrases — powered exclusively by crypto.getRandomValues() with unbiased rejection sampling. A live entropy meter shows the real bit strength of every option before you copy it.",
    icon: "password",
    accent: "secondary",
    category: "utility",
    popularity: 96,
    tags: ["password", "passphrase", "generator", "entropy", "crypto", "secure"],
    badges: [{ label: "CSPRNG", tone: "engine" }],
    heroChips: [pulseChip("Unbiased Sampler"), strongChip("Never Transmitted"), softChip("Entropy Meter")],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "No Modulo Bias",
        icon: "balance",
        iconTone: "secondary",
        desc: "Characters are drawn with rejection sampling so every symbol is exactly equally likely — biased generators weaken passwords.",
        metaLabel: "Entropy",
        metaValue: "Uniform",
        metaTone: "secondary",
      },
      {
        title: "Passphrase Mode",
        icon: "menu_book",
        iconTone: "tertiary",
        desc: "Diceware-style word passphrases with configurable word count, separator and capitalization — strong and memorable.",
        metaLabel: "Wordlist",
        metaValue: "256 words",
        metaTone: "primary",
      },
      {
        title: "Live Entropy Meter",
        icon: "speed",
        iconTone: "primary",
        desc: "True entropy bits are computed from the active character pool and length, with plain-language strength verdicts.",
        metaLabel: "Strength",
        metaValue: "Bit-accurate",
        metaTone: "primary",
      },
      {
        title: "Bulk Generation",
        icon: "layers",
        iconTone: "tertiary",
        desc: "Up to 50 passwords per run with individual and batch copy, plus a .txt download.",
        metaLabel: "Scale",
        metaValue: "50 / run",
        metaTone: "secondary",
      },
    ],
    related: [
      rel("token-generator", "Token Generator", "API keys & session secrets", "key", "primary"),
      rel("uuid-generator", "UUID / NanoID", "Structured identifiers", "fingerprint", "secondary"),
      rel("text-encryptor", "Encrypt & Decrypt", "Protect secrets with AES", "enhanced_encryption", "tertiary"),
    ],
    relatedHeading: "Related Tools",
    faqHeading: "Working With the Password Generator",
    faqs: [
      {
        q: "Are these passwords safe to use?",
        a: "They are drawn from the browser's CSPRNG (crypto.getRandomValues) with unbiased sampling — cryptographically appropriate for real accounts. Pair them with a password manager; unique-per-site matters more than any single password's strength.",
      },
      {
        q: "How many bits of entropy do I need?",
        a: "75+ bits is strong for online accounts; 100+ bits is comfortable for anything protecting high-value data. The meter labels anything below ~60 bits as weak regardless of how random it looks.",
      },
      {
        q: "Why use a passphrase instead of a random password?",
        a: "Passphrases reach high entropy with characters you can actually remember and type — six random words from a 256-word list carry ~144 bits. They're ideal for master passwords.",
      },
      {
        q: "Are the generated passwords stored anywhere?",
        a: "No. Generation happens in a single browser call and is never logged, transmitted, or stored — reloading the page erases everything.",
      },
    ],
  },
];
