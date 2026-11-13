import type { Metadata } from "next";
import Link from "next/link";
import { t as dict } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { supabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Se connecter", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erreur?: string }> }) {
  const { next, erreur } = await searchParams;
  const lang = await getLang();
  const t = dict(lang);
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/accueil";
  return (
    <>
      <h1 className="font-display text-[26px] font-bold leading-tight">{t.auth.loginTitle}</h1>
      {erreur === "lien" && <p role="alert" className="mt-3 rounded-2xl bg-orange-soft px-4 py-3 text-[14px] font-medium text-orange">{lang === "fr" ? "Ce lien a expiré. Demandez un nouveau code." : "This link has expired. Ask for a new code."}</p>}
      {supabaseConfigured ? (
        <div className="mt-6"><LoginForm lang={lang} next={safeNext} /></div>
      ) : (
        <p className="mt-4 text-[15px] text-muted">{t.auth.notConfigured}</p>
      )}
      <p className="mt-6 border-t border-line pt-5 text-[14px] text-muted">
        {t.auth.noAccount} <Link href="/inscription" className="font-semibold text-green-deep hover:underline">{t.auth.signupTitle}</Link>
      </p>
    </>
  );
}
