"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ComponentType } from "react";
import type { DevTool } from "@/data/devToolTypes";

/**
 * Maps a tool slug to its lazily-bundled workspace (same pattern as the PDF
 * loader). Every workspace pulls its own engines (Parsimmon, jsquash WASM,
 * marked, highlight.jsâ€¦), so `/tools/[slug]` ships only the code the opened
 * tool actually runs â€” the hero, capabilities, related tools and FAQs stay
 * server-rendered for crawlers.
 */

type WorkspaceComponent = ComponentType<{ tool: DevTool }>;

const JsonFormatter = dynamic(() => import("@/features/developer-tools/JsonFormatterWorkspace"), { ssr: false, loading: () => <WorkspaceSkeleton /> });
const OnlineClipboard = dynamic(() => import("@/features/developer-tools/OnlineClipboardWorkspace"), { ssr: false, loading: () => <WorkspaceSkeleton /> });
const SqlWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/codeTools").then((m) => ({ default: m.SqlWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const CssBeautifier = dynamic(
  () => import("@/features/developer-tools/workspaces/codeTools").then((m) => ({ default: m.CssBeautifierWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const CssMinifier = dynamic(
  () => import("@/features/developer-tools/workspaces/codeTools").then((m) => ({ default: m.CssMinifierWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const GraphqlWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/codeTools").then((m) => ({ default: m.GraphqlWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const HtmlFormatter = dynamic(
  () => import("@/features/developer-tools/workspaces/codeTools").then((m) => ({ default: m.HtmlFormatterWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const JsWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/codeTools").then((m) => ({ default: m.JsWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const ScriptFormatter = dynamic(
  () => import("@/features/developer-tools/workspaces/codeTools").then((m) => ({
    default: m.ScriptFormatterWorkspace,
  })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const YamlWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/codeTools").then((m) => ({ default: m.YamlWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const Base64Workspace = dynamic(
  () => import("@/features/developer-tools/workspaces/dataTools").then((m) => ({ default: m.Base64Workspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const CsvToJson = dynamic(
  () => import("@/features/developer-tools/workspaces/dataTools").then((m) => ({ default: m.CsvToJsonWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const HtmlViewer = dynamic(
  () => import("@/features/developer-tools/workspaces/dataTools").then((m) => ({ default: m.HtmlViewerWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const JsonToCsv = dynamic(
  () => import("@/features/developer-tools/workspaces/dataTools").then((m) => ({ default: m.JsonToCsvWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const UrlWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/dataTools").then((m) => ({ default: m.UrlWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const YamlToJson = dynamic(
  () => import("@/features/developer-tools/workspaces/dataTools").then((m) => ({ default: m.YamlToJsonWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const EncryptWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/securityIdTools").then((m) => ({ default: m.EncryptWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const JwtWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/securityIdTools").then((m) => ({ default: m.JwtWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const TokenWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/securityIdTools").then((m) => ({ default: m.TokenWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const UuidV7 = dynamic(
  () => import("@/features/developer-tools/workspaces/securityIdTools").then((m) => ({ default: m.UuidV7Workspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const UuidWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/securityIdTools").then((m) => ({ default: m.UuidWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const ApiMock = dynamic(
  () => import("@/features/developer-tools/workspaces/parserTools").then((m) => ({ default: m.ApiMockWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const CronWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/parserTools").then((m) => ({ default: m.CronWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const DiffWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/parserTools").then((m) => ({ default: m.DiffWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const HttpHeader = dynamic(
  () => import("@/features/developer-tools/workspaces/parserTools").then((m) => ({ default: m.HttpHeaderWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const JsonCompare = dynamic(
  () => import("@/features/developer-tools/workspaces/parserTools").then((m) => ({ default: m.JsonCompareWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const QueryString = dynamic(
  () => import("@/features/developer-tools/workspaces/parserTools").then((m) => ({ default: m.QueryStringWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const RegexWorkspace = dynamic(
  () => import("@/features/developer-tools/workspaces/parserTools").then((m) => ({ default: m.RegexWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const UnicodeSecurity = dynamic(
  () => import("@/features/developer-tools/workspaces/parserTools").then((m) => ({
    default: m.UnicodeSecurityWorkspace,
  })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const UnicodeText = dynamic(
  () => import("@/features/developer-tools/workspaces/parserTools").then((m) => ({
    default: m.UnicodeTextWorkspace,
  })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);

/* Text & Writing */
const CaseConverter = dynamic(
  () => import("@/features/text-tools/workspaces/TextWorkspaces").then((m) => ({ default: m.CaseConverterWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const InvisibleChar = dynamic(
  () => import("@/features/text-tools/workspaces/TextWorkspaces").then((m) => ({ default: m.InvisibleCharWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const LoremIpsum = dynamic(
  () => import("@/features/text-tools/workspaces/TextWorkspaces").then((m) => ({ default: m.LoremIpsumWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const RemoveDuplicates = dynamic(
  () =>
    import("@/features/text-tools/workspaces/TextWorkspaces").then((m) => ({
      default: m.RemoveDuplicatesWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const TextDiff = dynamic(
  () => import("@/features/text-tools/workspaces/TextDiffWorkspace").then((m) => ({ default: m.TextDiffWorkspace })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const WordCounter = dynamic(() => import("@/features/text-tools/workspaces/WordCounterWorkspace"), { ssr: false, loading: () => <WorkspaceSkeleton /> });
const MarkdownPreview = dynamic(
  () =>
    import("@/features/text-tools/workspaces/MarkdownPreviewWorkspace").then((m) => ({
      default: m.MarkdownPreviewWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);

/* Image & Media */
const ImageCompressor = dynamic(
  () =>
    import("@/features/image-tools/workspaces/ImageCompressorWorkspace").then((m) => ({
      default: m.ImageCompressorWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const ImageResizer = dynamic(
  () =>
    import("@/features/image-tools/workspaces/ImageResizerWorkspace").then((m) => ({
      default: m.ImageResizerWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const ImageDataUri = dynamic(
  () =>
    import("@/features/image-tools/workspaces/ImageDataUriWorkspace").then((m) => ({
      default: m.ImageDataUriWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const ColorPalette = dynamic(
  () =>
    import("@/features/image-tools/workspaces/ColorPaletteWorkspace").then((m) => ({
      default: m.ColorPaletteWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const FaviconGenerator = dynamic(
  () =>
    import("@/features/image-tools/workspaces/FaviconWorkspace").then((m) => ({
      default: m.FaviconWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const ExifStripper = dynamic(
  () =>
    import("@/features/image-tools/workspaces/ExifStripperWorkspace").then((m) => ({
      default: m.ExifStripperWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);

/* Utility & Productivity */
const QrGenerator = dynamic(
  () =>
    import("@/features/utility-tools/workspaces/QrGeneratorWorkspace").then((m) => ({
      default: m.QrGeneratorWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);
const PasswordGenerator = dynamic(
  () =>
    import("@/features/utility-tools/workspaces/PasswordGeneratorWorkspace").then((m) => ({
      default: m.PasswordGeneratorWorkspace,
    })),
  { ssr: false, loading: () => <WorkspaceSkeleton /> }
);

const WORKSPACES: Record<string, WorkspaceComponent> = {
  "json-formatter": JsonFormatter,
  "sql-query-formatter": () => <SqlWorkspace variant="interactive" />,
  "sql-formatter": () => <SqlWorkspace variant="scripts" />,
  "javascript-formatter": () => <JsWorkspace language="javascript" />,
  "typescript-formatter": () => <JsWorkspace language="typescript" />,
  "yaml-formatter": () => <YamlWorkspace />,
  "graphql-formatter": () => <GraphqlWorkspace />,
  "css-beautifier": () => <CssBeautifier />,
  "css-minifier": () => <CssMinifier />,
  "html-formatter": () => <HtmlFormatter />,
  "html-viewer": () => <HtmlViewer />,
  "python-formatter": () => <ScriptFormatter engine="python" />,
  "lua-beautifier": () => <ScriptFormatter engine="lua" />,
  "php-beautifier": () => <ScriptFormatter engine="php" />,
  "base64-encoder-decoder": () => <Base64Workspace />,
  "url-encoder-decoder": () => <UrlWorkspace />,
  "csv-to-json-converter": () => <CsvToJson />,
  "json-to-csv-converter": () => <JsonToCsv />,
  "yaml-to-json-converter": () => <YamlToJson />,
  "jwt-debugger": () => <JwtWorkspace />,
  "uuid-generator": () => <UuidWorkspace />,
  "uuid-v7-generator": () => <UuidV7 />,
  "token-generator": () => <TokenWorkspace />,
  "text-encryptor": () => <EncryptWorkspace />,
  "regex-tester": () => <RegexWorkspace />,
  "diff-checker": () => <DiffWorkspace />,
  "json-compare": () => <JsonCompare />,
  "cron-parser": () => <CronWorkspace />,
  "query-string-parser": () => <QueryString />,
  "http-header-inspector": () => <HttpHeader />,
  "unicode-text-inspector": () => <UnicodeText />,
  "unicode-security-inspector": () => <UnicodeSecurity />,
  "api-mock-generator": () => <ApiMock />,
  "online-clipboard": OnlineClipboard,

  /* Text & Writing Tools */
  "word-counter": () => <WordCounter />,
  "case-converter": () => <CaseConverter />,
  "text-diff": () => <TextDiff />,
  "remove-duplicate-lines": () => <RemoveDuplicates />,
  "lorem-ipsum-generator": () => <LoremIpsum />,
  "markdown-live-preview": () => <MarkdownPreview />,
  "invisible-unicode-character": () => <InvisibleChar />,

  /* Image & Media Tools */
  "image-compressor": () => <ImageCompressor />,
  "image-resizer": () => <ImageResizer />,
  "image-to-data-uri": () => <ImageDataUri />,
  "color-palette-extractor": () => <ColorPalette />,
  "favicon-generator": () => <FaviconGenerator />,
  "exif-stripper": () => <ExifStripper />,

  /* Utility & Productivity */
  "qr-code-generator": () => <QrGenerator />,
  "password-generator": () => <PasswordGenerator />,
};

/** Placeholder matching the workspace grid footprint while the chunk loads. */
function WorkspaceSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md animate-pulse" aria-busy="true">
      <div className="lg:col-span-7 flex flex-col gap-space-sm">
        <div className="h-40 rounded-xl bg-surface-container-low" />
        <div className="h-64 rounded-xl bg-surface-container-low" />
      </div>
      <div className="lg:col-span-5 flex flex-col gap-space-sm">
        <div className="h-72 rounded-xl bg-surface-container-low" />
      </div>
      <span className="sr-only">Loading workspaceâ€¦</span>
    </div>
  );
}

export default function ToolWorkspaceLoader({ slug, tool }: { slug: string; tool: DevTool }) {
  const Workspace = useMemo(() => WORKSPACES[slug], [slug]);
  if (!Workspace) return null;
  return <Workspace tool={tool} />;
}
