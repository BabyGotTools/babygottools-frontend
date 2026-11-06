import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

/* Self-hosted variable fonts (no CDN round-trip) */
import "@fontsource-variable/geist";
import "@fontsource-variable/jetbrains-mono";

/* Theme tokens + component styles (identical to the React app) */
import "./styles/globals.css";
import "./styles/accents.css";
import "./styles/accents-light.css";

import { ThemeProvider } from "@/context/ThemeContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { organizationLd, websiteLd, JsonLdScript } from "@/lib/jsonld";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const DEFAULT_DESCRIPTION =
  "Free, zero-friction online tools for PDFs, code and everyday micro-tasks — ultra-fast, executed strictly in your browser, with nothing uploaded.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // Short, brand-first default (fits the ~60-char SERP window).
    default: `${SITE_NAME} — Free Online PDF & Developer Tools`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230f131d'/%3E%3Ctext x='16' y='22' font-size='16' text-anchor='middle' fill='%235de6ff'%3E%E2%9C%A6%3C/text%3E%3C/svg%3E",
  },
};

/** Theme-color hints for both schemes (matches styles/themes.css tokens). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f131d" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

/**
 * Prevent theme flash: resolve the theme before first paint.
 * (localStorage → system preference → dark fallback; `?theme=` overrides for QA.)
 * The Next.js root layout renders <html class="dark"> and this inline script
 * corrects the class before anything paints — suppressing hydration warnings.
 */
const themeScript = `(function(){try{var param=new URLSearchParams(window.location.search).get("theme");var stored=localStorage.getItem("bgt-theme");var theme=param==="light"||param==="dark"?param:stored==="light"||stored==="dark"?stored:window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.classList.remove("dark","light");document.documentElement.classList.add(theme);document.documentElement.style.colorScheme=theme;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Site-level structured data (Organization + WebSite) */}
        <JsonLdScript node={organizationLd()} />
        <JsonLdScript node={websiteLd()} />
        {/* Material Symbols (subsetted to the icons actually used) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
        <ThemeProvider>
          {/* Common chrome: fixed header + site footer on EVERY route */}
          <Header />
          <main className="w-full pt-16 bg-surface min-h-screen">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
