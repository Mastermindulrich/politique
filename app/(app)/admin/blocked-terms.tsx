"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { I } from "@/app/components/ui/icons";
import { t as dict } from "@/lib/i18n";
import { errorText, social } from "@/lib/i18n-social";
import { addBlockedTerm, removeBlockedTerm } from "@/lib/social-actions";

/** The moderators' word filter: a post containing one of these words is refused. */
export function BlockedTerms({ terms, lang }: { terms: string[]; lang: "fr" | "en" }) {
  const t = dict(lang);
  const s = social(lang);
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) {
    setError(null);
    start(async () => {
      const r = await action();
      if (!r.ok) return setError(errorText(r.error, lang, t.common.error));
      done?.();
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-4">
      <p className="text-[14px] text-muted">{s.filter.intro}</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim().length >= 2) run(() => addBlockedTerm(value), () => setValue(""));
        }}
      >
        <label className="sr-only" htmlFor="blocked-term">{s.filter.placeholder}</label>
        <input id="blocked-term" className="input flex-1" value={value} maxLength={80} autoComplete="off" onChange={(e) => setValue(e.target.value)} placeholder={s.filter.placeholder} />
        <button type="submit" className="btn-primary flex-none" disabled={pending || value.trim().length < 2}>{s.filter.add}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-[13px] font-medium text-orange">{error}</p>}
      {terms.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">{s.filter.empty}</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {terms.map((term) => (
            <li key={term} className="flex items-center gap-1 rounded-full border border-line bg-paper py-1 pl-3 pr-1 text-[14px] font-medium">
              {term}
              <button type="button" disabled={pending} onClick={() => run(() => removeBlockedTerm(term))} aria-label={`${s.filter.remove} ${term}`} className="rounded-full p-1.5 text-muted hover:bg-line/70 hover:text-ink">
                <I.x className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
