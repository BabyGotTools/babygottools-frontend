"use client";

/** Favicon Package Generator â€” multi-size PNGs, .ico, manifest, ZIP. */

import { useCallback, useState } from "react";
import Icon from "@/components/common/Icon";
import CopyButton from "@/components/tools/CopyButton";
import { RIBBON_MAIN_ACTION, RIBBON_BTN_CLEAR, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import {
  FAVICON_SIZES,
  bitmapToCanvas,
  buildIco,
  canvasToBlob,
  closeImages,
  type FaviconSize,
  type LoadedImage,
} from "../engines/imageEngine";
import { useImageFileInput } from "../components/ImageDropzone";
import { dispatchLatency, useRibbonPortal } from "@/hooks/useRibbonPortal";
import { downloadBlob } from "@/hooks/useDownload";

const HTML_TAGS = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-96x96.png" sizes="96x96" type="image/png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="shortcut icon" href="/favicon-16x16.png" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" type="image/png">
<link rel="manifest" href="/manifest.webmanifest">`;

function manifestTags(name: string): string {
  return JSON.stringify(
    {
      name,
      short_name: name,
      icons: [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      theme_color: "#ffffff",
      background_color: "#ffffff",
      display: "standalone",
    },
    null,
    2
  );
}

interface GeneratedIcon {
  size: FaviconSize;
  blob: Blob;
  url: string;
}

export function FaviconWorkspace() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [siteName, setSiteName] = useState("My Site");
  const [icons, setIcons] = useState<GeneratedIcon[]>([]);
  const [icoBlob, setIcoBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const { handleFiles } = useImageFileInput(
    (added) => {
      const img = added[0];
      if (image) closeImages([image]);
      setIcons((prev) => {
        prev.forEach((i) => URL.revokeObjectURL(i.url));
        return [];
      });
      setIcoBlob(null);
      setError(null);
      if (img.width !== img.height) {
        setError(`Icons must be square â€” this image is ${img.width}Ã—${img.height}. Crop it to a square and try again.`);
        return;
      }
      setImage(img);
    },
    false
  );

  const generate = useCallback(async () => {
    if (!image) {
      setError("Load a square source image first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const started = performance.now();
      const generated: GeneratedIcon[] = [];
      for (const spec of FAVICON_SIZES) {
        const canvas = bitmapToCanvas(image.bitmap, spec.size, spec.size);
        const blob = await canvasToBlob(canvas, "image/png");
        generated.push({ size: spec, blob, url: URL.createObjectURL(blob) });
      }
      // .ico embeds 16/32/48 for classic browser + Windows support.
      const icoSources = generated.filter((g) => [16, 32, 48].includes(g.size.size));
      const ico = await buildIco(icoSources.map((g) => ({ size: g.size.size, blob: g.blob })));
      setIcons(generated);
      setIcoBlob(ico);
      dispatchLatency(performance.now() - started);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }, [image]);

  const downloadZip = useCallback(async () => {
    if (!image || icoBlob === null) return;
    const manifest = manifestTags(siteName.trim() || "My Site");
    const iconEntries: { name: string; bytes: Uint8Array }[] = [];
    for (const i of icons) iconEntries.push({ name: i.size.label, bytes: new Uint8Array(await i.blob.arrayBuffer()) });
    iconEntries.push({ name: "favicon.ico", bytes: new Uint8Array(await icoBlob.arrayBuffer()) });
    const full = await import("@/features/pdf-tools/engines/zip").then((z) =>
      z.bundleZip([
        ...iconEntries,
        { name: "manifest.webmanifest", bytes: new TextEncoder().encode(manifest) },
        {
          name: "README.txt",
          bytes: new TextEncoder().encode(
            `Favicon package for ${siteName.trim() || "My Site"}\n\n1. Copy every file into your site root.\n2. Paste the <link> tags from the generator into your <head>.\n3. Keep /favicon.ico at the domain root for legacy crawlers.\n\nGenerated locally by Baby Got Tools â€” no uploads.\n`
          ),
        },
      ])
    );
    downloadBlob(new Blob([full.slice().buffer], { type: "application/zip" }), "favicon-package.zip");
  }, [icons, icoBlob, image, siteName]);

  const clear = () => {
    if (image) closeImages([image]);
    icons.forEach((i) => URL.revokeObjectURL(i.url));
    setImage(null);
    setIcons([]);
    setIcoBlob(null);
    setError(null);
  };

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">App name</span>
          <input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            maxLength={60}
            aria-label="Site name for the web manifest"
            className="w-36 px-2 py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
          />
        </label>
        {image && (
          <button type="button" onClick={clear} className={RIBBON_BTN_CLEAR}>
            <Icon name="delete_sweep" size={16} />
            <span>Clear</span>
          </button>
        )}
      </div>
      <button type="button" onClick={() => void generate()} disabled={busy || loading} className={`${RIBBON_MAIN_ACTION} ${busy || loading ? "opacity-60" : ""}`}>
        <Icon name={busy ? "progress_activity" : "grid_on"} size={16} className={busy ? "animate-spin" : ""} />
        <span>{busy ? "Generatingâ€¦" : "Generate Package"}</span>
      </button>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        {/* dropzone */}
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Source Icon</span>
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Square only</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => document.getElementById("favicon-file")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                document.getElementById("favicon-file")?.click();
              }
            }}
            className={`m-space-sm p-space-lg border-2 border-dashed rounded-xl transition-all cursor-pointer text-center min-h-52 flex flex-col items-center justify-center ${
              image ? "border-transparent" : "border-outline-variant/50 hover:border-secondary/60"
            }`}
          >
            {image ? (
              <div className="w-full">
                <img
                  src={URL.createObjectURL(image.file)}
                  alt={image.name}
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                  className="max-h-40 mx-auto rounded object-contain"
                />
                <div className="mt-space-sm font-label-mono-md font-label-mono-md text-on-surface truncate" title={image.name}>
                  {image.name}
                </div>
                <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                  {image.width}Ã—{image.height} â€” ready to generate
                </div>
              </div>
            ) : loading ? (
              <Icon name="progress_activity" size={32} className="text-secondary animate-spin" />
            ) : (
              <>
                <Icon name="grid_on" size={32} className="mx-auto mb-2 text-secondary" />
                <p className="font-body-md text-body-md text-on-surface font-semibold">Drop a square icon here or click to browse</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Best source: square PNG, 512Ã—512 or larger, with transparency.</p>
              </>
            )}
          </div>
          <input
            id="favicon-file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/svg+xml"
            className="hidden"
            aria-hidden="true"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {error && (
            <div className="mx-space-sm mb-space-sm bg-error-container/20 border border-error/30 rounded-lg p-space-sm flex items-start gap-2">
              <Icon name="error" size={16} className="text-error flex-shrink-0 mt-0.5" />
              <span className="text-on-surface font-body-sm text-body-sm break-words">{error}</span>
            </div>
          )}
        </div>

        {/* preview grid + tags */}
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">Package Preview</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {icons.length > 0 && icoBlob && (
                <>
                  <button
                    type="button"
                    onClick={() => void downloadZip()}
                    className="inline-flex items-center gap-1 px-space-sm py-1 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-mono-md text-label-mono-md font-semibold transition-all shadow-md cursor-pointer"
                  >
                    <Icon name="folder_zip" size={16} />
                    <span>Download ZIP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBlob(icoBlob, "favicon.ico")}
                    title="Download favicon.ico"
                    className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    <Icon name="image" size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-md overflow-auto" style={{ height: 420, maxHeight: 560 }}>
            {icons.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="apps" size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">
                  Generate to get 16â†’512 px PNGs, a multi-resolution .ico, a web manifest and paste-ready tags.
                </p>
              </div>
            ) : (
              <div className="space-y-space-md">
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-space-sm">
                  {icons.map((icon) => (
                    <div key={icon.size.size} className="text-center">
                      <img src={icon.url} alt={`${icon.size.size}px icon`} className="w-12 h-12 mx-auto object-contain rounded bg-surface-container-low p-1" />
                      <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant mt-1">{icon.size.size}px</div>
                      <button
                        type="button"
                        onClick={() => downloadBlob(icon.blob, icon.size.label)}
                        className="font-label-mono-xs font-label-mono-xs text-secondary hover:underline cursor-pointer"
                      >
                        save
                      </button>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>Paste into your &lt;head&gt;</span>
                    <CopyButton value={HTML_TAGS} label="Copy tags" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 text-secondary hover:bg-secondary/20 font-label-mono-xs text-label-mono-xs" />
                  </div>
                  <pre className="bg-surface-container-low rounded-lg p-space-sm text-on-surface select-text overflow-x-auto font-label-mono-md text-label-mono-md">
                    <code>{HTML_TAGS}</code>
                  </pre>
                </div>
                <div>
                  <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant mb-1 uppercase tracking-wide flex items-center justify-between">
                    <span>manifest.webmanifest</span>
                    <CopyButton value={manifestTags(siteName.trim() || "My Site")} label="Copy" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 text-secondary hover:bg-secondary/20 font-label-mono-xs text-label-mono-xs" />
                  </div>
                  <pre className="bg-surface-container-low rounded-lg p-space-sm text-on-surface select-text overflow-x-auto font-label-mono-md text-label-mono-md">
                    <code>{manifestTags(siteName.trim() || "My Site")}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {ribbonNode}
    </>
  );
}
