"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { emptyVotingPlace, VotingPlaceFields, votingPlaceComplete, type VotingPlace } from "@/app/components/voting-place";
import { checkHandle } from "@/lib/actions";
import { requestSignupCode } from "@/lib/auth-actions";
import { slugify } from "@/lib/ci-geo";
import { t as dict } from "@/lib/i18n";
import type { AccountType } from "@/lib/types";
import { CodeStep } from "../code-step";
import { Spinner } from "@/app/components/ui/spinner";

const TYPES: AccountType[] = ["citoyen", "elu", "institution", "media"];
const TYPE_LABELS: Record<"fr" | "en", Record<AccountType, string>> = {
  fr: { citoyen: "Citoyen", elu: "Élu", institution: "Institution", media: "Média" },
  en: { citoyen: "Citizen", elu: "Elected official", institution: "Institution", media: "Media" },
};

export function SignupForm({ lang }: { lang: "fr" | "en" }) {
  const t = dict(lang);
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [handleFree, setHandleFree] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [type, setType] = useState<AccountType>("citoyen");
  const [place, setPlace] = useState<VotingPlace>(emptyVotingPlace);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  // Suggest a handle from the name until the person edits it.
  useEffect(() => {
    if (!handleTouched) setHandle(slugify(displayName).replace(/-/g, "_").slice(0, 20));
  }, [displayName, handleTouched]);

  // Debounced availability check.
  useEffect(() => {
    setHandleFree(null);
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return;
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      const free = await checkHandle(handle);
      if (id === seq.current) setHandleFree(free);
    }, 350);
    return () => clearTimeout(timer);
  }, [handle]);

  const handleValid = /^[a-z0-9_]{3,20}$/.test(handle);

  const form = () => ({
    email: email.trim(),
    display_name: displayName.trim(),
    handle,
    lang,
    vote_region_id: place.vote_region_id as number,
    vote_department_id: place.vote_department_id as number,
    vote_commune_id: place.vote_commune_id,
    vote_locality: place.vote_locality,
    is_registered_voter: place.is_registered_voter,
  });

  const send = async () => {
    const r = await requestSignupCode(form());
    if (!r.ok) {
      setError(
        r.error === "handle_taken" ? t.auth.handleTaken
          : r.error === "rate" ? (lang === "fr" ? "Trop de tentatives. Patientez une minute avant de réessayer." : "Too many attempts. Wait a minute.")
          : r.error === "closed" ? (lang === "fr" ? "Les inscriptions sont momentanément fermées. Revenez un peu plus tard." : "Sign-ups are closed for the moment. Please come back a little later.")
          : t.auth.error,
      );
      if (r.error === "handle_taken") setStep(1);
      return false;
    }
    return true;
  };

  const steps = [t.auth.step1, t.auth.step2, t.auth.step3];

  return (
    <div>
      <ol className="mb-6 flex gap-2" aria-label={lang === "fr" ? "Étapes" : "Steps"}>
        {steps.map((label, i) => (
          <li key={label} className="flex-1" aria-current={step === i + 1 ? "step" : undefined}>
            <span className={`block h-1.5 rounded-full ${i + 1 <= step ? "bg-green" : "bg-line"}`} />
            <span className={`mt-1.5 block text-[12px] font-semibold ${i + 1 === step ? "text-ink" : "text-muted"}`}>{label}</span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!handleValid || handleFree === false) return;
            setStep(2);
          }}
        >
          <label>
            <span className="label">{t.auth.displayName}</span>
            <input className="input" required maxLength={50} autoFocus autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label>
            <span className="label">{t.auth.handle}</span>
            <span className="relative block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-muted">@</span>
              <input
                className="input pl-8"
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={handle}
                onChange={(e) => { setHandleTouched(true); setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); }}
              />
            </span>
            {handle.length > 0 && !handleValid && <span className="mt-1 block text-[13px] text-muted">{lang === "fr" ? "De 3 à 20 caractères : lettres, chiffres ou _" : "3 to 20 characters: letters, digits, _"}</span>}
            {handleValid && handleFree === false && <span role="alert" className="mt-1 block text-[13px] font-medium text-orange">{t.auth.handleTaken}</span>}
            {handleValid && handleFree === true && <span className="mt-1 block text-[13px] font-medium text-green-deep">{lang === "fr" ? "Disponible" : "Available"}</span>}
          </label>
          <label>
            <span className="label">{t.auth.email}</span>
            <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <fieldset>
            <legend className="label">{t.auth.accountType}</legend>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((k) => (
                <label key={k} className={`flex h-11 cursor-pointer items-center justify-center rounded-2xl border text-[14px] font-semibold ${type === k ? "border-green bg-green-soft text-green-deep" : "border-line bg-card text-ink hover:bg-paper"}`}>
                  <input type="radio" name="type" className="sr-only" checked={type === k} onChange={() => setType(k)} />
                  {TYPE_LABELS[lang][k]}
                </label>
              ))}
            </div>
            {type !== "citoyen" && (
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                {lang === "fr"
                  ? "Votre compte démarre comme un compte citoyen. Après l'inscription, vous enverrez vos justificatifs pour obtenir le badge."
                  : "Your account starts as a citizen account. After signing up you will send your documents to get the badge."}
              </p>
            )}
          </fieldset>
          {error && <p role="alert" className="text-[14px] font-medium text-orange">{error}</p>}
          <button type="submit" className="btn-primary" disabled={!handleValid || handleFree === false}>{t.auth.next}</button>
        </form>
      )}

      {step === 2 && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!votingPlaceComplete(place)) return;
            start(async () => {
              setError(null);
              if (await send()) setStep(3);
            });
          }}
        >
          <VotingPlaceFields value={place} onChange={setPlace} lang={lang} />
          {error && <p role="alert" className="text-[14px] font-medium text-orange">{error}</p>}
          <p className="text-[13px] leading-relaxed text-muted">
            {lang === "fr" ? "En créant un compte, vous acceptez les " : "By creating an account you accept the "}
            <Link href="/regles" target="_blank" className="font-semibold text-green-deep hover:underline">{lang === "fr" ? "règles de la communauté" : "community rules"}</Link>
            {lang === "fr" ? " et la " : " and the "}
            <Link href="/confidentialite" target="_blank" className="font-semibold text-green-deep hover:underline">{lang === "fr" ? "politique de confidentialité" : "privacy policy"}</Link>.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>{t.auth.back}</button>
            <button type="submit" className="btn-primary flex-1" disabled={pending || !votingPlaceComplete(place)}>{pending && <Spinner />}{t.auth.create}</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <CodeStep
          email={email.trim()}
          lang={lang}
          onBack={() => setStep(2)}
          onResend={send}
          signup={form()}
          onDone={() => {
            // Officials, institutions and media go straight to the badge request.
            router.replace(type === "citoyen" ? "/mes-elus" : `/parametres?badge=${type}#verification`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
