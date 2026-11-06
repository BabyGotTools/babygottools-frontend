import Link from "next/link";
import { footerLinks } from "@/data/tools";
import { devTools } from "@/data/devTools";
import { PDF_TOOLS } from "@/data/pdfTools";

const TOOL_COUNT = devTools.length + PDF_TOOLS.length;

export default function Footer() {
  return (
    <footer className="bgt-footer w-full mt-space-xl">
      <div className="w-full max-w-7xl mx-auto px-gutter-desktop py-space-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-space-lg mb-space-xl">
          {/* Brand column */}
          <div className="lg:col-span-2 space-y-space-sm">
            <div className="flex items-center gap-space-sm">
              <div className="bgt-logo">
                <span className="material-symbols-outlined bgt-logo-ic" aria-hidden="true">
                  handyman
                </span>
              </div>
              <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
                Baby Got Tools
              </span>
            </div>
            <p className="font-body-md text-body-md text-ft-desc max-w-sm">
              Little Tools. Big Possibilities. Fast, secure, client-side utility engines engineered
              for developers, creators, and power users.
            </p>
            <div className="pt-space-xs">
              <span className="status-chip">
                <span className="status-dot" aria-hidden="true"></span>
                All {TOOL_COUNT} tools online
              </span>
            </div>
          </div>

          {/* Link columns — real internal links (crawlable, working) */}
          {footerLinks.map((col) => (
            <div className="space-y-space-sm" key={col.heading}>
              <h3 className="font-label-mono-md text-label-mono-md tracking-wider uppercase ft-head w-mono-strong">
                {col.heading}
              </h3>
              <ul className="space-y-space-xs font-body-sm text-body-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition-colors ft-link inline-flex"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-space-lg flex flex-col md:flex-row items-center justify-between gap-space-sm">
          <p className="font-body-sm text-body-sm text-tx-muted">
            © {new Date().getFullYear()} Baby Got Tools. Free, privacy-first online tools.
          </p>
          <div className="flex items-center gap-space-md font-label-mono-xs text-label-mono-xs w-lxs text-tx-muted">
            <Link href="/privacy" className="hover:text-on-surface transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-on-surface transition-colors">
              Terms
            </Link>
            <Link href="/about" className="hover:text-on-surface transition-colors">
              About
            </Link>
            <Link href="/contact" className="hover:text-on-surface transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
