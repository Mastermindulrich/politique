import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/app/components/shell/shell";
import { I } from "@/app/components/ui/icons";
import { communeLabel } from "@/lib/ci-geo";
import { communeSlug } from "@/lib/communes";
import { getMyPrivate } from "@/lib/data/people";
import { AT_THE_MAIRIE, MODE_LABEL, PORTALS, THEMES, THEME_ORDER, demarcheById, demarches } from "@/lib/demarches";
import { getLang } from "@/lib/lang";
import { CATEGORY_LABEL, EDITION_NOTICE, builtEditions, library, libraryById, upcoming, type LibraryCategory } from "@/lib/library";
import { getViewer } from "@/lib/supabase/server";
import { LibraryPicker } from "./picker";
import { ModeBadge, ThemeIcon } from "./demarches/ui";

export const metadata: Metadata = {
  title: "Bibliothèque de l'État",
  description: "La Constitution, les lois et les codes de la Côte d'Ivoire, et les démarches officielles (certificat de nationalité, casier judiciaire, carte d'identité, passeport, état civil…) avec les liens officiels et les pièces à fournir.",
};

const ORDER: LibraryCategory[] = ["institutions", "collectivites", "elections", "codes", "famille"];
const FEATURED = ["certificat-nationalite", "casier-judiciaire", "carte-identite", "passeport"];
const ko = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);

