"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { emptyVotingPlace, VotingPlaceFields, votingPlaceComplete, type VotingPlace } from "@/app/components/voting-place";
import { completeOnboarding, setDisplayName, updatePrivateProfile } from "@/lib/actions";
import { t as dict } from "@/lib/i18n";
import { nameHelp, nameOk } from "@/lib/names";
import { Spinner } from "@/app/components/ui/spinner";

/** Asks what an account is still missing: a real name, where the person votes, or both. */
export function WelcomeForm({ lang, askName = false, askPlace = true }: { lang: "fr" | "en"; askName?: boolean; askPlace?: boolean }) {
  const t = dict(lang);
  const router = useRouter();
  const [name, setName] = useState("");
  const [place, setPlace] = useState<VotingPlace>(emptyVotingPlace);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = (!askName || nameOk(name)) && (!askPlace || votingPlaceComplete(place));
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        start(async () => {
          setError(null);
          if (askName) {
            const n = await setDisplayName(name);
            if (!n.ok) return setError(n.error === "invalid_name" ? nameHelp(lang) : n.error === "reserved_name" ? (lang === "fr" ? "Ce nom est réservé." : "This name is reserved.") : t.auth.error);
          }
          if (askPlace) {
            const r = await updatePrivateProfile({ ...place, vote_locality: place.vote_locality.trim() || null });
            if (!r.ok) return setError(t.auth.error);
          }
          await completeOnboarding();
          router.replace("/mes-elus");
          router.refresh();
        });
      }}
    >
      {askName && (
        <label>
          <span className="label">{t.auth.displayName}</span>
          <input className="input" required minLength={2} maxLength={50} autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          {name.trim().length > 0 && !nameOk(name) && <span className="mt-1 block text-[13px] text-muted">{nameHelp(lang)}</span>}
        </label>
      )}
      {askPlace && <VotingPlaceFields value={place} onChange={setPlace} lang={lang} />}
      {error && <p role="alert" className="text-[14px] font-medium text-orange">{error}</p>}
      <button type="submit" className="btn-primary" disabled={pending || !ready}>{pending && <Spinner />}<span>{t.auth.next}</span></button>
    </form>
  );
}
