import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/site";
import HomePage from "@/components/pages/HomePage";

export const metadata: Metadata = {
  title: { absolute: "Baby Got Tools — Free Online PDF, Developer & Image Tools" },
  description:
    "78 free online tools for PDFs, code, images and text — merge PDFs, format JSON, compress WebP, convert files and more. Everything runs in your browser: no uploads, no sign-up.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Baby Got Tools — Free Online PDF, Developer & Image Tools",
    description:
      "78 free browser-based tools for PDFs, code, images and text. No uploads, no accounts — processing happens on your device.",
    type: "website",
    url: "/",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

export default function Page() {
  return <HomePage />;
}
