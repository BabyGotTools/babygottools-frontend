import type { AccentTone } from "@/data/devToolTypes";

/** Text color helper for icon/hover accents. */
export const textTone: Record<AccentTone, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  error: "text-error",
  neutral: "text-outline",
  engine: "text-secondary",
  "on-surface": "text-on-surface",
};

/** Badge chip colors, matching the reference card patterns. */
export const badgeTone: Record<AccentTone, string> = {
  primary: "bg-primary-container/30 text-primary",
  secondary: "bg-secondary-container/30 text-secondary",
  tertiary: "bg-tertiary-container/30 text-tertiary",
  error: "bg-error-container/30 text-error",
  neutral: "bg-surface-container-highest text-outline",
  engine: "bg-surface-container-highest text-secondary",
  "on-surface": "bg-surface-container-highest text-on-surface",
};

/** Icon-node background per tone (tool cards, capability cards). */
export const iconNodeTone: Record<AccentTone, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  error: "text-error",
  neutral: "text-outline",
  engine: "text-secondary",
  "on-surface": "text-on-surface",
};
