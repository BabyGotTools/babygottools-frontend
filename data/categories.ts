/**
 * Quick category navigation tiles — exactly the 8 hubs from the Stitch design.
 * `accent` maps onto the theme accent system (see app/styles/accents*.css).
 */

export interface Category {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  count: number;
  accent: string;
}

export const categories: Category[] = [
  /* Only categories with real, live hub sections are listed. Tiles for
   * not-yet-built suites (image, text, social, calculators, security)
   * intentionally do NOT link anywhere — dead in-page anchors are worse
   * than fewer tiles; they will be restored as those suites ship. */
  {
    id: "cat-pdf",
    title: "PDF Tools",
    subtitle: "Document Workflows",
    icon: "picture_as_pdf",
    count: 29,
    accent: "pdf",
  },
  {
    id: "cat-image",
    title: "Image Tools",
    subtitle: "Compress & Convert",
    icon: "photo_library",
    count: 0,
    accent: "image",
  },
  {
    id: "cat-dev",
    title: "Developer Tools",
    subtitle: "Encoding & Formats",
    icon: "code",
    count: 34,
    accent: "dev",
  },
];
