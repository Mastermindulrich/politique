"use client";

import { useState } from "react";

/** Jump straight to an article by its number. */
export function GoToArticle({ lang, max }: { lang: "fr" | "en"; max: number }) {
  const [n, setN] = useState("");
  return (
    <form
      role="search"
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const el = document.getElementById(`article-${Number(n)}`);
        if (el) {
          history.replaceState(null, "", `#article-${Number(n)}`);
          el.scrollIntoView({ block: "start" });
          el.classList.add("ring-2", "ring-green/40");
          setTimeout(() => el.classList.remove("ring-2", "ring-green/40"), 1600);
        }
      }}
    >
      <label className="sr-only" htmlFor="goto-article">{lang === "fr" ? "Aller à l'article" : "Go to article"}</label>
      <input id="goto-article" inputMode="numeric" pattern="[0-9]*" placeholder={lang === "fr" ? `Article n° (1 à ${max})` : `Article no. (1 to ${max})`} value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, "").slice(0, 3))} className="input h-10 flex-1" />
      <button type="submit" className="btn-dark btn-sm h-10">{lang === "fr" ? "Aller" : "Go"}</button>
    </form>
  );
}
