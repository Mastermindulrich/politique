"use client";

import { useState, useTransition } from "react";
import { verifyCode } from "@/lib/auth-actions";
import { t as dict } from "@/lib/i18n";

/** Second half of both log-in and sign-up: type the code received by email. */
export function CodeStep({ email, lang, onDone, onResend, onBack, signup }: { email: string; lang: "fr" | "en"; onDone: () => void; onResend: () => Promise<boolean>; onBack: () => void; signup?: Parameters<typeof verifyCode>[2] }) {
  const t = dict(lang);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await verifyCode(email, code, signup);
      if (!r.ok) return setError(t.auth.invalidCode);
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-[15px] text-muted">
        {t.auth.codeSent} <b className="break-all text-ink">{email}</b>.
      </p>
      <label>
        <span className="label">{t.auth.code}</span>
        <input
          className="input text-center font-display text-[22px] tracking-[0.3em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,9}"
          maxLength={9}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
        />
      </label>
      {error && <p role="alert" className="text-[14px] font-medium text-orange">{error}</p>}
      <button type="submit" className="btn-primary" disabled={pending || code.replace(/\s/g, "").length < 6}>{t.auth.verify}</button>
      <div className="flex items-center justify-between text-[14px]">
        <button type="button" className="font-semibold text-muted hover:text-ink" onClick={onBack}>{t.auth.back}</button>
        <button
          type="button"
          className="font-semibold text-green-deep hover:underline disabled:opacity-60"
          disabled={pending || resent}
          onClick={() => start(async () => { if (await onResend()) setResent(true); else setError(t.auth.error); })}
        >
          {resent ? `${t.auth.resend} ✓` : t.auth.resend}
        </button>
      </div>
    </form>
  );
}
