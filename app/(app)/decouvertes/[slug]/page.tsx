import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OfficialCard } from "@/app/components/official-card";
import { PageHeader } from "@/app/components/shell/shell";
import { ShowcaseForm } from "@/app/components/showcase-form";
import { I } from "@/app/components/ui/icons";
import { coverTone, formatPopulation, KINDS, photoUrl, showcaseBySlug, type Photo, type TownHallShowcase } from "@/lib/communes";
import { site } from "@/lib/content";
import { attachProfiles } from "@/lib/data/people";
import { formatDate } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Official } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = showcaseBySlug.get((await params).slug);
  if (!s) return { title: "Découvertes" };
  const cover = s.photos[0];
  return {
    title: `${s.name} · Découvertes`,
    description: `${s.tagline}. ${s.intro}`.slice(0, 200),
    openGraph: { title: `Découvrir ${s.name}`, description: s.tagline, ...(cover ? { images: [{ url: photoUrl(cover, 960) }] } : {}) },
  };
}

/** Author and licence of a photo, as Wikimedia Commons requires. */
function Credit({ p, className = "" }: { p: Photo; className?: string }) {
  return (
    <span className={`text-[11.5px] leading-snug text-muted ${className}`}>
      {"Photo : "}
      <a href={p.page} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:text-ink">{p.artist || "Wikimedia Commons"}</a>
      {p.license ? ` · ${p.license}` : ""}
    </span>
  );
}

