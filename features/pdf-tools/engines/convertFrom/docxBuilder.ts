import { strToU8, zipSync } from "fflate";
import type { RenderedPageImage } from "./convertFromTypes";
import type { ExtractedText } from "./pdfTextExtractor";

const EMU_PER_POINT = 12_700;
const TWIPS_PER_POINT = 20;
const A4_WIDTH_TWIPS = 11_906;
const A4_HEIGHT_TWIPS = 16_838;
const ONE_INCH_TWIPS = 1_440;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function imageExtension(mimeType: string): "jpg" | "png" {
  return mimeType === "image/png" ? "png" : "jpg";
}

function sectionProperties(
  widthTwips: number,
  heightTwips: number,
  margins = 0
): string {
  return [
    "<w:sectPr>",
    `<w:pgSz w:w="${Math.max(1, Math.round(widthTwips))}" w:h="${Math.max(1, Math.round(heightTwips))}"/>`,
    `<w:pgMar w:top="${margins}" w:right="${margins}" w:bottom="${margins}" w:left="${margins}" w:header="0" w:footer="0" w:gutter="0"/>`,
    "<w:cols w:space=\"0\"/>",
    "<w:docGrid w:linePitch=\"360\"/>",
    "</w:sectPr>",
  ].join("");
}

function imageParagraph(
  image: RenderedPageImage,
  relationshipId: string,
  drawingId: number,
  widthTwips: number,
  heightTwips: number,
  includeSectionBreak: boolean
): string {
  const ext = imageExtension(image.mimeType);
  const cx = Math.round(image.pageWidth * EMU_PER_POINT);
  const cy = Math.round(image.pageHeight * EMU_PER_POINT);

  const drawing = [
    "<w:r><w:drawing>",
    '<wp:inline distT="0" distB="0" distL="0" distR="0">',
    `<wp:extent cx="${cx}" cy="${cy}"/>`,
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>`,
    `<wp:docPr id="${drawingId}" name="PDF page ${image.pageNumber}"/>`,
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>',
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    `<pic:nvPicPr><pic:cNvPr id="0" name="page-${image.pageNumber}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr>`,
    `<pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`,
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/>',
    `<a:ext cx="${cx}" cy="${cy}"/>`,
    '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>',
    "</pic:pic></a:graphicData></a:graphic>",
    "</wp:inline></w:drawing></w:r>",
  ].join("");

  const paragraphProperties = includeSectionBreak
    ? `<w:pPr>${sectionProperties(widthTwips, heightTwips)}</w:pPr>`
    : '<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>';

  return `<w:p>${paragraphProperties}${drawing}</w:p>`;
}

function textRun(text: string, bold = false): string {
  return `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function textParagraph(text: string, styleId?: string): string {
  const pPr = styleId ? `<w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>` : "";
  return `<w:p>${pPr}${textRun(text)}</w:p>`;
}

function pageBreakParagraph(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function median(values: number[]): number {
  if (values.length === 0) return 11;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 11;
}

function headingStyleFor(
  line: { text: string; fontSize: number },
  bodySize: number
): string | undefined {
  if (line.text.length > 180) return undefined;
  const ratio = line.fontSize / Math.max(1, bodySize);
  if (ratio >= 1.55) return "Heading1";
  if (ratio >= 1.22) return "Heading2";
  return undefined;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
</w:styles>`;

function contentTypes(hasImages: boolean): string {
  const imageDefaults = hasImages
    ? '<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>'
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageDefaults}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

function coreProperties(title: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>PDF Intelligence Platform</dc:creator>
  <cp:lastModifiedBy>PDF Intelligence Platform</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>PDF Intelligence Platform</Application>
</Properties>`;

function buildDocx(
  documentXml: string,
  stylesXml: string,
  media: Array<{ path: string; bytes: Uint8Array }>,
  documentRelationships: string,
  title: string
): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes(media.length > 0)),
    "_rels/.rels": strToU8(ROOT_RELS),
    "docProps/core.xml": strToU8(coreProperties(title)),
    "docProps/app.xml": strToU8(APP_XML),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(stylesXml),
    "word/_rels/document.xml.rels": strToU8(documentRelationships),
  };

  for (const item of media) {
    files[item.path] = item.bytes;
  }

  return zipSync(files, { level: 6 });
}

/**
 * Image-based DOCX: one PDF page per Word page, with a section per page so the
 * paper size matches the source PDF exactly. This is the browser equivalent of
 * pdf-officegen's Word output (that package itself shells out to Ghostscript
 * and cannot run in a browser).
 */
export function buildImageDocx(
  images: RenderedPageImage[],
  title: string
): Uint8Array {
  if (images.length === 0) throw new Error("No pages were rendered for the DOCX");

  const media: Array<{ path: string; bytes: Uint8Array }> = [];
  const relationships: string[] = [];
  const paragraphs: string[] = [];

  images.forEach((image, index) => {
    const ext = imageExtension(image.mimeType);
    const mediaPath = `media/page-${index + 1}.${ext}`;
    const relationshipId = `rIdImg${index + 1}`;
    media.push({ path: `word/${mediaPath}`, bytes: image.bytes });
    relationships.push(
      `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${mediaPath}"/>`
    );

    const widthTwips = image.pageWidth * TWIPS_PER_POINT;
    const heightTwips = image.pageHeight * TWIPS_PER_POINT;
    paragraphs.push(
      imageParagraph(
        image,
        relationshipId,
        index + 1,
        widthTwips,
        heightTwips,
        index < images.length - 1
      )
    );
  });

  const last = images[images.length - 1];
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${paragraphs.join("\n    ")}
    ${sectionProperties(
      last.pageWidth * TWIPS_PER_POINT,
      last.pageHeight * TWIPS_PER_POINT
    )}
  </w:body>
</w:document>`;

  const documentRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${relationships.join("\n  ")}
</Relationships>`;

  return buildDocx(
    documentXml,
    STYLES_XML,
    media,
    documentRelationships,
    title
  );
}

/**
 * Editable-text DOCX. Headings are inferred from font-size ratios against the
 * page's body size; everything else becomes a paragraph. This is intentionally
 * labelled experimental in the UI because complex multi-column layouts flatten.
 */
export function buildTextDocx(text: ExtractedText, title: string): Uint8Array {
  const paragraphs: string[] = [];

  text.pages.forEach((page, pageIndex) => {
    const lines = page.lines ?? [];
    const bodySize = median(lines.map((line) => line.fontSize));

    if (lines.length === 0) {
      paragraphs.push(textParagraph(""));
    } else {
      for (const line of lines) {
        const style = headingStyleFor(line, bodySize);
        paragraphs.push(textParagraph(line.text, style));
      }
    }

    if (pageIndex < text.pages.length - 1) {
      paragraphs.push(pageBreakParagraph());
    }
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs.join("\n    ")}
    ${sectionProperties(A4_WIDTH_TWIPS, A4_HEIGHT_TWIPS, ONE_INCH_TWIPS)}
  </w:body>
</w:document>`;

  const documentRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  return buildDocx(documentXml, STYLES_XML, [], documentRelationships, title);
}
