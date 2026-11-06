import Icon from "../common/Icon";
import SectionHeading from "../common/SectionHeading";
import { categories } from "@/data/categories";

/** 8 quick category tiles linking to the detailed hub sections. */
export default function CategoryNavigation() {
  return (
    <section className="w-full max-w-7xl mx-auto px-gutter-desktop mb-20" id="browse-categories">
      <SectionHeading title="Browse by Category" label="Specialized Hubs" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {categories.map((cat) => (
          <a key={cat.id} href={`#${cat.id}`} className="cat-tile group" data-accent={cat.accent}>
            <div className="flex items-center gap-3">
              <div className="ic-chip">
                <Icon name={cat.icon} size={20} />
              </div>
              <div className="text-left">
                <div className="tile-title font-headline-sm text-headline-sm text-on-surface">
                  {cat.title}
                </div>
                <div className="font-label-mono-xs text-label-mono-xs text-tx-muted w-lxs">
                  {cat.subtitle}
                </div>
              </div>
            </div>
            <span className="chip-tile">{cat.count}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
