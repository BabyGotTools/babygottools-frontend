"use client";

/** Image to Data URI / Base64 workspace â€” byte-exact, three snippet styles. */

import { useCallback, useState } from "react";
import Icon from "@/components/common/Icon";
import CopyButton from "@/components/tools/CopyButton";
import DownloadButton from "@/components/tools/DownloadButton";
import { RIBBON_BTN_CLEAR, INDENT_BTN_ACTIVE, INDENT_BTN_IDLE, RIBBON_INDENT_GROUP, RIBBON_ROW } from "@/components/tools/ribbonStyles";
import { bytesToLabel, type LoadedImage } from "../engines/imageEngine";
import { useImageFileInput } from "../components/ImageDropzone";
import { useRibbonPortal } from "@/hooks/useRibbonPortal";

type Snippet = "raw" | "html" | "css";

const SNIPPET_LABEL: Record<Snippet, string> = {
  raw: "Raw Data URI",
  html: "HTML <img>",
  css: "CSS background",
};

export function ImageDataUriWorkspace() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [dataUri, setDataUri] = useState("");
  const [snippet, setSnippet] = useState<Snippet>("html");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { handleFiles } = useImageFileInput(
    (added) => {
      const img = added[0];
      setImage(img);
      setDataUri("");
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const uri = String(reader.result ?? "");
        setDataUri(uri);
      };
      reader.onerror = () => setError("The file could not be read.");
      reader.readAsDataURL(img.file);
    },
    false
  );

  const output = useCallback((): string => {
    if (!image || !dataUri) return "";
    if (snippet === "raw") return dataUri;
    if (snippet === "html") return `<img src="${dataUri}" alt="${image.name.replace(/\.[^.]+$/, "")}" width="${image.width}" height="${image.height}">`;
    return `.element {\n  background-image: url("${dataUri}");\n  background-repeat: no-repeat;\n  background-size: contain;\n}`;
  }, [image, dataUri, snippet]);

  const text = output();
  const overhead = image ? Math.round(((dataUri.length - image.size) / image.size) * 100) : 0;

  const clear = () => {
    setImage(null);
    setDataUri("");
    setError(null);
  };

  const ribbon = (
    <div className={RIBBON_ROW}>
      <div className="flex flex-wrap items-center gap-space-xs">
        <div className={RIBBON_INDENT_GROUP}>
          {(Object.keys(SNIPPET_LABEL) as Snippet[]).map((s) => (
            <button key={s} type="button" onClick={() => setSnippet(s)} className={snippet === s ? INDENT_BTN_ACTIVE : INDENT_BTN_IDLE}>
              {SNIPPET_LABEL[s]}
            </button>
          ))}
        </div>
        {image && (
          <button type="button" onClick={clear} className={RIBBON_BTN_CLEAR}>
            <Icon name="delete_sweep" size={16} />
            <span>Clear</span>
          </button>
        )}
      </div>
      <span className="inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-tertiary/10 text-tertiary text-label-mono-md font-label-mono-md">
        <Icon name="verified" size={16} />
        <span>Byte-exact â€” no re-encoding</span>
      </span>
    </div>
  );
  const ribbonNode = useRibbonPortal(ribbon);

  return (
    <>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
        }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-lg"
      >
        {/* left: dropzone + preview */}
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Source Image</span>
            </div>
            <span className="text-label-mono-xs font-label-mono-xs text-on-surface-variant">0-Upload</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => document.getElementById("datauri-file")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                document.getElementById("datauri-file")?.click();
              }
            }}
            className={`p-space-lg border-2 border-dashed rounded-xl transition-all cursor-pointer text-center flex-1 flex flex-col items-center justify-center ${
              image ? "border-transparent" : "border-outline-variant/50 hover:border-secondary/60"
            }`}
          >
            {image ? (
              <div className="w-full">
                <img
                  src={URL.createObjectURL(image.file)}
                  alt={image.name}
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                  className="max-h-48 mx-auto rounded object-contain"
                />
                <div className="mt-space-sm font-label-mono-md font-label-mono-md text-on-surface truncate" title={image.name}>
                  {image.name}
                </div>
                <div className="font-label-mono-xs font-label-mono-xs text-on-surface-variant">
                  {image.width}Ã—{image.height} Â· {bytesToLabel(image.size)}
                </div>
              </div>
            ) : loading ? (
              <Icon name="progress_activity" size={32} className="text-secondary animate-spin" />
            ) : (
              <>
                <Icon name="cloud_upload" size={32} className="mx-auto mb-2 text-secondary" />
                <p className="font-body-md text-body-md text-on-surface font-semibold">Drop an image here or click to browse</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Small assets (icons, logos) inline best â€” the overhead report tells you.</p>
              </>
            )}
          </div>
          <input
            id="datauri-file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/svg+xml"
            className="hidden"
            aria-hidden="true"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* right: output */}
        <div className="flex flex-col bg-surface-container rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="w-3 h-3 rounded-full bg-surface-variant flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">{SNIPPET_LABEL[snippet]}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <DownloadButton value={text} filename={`image-${snippet === "raw" ? "data-uri" : snippet === "html" ? "img-tag" : "background"}.txt`} />
              <CopyButton value={text} />
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest p-space-md font-label-mono-md text-label-mono-md overflow-auto leading-[22px]" style={{ height: 380, maxHeight: 560 }}>
            {error ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="error" size={36} className="text-error" />
                <p className="text-error font-semibold">{error}</p>
              </div>
            ) : text ? (
              <pre className="text-on-surface select-text overflow-x-auto whitespace-pre-wrap break-all">
                <code>{text}</code>
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Icon name="code" size={36} className="text-outline-variant" />
                <p className="text-on-surface-variant font-body-sm text-body-sm">The data URI and snippets appear here after you load an image.</p>
              </div>
            )}
          </div>
          <div className="bg-surface-container-low px-space-md py-2 flex items-center justify-between flex-wrap gap-1 text-label-mono-xs font-label-mono-xs">
            <div className="flex items-center gap-2 min-w-0 text-secondary">
              <Icon name={dataUri ? "verified" : "hourglass_empty"} size={16} className="flex-shrink-0" />
              <span className="font-semibold truncate">{dataUri ? "Encoded â€¢ nothing was transmitted" : "Awaiting image"}</span>
            </div>
            {dataUri && image && (
              <div className="flex items-center gap-3 text-on-surface-variant flex-shrink-0">
                <span>
                  {bytesToLabel(image.size)} â†’ <span className="text-secondary font-semibold">{bytesToLabel(dataUri.length)}</span>
                </span>
                <span className={overhead > 0 ? "text-tertiary" : "text-secondary"}>
                  {overhead >= 0 ? "+" : ""}
                  {overhead}% overhead
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {ribbonNode}
    </>
  );
}
