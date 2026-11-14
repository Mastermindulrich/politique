"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLanguage } from "@/lib/actions";

type Lang = "fr" | "en";
const YEAR = 60 * 60 * 24 * 365;

/** Remember the choice in the browser at once, so the very next page already uses it. */
export function rememberLang(l: Lang) {
  document.cookie = `lang=${l}; path=/; max-age=${YEAR}; samesite=lax`;
  document.documentElement.lang = l;
}

/**
 * FR | EN switch. Both choices are always visible, the current one highlighted.
 * `hrefs` is for the static landing pages (/ and /en): the switch then just navigates.
 * Elsewhere it saves the choice (on the profile too for members) and redraws the page.
 */
export function LangSwitch({ lang, hrefs, size = "sm", className = "" }: { lang: Lang; hrefs?: Record<Lang, string>; size?: "sm" | "md"; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (l: Lang) => {
    if (l === lang || pending) return;
    rememberLang(l);
    if (hrefs) return router.push(hrefs[l]);
    start(async () => {
      await setLanguage(l).catch(() => null);
      router.refresh();
    });
  };
  const h = size === "md" ? "h-10 text-[15px] px-4" : "h-8 text-[13px] px-2.5 sm:px-3";
  return (
    <div role="group" aria-label="Langue / Language" className={`inline-flex items-center rounded-full border border-line bg-card p-0.5 ${pending ? "opacity-60" : ""} ${className}`}>
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === lang}
          title={l === "fr" ? "Français" : "English"}
          onClick={(e) => { e.stopPropagation(); pick(l); }}
          className={`tap flex items-center rounded-full font-bold tracking-wide transition-colors ${h} ${l === lang ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
        >
          {size === "md" ? (l === "fr" ? "Français" : "English") : l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
