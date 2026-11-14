import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/lang";
import { safePath } from "@/lib/join";

export const metadata: Metadata = { title: "Rejoindre POLITIQUE", robots: { index: false } };

type Lang = "fr" | "en";
// What the visitor was trying to reach, said in their words.
const PLACES: { prefix: string; fr: string; en: string }[] = [
  { prefix: "/accueil", fr: "Votre fil d'actualité est réservé aux membres.", en: "Your feed is for members." },
  { prefix: "/notifications", fr: "Vos notifications sont réservées aux membres.", en: "Notifications are for members." },
  { prefix: "/messages", fr: "Les messages privés sont réservés aux membres.", en: "Direct messages are for members." },
  { prefix: "/mes-elus", fr: "« Mes élus » vous montre les élus de votre lieu de vote.", en: "“My officials” shows the officials where you vote." },
  { prefix: "/barometre", fr: "Le baromètre est voté par les membres, commune par commune.", en: "The barometer is voted on by members, commune by commune." },
  { prefix: "/signets", fr: "Vos publications enregistrées sont réservées aux membres.", en: "Saved posts are for members." },
  { prefix: "/parametres", fr: "Vos paramètres sont réservés aux membres.", en: "Settings are for members." },
];

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const lang: Lang = await getLang();
  const fr = lang === "fr";
  const target = safePath(next, "");
  const place = PLACES.find((p) => target === p.prefix || target.startsWith(p.prefix + "/") || target.startsWith(p.prefix + "?"));
  const lead = place
    ? place[lang]
    : fr ? "Pour réagir, suivre, publier ou interpeller un élu, il faut un compte." : "To react, follow, post or question an official, you need an account.";
  const perks = fr
    ? ["Suivez vos élus et ce qu'ils font pour votre commune.", "Interpellez-les publiquement et votez au baromètre.", "Publiez, commentez et partagez avec votre communauté."]
    : ["Follow your officials and what they do for your commune.", "Question them publicly and vote in the barometer.", "Post, comment and share with your community."];
  const login = target ? `/connexion?next=${encodeURIComponent(target)}` : "/connexion";
  return (
    <>
      <h1 className="font-display text-[26px] font-bold leading-tight">{fr ? "Rejoignez POLITIQUE" : "Join POLITIQUE"}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{lead} {fr ? "L'inscription est gratuite et prend une minute." : "Signing up is free and takes a minute."}</p>
      <ul className="mt-5 flex flex-col gap-3">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-3 text-[15px] leading-snug">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 flex-none text-green" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7 flex flex-col gap-2">
        <Link href="/inscription" className="btn-primary h-12">{fr ? "Créer mon compte" : "Create my account"}</Link>
        <Link href={login} className="btn-ghost h-12">{fr ? "J'ai déjà un compte" : "I already have an account"}</Link>
      </div>
      <p className="mt-6 border-t border-line pt-5 text-[14px] text-muted">
        {fr ? "Vous pouvez aussi continuer à découvrir : " : "You can also keep looking around: "}
        <Link href="/explorer" className="font-semibold text-green-deep hover:underline">{fr ? "Explorer" : "Explore"}</Link>
        {" · "}
        <Link href="/elus" className="font-semibold text-green-deep hover:underline">{fr ? "Les élus" : "Officials"}</Link>
      </p>
    </>
  );
}
