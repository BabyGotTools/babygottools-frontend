/**
 * Image & Media tools registry — shares the DevTool metadata shape and the
 * ToolPageShell so these pages look and behave exactly like the other tools.
 * All processing is canvas-based and 100% client-side.
 */

import type {
  AccentTone,
  DevTool,
  HeroMetric,
  RelatedTool,
  ToolCapability,
  ToolFaq,
  ToolHeroChip,
} from "./devToolTypes";

const pulseChip = (label: string): ToolHeroChip => ({ label, style: "pulse" });
const strongChip = (label = "100% Client-Side"): ToolHeroChip => ({ label, style: "strong" });
const softChip = (label = "Files Never Uploaded"): ToolHeroChip => ({ label, style: "soft" });

const defaultHeroMetrics = (): HeroMetric[] => [
  { label: "Uploaded to Server", value: "0", lock: true },
  { label: "Processing", value: "In-Browser" },
];

const privacyFaqs = (subject: string): ToolFaq[] => [
  {
    q: "Are my images uploaded anywhere?",
    a: `No. ${subject} is decoded and processed entirely inside your browser's memory using the Canvas and WebCodecs APIs. Your files never leave your device.`,
  },
  {
    q: "What formats can I load?",
    a: "PNG, JPEG, WebP, GIF (first frame), BMP and AVIF for input; output depends on the tool. SVG inputs are rasterized at their intrinsic size.",
  },
];

const imageCapabilities = (extra: ToolCapability): ToolCapability[] => [
  {
    title: "0-Upload Processing",
    icon: "shield",
    iconTone: "tertiary",
    desc: "Decoding, resizing and encoding all happen locally via the Canvas API — the Network panel stays silent while you work.",
    metaLabel: "Network",
    metaValue: "None",
    metaTone: "tertiary",
  },
  {
    title: "Batch-Friendly",
    icon: "layers",
    iconTone: "primary",
    desc: "Drop many files at once; results download individually or as a single ZIP archive.",
    metaLabel: "Throughput",
    metaValue: "Multi-file",
    metaTone: "secondary",
  },
  {
    title: "Honest Reporting",
    icon: "speed",
    iconTone: "secondary",
    desc: "Before/after sizes and percentages are always shown — a result that isn't smaller is labeled as such.",
    metaLabel: "Transparency",
    metaValue: "Always",
    metaTone: "primary",
  },
  extra,
];

const rel = (slug: string, title: string, subtitle: string, icon: string, iconTone: AccentTone): RelatedTool => ({
  slug,
  title,
  subtitle,
  icon,
  iconTone,
});

