import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "../components/wordmark";
import { getMyPrivate } from "@/lib/data/people";
import { getViewer } from "@/lib/supabase/server";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Où votez-vous ?", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Every account must say where it votes before using the app. People who signed up
 * through the normal form already did; this catches accounts created any other way.
 */
export default async function WelcomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const priv = await getMyPrivate();
  if (priv?.vote_region_id) redirect("/mes-elus");
  const lang = viewer.lang;
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex h-16 items-center justify-center border-b border-line bg-card">
        <Link href="/" aria-label="POLITIQUE"><Wordmark /></Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:py-12">
        <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">
          <h1 className="font-display text-[26px] font-bold leading-tight">{lang === "fr" ? "Où votez-vous ?" : "Where do you vote?"}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {lang === "fr"
              ? "POLITIQUE vous relie aux élus de l'endroit où vous votez : votre maire, votre député, votre conseil régional."
              : "POLITIQUE links you to the officials of the place where you vote: your mayor, your MP, your regional council."}
          </p>
          <div className="mt-5"><WelcomeForm lang={lang} /></div>
        </div>
      </main>
    </div>
  );
}
