import Link from "next/link";
import Icon from "@/components/common/Icon";
import { textTone } from "./tone";
import type { ToolCapability, ToolFaq } from "@/data/devToolTypes";

export interface EngineCapabilitiesData {
  eyebrow: string;
  heading: string;
  items: ToolCapability[];
}

export interface RelatedToolsData {
  heading: string;
  items: { slug: string; title: string; subtitle: string; icon: string; iconTone: string }[];
}

export interface ToolFaqGridData {
  heading: string;
  faqs: ToolFaq[];
}

const metaToneClass: Record<string, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  error: "text-error",
  neutral: "text-outline",
  engine: "text-secondary",
  "on-surface": "text-on-surface",
};

/** "Engine Architecture" capability cards grid (reference pattern). */
export function EngineCapabilities({ eyebrow, heading, items }: EngineCapabilitiesData) {
  return (
    <div className="mb-space-xl">
      <div className="flex flex-col mb-space-md">
        <span className="text-label-mono-xs font-label-mono-xs text-secondary uppercase tracking-widest font-bold">
          {eyebrow}
        </span>
        <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">{heading}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {items.map((cap) => (
          <div
            key={cap.title}
            className="bg-surface-container p-space-lg rounded-xl flex flex-col justify-between hover:bg-surface-container-high transition-all shadow-md group"
          >
            <div>
              <div
                className={`w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center mb-space-sm group-hover:scale-110 transition-transform ${textTone[cap.iconTone]}`}
              >
                <Icon name={cap.icon} size={24} />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">{cap.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{cap.desc}</p>
            </div>
            <div className="mt-space-md pt-space-xs flex items-center justify-between text-label-mono-xs font-label-mono-xs text-outline">
              <span>{cap.metaLabel}</span>
              <span className={metaToneClass[cap.metaTone] ?? "text-secondary"}>{cap.metaValue}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Suite Ecosystem" related tools row (reference pattern). */
export function RelatedToolsRow({ heading, items }: RelatedToolsData) {
  return (
    <div className="mb-space-xl">
      <div className="flex items-center justify-between mb-space-md">
        <div>
          <span className="text-label-mono-xs font-label-mono-xs text-primary uppercase tracking-widest font-bold">
            Suite Ecosystem
          </span>
          <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mt-1">{heading}</h3>
        </div>
        <Link
          className="text-label-mono-md font-label-mono-md text-secondary hover:underline flex items-center gap-1"
          href="/developer-tools"
        >
          <span>View all tools</span>
          <Icon name="arrow_forward" size={16} />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {items.map((item) => (
          <Link
            key={item.slug}
            className="bg-surface-container-low p-space-md rounded-xl hover:bg-surface-container transition-all flex items-center gap-space-sm group shadow-sm min-w-0"
            href={`/tools/${item.slug}`}
          >
            <div
              className={`w-10 h-10 shrink-0 rounded-lg bg-surface-container flex items-center justify-center group-hover:scale-110 transition-transform ${
                item.iconTone === "secondary"
                  ? "text-secondary-container"
                  : item.iconTone === "tertiary"
                    ? "text-tertiary-container"
                    : item.iconTone === "error"
                      ? "text-error-container"
                      : "text-primary-container"
              }`}
            >
              <Icon name={item.icon} size={22} />
            </div>
            <div className="min-w-0">
              <div className="font-headline-sm text-headline-sm text-on-surface truncate group-hover:text-primary transition-colors">
                {item.title}
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant truncate">{item.subtitle}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const faqIcons = ["verified_user", "rule", "dataset", "quiz"];

/** "Documentation & FAQ" boxed two-column Q&A grid (reference pattern). */
export function ToolFaqGrid({ heading, faqs }: ToolFaqGridData) {
  const mid = Math.ceil(faqs.length / 2);
  const columns = [faqs.slice(0, mid), faqs.slice(mid)];
  return (
    <div className="bg-surface-container rounded-xl p-space-xl mb-space-xl shadow-lg">
      <div className="max-w-3xl">
        <span className="text-label-mono-xs font-label-mono-xs text-secondary uppercase tracking-widest font-bold">
          Documentation &amp; FAQ
        </span>
        <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight mt-1 mb-space-lg">
          {heading}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-xl">
        {columns.map((column, ci) => (
          <div key={ci} className="space-y-space-lg">
            {column.map((item) => (
              <div key={item.q}>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-space-xs flex items-center gap-2">
                  <Icon
                    name={faqIcons[(item.q.length + ci) % faqIcons.length]}
                    size={18}
                    className={ci === 0 ? "text-secondary" : "text-primary"}
                  />
                  {item.q}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{item.a}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
