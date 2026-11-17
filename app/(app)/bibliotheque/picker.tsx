"use client";

import { useState } from "react";
import { I } from "@/app/components/ui/icons";
import { zipStore } from "@/lib/zip-store";

export type PickerItem = { id: string; title: string; short: string; bytes: number; pages: number };

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);

/** Lets the reader tick the texts they want and download them as one PDF or one ZIP. */
export function LibraryPicker({ items, lang }: { items: PickerItem[]; lang: "fr" | "en" }) {
  const fr = lang === "fr";
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const picked = items.filter((i) => chosen.has(i.id));
  const total = picked.reduce((n, i) => n + i.bytes, 0);
  const all = picked.length === items.length;

  const toggle = (id: string) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function download() {
    if (!picked.length) return;
    if (picked.length === 1) {
      const a = document.createElement("a");
      a.href = `/bibliotheque/${picked[0].id}.pdf`;
      a.download = `${picked[0].id}.pdf`;
      a.click();
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const files = await Promise.all(
        picked.map(async (i) => {
          const r = await fetch(`/bibliotheque/${i.id}.pdf`);
          if (!r.ok) throw new Error(String(r.status));
          return { name: `politique-${i.id}.pdf`, data: new Uint8Array(await r.arrayBuffer()) };
        }),
      );
      save(zipStore(files), "politique-bibliotheque-selection.zip");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-b border-line px-4 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="section-title">{fr ? "Composer mon dossier" : "Build my bundle"}</h2>
        <button type="button" onClick={() => setChosen(all ? new Set() : new Set(items.map((i) => i.id)))} className="text-[13px] font-semibold text-green-deep hover:underline">
          {all ? (fr ? "Tout décocher" : "Clear all") : fr ? "Tout cocher" : "Select all"}
        </button>
      </div>
      <p className="mt-1 text-[14px] leading-snug text-muted">{fr ? "Cochez les textes voulus : un seul se télécharge en PDF, plusieurs dans un ZIP." : "Tick the texts you want: one downloads as a PDF, several as a ZIP."}</p>
      <ul className="mt-3 divide-y divide-line rounded-[14px] border border-line">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-3.5 py-2.5">
              <input type="checkbox" checked={chosen.has(i.id)} onChange={() => toggle(i.id)} className="h-5 w-5 flex-none accent-green" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{i.title}</span>
                <span className="block text-[12px] text-muted">PDF · {size(i.bytes)} · {i.pages} pages</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" disabled={!picked.length || busy} onClick={download} className="btn-dark mt-3 inline-flex w-full items-center justify-center gap-2 disabled:opacity-50 sm:w-auto">
        <I.download className="h-[18px] w-[18px]" />
        {busy
          ? fr ? "Préparation…" : "Preparing…"
          : !picked.length
            ? fr ? "Cochez au moins un texte" : "Tick at least one text"
            : picked.length === 1
              ? `${fr ? "Télécharger" : "Download"} · PDF, ${size(total)}`
              : `${fr ? "Télécharger" : "Download"} ${picked.length} ${fr ? "textes" : "texts"} · ZIP, ${size(total)}`}
      </button>
      {error && <p role="alert" className="mt-2 text-[13px] text-orange">{fr ? "Le téléchargement a échoué. Réessayez." : "The download failed. Please try again."}</p>}
    </section>
  );
}
