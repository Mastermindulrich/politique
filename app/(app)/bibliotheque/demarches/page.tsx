import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/app/components/shell/shell";
import { I } from "@/app/components/ui/icons";
import { PORTALS, THEMES, THEME_ORDER, demarches } from "@/lib/demarches";
import { getLang } from "@/lib/lang";
import { getViewer } from "@/lib/supabase/server";
import { ModeBadge, ThemeIcon } from "./ui";

export const metadata: Metadata = {
  title: "Démarches · Bibliothèque",
  description: "Les démarches officielles en Côte d'Ivoire, ce qui se fait en ligne, où aller et quoi apporter : certificat de nationalité, casier judiciaire, carte d'identité, passeport, état civil, CMU, CNPS, permis, entreprise, impôts.",
};

export default async function DemarchesPage() {
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const fr = lang === "fr";
  const online = demarches.filter((d) => d.mode !== "office").length;

  return (
    <>
      <PageHeader title={fr ? "Démarches" : "Procedures"} back="/bibliotheque" />
      <section className="border-b border-line px-4 pb-4 pt-4">
        <h1 className="font-display text-[24px] font-bold leading-tight">{fr ? "Vos démarches, au bon endroit" : "Your procedures, in the right place"}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          {fr
            ? `${online} démarches sur ${demarches.length} se font déjà en ligne, au moins en partie. Chaque fiche renvoie au site officiel et dit quoi apporter.`
            : `${online} of ${demarches.length} procedures can already be done online, at least in part. Each page links to the official site and says what to bring.`}
        </p>
        <nav className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {THEME_ORDER.map((t) => (
            <a key={t} href={`#${t}`} className="pill whitespace-nowrap">{fr ? THEMES[t].fr : THEMES[t].en}</a>
          ))}
        </nav>
      </section>

      {THEME_ORDER.map((t) => {
        const items = demarches.filter((d) => d.theme === t);
        if (!items.length) return null;
        return (
          <section key={t} id={t} className="scroll-mt-16 border-b border-line">
            <h2 className="flex items-center gap-2 px-4 pt-4 font-display text-[18px] font-bold">
              <ThemeIcon theme={t} className="h-5 w-5 text-orange" />
              {fr ? THEMES[t].fr : THEMES[t].en}
            </h2>
            <ul className="pb-2">
              {items.map((d) => (
                <li key={d.id}>
                  <Link href={`/bibliotheque/demarches/${d.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-paper/60">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold leading-snug">{d.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">{d.summary}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <ModeBadge mode={d.mode} lang={lang} />
                        {d.cost && <span className="text-[12px] text-muted">{d.cost.split(".")[0]}</span>}
                      </span>
                    </span>
                    <I.back className="mt-1 h-4 w-4 flex-none rotate-180 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="border-b border-line px-4 py-4">
        <h2 className="font-display text-[18px] font-bold">{fr ? "Portails officiels" : "Official portals"}</h2>
        <ul className="mt-2 grid gap-2">
          {PORTALS.map((p) => (
            <li key={p.u}>
              <a href={p.u} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3 hover:bg-paper/60">
                <I.globe className="h-5 w-5 flex-none text-green-deep" />
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold">{p.l}</span>
                  <span className="block text-[13px] text-muted">{p.d}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          {fr
            ? "Les montants, délais et pièces changent : vérifiez toujours auprès du service officiel avant de vous déplacer. POLITIQUE n'est pas un service de l'État et ne collecte aucun paiement."
            : "Fees, delays and documents change: always check with the official service before going. POLITIQUE is not a government service and collects no payment."}
        </p>
      </section>
    </>
  );
}
