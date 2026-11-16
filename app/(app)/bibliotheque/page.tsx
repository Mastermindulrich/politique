import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/app/components/shell/shell";
import { I } from "@/app/components/ui/icons";
import { getLang } from "@/lib/lang";
import { CATEGORY_LABEL, EDITION_NOTICE, builtEditions, library, upcoming, type LibraryCategory } from "@/lib/library";
import { getViewer } from "@/lib/supabase/server";
import { LibraryPicker } from "./picker";

export const metadata: Metadata = {
  title: "Bibliothèque de l'État",
  description: "La Constitution, les codes et les règlements qui fixent les règles de fonctionnement de la Côte d'Ivoire, en éditions POLITIQUE à lire en ligne et à télécharger.",
};

const ORDER: LibraryCategory[] = ["fondamental", "institutions", "elections", "codes"];
const ko = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);

export default async function LibraryPage() {
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const fr = lang === "fr";
  const built = builtEditions.editions as Record<string, { pages: number; bytes: number; articles: number }>;
  const editions = library.filter((e) => e.edition && built[e.id]);

  return (
    <>
      <PageHeader title={fr ? "Bibliothèque" : "Library"} />
      <section className="border-b border-line px-4 pb-5 pt-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-orange">{fr ? "Bibliothèque de l'État" : "State library"}</p>
        <h1 className="mt-1 font-display text-[26px] font-bold leading-tight">{fr ? "Les règles du pays, à portée de main" : "The country's rules, at hand"}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {fr
            ? "La Constitution, les codes et les règlements des institutions. Chaque texte renvoie à sa source officielle ; les éditions POLITIQUE se lisent en ligne et se téléchargent, une par une ou toutes ensemble."
            : "The Constitution, codes and rules of procedure. Each text links its official source; POLITIQUE editions can be read online and downloaded, one by one or all together."}
        </p>
        {editions.length > 0 && (
          <a href="/bibliotheque/politique-bibliotheque.zip" download className="btn-primary mt-4 inline-flex items-center gap-2">
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
            <h2 className="section-title px-4 pb-1 pt-5">{CATEGORY_LABEL[cat][lang]}</h2>
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
        <h2 className="section-title">{fr ? "Bientôt dans la bibliothèque" : "Coming to the library"}</h2>
        <ul className="mt-2 flex flex-wrap gap-2">{upcoming.map((u) => <li key={u} className="rounded-full border border-line px-3.5 py-1.5 text-[14px] font-semibold leading-snug">{u}</li>)}</ul>
      </section>
      <p className="px-4 py-5 text-[12px] leading-relaxed text-muted">{EDITION_NOTICE}</p>
    </>
  );
}
