/**
 * Exact reference class strings for the hero control ribbon buttons
 * (shared by the tool workspaces so every page matches the Stitch design).
 */

export const RIBBON_BTN =
  "inline-flex items-center gap-1.5 px-space-sm py-1.5 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest hover:text-secondary text-label-mono-md font-label-mono-md transition-all cursor-pointer";

export const RIBBON_BTN_CLEAR =
  "inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-error hover:bg-surface-container-highest text-label-mono-md font-label-mono-md transition-all";

export const RIBBON_BTN_PRIMARY_SOFT =
  "inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-label-mono-md font-label-mono-md transition-all";

export const RIBBON_BTN_TERTIARY_SOFT =
  "inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-tertiary/10 text-tertiary hover:bg-tertiary/20 text-label-mono-md font-label-mono-md transition-all";

export const RIBBON_BTN_MINIFY =
  "inline-flex items-center gap-1 px-space-sm py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-label-mono-md font-label-mono-md transition-all";

export const RIBBON_MAIN_ACTION =
  "inline-flex items-center gap-1 px-space-md py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-label-mono-md font-label-mono-md font-semibold transition-all shadow-md";

export const RIBBON_INDENT_GROUP =
  "flex items-center bg-surface-container-highest p-0.5 rounded-lg text-label-mono-xs font-label-mono-xs";

export const INDENT_BTN_ACTIVE = "px-2 py-1 rounded bg-surface-container text-secondary font-semibold";

export const INDENT_BTN_IDLE = "px-2 py-1 rounded text-on-surface-variant hover:text-on-surface";

export const RIBBON_DIVIDER = "w-px h-4 bg-surface-container-highest mx-1";

/**
 * Full wrapper for a hero control-ribbon row (rendered via useRibbonPortal).
 * Adds a hairline divider above the strip so the toolbar reads as its own
 * region instead of floating under the hero description.
 */
export const RIBBON_ROW =
  "mt-space-lg pt-space-md border-t border-outline-variant/60 flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low/70 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl";

export const RIBBON_KBD = "ml-1 px-1 py-0.5 bg-on-primary/20 rounded text-[9px]";
