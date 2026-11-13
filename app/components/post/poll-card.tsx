"use client";

import { useState, useTransition } from "react";
import { votePoll } from "@/lib/actions";
import type { Poll } from "@/lib/types";
import type { Dict } from "@/lib/i18n";

export function PollCard({ poll, voted, canVote, t, lang }: { poll: Poll; voted: number | null; canVote: boolean; t: Dict["post"]; lang: "fr" | "en" }) {
  const [choice, setChoice] = useState<number | null>(voted);
  const [counts, setCounts] = useState<number[]>(poll.counts);
  const [pending, start] = useTransition();
  const ended = new Date(poll.ends_at).getTime() < Date.now();
  const total = counts.reduce((a, b) => a + b, 0);
  const showResults = choice !== null || ended || !canVote;

  const left = () => {
    const ms = new Date(poll.ends_at).getTime() - Date.now();
    if (ms <= 0) return t.pollEnded;
    const h = Math.floor(ms / 3600_000);
    if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min ${t.pollLeft}`;
    if (h < 48) return `${h} h ${t.pollLeft}`;
    return `${Math.floor(h / 24)} ${lang === "fr" ? "j" : "d"} ${t.pollLeft}`;
  };

  function vote(i: number) {
    if (showResults || pending) return;
    setChoice(i);
    setCounts((c) => c.map((v, j) => (j === i ? v + 1 : v)));
    start(async () => {
      const r = await votePoll(poll.post_id, i);
      if (!r.ok) {
        setChoice(null);
        setCounts(poll.counts);
      }
    });
  }

  return (
    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
      <ul className="flex flex-col gap-1.5">
        {poll.options.map((label, i) => {
          const pct = total ? Math.round((100 * counts[i]) / total) : 0;
          const top = showResults && total > 0 && counts[i] === Math.max(...counts);
          return (
            <li key={i}>
              {showResults ? (
                <div className="relative h-10 overflow-hidden rounded-xl border border-line">
                  <span className={`absolute inset-y-0 left-0 ${top ? "bg-green-soft" : "bg-paper"}`} style={{ width: `${pct}%` }} />
                  <span className="relative flex h-full items-center justify-between px-3 text-[14px]">
                    <span className={`flex items-center gap-1.5 ${top ? "font-bold" : "font-medium"}`}>
                      {label}
                      {choice === i && <svg viewBox="0 0 24 24" className="h-4 w-4 text-green-deep" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                    </span>
                    <span className="font-semibold text-muted">{pct} %</span>
                  </span>
                </div>
              ) : (
                <button type="button" onClick={() => vote(i)} disabled={pending} className="h-10 w-full rounded-xl border border-green px-3 text-left text-[14px] font-semibold text-green-deep hover:bg-green-soft">
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 text-[13px] text-muted">
        {total} {t.votes} · {left()}
      </div>
    </div>
  );
}
