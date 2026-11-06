import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/common/Icon";
import { OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy — What Data Baby Got Tools Handles",
  description:
    "How data is handled: tools run entirely in your browser; the clipboard relay stores anonymous, self-expiring messages. No accounts, cookies or analytics.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Privacy Policy — Baby Got Tools", type: "website", url: "/privacy", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image" },
};

const sections = [
  {
    h: "Summary",
    p: [
      "Baby Got Tools is built privacy-first. All tool workloads — every PDF operation, formatter, encoder and converter — run locally in your browser using JavaScript and WebAssembly. Your files are not uploaded as part of using the tools.",
      "The few features that do involve our server are described below in plain terms: the online clipboard relay, optional feedback, anonymous usage counters, and anonymous PDF job records. There are no accounts, no cookies, no advertising, no analytics trackers, and no IP retention.",
    ],
  },
  {
    h: "Tool processing (files, text and code)",
    p: [
      "Developer tools and PDF tools execute inside your browser tab. Documents and text you paste or drop into a tool are parsed, transformed and exported locally. No upload request is issued for the tool workloads themselves — you can verify this from your browser's network panel.",
      "This means we never receive a copy of your documents and cannot read them afterwards. Processing stops when you close the tab.",
    ],
  },
  {
    h: "Online clipboard (the one server-side exception)",
    p: [
      "The online clipboard tool is designed for cross-device hand-off, so it necessarily uses the platform relay: your pasted text (limited to small snippets) is stored temporarily on our server, keyed by a one-time 6-character code.",
      "Messages are anonymous by design — no account, no IP logging — and are deleted automatically shortly after creation (a few minutes by default). Anyone holding the code can read the message once, which is why we recommend encrypting genuinely sensitive text first (for example with our client-side Text Encryptor tool).",
    ],
  },
  {
    h: "Feedback and contact messages",
    p: [
      "When you submit feedback via the contact page, we store the message body and the topic you selected (bug, idea, privacy, other). Providing an email address is optional and only stored if you enter it, so we can reply.",
      "Messages expire automatically. We don't enrich them with any identity data.",
    ],
  },
  {
    h: "Anonymous usage counters and PDF job records",
    p: [
      "Tool pages can increment an anonymous usage counter (a simple tally per tool, with no identity attached) which powers aggregate statistics only.",
      "PDF tools may record an anonymous, content-free job record (tool name and success/failure) to understand reliability across browsers. These records contain no document content and expire on a schedule.",
      "Optional engine detection and diagnostic PDF head-inspection endpoints are opt-in diagnostics, degrade gracefully, and are never required for a tool to work.",
    ],
  },
  {
    h: "What we don't do",
    p: [
      "We don't sell or share data (there is essentially nothing to share).",
      "We don't set cookies, embed ad networks, analytics pixels or third-party trackers.",
      "We don't retain IP addresses for any documented feature.",
      "We don't require accounts — there is no sign-up anywhere on the site.",
    ],
  },
  {
    h: "Local storage",
    p: [
      "The site stores one preference locally in your browser: your chosen theme (light or dark) in localStorage — a display preference only, never a tracking identifier.",
    ],
  },
  {
    h: "Changes to this policy",
    p: [
      "If the architecture changes in ways that affect data handling, this page will be updated to describe the new reality honestly. The authoritative description of the system is the source code itself.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-tertiary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="w-full max-w-3xl mx-auto px-gutter-desktop py-space-xl relative">
        <div className="bg-surface-container rounded-xl p-space-lg md:p-space-xl shadow-xl">
          <div className="flex items-center gap-space-sm mb-space-md">
            <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-inner">
              <Icon name="shield" size={26} className="text-secondary" />
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Privacy Policy
            </h1>
          </div>
          <p className="font-body-md text-body-md text-outline mb-space-lg">
            Last updated: November 2026
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

          <div className="pt-space-md border-t border-outline-variant/40">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Questions about any of this?{" "}
              <Link href="/contact" className="text-secondary hover:underline">
                Contact us
              </Link>{" "}
              — privacy questions get logged as a topic and answered directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