export default async function LibraryPage() {
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const fr = lang === "fr";
  const built = builtEditions.editions as Record<string, { pages: number; bytes: number; articles: number }>;
  const editions = library.filter((e) => e.edition && built[e.id]);
  const constitution = libraryById.get("constitution")!;
  const cBuilt = built.constitution;
  const priv = viewer ? await getMyPrivate() : null;
  const place = communeLabel(priv?.vote_commune_id);
  const online = demarches.filter((d) => d.mode !== "office").length;

  return (
    <>
      <PageHeader title={fr ? "Bibliothèque" : "Library"} />
      <section className="px-4 pb-4 pt-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-orange">{fr ? "Bibliothèque de l'État" : "State library"}</p>
        <h1 className="mt-1 font-display text-[26px] font-bold leading-tight">{fr ? "Vos droits, vos lois, vos démarches" : "Your rights, laws and paperwork"}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {fr
            ? "La Constitution et les lois du pays, et les démarches de tous les jours avec le lien officiel et les pièces à fournir. Tout au même endroit."
            : "The Constitution and the country's laws, and everyday procedures with the official link and the documents to bring. All in one place."}
        </p>
      </section>

      {/* The Constitution: the main document of the library. */}
      <section className="px-4 pb-5">
        <div className="relative overflow-hidden rounded-[20px] bg-ink p-5 text-bg">
          <span className="absolute inset-x-0 top-0 flex h-[5px]"><span className="flex-1 bg-orange" /><span className="flex-1 bg-white" /><span className="flex-1 bg-green" /></span>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">{fr ? "La loi fondamentale" : "The fundamental law"}</p>
          <h2 className="mt-1 font-display text-[24px] font-bold leading-tight">{fr ? "Constitution de la République de Côte d'Ivoire" : "Constitution of Côte d'Ivoire"}</h2>
          <p className="mt-1.5 text-[13px] leading-snug opacity-70">{constitution.reference}</p>
          <p className="mt-3 text-[15px] leading-relaxed opacity-90">{fr ? "Tout part d'elle : vos droits et vos devoirs, l'élection du Président, le Parlement, la justice, les régions et les communes." : "Everything starts here: your rights and duties, the election of the President, Parliament, justice, regions and communes."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/bibliotheque/constitution" className="inline-flex items-center rounded-full bg-bg px-4 py-2 text-[14px] font-bold text-ink">{fr ? "Lire la Constitution" : "Read the Constitution"}</Link>
            {cBuilt && (
              <a href="/bibliotheque/constitution.pdf" download className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-4 py-2 text-[14px] font-semibold">
                <I.download className="h-4 w-4" />PDF · {ko(cBuilt.bytes)}
              </a>
            )}
          </div>
        </div>
      </section>

      <nav aria-label={fr ? "Rubriques" : "Sections"} className="flex gap-2 overflow-x-auto border-b border-line px-4 pb-4 [scrollbar-width:none]">
        <a href="#demarches" className="pill flex-none">{fr ? "Démarches" : "Procedures"}</a>
        <a href="#commune" className="pill flex-none">{fr ? "Ma commune" : "My commune"}</a>
        <a href="#lois" className="pill flex-none">{fr ? "Lois et codes" : "Laws and codes"}</a>
        <a href="#portails" className="pill flex-none">{fr ? "Portails officiels" : "Official portals"}</a>
      </nav>

      {/* Procedures */}
      <section id="demarches" className="scroll-mt-16 border-b border-line px-4 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="section-title">{fr ? "Démarches" : "Procedures"}</h2>
          <Link href="/bibliotheque/demarches" className="text-[14px] font-semibold text-green-deep hover:underline">{fr ? `Tout voir (${demarches.length})` : `See all (${demarches.length})`}</Link>
        </div>
        <p className="mt-1 text-[14px] leading-snug text-muted">{fr ? `${online} démarches se font, en tout ou en partie, en ligne. Chaque fiche renvoie au site officiel.` : `${online} procedures can be done fully or partly online. Each one links the official site.`}</p>
        <ul className="mt-3 space-y-2">
          {FEATURED.map((id) => demarcheById.get(id)!).map((d) => (
            <li key={d.id}>
              <Link href={`/bibliotheque/demarches/${d.id}`} className="card flex items-start gap-3 p-3.5 hover:bg-paper/60">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-green/10 text-green-deep"><ThemeIcon theme={d.theme} className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold leading-snug">{d.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">{(d.cost ?? d.organisme).split(" (")[0]}</span>
                  <span className="mt-1.5 block"><ModeBadge mode={d.mode} lang={lang} /></span>
                </span>
                <I.back className="mt-3 h-4 w-4 flex-none rotate-180 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {THEME_ORDER.map((t) => (
            <Link key={t} href={`/bibliotheque/demarches#${t}`} className="rounded-2xl border border-line p-3 hover:bg-paper/60">
              <ThemeIcon theme={t} className="h-5 w-5 text-orange" />
              <span className="mt-1.5 block text-[14px] font-bold leading-snug">{THEMES[t][lang]}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-muted">{THEMES[t].blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Local: what is done at the town hall, the commune's showcase and officials, the law on local government. */}
      <section id="commune" className="scroll-mt-16 border-b border-line px-4 py-5">
        <h2 className="section-title">{place ? (fr ? `Ma commune : ${place.commune}` : `My commune: ${place.commune}`) : fr ? "Dans ma commune" : "In my commune"}</h2>
        <p className="mt-1 text-[14px] leading-snug text-muted">
          {place
            ? fr ? `Ces démarches se font à la mairie de ${place.commune} (${place.region}).` : `These are done at the ${place.commune} town hall (${place.region}).`
            : fr ? "Ces démarches se font à la mairie. Indiquez votre commune pour voir la vôtre." : "These are done at the town hall. Set your commune to see yours."}
        </p>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {AT_THE_MAIRIE.map((id) => demarcheById.get(id)!).map((d) => (
            <li key={d.id}>
              <Link href={`/bibliotheque/demarches/${d.id}`} className="flex items-center justify-between gap-3 px-3.5 py-3 text-[15px] hover:bg-paper/60">
                <span className="min-w-0 font-semibold leading-snug">{d.title}</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 flex-none text-muted" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {place ? (
            <>
              <Link href={`/decouvertes/${communeSlug(priv!.vote_commune_id!)}`} className="btn-soft btn-sm">{fr ? `Découvrir ${place.commune}` : `Discover ${place.commune}`}</Link>
              <Link href="/mes-elus" className="btn-ghost btn-sm">{fr ? "Mon maire et mes élus" : "My mayor and officials"}</Link>
            </>
          ) : (
            <>
              <Link href={viewer ? "/mes-elus" : "/inscription"} className="btn-soft btn-sm">{fr ? "Indiquer ma commune" : "Set my commune"}</Link>
              <Link href="/decouvertes" className="btn-ghost btn-sm">{fr ? "Découvrir les communes" : "Discover the communes"}</Link>
            </>
          )}
          <Link href="/bibliotheque/loi-collectivites" className="btn-ghost btn-sm">{fr ? "La loi sur les communes et les régions" : "The law on communes and regions"}</Link>
        </div>
      </section>

      {/* Laws and codes */}
      <section id="lois" className="scroll-mt-16 px-4 pb-1 pt-5">
        <h2 className="section-title">{fr ? "Lois et codes" : "Laws and codes"}</h2>
        <p className="mt-1 text-[14px] leading-snug text-muted">{fr ? "Chaque texte renvoie à sa source ; les éditions POLITIQUE se lisent en ligne et se téléchargent, une par une ou toutes ensemble." : "Each text links its source; POLITIQUE editions can be read online and downloaded, one by one or all together."}</p>
        {editions.length > 0 && (
          <a href="/bibliotheque/politique-bibliotheque.zip" download className="btn-primary mt-3 inline-flex items-center gap-2">
            <I.download className="h-[18px] w-[18px]" />
            {fr ? "Tout télécharger" : "Download everything"} <span className="font-normal opacity-80">· ZIP, {ko(builtEditions.archive.bytes)}</span>
          </a>
        )}
      </section>

      {editions.length > 1 && (
        <LibraryPicker lang={lang} items={editions.map((e) => ({ id: e.id, title: e.title, short: e.short, bytes: built[e.id].bytes, pages: built[e.id].pages }))} />
      )}

      {ORDER.map((cat) => {
        const items = library.filter((e) => e.category === cat);
        if (!items.length) return null;
        return (
          <section key={cat} className="border-b border-line">
            <h3 className="px-4 pb-1 pt-5 text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{CATEGORY_LABEL[cat][lang]}</h3>
            <ul>
              {items.map((e) => {
                const b = built[e.id];
                return (
                  <li key={e.id} className="px-4 py-3">
                    <div className="card flex gap-4 p-4">
                      <Link href={`/bibliotheque/${e.id}`} aria-hidden="true" tabIndex={-1} className={`relative flex h-[104px] w-[74px] flex-none flex-col justify-between overflow-hidden rounded-[6px] p-2 shadow-sm ${b ? "bg-ink text-bg" : "border border-line bg-paper text-muted"}`}>
                        <span className="absolute inset-x-0 top-0 flex h-[3px]"><span className="flex-1 bg-orange" /><span className="flex-1 bg-white" /><span className="flex-1 bg-green" /></span>
                        <span className="mt-1 text-[7px] font-bold tracking-[0.16em]">POLITIQUE</span>
                        <span className="font-display text-[11px] font-bold leading-[1.1]">{e.short}</span>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={`/bibliotheque/${e.id}`} className="block text-[16px] font-bold leading-snug hover:underline">{e.title}</Link>
                        <p className="mt-0.5 text-[13px] leading-snug text-muted">{e.reference}</p>
                        <p className="mt-1.5 line-clamp-2 text-[14px] leading-snug">{e.summary}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {b ? (
                            <>
                              <Link href={`/bibliotheque/${e.id}`} className="btn-dark btn-sm">{fr ? "Lire" : "Read"}</Link>
                              <a href={`/bibliotheque/${e.id}.pdf`} download className="btn-ghost btn-sm inline-flex items-center gap-1.5"><I.download className="h-4 w-4" />PDF · {ko(b.bytes)}</a>
                            </>
                          ) : (
                            <span className="chip bg-paper text-muted">{fr ? "Édition POLITIQUE en préparation" : "POLITIQUE edition in preparation"}</span>
                          )}
                          <a href={e.officialUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-green-deep hover:underline">{e.transcription ? (fr ? "Source du texte" : "Text source") : fr ? "Texte officiel" : "Official text"} ↗</a>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="border-b border-line px-4 py-5">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{fr ? "Bientôt dans la bibliothèque" : "Coming to the library"}</h3>
        <ul className="mt-2 flex flex-wrap gap-2">{upcoming.map((u) => <li key={u} className="rounded-full border border-line px-3.5 py-1.5 text-[14px] font-semibold leading-snug">{u}</li>)}</ul>
      </section>

      <section id="portails" className="scroll-mt-16 border-b border-line px-4 py-5">
        <h2 className="section-title">{fr ? "Portails officiels" : "Official portals"}</h2>
        <ul className="mt-3 space-y-2">
          {PORTALS.map((p) => (
            <li key={p.u}>
              <a href={p.u} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-line p-3.5 hover:bg-paper/60">
                <I.globe className="h-5 w-5 flex-none text-green-deep" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{p.l} ↗</span>
                  <span className="block text-[13px] leading-snug text-muted">{p.d}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <p className="px-4 py-5 text-[12px] leading-relaxed text-muted">{EDITION_NOTICE} {fr ? `Les démarches renvoient aux sites officiels ; les tarifs et les pièces peuvent changer, vérifiez-les auprès du service concerné. Légende : ${MODE_LABEL.online.fr}, ${MODE_LABEL.partial.fr}, ${MODE_LABEL.office.fr}.` : ""}</p>
    </>
  );
}
