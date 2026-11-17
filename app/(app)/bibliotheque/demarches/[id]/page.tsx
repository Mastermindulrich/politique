import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/components/shell/shell";
import { I } from "@/app/components/ui/icons";
import { THEMES, demarcheById, demarches } from "@/lib/demarches";
import { getLang } from "@/lib/lang";
import { getViewer } from "@/lib/supabase/server";
import { ModeBadge, ThemeIcon } from "../ui";

export function generateStaticParams() {
  return demarches.map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = demarcheById.get(id);
  if (!d) return { title: "Démarches" };
  return { title: `${d.title} · Démarches`, description: d.summary };
}

export default async function DemarchePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = demarcheById.get(id);
  if (!d) notFound();
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const fr = lang === "fr";
  const facts = [
    { k: fr ? "Coût" : "Cost", v: d.cost },
    { k: fr ? "Délai" : "Delay", v: d.delay },
    { k: fr ? "Où" : "Where", v: d.where },
    { k: fr ? "Service" : "Office", v: d.organisme },
  ].filter((f) => f.v);

  return (
    <>
      <PageHeader title={fr ? "Démarche" : "Procedure"} back="/bibliotheque/demarches" />
      <article className="px-4 pb-6 pt-4">
        <Link href={`/bibliotheque/demarches#${d.theme}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-orange">
          <ThemeIcon theme={d.theme} className="h-4 w-4" />
          {fr ? THEMES[d.theme].fr : THEMES[d.theme].en}
        </Link>
        <h1 className="mt-1.5 font-display text-[26px] font-bold leading-tight">{d.title}</h1>
        <div className="mt-2"><ModeBadge mode={d.mode} lang={lang} /></div>
        <p className="mt-3 text-[15px] leading-relaxed">{d.summary}</p>

        <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 flex w-full items-center justify-center gap-2">
          <I.globe className="h-5 w-5" />
          {d.urlLabel}
        </a>

        {facts.length > 0 && (
          <dl className="card mt-5 divide-y divide-line p-0">
            {facts.map((f) => (
              <div key={f.k} className="px-4 py-3">
                <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{f.k}</dt>
                <dd className="mt-0.5 text-[15px] leading-snug">{f.v}</dd>
              </div>
            ))}
          </dl>
        )}

        {d.pieces && d.pieces.length > 0 && (
          <section className="mt-6">
            <h2 className="section-title flex items-center gap-2"><I.clip className="h-5 w-5 text-green-deep" />{fr ? "Ce qu'il faut apporter" : "What to bring"}</h2>
            <ul className="mt-2 grid gap-2">
              {d.pieces.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[15px] leading-snug">
                  <I.check className="mt-0.5 h-4 w-4 flex-none text-green-deep" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.steps && d.steps.length > 0 && (
          <section className="mt-6">
            <h2 className="section-title">{fr ? "Étapes" : "Steps"}</h2>
            <ol className="mt-2 grid gap-3">
              {d.steps.map((s, i) => (
                <li key={s} className="flex items-start gap-3 text-[15px] leading-snug">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ink text-[12px] font-bold text-bg">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {d.links && d.links.length > 0 && (
          <section className="mt-6">
            <h2 className="section-title">{fr ? "Liens utiles" : "Useful links"}</h2>
            <ul className="mt-2 grid gap-2">
              {d.links.map((l) => (
                <li key={l.u}>
                  <a href={l.u} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3.5 py-3 text-[15px] font-semibold hover:bg-paper/60">
                    {l.l}
                    <I.share className="h-4 w-4 flex-none text-muted" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.note && <p className="mt-6 rounded-2xl bg-paper px-4 py-3 text-[14px] leading-relaxed">{d.note}</p>}

        <footer className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
          <p>{fr ? "Source" : "Source"} : <a href={d.source} target="_blank" rel="noopener noreferrer" className="break-all underline">{d.source.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a></p>
          <p className="mt-1">{fr ? `Vérifié le ${d.checked}.` : `Checked on ${d.checked}.`} {fr ? "Les montants, délais et pièces peuvent changer : confirmez auprès du service avant de vous déplacer. POLITIQUE n'est pas un service de l'État et ne collecte aucun paiement." : "Fees, delays and documents can change: confirm with the office before going. POLITIQUE is not a government service and collects no payment."}</p>
          <Link href="/bibliotheque/demarches" className="mt-3 inline-block font-semibold text-green-deep hover:underline">{fr ? "← Toutes les démarches" : "← All procedures"}</Link>
        </footer>
      </article>
    </>
  );
}
