"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "bgt-theme";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

/**
 * Theme context — controls the .dark/.light class on <html>.
 * The initial class is applied by the inline script in the root layout
 * (localStorage → system preference → dark fallback) to prevent flashing.
 */
const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggle: () => {},
});

function resolveTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // `dark` matches the SSR default (<html class="dark">); synced after hydration.
  const [theme, setThemeState] = useState<Theme>("dark");

  /* Pick up the theme the pre-paint script already applied — no DOM write needed. */
  useEffect(() => {
    setThemeState(resolveTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(next);
    root.style.colorScheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — theme still works for the session */
    }
  }, []);

  /* Read the live DOM class so the toggle is correct even on the very first click. */
  const toggle = useCallback(() => setTheme(resolveTheme() === "dark" ? "light" : "dark"), [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
