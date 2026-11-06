"use client";

import type { RefObject } from "react";
import Icon from "../common/Icon";
import { trendingQueries } from "@/data/tools";

interface HeroSectionProps {
  query: string;
  onQueryChange: (query: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

/**
 * Hero: eyebrow badge, gradient headline, subtitle, glowing search field,
 * trending pills and the trust metrics strip.
 */
export default function HeroSection({ query, onQueryChange, searchRef }: HeroSectionProps) {
  return (
    <section className="hero-sec w-full max-w-6xl mx-auto px-gutter-desktop pb-16 text-center flex flex-col items-center">
      {/* Eyebrow Pill */}
      <div className="eyebrow-badge mb-6">
        <span className="eyebrow-star">✦</span>
        <span className="eyebrow-label">Your Everyday Digital Toolkit</span>
        <span className="eyebrow-dot" aria-hidden="true"></span>
      </div>

      {/* Main Headline */}
      <h1 className="font-display-hero text-display-hero font-bold tracking-tight text-on-surface max-w-4xl mb-5">
        Every Tool You Need.{" "}
        <span className="gradient-title text-transparent bg-clip-text">All in One Place.</span>
      </h1>

      {/* Subtitle */}
      <p className="font-body-lg text-body-lg text-tx-subtle max-w-2xl mx-auto mb-9 leading-relaxed">
        From PDFs and images to code and everyday micro-tasks — discover powerful, zero-friction
        utilities that make your digital workflow effortless. Free, ultra-fast, and executed
        strictly in your browser.
      </p>

      {/* Prominent Interactive Search Bar */}
      <div className="w-full max-w-2xl relative group/search mb-4">
        <div className="search-glow" aria-hidden="true"></div>
        <div className="search-field">
          <Icon name="search" size={22} className="search-ic" />
          <input
            ref={searchRef}
            autoComplete="off"
            id="hero-tool-search"
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Search for a tool"
            placeholder="Search for a tool... PDF, JSON, Image Compressor, Clipboard"
          />
          <div className="flex items-center gap-1.5 ml-2">
            <kbd className="kbd-glyph" aria-hidden="true">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Quick Suggestion Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mb-8">
        <span className="font-label-mono-xs text-label-mono-xs uppercase tracking-wider mr-1 text-tx-subtle w-lxs">
          Trending:
        </span>
        {trendingQueries.map((term) => (
          <button key={term} type="button" className="trend-pill" onClick={() => onQueryChange(term)}>
            {term}
          </button>
        ))}
      </div>

      {/* Trust Metrics Strip */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-tx-subtle font-label-mono-md text-label-mono-md">
        <span className="inline-flex items-center gap-1.5">
          <span className="trust-a">⚡</span> Zero installations
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="trust-b">🔒</span> 100% Client-side privacy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="trust-c">🆓</span> No sign-ups, no ads
        </span>
      </div>
    </section>
  );
}
