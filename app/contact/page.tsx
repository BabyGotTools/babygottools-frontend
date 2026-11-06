import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/common/Icon";
import ContactForm from "@/features/contact/ContactForm";
import { OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact — Report Bugs & Request Tools",
  description:
    "Get in touch with the Baby Got Tools team: report bugs, request new tools or ask privacy questions. Messages go straight to the team — anonymous by default.",
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact Baby Got Tools", type: "website", url: "/contact", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image" },
};

const prompts = [
  {
    icon: "bug_report",
    title: "Something broken?",
    body: "Tell us which tool, what you expected and what happened instead. Browser and OS help us reproduce it.",
  },
  {
    icon: "lightbulb",
    title: "Tool request",
    body: "Suggest a new utility or an improvement to an existing one — many tools on the roadmap started as feedback.",
  },
  {
    icon: "shield",
    title: "Privacy question",
    body: "Ask anything about how processing works. A quick summary: tool workloads never leave your browser; the online clipboard relay is the one documented exception.",
  },
];

export default function ContactPage() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="w-full max-w-3xl mx-auto px-gutter-desktop py-space-xl relative">
        <div className="bg-surface-container rounded-xl p-space-lg md:p-space-xl shadow-xl">
          <div className="flex items-center gap-space-sm mb-space-md">
            <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-inner">
              <Icon name="mail" size={26} className="text-primary" />
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Contact
            </h1>
          </div>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-space-lg leading-relaxed">
            Feedback goes straight to the maintainers. No ticket system, no account — just write
            below.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm mb-space-lg">
            {prompts.map((p) => (
              <div key={p.title} className="bg-surface-container-low rounded-xl p-space-md">
                <Icon name={p.icon} size={22} className="text-secondary mb-space-xs" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">
                  {p.title}
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{p.body}</p>
              </div>
            ))}
          </div>

          <ContactForm />

          <div className="pt-space-md mt-space-lg border-t border-outline-variant/40">
            <Link href="/privacy" className="font-body-sm text-body-sm text-secondary hover:underline">
              How we handle data →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
