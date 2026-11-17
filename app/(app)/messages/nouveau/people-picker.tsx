"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { VerifiedBadge } from "@/app/components/ui/badge";
import { I } from "@/app/components/ui/icons";
import { startConversation } from "@/lib/actions";
import { createGroup, searchPeople } from "@/lib/social-actions";
import { t as dict } from "@/lib/i18n";
import { errorText, social } from "@/lib/i18n-social";

type Person = Awaited<ReturnType<typeof searchPeople>>[number];

/** Pick one person to write to, or several to start a group. */
export function PeoplePicker({ lang }: { lang: "fr" | "en" }) {
  const t = dict(lang);
  const s = social(lang);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [picked, setPicked] = useState<Person[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setResults(null);
    let live = true;
    const timer = setTimeout(() => {
      searchPeople(term).then((r) => { if (live) setResults(r); }).catch(() => { if (live) setResults([]); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [q]);

  const isPicked = (id: string) => picked.some((p) => p.id === id);
  function toggle(p: Person) {
    setError(null);
    setPicked((x) => (x.some((y) => y.id === p.id) ? x.filter((y) => y.id !== p.id) : x.length >= 49 ? x : [...x, p]));
    setQ("");
  }
  function go() {
    if (!picked.length || pending) return;
    setError(null);
    start(async () => {
      const r = picked.length === 1 ? await startConversation(picked[0].id) : await createGroup(title.trim(), picked.map((p) => p.id));
      if (!r.ok) return setError(errorText(r.error, lang, t.common.error));
      router.push(`/messages/${r.data!.id}`);
    });
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper px-3 py-2 focus-within:border-green">
        <span className="text-[14px] font-semibold text-muted">{s.messages.to}</span>
        {picked.map((p) => (
          <button key={p.id} type="button" onClick={() => toggle(p)} aria-label={`${s.filter.remove} ${p.display_name}`} className="flex items-center gap-1.5 rounded-full bg-green-soft py-1 pl-1 pr-2 text-[13px] font-semibold text-green-deep">
            <Avatar src={p.avatar_url} name={p.display_name} size={22} />
            <span className="max-w-[9rem] truncate">{p.display_name}</span>
            <I.x className="h-3.5 w-3.5" />
          </button>
        ))}
        <label className="sr-only" htmlFor="people-q">{s.messages.searchPeople}</label>
        <input id="people-q" autoFocus autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.messages.searchPeople} className="min-w-[8rem] flex-1 bg-transparent py-1 text-[16px] focus:outline-none" />
      </div>

      {picked.length > 1 && (
        <label className="mt-3 block">
          <span className="sr-only">{s.messages.groupName}</span>
          <input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={s.messages.groupName} />
        </label>
      )}

      {error && <p role="alert" className="mt-3 text-[13px] font-medium text-orange">{error}</p>}

      {picked.length > 0 && (
        <button type="button" onClick={go} disabled={pending} className="btn-primary mt-3 w-full">
          {pending ? t.common.loading : picked.length === 1 ? s.messages.start : `${s.messages.createGroup} (${picked.length + 1})`}
        </button>
      )}

      {results === null && picked.length === 0 && <p className="px-2 py-10 text-center text-[15px] text-muted">{s.messages.pickHint}</p>}
      {results && results.length === 0 && <p className="px-2 py-8 text-center text-[15px] text-muted">{s.messages.noResult}</p>}
      {results && results.length > 0 && (
        <ul className="-mx-4 mt-3 border-t border-line">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => toggle(p)} aria-pressed={isPicked(p.id)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left hover:bg-paper/60">
                <Avatar src={p.avatar_url} name={p.display_name} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[15px] font-bold"><span className="truncate">{p.display_name}</span>{p.verified && <VerifiedBadge type={p.account_type} size={16} />}</span>
                  <span className="block truncate text-[14px] text-muted">@{p.handle}</span>
                </span>
                <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border ${isPicked(p.id) ? "border-green bg-green text-white" : "border-line"}`}>{isPicked(p.id) && <I.check className="h-4 w-4" />}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
