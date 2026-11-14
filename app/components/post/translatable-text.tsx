"use client";

import { useMemo, useState, useTransition } from "react";
import { detectLang } from "@/lib/detect-lang";
import { translatePost } from "@/lib/translate-actions";
import { PostText } from "./post-text";

type Lang = "fr" | "en";
const L = {
  fr: { translate: "Traduire", working: "Traduction…", from: { fr: "Traduit du français", en: "Traduit de l'anglais", unknown: "Traduit automatiquement" }, original: "Voir l'original", same: "Ce texte est déjà en français.", failed: "Traduction indisponible pour le moment. Réessayez plus tard." },
  en: { translate: "Translate", working: "Translating…", from: { fr: "Translated from French", en: "Translated from English", unknown: "Automatically translated" }, original: "Show original", same: "This post is already in English.", failed: "Translation is unavailable right now. Please try again later." },
};

/**
 * Post text with a "Traduire / Translate" link above it, as on X. Shown when the post
 * seems to be in the other language, or when it cannot tell. The translation is made
 * on the server once and reused; the original is always one tap away.
 */
export function TranslatableText({ postId, text, lang, className }: { postId: string; text: string; lang: Lang; className?: string }) {
  const t = L[lang];
  const detected = useMemo(() => detectLang(text), [text]);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const offer = text.trim().length > 0 && detected !== lang;
  if (!offer) return <PostText text={text} className={className} />;

  const toggle = () => {
    setNote(null);
    if (showing) return setShowing(false);
    if (translated) return setShowing(true);
    start(async () => {
      const r = await translatePost(postId, lang).catch(() => null);
      if (!r || !r.ok) return setNote(t.failed);
      if (r.same) return setNote(t.same);
      setTranslated(r.text);
      setShowing(true);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        disabled={pending}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold text-green-deep hover:underline disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h9M8.5 3v2M6 5c.5 3 3 6 6 7.5M11 5c-.8 3.5-3.5 6.5-7 8" /><path d="m13 20 4-9 4 9M14.3 17h5.4" /></svg>
        <span>{pending ? t.working : showing ? t.original : t.translate}</span>
      </button>
      {showing && translated ? (
        <>
          <PostText text={translated} className={className} />
          <p className="mt-1 text-[12px] text-muted">{t.from[detected ?? "unknown"]}</p>
        </>
      ) : (
        <PostText text={text} className={className} />
      )}
      {note && <p role="status" className="mt-1 text-[12px] text-muted">{note}</p>}
    </div>
  );
}
