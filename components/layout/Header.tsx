"use client";

import Icon from "../common/Icon";
import ThemeToggle from "../common/ThemeToggle";
import Link from "next/link";

/**
 * Fixed header — logo, badges, readonly search shortcut, nav,
 * favorites, theme toggle, sign in, avatar.
 */
export default function Header({ onSearchFocus }: { onSearchFocus?: () => void }) {
  return (
    <header className="bgt-header fixed top-0 left-0 w-full z-50 backdrop-blur-xl">
      <div className="h-16 w-full px-gutter-desktop flex items-center justify-between gap-space-md">
        {/* Brand */}
        <div className="flex items-center gap-space-md flex-shrink-0">
          <div className="flex items-center gap-space-sm">
            <div className="bgt-logo">
              <span className="material-symbols-outlined bgt-logo-ic" aria-hidden="true">
                handyman
              </span>
            </div>
            <span className="font-headline-sm text-headline-sm w-strong tracking-tight text-on-surface">
              Baby Got Tools
            </span>
          </div>
          <span className="badge-accent hidden sm:inline-flex font-label-mono-xs text-label-mono-xs font-medium tracking-wider w-lxs">
            v2.4
          </span>
          <span className="badge-soft hidden lg:inline-flex font-label-mono-xs text-label-mono-xs w-lxs">
            Free &amp; Fast
          </span>
        </div>

        {/* Search shortcut */}
        <div className="flex-1 max-w-xl mx-auto hidden md:block">
          <div className="hdr-search">
            <Icon name="search" size={18} className="hdr-search-ic" />
            <input
              type="text"
              placeholder="Search free tools — PDF, developer, everyday…"
              readOnly
              aria-label="Search tools"
              onMouseDown={(e) => {
                e.preventDefault();
                onSearchFocus?.();
              }}
            />
            <kbd className="hdr-kbd" aria-hidden="true">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-space-sm flex-shrink-0">
          <nav className="hidden xl:flex items-center gap-space-md mr-space-xs" aria-label="Primary">
            <Link
              href="/developer-tools"
              className="transition-colors text-primary w-strong"
            >
              Explore Tools
            </Link>
            <Link href="/tools/pdf" className="nav-idle font-body-md text-body-md">
              PDF Tools
            </Link>
            <Link href="/#cat-dev" className="nav-idle font-body-md text-body-md flex items-center gap-0.5">
              Categories
            </Link>
          </nav>

          <div className="flex items-center gap-space-xs">
            <Link
              href="/about"
              className="nav-idle hidden md:inline-flex font-body-md text-body-md transition-colors hover:text-primary"
            >
              About
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