export default async function CommuneShowcasePage({ params }: { params: Promise<{ slug: string }> }) {
  const s = showcaseBySlug.get((await params).slug);
  if (!s) notFound();
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const fr = lang === "fr";
  const lowData = Boolean(viewer?.low_data);
  const supabase = await createClient();

  const [hallRes, offRes] = await Promise.all([
    supabase.from("commune_showcases").select("*").eq("commune_id", s.id).maybeSingle(),
    supabase.from("officials").select("*").eq("commune_id", s.id).order("mandate").limit(8),
  ]);
  // Until the table exists (migration 0011) the page simply shows the editorial content.
  const hallReady = !hallRes.error;
  const hall = (hallRes.data ?? null) as TownHallShowcase | null;
  const officials = await attachProfiles(supabase, (offRes.data ?? []) as Official[]);
  const mayor = officials.find((o) => o.mandate === "maire");
  const canEdit = hallReady && Boolean(viewer && (viewer.is_moderator || viewer.is_admin || viewer.is_owner || (mayor && (mayor.profile_id === viewer.id || mayor.personal_profile_id === viewer.id))));
  const hasHall = Boolean(hall && (hall.message || hall.event_title || hall.website));

  const cover = s.photos[0];
  const tagline = hall?.tagline || s.tagline;
  const url = `${site.origin}/decouvertes/${s.slug}`;
  const share = `https://wa.me/?text=${encodeURIComponent(`${s.name} : ${tagline} ${url}`)}`;

  return (
    <>
      <PageHeader title={s.name} subtitle={fr ? "Découvertes" : "Discoveries"} back="/decouvertes" />

      {/* Cover */}
      <div className="relative" style={{ background: coverTone(s.district) }}>
        <div className="relative aspect-[16/10] w-full sm:aspect-[16/9]">
          {cover && !lowData && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(cover, 960)} alt={cover.caption ?? s.name} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-white/85">
              <I.pin className="h-3.5 w-3.5" /> {s.department === s.name ? s.region : `${s.department} · ${s.region}`}
            </p>
            <h2 className="mt-1 font-display text-[30px] font-bold leading-[1.05] tracking-[-0.01em]">{s.name}</h2>
            <p className="mt-1.5 max-w-[460px] text-[15.5px] font-medium leading-snug text-white/95">{tagline}</p>
          </div>
        </div>
      </div>
      {cover && !lowData && <p className="px-4 pt-1.5"><Credit p={cover} /></p>}

      {/* Facts and actions */}
      <div className="border-b border-line px-4 pb-4 pt-3">
        <div className="flex flex-wrap gap-2">
          {s.population && <span className="chip bg-paper text-ink"><I.people className="h-3.5 w-3.5" /> {formatPopulation(s.population.value, lang)} {fr ? "habitants" : "inhabitants"} ({s.population.year})</span>}
          <span className="chip bg-paper text-ink"><I.globe className="h-3.5 w-3.5" /> {fr ? "District" : "District"} {s.district}</span>
          {hall?.tagline && <span className="chip bg-green-soft text-green-deep"><I.check className="h-3.5 w-3.5" /> {fr ? "Page personnalisée par la mairie" : "Personalised by the town hall"}</span>}
        </div>
        <p className="mt-3 text-[15.5px] leading-relaxed">{s.intro}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/explorer?ville=${s.id}`} className="btn-primary btn-sm">{fr ? `Publications à ${s.name}` : `Posts in ${s.name}`}</Link>
          <Link href={`/idees?commune=${s.id}`} className="btn-ghost btn-sm"><I.bulb className="h-4 w-4" /> {fr ? "Boîte à idées" : "Idea box"}</Link>
          <a href={share} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm"><I.whatsapp className="h-4 w-4" /> {fr ? "Partager" : "Share"}</a>
        </div>
      </div>

      {/* The town hall's own words */}
      {(hasHall || canEdit) && (
        <section className="border-b border-line bg-green-soft/30 px-4 py-4">
          <h2 className="section-title flex items-center gap-2"><I.landmark className="h-5 w-5 text-green-deep" /> {fr ? "Le mot de la mairie" : "A word from the town hall"}</h2>
          {hall?.message && <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{hall.message}</p>}
          {hall?.event_title && (
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-line bg-card p-3.5">
              <I.calendar className="mt-0.5 h-5 w-5 flex-none text-orange" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-snug">{hall.event_title}</p>
                {hall.event_date && <p className="text-[13px] font-semibold text-orange">{formatDate(hall.event_date, lang)}</p>}
                {hall.event_text && <p className="mt-1 text-[14px] leading-snug text-muted">{hall.event_text}</p>}
              </div>
            </div>
          )}
          {hall?.website && (
            <a href={hall.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-green-deep hover:underline">
              <I.globe className="h-4 w-4" /> {hall.website.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          )}
          {!hasHall && <p className="mt-2 text-[14px] leading-relaxed text-muted">{fr ? "Ajoutez votre mot d'accueil, votre prochain événement et le site de la mairie." : "Add your welcome word, your next event and the town hall website."}</p>}
          {canEdit && <div className="mt-3"><ShowcaseForm communeId={s.id} name={s.name} initial={hall} lang={lang} /></div>}
        </section>
      )}

      {/* What the commune has to offer */}
      {s.highlights.length > 0 && (
        <section className="border-b border-line px-4 py-4">
          <h2 className="section-title">{fr ? `Ce que ${s.name} a de spécial` : `What makes ${s.name} special`}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {s.highlights.map((h) => {
              const p = h.photo !== undefined ? s.photos[h.photo] : undefined;
              return (
                <li key={h.t} className="overflow-hidden rounded-2xl border border-line">
                  {p && !lowData && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl(p, 960)} alt={p.caption ?? h.t} loading="lazy" decoding="async" className="aspect-[16/9] w-full object-cover" />
                  )}
                  <div className="p-3.5">
                    <span className={`chip ${KINDS[h.k].tone}`}>{KINDS[h.k][lang]}</span>
                    <h3 className="mt-1.5 font-display text-[17px] font-bold leading-snug">{h.t}</h3>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{h.d}</p>
                    {p && !lowData && <Credit p={p} className="mt-2 block" />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {s.products.length > 0 && (
        <section className="border-b border-line px-4 py-4">
          <h2 className="section-title">{fr ? "Produits et savoir-faire" : "Products and know-how"}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {s.products.map((p) => <li key={p} className="rounded-full border border-line bg-paper/60 px-3.5 py-1.5 text-[14px] font-semibold">{p}</li>)}
          </ul>
        </section>
      )}

      {s.events.length > 0 && (
        <section className="border-b border-line px-4 py-4">
          <h2 className="section-title">{fr ? "Les rendez-vous" : "Dates to remember"}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {s.events.map((e) => (
              <li key={e.t} className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-orange-soft text-orange"><I.calendar className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-snug">{e.t}</span>
                  <span className="block text-[13px] font-semibold text-orange">{e.when}</span>
                  <span className="mt-0.5 block text-[14px] leading-snug text-muted">{e.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.photos.length > 1 && !lowData && (
        <section className="border-b border-line px-4 py-4">
          <h2 className="section-title">{fr ? "En images" : "In pictures"}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {s.photos.map((p) => (
              <li key={p.file} className="min-w-0">
                <a href={p.page} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl(p, 500)} alt={p.caption ?? s.name} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover transition-transform duration-300 hover:scale-[1.03]" />
                </a>
                {p.caption && <p className="mt-1.5 text-[13px] font-medium leading-snug">{p.caption}</p>}
                <Credit p={p} className="block" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Who runs the commune */}
      <section className="border-b border-line">
        <div className="flex items-baseline justify-between px-4 pt-4">
          <h2 className="section-title">{fr ? `Les élus de ${s.name}` : `${s.name}'s officials`}</h2>
          <Link href={`/elus?q=${encodeURIComponent(s.name)}`} className="text-[14px] font-semibold text-green-deep">{fr ? "Voir plus" : "Show more"}</Link>
        </div>
        {officials.length === 0 ? (
          <p className="px-4 py-4 text-[14px] text-muted">{fr ? "Les élus de cette commune apparaîtront ici." : "This commune's officials will appear here."}</p>
        ) : (
          <ul className="mt-1">{officials.map((o) => <li key={o.id}><OfficialCard o={o} lang={lang} /></li>)}</ul>
        )}
      </section>

      {!hasHall && !canEdit && (
        <section className="border-b border-line px-4 py-4">
          <div className="rounded-2xl bg-paper px-4 py-3.5">
            <h2 className="font-display text-[16px] font-bold">{fr ? `Vous représentez la mairie de ${s.name} ?` : `Do you represent ${s.name}'s town hall?`}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              {fr
                ? "Le maire dont le compte est certifié peut ajouter ici son mot d'accueil, le prochain événement de la commune et son site officiel."
                : "A mayor with a verified account can add a welcome word, the commune's next event and its official website here."}
            </p>
            <Link href={viewer ? "/parametres#verification" : "/inscription"} className="mt-2 inline-block text-[14px] font-semibold text-green-deep hover:underline">{fr ? "Faire certifier mon compte" : "Get my account verified"}</Link>
          </div>
        </section>
      )}

      <section className="px-4 py-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted">Sources</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {s.sources.map((x) => (
            <li key={x.u}><a href={x.u} target="_blank" rel="noopener noreferrer" className="text-muted underline decoration-line underline-offset-2 hover:text-ink">{x.l}</a></li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          {fr
            ? "Présentation rédigée par POLITIQUE à partir de sources publiques. Les photos viennent de Wikimedia Commons et restent la propriété de leurs auteurs."
            : "Presentation written by POLITIQUE from public sources (in French). Photos come from Wikimedia Commons and remain the property of their authors."}
        </p>
      </section>
    </>
  );
}
