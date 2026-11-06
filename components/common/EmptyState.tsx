import Icon from "./Icon";

/**
 * Global search results empty state (shown when the hero search
 * matches nothing). Follows the section styling language.
 */
export default function EmptyState({ query }: { query: string }) {
  return (
    <section className="w-full max-w-7xl mx-auto px-gutter-desktop mb-20">
      <div
        className="flex flex-col items-center gap-3 p-10 rounded-xl bg-surface-container-low border border-outline-variant text-center"
        role="status"
      >
        <div className="w-10 h-10 rounded-sm bg-surface-container-highest text-tx-muted flex items-center justify-center">
          <Icon name="search_off" size={20} />
        </div>
        <p className="font-headline-sm text-headline-sm w-strong text-on-surface">No tools found</p>
        <p className="font-body-md text-body-md text-tx-subtle max-w-md">
          Nothing matches “{query}”. Try a shorter keyword — like “pdf”, “json” or “image” — or
          browse the categories above.
        </p>
      </div>
    </section>
  );
}