export const imageTools: DevTool[] = [
  {
    slug: "image-compressor",
    title: "Image Compressor",
    alias: "Image Compressor — WebP & AVIF",
    desc: "Shrink PNG, JPG & WebP files without visible quality loss.",
    heroDesc:
      "Compress images in your browser to PNG, JPEG, WebP or AVIF with a live quality slider and before/after size reporting. WebP and AVIF encode through bundled WASM codecs so they work in every browser — files are never uploaded.",
    icon: "compress",
    accent: "primary",
    category: "image",
    popularity: 94,
    tags: ["image", "compress", "webp", "avif", "jpeg", "png", "optimize", "wasm"],
    badges: [{ label: "WASM Encoders", tone: "engine" }],
    heroChips: [pulseChip("WebP + AVIF WASM"), strongChip("0-Upload"), softChip("Batch ZIP Export")],
    heroMetrics: defaultHeroMetrics(),
    capabilities: imageCapabilities({
      title: "Next-Gen Codecs",
      icon: "memory",
      iconTone: "primary",
      desc: "AVIF and WebP encode via libaom/libwebp compiled to WebAssembly (the Squoosh codecs) — universal support, no server involvement.",
      metaLabel: "Engines",
      metaValue: "libwebp • aom",
      metaTone: "primary",
    }),
    related: [
      rel("image-resizer", "Image Resizer", "Scale dimensions precisely", "aspect_ratio", "secondary"),
      rel("exif-stripper", "EXIF Stripper", "Remove GPS & camera data", "no_encryption", "tertiary"),
      rel("image-to-data-uri", "Image to Data URI", "Inline as base64", "code", "secondary"),
    ],
    relatedHeading: "Related Image Tools",
    faqHeading: "Working With the Image Compressor",
    faqs: [
      ...privacyFaqs("Your images"),
      {
        q: "Why can WebP output be larger than the source?",
        a: "Re-encoding can't always beat the original codec at the same quality — a well-tuned JPEG may out-compress WebP at high quality. The tool always shows the honest before/after numbers, and flags results that are larger so you can pick another format or quality.",
      },
      {
        q: "How does AVIF encoding work offline?",
        a: "The AV1 encoder is compiled to WebAssembly and bundled with the page. The first AVIF encode downloads the compiled module from the page itself (no CDN), and it is cached for the session.",
      },
      {
        q: "What quality setting should I use?",
        a: "0.75–0.85 is the sweet spot for photos; logos and flat graphics prefer PNG. Always zoom the preview — the tool shows exact sizes so you can decide with data, not guesswork.",
      },
    ],
  },

  {
    slug: "image-resizer",
    title: "Image Resizer & Aspect Ratio",
    desc: "Scale to exact dimensions with aspect-ratio lock.",
    heroDesc:
      "Resize images to precise pixel dimensions or percentage presets with an aspect-ratio lock, high-quality smoothing and optional format conversion. Batch mode processes a whole folder of images in one pass, entirely in your browser.",
    icon: "aspect_ratio",
    accent: "secondary",
    category: "image",
    popularity: 87,
    tags: ["image", "resize", "scale", "aspect ratio", "dimensions", "batch"],
    badges: [{ label: "Batch Ready", tone: "secondary" }],
    heroChips: [pulseChip("High-Quality Scale"), strongChip("0-Upload"), softChip("ZIP Export")],
    heroMetrics: defaultHeroMetrics(),
    capabilities: imageCapabilities({
      title: "Aspect-Ratio Lock",
      icon: "link",
      iconTone: "primary",
      desc: "Change one dimension and the other follows the exact original ratio — or unlock to crop-stretch deliberately.",
      metaLabel: "Controls",
      metaValue: "Lock + unlock",
      metaTone: "primary",
    }),
    related: [
      rel("image-compressor", "Image Compressor", "Shrink file weight next", "compress", "primary"),
      rel("favicon-generator", "Favicon Generator", "Icon-sized exports", "grid_on", "tertiary"),
      rel("image-to-data-uri", "Image to Data URI", "Inline small images", "code", "secondary"),
    ],
    relatedHeading: "Related Image Tools",
    faqHeading: "Working With the Image Resizer",
    faqs: [
      ...privacyFaqs("Your images"),
      {
        q: "Will upscaling look blurry?",
        a: "Upscaling always adds pixels the source doesn't have; the browser's high-quality smoothing is used, but no AI upscaling happens here. For best results only downscale, or upscale in small steps.",
      },
      {
        q: "What are the dimension limits?",
        a: "Inputs up to 50 MB per file and outputs up to 16384×16384 pixels per canvas — the hard limit of most browsers. Validation stops larger requests with a clear message.",
      },
    ],
  },

  {
    slug: "image-to-data-uri",
    title: "Image to Data URI / Base64",
    desc: "Instant inline code for HTML, CSS and JSON.",
    heroDesc:
      "Convert any image into a base64 data URI with ready-to-paste <img>, CSS background, or raw snippets. The exact byte count overhead is reported, so you know whether inlining is a win or a loss before shipping.",
    icon: "code",
    accent: "tertiary",
    category: "image",
    popularity: 82,
    tags: ["base64", "data uri", "inline", "css", "html", "embed"],
    badges: [{ label: "Instant", tone: "tertiary" }],
    heroChips: [pulseChip("Zero Re-encode"), strongChip("0-Upload"), softChip("3 Snippets")],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "Byte-Exact Encoding",
        icon: "verified",
        iconTone: "primary",
        desc: "The original file bytes are encoded directly — no re-compression, no quality loss, no browser rounding.",
        metaLabel: "Fidelity",
        metaValue: "Bit-exact",
        metaTone: "primary",
      },
      {
        title: "Three Snippet Styles",
        icon: "code",
        iconTone: "secondary",
        desc: "HTML <img>, CSS background-image, and the raw data URI — switch with one click.",
        metaLabel: "Output",
        metaValue: "3 formats",
        metaTone: "secondary",
      },
      {
        title: "Size Overhead Report",
        icon: "speed",
        iconTone: "tertiary",
        desc: "Base64 inflates payloads by ~33% — the tool shows the exact before/after sizes so the trade-off is explicit.",
        metaLabel: "Report",
        metaValue: "Live",
        metaTone: "primary",
      },
    ],
    related: [
      rel("image-compressor", "Image Compressor", "Shrink before inlining", "compress", "primary"),
      rel("base64-encoder-decoder", "Base64 Converter", "Encode text & files", "swap_horiz", "secondary"),
      rel("favicon-generator", "Favicon Generator", "Multi-size icon pack", "grid_on", "tertiary"),
    ],
    relatedHeading: "Related Image Tools",
    faqHeading: "Working With Data URIs",
    faqs: [
      ...privacyFaqs("Your images"),
      {
        q: "When should I inline an image as base64?",
        a: "For small critical assets (icons, tiny logos) where an extra request costs more than the 33% size overhead. Large photos should stay as separate, cacheable files — the tool's size report makes the call obvious.",
      },
      {
        q: "Does inlining affect caching?",
        a: "Yes — a data URI is cached together with the document that contains it, not independently. That's fine for bundled, versioned assets; it's wasteful for media that changes often.",
      },
    ],
  },

  {
    slug: "color-palette-extractor",
    title: "Color Palette Extractor",
    desc: "HEX/RGB/HSL palette from any photo.",
    heroDesc:
      "Pull a clean color palette out of any image with median-cut quantization — swatches with HEX, RGB and HSL values, pixel-share percentages, and one-click export as JSON or CSS custom properties.",
    icon: "palette",
    accent: "primary",
    category: "image",
    popularity: 79,
    tags: ["color", "palette", "extract", "hex", "rgb", "hsl", "design", "theme"],
    badges: [{ label: "Median-Cut", tone: "engine" }],
    heroChips: [pulseChip("Median-Cut Engine"), strongChip("0-Upload"), softChip("JSON + CSS Export")],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "Median-Cut Quantization",
        icon: "format_shapes",
        iconTone: "primary",
        desc: "Color space is recursively split along its widest channel, producing perceptually representative buckets — not just the most frequent pixel.",
        metaLabel: "Algorithm",
        metaValue: "Median cut",
        metaTone: "primary",
      },
      {
        title: "Dominance Share",
        icon: "donut_small",
        iconTone: "secondary",
        desc: "Each swatch shows the share of pixels it represents, so the true dominant colors lead the palette.",
        metaLabel: "Report",
        metaValue: "Per color",
        metaTone: "secondary",
      },
      {
        title: "Full Color Space Readout",
        icon: "palette",
        iconTone: "tertiary",
        desc: "HEX, RGB and HSL values per swatch with individual copy buttons for each format.",
        metaLabel: "Formats",
        metaValue: "3 spaces",
        metaTone: "secondary",
      },
    ],
    related: [
      rel("image-to-data-uri", "Image to Data URI", "Inline the source image", "code", "tertiary"),
      rel("image-compressor", "Image Compressor", "Shrink the source file", "compress", "secondary"),
    ],
    relatedHeading: "Related Image Tools",
    faqHeading: "Working With the Palette Extractor",
    faqs: [
      ...privacyFaqs("Your images"),
      {
        q: "How many colors can I extract?",
        a: "Between 2 and 12 via the color-count control. More colors give finer gradients; fewer give punchy brand-style palettes.",
      },
      {
        q: "Why do extracted colors differ from Photoshop's eyedropper?",
        a: "Eyedroppers read a single pixel; median-cut averages perceptual buckets across the whole image. Both approaches are valid — this one is designed for representative palettes, not single-pixel sampling.",
      },
    ],
  },

  {
    slug: "favicon-generator",
    title: "Favicon Package Generator",
    desc: "16×16 → 512×512 icons, .ico, manifest & HTML tags.",
    heroDesc:
      "Turn one square image into a complete favicon package — 16 to 512 px PNGs, a multi-resolution .ico, a web manifest and ready-to-paste <link> tags — all generated locally and delivered as a ZIP.",
    icon: "grid_on",
    accent: "secondary",
    category: "image",
    popularity: 77,
    tags: ["favicon", "icon", "pwa", "manifest", "ico", "apple touch", "generator"],
    badges: [{ label: "ZIP Package", tone: "secondary" }],
    heroChips: [pulseChip("7 Sizes + .ico"), strongChip("0-Upload"), softChip("Manifest Included")],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "True Multi-Resolution .ico",
        icon: "image",
        iconTone: "primary",
        desc: "The .ico container embeds several PNG sizes in one file — the format modern browsers and Windows actually read.",
        metaLabel: "Format",
        metaValue: "ICO (PNG-in)",
        metaTone: "secondary",
      },
      {
        title: "Manifest Ready",
        icon: "apps",
        iconTone: "tertiary",
        desc: "Generates manifest.webmanifest entries plus the exact <link>/<meta> tags to paste into your <head>.",
        metaLabel: "Output",
        metaValue: "Copy-paste",
        metaTone: "primary",
      },
      {
        title: "Square-Nudge Warning",
        icon: "crop_square",
        iconTone: "error",
        desc: "Non-square uploads are detected before processing with a clear message — icons must be square.",
        metaLabel: "Validation",
        metaValue: "Up-front",
        metaTone: "secondary",
      },
    ],
    related: [
      rel("image-resizer", "Image Resizer", "General dimension scaling", "aspect_ratio", "primary"),
      rel("image-to-data-uri", "Image to Data URI", "Inline tiny icons", "code", "secondary"),
    ],
    relatedHeading: "Related Image Tools",
    faqHeading: "Working With the Favicon Generator",
    faqs: [
      ...privacyFaqs("Your icon"),
      {
        q: "Which source image should I use?",
        a: "A square PNG at 512×512 or larger with transparency. Upscaling from small sources produces blurry icons — start big.",
      },
      {
        q: "Do I still need favicon.ico?",
        a: "Yes — browsers and crawlers request /favicon.ico by convention regardless of your <link> tags. The generated package includes it so you can drop it in your site root.",
      },
    ],
  },

  {
    slug: "exif-stripper",
    title: "EXIF Metadata Stripper",
    desc: "Remove GPS location and camera tags from photos.",
    heroDesc:
      "Inspect the metadata embedded in your photos — camera model, timestamps and (importantly) GPS coordinates — then download a clean copy with all of it removed. Stripping happens by re-encoding through the canvas, which physically cannot carry EXIF blocks.",
    icon: "no_encryption",
    accent: "error",
    category: "image",
    popularity: 80,
    tags: ["exif", "metadata", "gps", "privacy", "strip", "photo", "security"],
    badges: [{ label: "Privacy", tone: "error" }],
    heroChips: [pulseChip("GPS Radar"), strongChip("0-Upload"), softChip("Batch Strip")],
    heroMetrics: defaultHeroMetrics(),
    capabilities: [
      {
        title: "Metadata Radar",
        icon: "travel_explore",
        iconTone: "error",
        desc: "Lists detected EXIF fields per photo and flags GPS tags prominently so you know exactly what would leak.",
        metaLabel: "Inspection",
        metaValue: "Per file",
        metaTone: "error",
      },
      {
        title: "Canvas Re-Encode Strip",
        icon: "shield",
        iconTone: "primary",
        desc: "Output is rebuilt pixel-by-pixel through the canvas — a format that cannot store EXIF, so stripping is structural, not optional.",
        metaLabel: "Guarantee",
        metaValue: "Structural",
        metaTone: "primary",
      },
      {
        title: "Quality Control",
        icon: "tune",
        iconTone: "secondary",
        desc: "JPEG output quality is adjustable; the tool reports before/after sizes and warns if the file grew.",
        metaLabel: "Trade-off",
        metaValue: "Visible",
        metaTone: "secondary",
      },
    ],
    related: [
      rel("image-compressor", "Image Compressor", "Shrink after stripping", "compress", "primary"),
      rel("image-resizer", "Image Resizer", "Resize the clean copy", "aspect_ratio", "secondary"),
    ],
    relatedHeading: "Related Image Tools",
    faqHeading: "Working With EXIF Metadata",
    faqs: [
      ...privacyFaqs("Your photos"),
      {
        q: "Why is GPS metadata a real privacy risk?",
        a: "Many phones embed exact coordinates in every photo. Sharing that file publicly can disclose your home, workplace or a child's school. If you publish photos, strip them.",
      },
      {
        q: "Does re-encoding change the image?",
        a: "Pixels are preserved exactly by design; the file is re-containerized without metadata. JPEG output is re-compressed at the selected quality, so there can be a small size trade-off — always shown honestly.",
      },
      {
        q: "Which formats carry EXIF?",
        a: "Primarily JPEG and TIFF (and some WebP). PNG files normally don't carry EXIF; the inspector will simply report no metadata for them.",
      },
    ],
  },
];
