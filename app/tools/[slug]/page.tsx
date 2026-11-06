import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolPageShell from "@/components/tools/ToolPageShell";
import { devTools } from "@/data/devTools";
import type { DevTool } from "@/data/devToolTypes";
import { PDF_TOOLS, pdfToolBySlug } from "@/data/pdfTools";
import PdfToolShell from "@/features/pdf-tools/components/PdfToolShell";
import { SEO_BY_SLUG } from "@/data/seoTitles";
import { OG_IMAGE } from "@/lib/site";
import PdfWorkspaceLoader from "@/features/pdf-tools/components/PdfWorkspaceLoader";
import JsonFormatterWorkspace from "@/features/developer-tools/JsonFormatterWorkspace";
import {
  CssBeautifierWorkspace,
  CssMinifierWorkspace,
  GraphqlWorkspace,
  HtmlFormatterWorkspace,
  JsWorkspace,
  ScriptFormatterWorkspace,
  SqlWorkspace,
  YamlWorkspace,
} from "@/features/developer-tools/workspaces/codeTools";
import {
  Base64Workspace,
  CsvToJsonWorkspace,
  HtmlViewerWorkspace,
  JsonToCsvWorkspace,
  UrlWorkspace,
  YamlToJsonWorkspace,
} from "@/features/developer-tools/workspaces/dataTools";
import {
  EncryptWorkspace,
  JwtWorkspace,
  TokenWorkspace,
  UuidV7Workspace,
  UuidWorkspace,
} from "@/features/developer-tools/workspaces/securityIdTools";
import {
  ApiMockWorkspace,
  CronWorkspace,
  DiffWorkspace,
  HttpHeaderWorkspace,
  JsonCompareWorkspace,
  QueryStringWorkspace,
  RegexWorkspace,
  UnicodeSecurityWorkspace,
  UnicodeTextWorkspace,
} from "@/features/developer-tools/workspaces/parserTools";
import OnlineClipboardWorkspace from "@/features/developer-tools/OnlineClipboardWorkspace";

/** slug → lazily-bundled client workspace (flagship gets the bespoke build). */
type WorkspaceProps = { tool: DevTool };
const WORKSPACES: Record<string, (props: WorkspaceProps) => React.JSX.Element> = {
  "json-formatter": ({ tool }) => <JsonFormatterWorkspace tool={tool} />,
  "sql-query-formatter": () => <SqlWorkspace variant="interactive" />,
  "sql-formatter": () => <SqlWorkspace variant="scripts" />,
  "javascript-formatter": () => <JsWorkspace language="javascript" />,
  "typescript-formatter": () => <JsWorkspace language="typescript" />,
  "yaml-formatter": () => <YamlWorkspace />,
  "graphql-formatter": () => <GraphqlWorkspace />,
  "css-beautifier": () => <CssBeautifierWorkspace />,
  "css-minifier": () => <CssMinifierWorkspace />,
  "html-formatter": () => <HtmlFormatterWorkspace />,
  "html-viewer": () => <HtmlViewerWorkspace />,
  "python-formatter": () => <ScriptFormatterWorkspace engine="python" />,
  "lua-beautifier": () => <ScriptFormatterWorkspace engine="lua" />,
  "php-beautifier": () => <ScriptFormatterWorkspace engine="php" />,
  "base64-encoder-decoder": () => <Base64Workspace />,
  "url-encoder-decoder": () => <UrlWorkspace />,
  "csv-to-json-converter": () => <CsvToJsonWorkspace />,
  "json-to-csv-converter": () => <JsonToCsvWorkspace />,
  "yaml-to-json-converter": () => <YamlToJsonWorkspace />,
  "jwt-debugger": () => <JwtWorkspace />,
  "uuid-generator": () => <UuidWorkspace />,
  "uuid-v7-generator": () => <UuidV7Workspace />,
  "token-generator": () => <TokenWorkspace />,
  "text-encryptor": () => <EncryptWorkspace />,
  "regex-tester": () => <RegexWorkspace />,
  "diff-checker": () => <DiffWorkspace />,
  "json-compare": () => <JsonCompareWorkspace />,
  "cron-parser": () => <CronWorkspace />,
  "query-string-parser": () => <QueryStringWorkspace />,
  "http-header-inspector": () => <HttpHeaderWorkspace />,
  "unicode-text-inspector": () => <UnicodeTextWorkspace />,
  "unicode-security-inspector": () => <UnicodeSecurityWorkspace />,
  "api-mock-generator": () => <ApiMockWorkspace />,
  "online-clipboard": ({ tool }) => <OnlineClipboardWorkspace tool={tool} />,
};

export function generateStaticParams() {
  return [
    ...devTools.map((tool) => ({ slug: tool.slug })),
    ...PDF_TOOLS.map((tool) => ({ slug: tool.slug })),
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = devTools.find((t) => t.slug === slug) ?? pdfToolBySlug(slug);
  if (!tool) return { title: { absolute: "Tool not found — Baby Got Tools" } };
  const fallbackTitle = `${tool.alias ?? tool.title} — Free Online Tool`;
  const curated = SEO_BY_SLUG[tool.slug];
  const title = curated?.title ?? fallbackTitle;
  const description = curated?.description ?? tool.desc;
  return {
    title,
    description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/tools/${tool.slug}`,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // PDF & Document Tools route through their own shell (Stitch compress-pdf layout).
  const pdfTool = pdfToolBySlug(slug);
  if (pdfTool) {
    return (
      <PdfToolShell tool={pdfTool}>
        <PdfWorkspaceLoader slug={slug} tool={pdfTool} />
      </PdfToolShell>
    );
  }
  const tool = devTools.find((t) => t.slug === slug);
  const Workspace = WORKSPACES[slug];
  if (!tool || !Workspace) notFound();
  return (
    <ToolPageShell tool={tool}>
      <Workspace tool={tool} />
    </ToolPageShell>
  );
}
