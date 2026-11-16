"use client";

/** QR Code Generator â€” `qrcode` lib, SVG/PNG export, logo overlay, contrast guard. */

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/common/Icon";
import CopyButton from "@/components/tools/CopyButton";
import { RIBBON_BTN_CLEAR, RIBBON_MAIN_ACTION, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import { downloadBlob, downloadText } from "@/hooks/useDownload";
import { useRibbonPortal } from "@/hooks/useRibbonPortal";

type EcLevel = "L" | "M" | "Q" | "H";

const EC_LABEL: Record<EcLevel, string> = {
  L: "L â€” 7% recovery",
  M: "M â€” 15% recovery",
  Q: "Q â€” 25% recovery",
  H: "H â€” 30% recovery",
};

/** Relative luminance (WCAG-ish) for the contrast guard. */
function luminance(hex: string): number {
  const rgb = hex.replace("#", "");
  const full = rgb.length === 3 ? rgb.split("").map((c) => c + c).join("") : rgb;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function QrGeneratorWorkspace() {
  const [content, setContent] = useState("https://babygottools.com");
  const [ecLevel, setEcLevel] = useState<EcLevel>("M");
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(4);
  const [dark, setDark] = useState("#111827");
  const [light, setLight] = useState("#ffffff");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasHost = useRef<HTMLDivElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const contrast = contrastRatio(dark, light);
  const lowContrast = contrast < 2.5;

  const generateSvg = useCallback(async () => {
    if (content.trim().length === 0) {
      setError("Enter a URL or text to encode.");
      setSvg("");
      return;
    }
    if (content.length > 2000) {
      setError("Content is too long for a single QR code (2,000 characters max for reliable scanning).");
      setSvg("");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const QRCode = (await import("qrcode")).default;
      const svgText = await QRCode.toString(content, {
        type: "svg",
        errorCorrectionLevel: ecLevel,
        margin,
        width: size,
        color: { dark, light },
      });
      setSvg(svgText);
    } catch (e) {
      setSvg("");
      setError(e instanceof Error ? e.message : "QR generation failed.");
    } finally {
      setBusy(false);
    }
  }, [content, ecLevel, margin, size, dark, light]);

  // Auto-generate on first mount so the page is never empty.
  useEffect(() => {
    void generateSvg();
  }, [generateSvg]);

  /** Compose PNG on canvas: QR + optional centered logo with a quiet pad. */
  const exportPng = useCallback(async () => {
    if (!svg) return;
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(content, {
        errorCorrectionLevel: ecLevel,
        margin,
        width: size,
        color: { dark, light },
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to rasterize the QR canvas."));
        img.src = dataUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable.");
      ctx.drawImage(img, 0, 0, size, size);
      if (logoDataUrl) {
        const logo = new Image();
        await new Promise<void>((resolve, reject) => {
          logo.onload = () => resolve();
          logo.onerror = () => reject(new Error("Failed to read the logo image."));
          logo.src = logoDataUrl;
        });
        const logoSize = Math.round(size * 0.18);
        const pad = Math.round(size * 0.015);
        const x = (size - logoSize) / 2;
        const y = (size - logoSize) / 2;
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, pad * 2);
        ctx.fill();
        ctx.drawImage(logo, x, y, logoSize, logoSize);
      }
      canvas.toBlob(
        (blob) => {
          if (blob) downloadBlob(blob, `qr-code-${size}px.png`);
          else setError("This browser could not encode the PNG.");
        },
        "image/png"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "PNG export failed.");
    }
  }, [svg, content, ecLevel, margin, size, dark, light, logoDataUrl]);

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logos must be image files (PNG, JPEG, WebP or SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo images are limited to 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const clear = () => {
    setContent("");
    setLogoDataUrl(null);
    setSvg("");
    setError(null);
  };

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className="flex items-center gap-1.5">
          <label htmlFor="qr-ec" className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">
            EC level
          </label>
          <select
            id="qr-ec"
            value={ecLevel}
            onChange={(e) => setEcLevel(e.target.value as EcLevel)}
            className="px-2 py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
          >
            {(Object.keys(EC_LABEL) as EcLevel[]).map((k) => (
              <option key={k} value={k}>
                {EC_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => (logoDataUrl ? setLogoDataUrl(null) : logoInput.current?.click())}
          className={`inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg text-label-mono-md font-label-mono-md transition-all cursor-pointer ${
            logoDataUrl ? "bg-secondary/10 text-secondary" : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
          }`}
        >
          <Icon name={logoDataUrl ? "check_circle" : "image"} size={16} />
          <span>{logoDataUrl ? "Logo attached" : "Add logo"}</span>
        </button>
        <input ref={logoInput} type="file" accept="image/*" className="hidden" aria-hidden="true" onChange={(e) => onLogoFile(e.target.files?.[0])} />
        {content && (
          <button type="button" onClick={clear} className={RIBBON_BTN_CLEAR}>
            <Icon name="delete_sweep" size={16} />
            <span>Clear</span>
          </button>
        )}
      </div>
      <button type="button" onClick={() => void exportPng()} disabled={!svg} className={`${RIBBON_MAIN_ACTION} ${!svg ? "opacity-60" : ""}`}>
        <Icon name="download" size={16} />
        <span>Download PNG</span>
      </button>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg">
        {/* controls */}
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Content & Styling</span>
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">Computed locally</span>
          </div>
          <div className="bg-surface-container-lowest p-space-md space-y-space-md">
            <label className="block">
              <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wide">URL or text</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="https://example.com"
                className="mt-1 w-full px-space-sm py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary placeholder:text-outline-variant resize-y"
              />
              <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">{content.length}/2,000 characters</span>
            </label>
            <div className="grid grid-cols-2 gap-space-sm">
              <label className="block">
                <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wide">Size: {size}px</span>
                <input type="range" min={256} max={2000} step={64} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-1 w-full accent-secondary cursor-pointer" />
              </label>
              <label className="block">
                <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wide">Quiet zone: {margin} modules</span>
                <input type="range" min={0} max={8} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="mt-1 w-full accent-secondary cursor-pointer" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-space-sm">
              <label className="block">
                <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wide">Foreground</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} aria-label="Foreground color" className="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent p-0" />
                  <input
                    value={dark}
                    onChange={(e) => setDark(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
              </label>
              <label className="block">
                <span className="font-label-mono-xs font-label-mono-xs text-on-surface-variant uppercase tracking-wide">Background</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={light} onChange={(e) => setLight(e.target.value)} aria-label="Background color" className="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent p-0" />
                  <input
                    value={light}
                    onChange={(e) => setLight(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-mono-md text-label-mono-md focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
              </label>
            </div>
            {lowContrast && (
              <div className="flex items-start gap-2 text-tertiary text-label-mono-md font-label-mono-md">
                <Icon name="warning" size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  Contrast ratio {contrast.toFixed(1)}:1 is below the 2.5:1 reliability threshold â€” scanners may struggle with this color pair.
                </span>
              </div>
            )}
            {logoDataUrl && (
              <div className="flex items-center gap-2 text-label-mono-md font-label-mono-md text-on-surface-variant">
                <Icon name="info" size={16} className="text-tertiary flex-shrink-0" />
                <span>Logo overlays the center â€” keep EC level at Q or H so the code stays scannable.</span>
              </div>
            )}
          </div>
        </div>

        {/* output */}
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">QR Preview</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {svg && (
                <>
                  <button
                    type="button"
                    onClick={() => downloadText(svg, "qr-code.svg", "image/svg+xml;charset=utf-8")}
                    title="Download SVG (vector)"
                    className="inline-flex items-center gap-1 px-space-sm py-1 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 font-label-mono-md text-label-mono-md transition-all cursor-pointer"
                  >
                    <Icon name="download" size={16} />
                    <span>SVG</span>
                  </button>
                  <CopyButton value={svg} label="Copy SVG" title="Copy SVG markup" />
                </>
              )}
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest p-space-md flex flex-col items-center justify-center overflow-auto" style={{ minHeight: 380, maxHeight: 560 }}>
            {busy ? (
              <Icon name="progress_activity" size={32} className="text-secondary animate-spin" />
            ) : error ? (
              <div className="flex flex-col items-center justify-center text-center gap-2">
                <Icon name="error" size={36} className="text-error" />
                <p className="text-error font-semibold max-w-xs break-words">{error}</p>
              </div>
            ) : svg ? (
              <div className="p-3 rounded-xl bg-white shadow-inner max-w-full" style={{ maxWidth: 420 }}>
                <div ref={canvasHost} className="max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
                <div className="mt-2 text-center font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                  {size}Ã—{size}px Â· EC {ecLevel} Â· margin {margin}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center gap-2">
                <Icon name="qr_code_2" size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">Enter a URL or text â€” the QR code renders instantly.</p>
              </div>
            )}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between flex-wrap gap-1 text-label-mono-xs font-label-mono-xs">
            <div className="flex items-center gap-2 min-w-0 text-secondary">
              <Icon name={svg ? "verified" : "hourglass_empty"} size={16} className="flex-shrink-0" />
              <span className="font-semibold truncate">{svg ? "Generated locally â€¢ no tracking pixels" : "Awaiting content"}</span>
            </div>
            <div className="flex items-center gap-3 text-on-surface-variant flex-shrink-0">
              {contrast >= 2.5 && <span>contrast {contrast.toFixed(1)}:1</span>}
              {logoDataUrl && <span>PNG export composites logo</span>}
            </div>
          </div>
        </div>
      </div>

      {ribbonNode}
    </>
  );
}
