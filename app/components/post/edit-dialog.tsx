"use client";

import { useEffect, useState, useTransition } from "react";
import { editPost, getPostEdits } from "@/lib/social-actions";
import { errorText, social } from "@/lib/i18n-social";
import { t as dict, formatDate } from "@/lib/i18n";
import type { LinkPreview } from "@/lib/types";

const MAX = 500;
type Lang = "fr" | "en";

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Edit your own post during the hour after publishing. */
export function EditDialog({ postId, text, lang, onClose, onSaved }: { postId: string; text: string; lang: Lang; onClose: () => void; onSaved: (p: { text: string; edited_at: string | null; link: LinkPreview | null }) => void }) {
  const t = dict(lang);
  const s = social(lang);
  const [value, setValue] = useState(text);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const left = MAX - value.length;
  const canSave = !pending && left >= 0 && value.trim() !== text.trim();

  function save() {
    if (!canSave) return;
    setError(null);
    start(async () => {
      const r = await editPost(postId, value);
      if (!r.ok) return setError(errorText(r.error, lang, t.common.error));
      onSaved(r.data!);
    });
  }

  return (
    <Sheet title={s.post.editTitle} onClose={onClose}>
      <p className="mt-1 text-[13px] text-muted">{s.post.editHint}</p>
      <label className="sr-only" htmlFor={`edit-${postId}`}>{s.post.editTitle}</label>
      <textarea
        id={`edit-${postId}`}
        autoFocus
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); }}
        className="mt-3 w-full resize-none rounded-2xl border border-line bg-paper px-4 py-3 text-[16px] leading-snug text-ink focus:border-green focus:outline-none"
      />
      {error && <p role="alert" className="mt-2 text-[13px] font-medium text-orange">{error}</p>}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span aria-live="polite" className={`text-[13px] tabular-nums ${left < 0 ? "font-bold text-orange" : left < 40 ? "text-orange" : "text-muted"}`}>{left}</span>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t.common.cancel}</button>
          <button type="button" className="btn-primary btn-sm" disabled={!canSave} onClick={save}>{pending ? t.common.loading : s.post.save}</button>
        </div>
      </div>
    </Sheet>
  );
}

/** The earlier versions of an edited post, newest first. Anyone who can see the post can see them. */
export function HistoryDialog({ postId, current, lang, onClose }: { postId: string; current: string; lang: Lang; onClose: () => void }) {
  const t = dict(lang);
  const s = social(lang);
  const [edits, setEdits] = useState<{ text: string; created_at: string }[] | null>(null);
  useEffect(() => {
    let live = true;
    getPostEdits(postId).then((e) => live && setEdits(e)).catch(() => live && setEdits([]));
    return () => { live = false; };
  }, [postId]);

  return (
    <Sheet title={s.post.history} onClose={onClose}>
      <ol className="mt-4 flex flex-col gap-3">
        <li className="rounded-2xl border border-green/30 bg-green-soft px-4 py-3">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-green-deep">{s.post.current}</span>
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-snug">{current}</p>
        </li>
        {edits === null && <li className="text-[14px] text-muted">{t.common.loading}</li>}
        {edits?.map((e, i) => (
          <li key={i} className="rounded-2xl border border-line px-4 py-3">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{s.post.original} · {formatDate(e.created_at, lang, true)}</span>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-snug text-muted">{e.text}</p>
          </li>
        ))}
      </ol>
      <button type="button" className="btn-ghost mt-5 w-full" onClick={onClose}>{t.common.close}</button>
    </Sheet>
  );
}
