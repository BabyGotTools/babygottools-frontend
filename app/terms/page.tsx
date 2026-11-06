import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/common/Icon";
import { OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service — Using Baby Got Tools",
  description:
    "Using Baby Got Tools: the service is free, provided as-is and runs in your browser. Acceptable use, no warranty, no accounts.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "Terms of Service — Baby Got Tools", type: "website", url: "/terms", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image" },
};

const sections = [
  {
    h: "Acceptance",
    p: [
      "By using Baby Got Tools you agree to these terms. They are deliberately short; if you ever find them unclear, tell us via the contact page.",
    ],
  },
  {
    h: "The service",
    p: [
      "Baby Got Tools provides free, browser-based utilities. Tool workloads execute on your own device; the optional platform backend only powers the clipboard relay, anonymous counters, feedback and job analytics. There are no paid tiers and no accounts.",
    ],
  },
  {
    h: "Acceptable use",
    p: [
      "Use the tools for lawful purposes. Don't attempt to abuse, overload or automate access in ways that degrade the service for others (for example, hammering the clipboard relay via script). Don't use the relay or other features to distribute malware, harassment, or illegal content.",
      "The clipboard relay is intended for quick convenience hand-offs of small snippets — not as a storage, messaging or distribution system. Abusive volumes may be rate-limited or blocked.",
    ],
  },
  {
    h: "No warranty",
    p: [
      "The service is provided “as is” and “as available”, without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement. Output should always be verified for critical work — like any tool, these utilities can have bugs.",
      "Because processing is client-side, results can vary with your browser, device and available memory. Very large files may fail purely due to local resource limits.",
    ],
  },
  {
    h: "Limitation of liability",
    p: [
      "To the maximum extent permitted by law, the maintainers are not liable for any indirect, incidental or consequential damages, or for any loss of data, profits or goodwill arising from use of the service.",
    ],
  },
  {
    h: "Availability and changes",
    p: [
      "Features may be added, changed or retired. The optional backend features may be offline without affecting the tools themselves, since nothing depends on the server.",
    ],
  },
  {
    h: "Contact",
    p: [
      "Questions about these terms? Use the contact page — messages are logged anonymously and we read every one.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="w-full max-w-3xl mx-auto px-gutter-desktop py-space-xl relative">
        <div className="bg-surface-container rounded-xl p-space-lg md:p-space-xl shadow-xl">
          <div className="flex items-center gap-space-sm mb-space-md">
            <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-inner">
              <Icon name="gavel" size={26} className="text-primary" />
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Terms of Service
            </h1>
          </div>
          <p className="font-body-md text-body-md text-outline mb-space-lg">Last updated: November 2026</p>

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

          <div className="pt-space-md border-t border-outline-variant/40">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              See also our{" "}
              <Link href="/privacy" className="text-secondary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
