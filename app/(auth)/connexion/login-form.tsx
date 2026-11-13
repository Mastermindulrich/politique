"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestLoginCode } from "@/lib/auth-actions";
import { t as dict } from "@/lib/i18n";
import { CodeStep } from "../code-step";

export function LoginForm({ lang, next }: { lang: "fr" | "en"; next: string }) {
  const t = dict(lang);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const message = (code: string) =>
    code === "no_account"
      ? lang === "fr" ? "Aucun compte n'est associé à cette adresse. Créez-en un." : "No account with this address. Create one."
      : code === "rate"
        ? lang === "fr" ? "Trop de tentatives. Patientez une minute avant de réessayer." : "Too many attempts. Wait a minute."
        : t.auth.error;

  if (sent) {
    return (
      <CodeStep
        email={email}
        lang={lang}
        onBack={() => setSent(false)}
        onResend={async () => (await requestLoginCode(email, lang)).ok}
        onDone={() => { router.replace(next); router.refresh(); }}
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await requestLoginCode(email.trim(), lang);
          if (!r.ok) return setError(message(r.error));
          setSent(true);
        });
      }}
    >
      <label>
        <span className="label">{t.auth.email}</span>
        <input className="input" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-[14px] font-medium text-orange">{error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>{t.auth.sendCode}</button>
    </form>
  );
}
