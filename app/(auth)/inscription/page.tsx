import type { Metadata } from "next";
import Link from "next/link";
import { t as dict } from "@/lib/i18n";
import { betaOpen, getLang } from "@/lib/lang";
import { supabaseConfigured } from "@/lib/supabase/server";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function SignupPage() {
  const lang = await getLang();
  const t = dict(lang);
  return (
    <>
      <h1 className="font-display text-[26px] font-bold leading-tight">{t.auth.signupTitle}</h1>
      {!supabaseConfigured ? (
        <p className="mt-4 text-[15px] text-muted">{t.auth.notConfigured}</p>
      ) : !betaOpen ? (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-[15px] leading-relaxed text-muted">
            {lang === "fr"
              ? "Les inscriptions ouvrent avec la bêta. Laissez votre email sur la liste d'attente pour être parmi les premiers."
              : "Sign-ups open with the beta. Leave your email on the waitlist to be among the first."}
          </p>
          <Link href={lang === "fr" ? "/#waitlist" : "/en#waitlist"} className="btn-primary">{lang === "fr" ? "Rejoindre la liste d'attente" : "Join the waitlist"}</Link>
        </div>
      ) : (
        <div className="mt-5"><SignupForm lang={lang} /></div>
      )}
      <p className="mt-6 border-t border-line pt-5 text-[14px] text-muted">
        {t.auth.hasAccount} <Link href="/connexion" className="font-semibold text-green-deep hover:underline">{t.auth.loginTitle}</Link>
      </p>
    </>
  );
}
