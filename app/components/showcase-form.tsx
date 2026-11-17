"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveShowcase } from "@/lib/actions";
import type { TownHallShowcase } from "@/lib/communes";
import { I } from "./ui/icons";

/** The town hall's corner of its Découvertes page: a welcome word, the next event, the official site. */
export function ShowcaseForm({ communeId, name, initial, lang }: { communeId: number; name: string; initial: TownHallShowcase | null; lang: "fr" | "en" }) {
  const fr = lang === "fr";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const [f, setF] = useState({
    tagline: initial?.tagline ?? "",
    message: initial?.message ?? "",
    eventTitle: initial?.event_title ?? "",
    eventDate: initial?.event_date ?? "",
    eventText: initial?.event_text ?? "",
    website: initial?.website ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (!open) {
    return (
      <button type="button" className="btn-soft btn-sm" onClick={() => setOpen(true)}>
        <I.landmark className="h-4 w-4" />
        {fr ? "Personnaliser la page de la commune" : "Personalise the commune page"}
      </button>
    );
  }
  return (
    <form
      className="sheet-up flex w-full flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.15)]"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(false);
          const r = await saveShowcase({ communeId, ...f });
          if (!r.ok) return setError(true);
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <h3 className="font-display text-[17px] font-bold">{fr ? `La touche personnelle de ${name}` : `${name}'s personal touch`}</h3>
      <p className="text-[13px] leading-snug text-muted">
        {fr ? "Ces textes s'affichent en haut de la page, signés par la mairie. Laissez un champ vide pour ne pas l'afficher." : "These texts appear at the top of the page, signed by the town hall. Leave a field empty to hide it."}
      </p>
      <label><span className="label">{fr ? "Votre slogan (90 caractères)" : "Your tagline (90 characters)"}</span><input className="input" maxLength={90} value={f.tagline} onChange={set("tagline")} /></label>
      <label><span className="label">{fr ? "Le mot de la mairie" : "A word from the town hall"}</span><textarea className="textarea" maxLength={700} value={f.message} onChange={set("message")} /></label>
      <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
        <label><span className="label">{fr ? "Prochain événement" : "Next event"}</span><input className="input" maxLength={90} value={f.eventTitle} onChange={set("eventTitle")} /></label>
        <label><span className="label">Date</span><input className="input" type="date" value={f.eventDate} onChange={set("eventDate")} /></label>
      </div>
      <label><span className="label">{fr ? "Quelques mots sur l'événement" : "A few words about the event"}</span><textarea className="textarea min-h-[72px]" maxLength={300} value={f.eventText} onChange={set("eventText")} /></label>
      <label><span className="label">{fr ? "Site officiel (https://…)" : "Official website (https://…)"}</span><input className="input" type="url" inputMode="url" pattern="https://.*" maxLength={200} placeholder="https://" value={f.website} onChange={set("website")} /></label>
      {error && <p role="alert" className="text-[13px] font-medium text-orange">{fr ? "L'enregistrement n'a pas abouti. Vérifiez les champs et réessayez." : "Saving failed. Check the fields and try again."}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>{fr ? "Annuler" : "Cancel"}</button>
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>{fr ? "Enregistrer" : "Save"}</button>
      </div>
    </form>
  );
}
