"use client";

import { useEffect } from "react";

/**
 * Applies the member's saved theme and language to the page, and copies them into
 * cookies so the next visit paints correctly straight away (the root layout is static
 * and reads those cookies in the browser before first paint).
 */
export function PrefsSync({ theme, lang }: { theme: "system" | "light" | "dark"; lang: "fr" | "en" }) {
  useEffect(() => {
    const d = document.documentElement;
    if (d.getAttribute("data-theme") !== theme) d.setAttribute("data-theme", theme);
    if (d.lang !== lang) d.lang = lang;
    const year = 60 * 60 * 24 * 365;
    document.cookie = `theme=${theme}; path=/; max-age=${year}; samesite=lax`;
    document.cookie = `lang=${lang}; path=/; max-age=${year}; samesite=lax`;
  }, [theme, lang]);
  return null;
}
