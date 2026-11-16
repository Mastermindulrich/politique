import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/components/shell/shell";
import { I } from "@/app/components/ui/icons";
import { getLang } from "@/lib/lang";
import { CATEGORY_LABEL, EDITION_NOTICE, articleLabel, builtEditions, library, libraryById, ordinal, sectionLabel, type Edition } from "@/lib/library";
import { getViewer } from "@/lib/supabase/server";
import { GoToArticle } from "./goto";

// Edition texts, loaded only for the page that shows them.
const loadEdition = (id: string) => import(`@/data/library/${id}.json`) as Promise<{ default: unknown }>;

export function generateStaticParams() {
  return library.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = libraryById.get(id);
  if (!e) return { title: "Bibliothèque" };
  return { title: `${e.title} · Bibliothèque`, description: `${e.reference}. ${e.summary}` };
}

const ko = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function LibraryBook({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = libraryById.get(id);
  if (!entry) notFound();
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const fr = lang === "fr";
  const built = (builtEditions.editions as Record<string, { pages: number; bytes: number; articles: number }>)[id];
  const edition = built && entry.edition ? ((await loadEdition(id)).default as Edition) : null;
  // Top-level divisions for the contents: books (livres) when the text has them, else titres.
  const top = edition?.blocks.some((b) => b.type === "livre") ? "livre" : "titre";
  const heads = edition?.blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.type === top) ?? [];
  const lastArticle = edition ? Math.max(...edition.blocks.filter((b) => b.type === "article").map((b) => Number(b.num) || 1)) : 0;

  return (
    <>
      <PageHeader title={entry.short} subtitle={fr ? "Bibliothèque" : "Library"} back="/bibliotheque" />
      <section className="border-b border-line px-4 pb-5 pt-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-orange">{CATEGORY_LABEL[entry.category][lang]}</p>
        <h1 className="mt-1 font-display text-[24px] font-bold leading-tight">{entry.title}</h1>
        <p className="mt-1.5 text-[14px] leading-snug text-muted">{entry.reference}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{entry.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {built ? (
            <a href={`/bibliotheque/${id}.pdf`} download className="btn-primary inline-flex items-center gap-2">
              <I.download className="h-[18px] w-[18px]" />
              {fr ? "Télécharger le PDF" : "Download the PDF"} <span className="font-normal opacity-80">· {ko(built.bytes)}</span>
            </a>
          ) : (
            <span className="chip bg-paper text-muted">{fr ? "Édition POLITIQUE en préparation" : "POLITIQUE edition in preparation"}</span>
          )}
          <a href={entry.officialUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">{fr ? "Texte officiel" : "Official text"} · {entry.officialLabel} ↗</a>
        </div>
        {entry.edition && built && <p className="mt-3 text-[12px] text-muted">{fr ? "Édition POLITIQUE" : "POLITIQUE edition"} · {entry.edition.version} · {built.articles} articles · {built.pages} {fr ? "pages" : "pages"}</p>}
      </section>

      {edition ? (
        <>
          <section className="border-b border-line px-4 py-4">
            <GoToArticle lang={lang} max={lastArticle} />
            <details className="group mt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-bold">
                {fr ? "Sommaire" : "Contents"}
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <ol className="mt-2">
                {edition.blocks.some((b) => b.type === "preambule") && <li><a href="#preambule" className="block border-b border-line py-2 text-[14px] hover:text-green-deep">{fr ? "Préambule" : "Preamble"}</a></li>}
                {heads.map(({ b: t, i }) => (t.type === "titre" || t.type === "livre") && (
                  <li key={i}><a href={`#d-${i}`} className="flex gap-3 border-b border-line py-2 text-[14px] hover:text-green-deep"><span className="w-16 flex-none text-[12px] font-semibold uppercase tracking-wide text-green-deep">{t.type === "livre" ? "Livre" : "Titre"} {t.num}</span>{cap(t.title)}</a></li>
                ))}
              </ol>
            </details>
          </section>
          <div className="px-4 pb-10 pt-2 text-[15.5px] leading-[1.7]">
            {edition.blocks.map((b, i) => {
              if (b.type === "preambule")
                return (
                  <section key={i} id="preambule" className="scroll-mt-20 pt-4">
                    <h2 className="font-display text-[20px] font-bold">{fr ? "Préambule" : "Preamble"}</h2>
                    {b.paras.map((p, j) => <p key={j} className="mt-2">{p}</p>)}
                  </section>
                );
              if (b.type === "livre")
                return (
                  <h2 key={i} id={`d-${i}`} className="mt-12 scroll-mt-20 rounded-[14px] bg-ink px-4 py-5 text-bg">
                    <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-orange">Livre {ordinal(b.num)}</span>
                    <span className="mt-1 block font-display text-[21px] font-bold leading-tight">{cap(b.title)}</span>
                  </h2>
                );
              if (b.type === "section")
                return (
                  <h4 key={i} className="mt-5 text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
                    {sectionLabel(b)} · <span className="normal-case tracking-normal">{b.title}</span>
                  </h4>
                );
              if (b.type === "titre")
                return (
                  <h2 key={i} id={`d-${i}`} className="mt-10 scroll-mt-20 border-t border-line pt-6">
                    <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-orange">Titre {ordinal(b.num)}</span>
                    <span className="mt-1 block font-display text-[20px] font-bold leading-tight">{cap(b.title)}</span>
                  </h2>
                );
              if (b.type === "chapitre")
                return (
                  <h3 key={i} className="mt-6 border-b border-green/50 pb-1.5 font-display text-[16.5px] font-bold">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-green-deep">Chapitre {b.num === "1" ? "premier" : b.num}{b.nouveau ? " (nouveau)" : ""}</span>
                    {b.title}
                  </h3>
                );
              if (b.type === "article")
                return (
                  <article key={i} id={`article-${b.num}`} className="mt-4 scroll-mt-20 rounded-xl transition-shadow">
                    <h4 className="flex items-baseline gap-2 text-[14px] font-bold">
                      <a href={`#article-${b.num}`} className="hover:text-green-deep">{articleLabel(b)}</a>
                    </h4>
                    {b.paras.map((p, j) => <p key={j} className={`mt-1 ${/^[—-] /.test(p) ? "pl-5 -indent-5" : ""}`}>{p}</p>)}
                  </article>
                );
              return <p key={i} className="mt-8 text-right italic text-muted">{b.paras.map((p, j) => <span key={j} className="block">{p}</span>)}</p>;
            })}
          </div>
        </>
      ) : (
        <p className="px-4 py-6 text-[14px] leading-relaxed text-muted">
          {fr
            ? "Nous préparons l'édition POLITIQUE de ce texte, à lire ici et à télécharger. En attendant, le texte officiel est disponible auprès de l'institution qui le publie."
            : "We are preparing the POLITIQUE edition of this text, to read here and download. Meanwhile the official text is available from the institution that publishes it."}{" "}
          <Link href="/bibliotheque" className="font-semibold text-green-deep hover:underline">{fr ? "Retour à la bibliothèque" : "Back to the library"}</Link>
        </p>
      )}
      <p className="border-t border-line px-4 py-5 text-[12px] leading-relaxed text-muted">{EDITION_NOTICE}</p>
    </>
  );
}
