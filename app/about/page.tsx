import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/common/Icon";
import { devTools } from "@/data/devTools";
import { PDF_TOOLS } from "@/data/pdfTools";
import { OG_IMAGE } from "@/lib/site";

const TOTAL = devTools.length + PDF_TOOLS.length;

export const metadata: Metadata = {
  title: "About — Who We Are & Why Baby Got Tools Exists",
  description: `What we do: ${TOTAL} free, browser-based tools for PDFs, code and everyday micro-tasks — privacy-first: processing happens on your device, not our servers.`,
  alternates: { canonical: "/about" },
  openGraph: { title: "About Baby Got Tools", type: "website", url: "/about", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image" },
};

interface Section {
  h: string;
  p: string[];
}

const sections: Section[] = [
  {
    h: "What is Baby Got Tools?",
    p: [
      `Baby Got Tools is a collection of ${TOTAL} free online tools covering three main areas: PDF & document processing (merge, split, compress, OCR, convert to and from PDF), developer utilities (JSON, SQL, JWT, UUID, regex, diff and format/convert tools), and exploit-free everyday helpers such as the online clipboard relay.`,
      "Every tool runs directly in your browser using JavaScript and WebAssembly engines. There is no upload step for tool workloads: your documents are parsed, transformed and exported locally, which is why the tools feel instant and keep working even when your connection is poor.",
    ],
  },
  {
    h: "Why client-side?",
    p: [
      "Two reasons: privacy and speed. When a file never leaves your device, there is nothing on a server to leak, retain or subpoena. And because there is no round-trip, processing latency is limited only by your own hardware.",
      "The backend exists only for a small set of opt-in platform features — anonymous usage counters, optional feedback, the online clipboard relay and PDF job analytics — and is never required for any tool to work.",
    ],
  },
  {
    h: "Who is it for?",
    p: [
      "Developers who need a trustworthy formatter or decoder without installing anything, knowledge workers who handle PDFs and documents on a daily basis, students, and generally anyone who wants a focused, no-signup utility that does one job well.",
    ],
  },
  {
    h: "How is the project built?",
    p: [
      "The frontend is a modern React application (Next.js App Router, TypeScript, Tailwind) with a dark/light design system. The optional API service is a separate Node.js service with MongoDB. All file processing engines — pdf-lib, PDF.js, qpdf WASM (PDFStudio), Tesseract OCR and more — are bundled and executed client-side.",
      "There are no ads, no cookies, no analytics trackers and no accounts required.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="w-full max-w-3xl mx-auto px-gutter-desktop py-space-xl relative">
        <div className="bg-surface-container rounded-xl p-space-lg md:p-space-xl shadow-xl">
          <div className="flex items-center gap-space-sm mb-space-md">
            <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-inner">
              <Icon name="handyman" size={26} className="text-primary" />
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              About Baby Got Tools
            </h1>
          </div>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-space-lg leading-relaxed">
            Little tools. Big possibilities. {TOTAL} utilities that run where your data already
            lives — your own browser.
          </p>

          {sections.map((s) => (
            <div key={s.h} className="mb-space-lg">
              <h2 className="font-headline-md text-headline-md text-on-surface font-semibold mb-space-xs">
                {s.h}
              </h2>
              {s.p.map((para, i) => (
                <p key={i} className="font-body-md text-body-md text-on-surface-variant mb-space-xs leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          ))}

          <div className="flex flex-wrap gap-space-sm pt-space-md border-t border-outline-variant/40">
            <Link
              href="/developer-tools"
              className="inline-flex items-center gap-2 px-space-md py-2 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
            >
              <Icon name="grid_view" size={18} />
              <span>Developer Tools</span>
            </Link>
            <Link
              href="/tools/pdf"
              className="inline-flex items-center gap-2 px-space-md py-2 rounded-lg bg-surface-container-highest text-on-surface font-semibold hover:bg-surface-container-low transition-colors"
            >
              <Icon name="picture_as_pdf" size={18} />
              <span>PDF &amp; Document Tools</span>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-space-md py-2 rounded-lg bg-surface-container-highest text-on-surface font-semibold hover:bg-surface-container-low transition-colors"
            >
              <Icon name="mail" size={18} />
              <span>Contact Us</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
