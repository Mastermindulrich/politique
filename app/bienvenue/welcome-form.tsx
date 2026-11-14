"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { emptyVotingPlace, VotingPlaceFields, votingPlaceComplete, type VotingPlace } from "@/app/components/voting-place";
import { completeOnboarding, updatePrivateProfile } from "@/lib/actions";
import { t as dict } from "@/lib/i18n";
import { Spinner } from "@/app/components/ui/spinner";

export function WelcomeForm({ lang }: { lang: "fr" | "en" }) {
  const t = dict(lang);
  const router = useRouter();
  const [place, setPlace] = useState<VotingPlace>(emptyVotingPlace);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!votingPlaceComplete(place)) return;
        start(async () => {
          setError(false);
          const r = await updatePrivateProfile({ ...place, vote_locality: place.vote_locality.trim() || null });
          if (!r.ok) return setError(true);
          await completeOnboarding();
          router.replace("/mes-elus");
          router.refresh();
        });
      }}
    >
      <VotingPlaceFields value={place} onChange={setPlace} lang={lang} />
      {error && <p role="alert" className="text-[14px] font-medium text-orange">{t.auth.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending || !votingPlaceComplete(place)}>{pending && <Spinner />}<span>{t.auth.next}</span></button>
    </form>
  );
}
