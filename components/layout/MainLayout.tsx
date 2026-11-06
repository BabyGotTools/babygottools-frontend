import type { ReactNode } from "react";

interface MainLayoutProps {
  /** Kept for signature parity — the header search now lives in the root layout. */
  onSearchFocus?: () => void;
  children: ReactNode;
}

/**
 * Homepage decorations: ambient-glow canvas only.
 * (Header + Footer now come from the root layout so every route has them.)
 */
export default function MainLayout({ onSearchFocus, children }: MainLayoutProps) {
  void onSearchFocus;
  return (
    <div className="relative flex flex-col w-full text-on-surface">
      <div className="relative w-full overflow-hidden">
        {/* Ambient Glow Background Canvas */}
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[840px] h-[480px] glow-hero blur-[120px] -z-10 rounded-full"
          aria-hidden="true"
        ></div>
        <div
          className="pointer-events-none absolute top-[520px] -right-40 w-[420px] h-[420px] glow-2 blur-[140px] -z-10 rounded-full"
          aria-hidden="true"
        ></div>
        <div
          className="pointer-events-none absolute top-[980px] -left-40 w-[460px] h-[460px] glow-3 blur-[130px] -z-10 rounded-full"
          aria-hidden="true"
        ></div>
        {children}
      </div>
    </div>
  );
}
