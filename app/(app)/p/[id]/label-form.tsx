"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { labelPost } from "@/lib/actions";
import { t as dict } from "@/lib/i18n";

type Label = "contexte" | "contestee" | "fausse" | "satire" | "officiel";

/** Moderators and verified media can attach a context or fact-check label to a post. */
export function LabelForm({ postId, lang }: { postId: string; lang: "fr" | "en" }) {
  const t = dict(lang);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<Label>("contexte");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="border-b border-line px-4 py-2">
        <button type="button" className="text-[13px] font-semibold text-green-deep" onClick={() => setOpen(true)}>
          + {lang === "fr" ? "Ajouter un contexte ou une vérification" : "Add context or a fact-check"}
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 border-b border-line bg-paper px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await labelPost({ postId, label, note, source_url: source || undefined });
          if (r.ok) {
            setOpen(false);
            setNote("");
            setSource("");
            router.refresh();
          }
        });
      }}
    >
      <select className="select h-10" value={label} onChange={(e) => setLabel(e.target.value as Label)} aria-label="Label">
        {(Object.keys(t.post.labels) as Label[]).map((l) => (
          <option key={l} value={l}>{t.post.labels[l]}</option>
        ))}
      </select>
      <textarea className="textarea min-h-[64px]" maxLength={500} required value={note} onChange={(e) => setNote(e.target.value)} placeholder={lang === "fr" ? "Ce que les lecteurs doivent savoir" : "What readers should know"} />
      <input className="input h-10" type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder={lang === "fr" ? "Lien source" : "Source link"} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>{t.common.cancel}</button>
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>{t.common.save}</button>
      </div>
    </form>
  );
}
