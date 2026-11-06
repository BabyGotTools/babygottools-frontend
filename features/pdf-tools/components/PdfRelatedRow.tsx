import Link from "next/link";
import Icon from "@/components/common/Icon";
import type { RelatedTool } from "@/data/pdfToolTypes";

/**
 * Stitch "Complementary PDF Utilities" row. Unlike the developer-tools row
 * (which links to /developer-tools), the footer link points to the PDF hub.
 */
export default function PdfRelatedRow({ items }: { items: RelatedTool[] }) {
  return (
    <section className="mt-space-md flex flex-col gap-space-md">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
            Complementary PDF Utilities
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            More lightweight, zero-latency document engines right in your browser.
          </p>
        </div>
        <Link
          className="hidden sm:inline-flex items-center gap-1 font-body-sm text-body-sm text-primary font-medium hover:underline"
          href="/tools/pdf"
        >
          View all PDF tools
          <Icon name="arrow_forward" size={16} />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {items.map((item) => (
          <Link
            key={`${item.slug}-${item.title}`}
            className="group bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            href={item.slug === "pdf" ? "/tools/pdf" : `/tools/${item.slug}`}
          >
            <div className="flex flex-col gap-2.5">
              <div
                className={`w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center transition-colors ${
                  item.iconTone === "secondary"
                    ? "text-secondary group-hover:bg-secondary group-hover:text-on-secondary"
                    : item.iconTone === "tertiary"
                      ? "text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary"
                      : item.iconTone === "error"
                        ? "text-error group-hover:bg-error group-hover:text-on-error"
                        : "text-primary group-hover:bg-primary group-hover:text-on-primary"
                }`}
              >
                <Icon name={item.icon} size={20} />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{item.subtitle}</p>
            </div>
            <div className="mt-4 pt-2 border-t border-outline-variant/30 flex items-center justify-between text-label-sm font-label-sm text-outline">
              <span>{item.slug === "pdf" ? "All 29 tools" : "In-Browser WASM"}</span>
              <Icon
                name="north_east"
                size={16}
                className="text-outline-variant group-hover:text-primary transition-colors"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
