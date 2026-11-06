import Icon from "../common/Icon";

/** Sponsored micro-feature callout strip (IconShelf). */
export default function SponsoredCallout() {
  return (
    <div className="w-full max-w-7xl mx-auto px-gutter-desktop mb-20">
      <div className="callout-box flex-col md:flex-row">
        <div className="flex items-center gap-4 mb-3 md:mb-0">
          <div className="callout-ic">
            <Icon name="auto_awesome" size={20} />
          </div>
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface w-med">
              IconShelf — 300,000+ Free SVG Icons Collection
            </div>
            <p className="font-body-sm text-body-sm text-tx-subtle">
              Search and drop pristine vector icons directly into Figma or React code. Fast,
              zero-subscription.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-label-mono-xs text-label-mono-xs uppercase w-lxs text-co-label">
            Featured Utility
          </span>
          <button type="button" className="callout-btn">
            Explore Icons
          </button>
        </div>
      </div>
    </div>
  );
}
