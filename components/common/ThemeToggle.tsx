"use client";

import { useTheme } from "@/hooks/useTheme";
import Icon from "./Icon";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className="icon-btn"
      title="Toggle Theme"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      onClick={toggle}
    >
      <Icon
        name={theme === "dark" ? "dark_mode" : "light_mode"}
        size={20}
        className={theme === "light" ? "text-amber-500" : ""}
      />
    </button>
  );
}
