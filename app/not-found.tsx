import Link from "next/link";
import Icon from "@/components/common/Icon";

export default function NotFound() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-error-container/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="w-full max-w-7xl mx-auto px-gutter-desktop py-space-xl relative">
        <div className="bg-surface-container rounded-xl p-space-xl shadow-xl text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-xl bg-surface-container-lowest shadow-inner flex items-center justify-center mx-auto mb-space-md">
            <Icon name="wrong_location" size={36} className="text-error" />
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">404 — Tool Not Found</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-space-sm mb-space-lg">
            That route is not part of the Baby Got Tools console. Try the hub — all 33 utilities live behind real,
            working links there.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-space-sm">
            <Link
              href="/developer-tools"
              className="inline-flex items-center gap-2 px-space-md py-2 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
            >
              <Icon name="grid_view" size={18} />
              <span>Browse Developer Tools</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-space-md py-2 rounded-lg bg-surface-container-highest text-on-surface font-semibold hover:bg-surface-container-low transition-colors"
            >
              <Icon name="home" size={18} />
              <span>Back Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
