import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { I } from "@/app/components/ui/icons";
import { communeSlug, coverTone, districts, fold, photoUrl, showcaseById, showcases, type Showcase } from "@/lib/communes";
import { getMyPrivate } from "@/lib/data/people";
import { getLang } from "@/lib/lang";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Découvertes",
  description: "La vitrine de chaque commune de Côte d'Ivoire : sites à visiter, culture, saveurs, fêtes et produits du terroir.",
};

/** The cover of a commune: its first photo, or the colours of its district when it has none yet. */
function Cover({ s, lowData, className = "" }: { s: Showcase; lowData: boolean; className?: string }) {
  const p = s.photos[0];
  return (
    <span className={`relative block overflow-hidden ${className}`} style={{ background: coverTone(s.district) }}>
      {p && !lowData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl(p, 500)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <I.pin className="absolute right-3 top-3 h-5 w-5 text-white/50" />
      )}
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
    </span>
  );
}

function Card({ s, lowData, wide = false }: { s: Showcase; lowData: boolean; wide?: boolean }) {
  return (
    <Link href={`/decouvertes/${s.slug}`} prefetch={false} className={`tap group relative block overflow-hidden rounded-2xl border border-line ${wide ? "w-[250px] flex-none" : ""}`}>
      <Cover s={s} lowData={lowData} className={wide ? "h-[190px]" : "h-[150px]"} />
      <span className="absolute inset-x-0 bottom-0 p-3 text-white">
        <span className="block truncate font-display text-[17px] font-bold leading-tight">{s.name}</span>
        <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-white/90">{s.tagline}</span>
      </span>
    </Link>
  );
}

export default async function DiscoveriesPage({ searchParams }: { searchParams: Promise<{ commune?: string; district?: string; q?: string }> }) {
  const { commune, district: rawDistrict, q: rawQ } = await searchParams;
  if (commune && showcaseById.has(Number(commune))) redirect(`/decouvertes/${communeSlug(Number(commune))}`);
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const fr = lang === "fr";
  const lowData = Boolean(viewer?.low_data);
  const priv = viewer ? await getMyPrivate().catch(() => null) : null;
  const mine = showcaseById.get(priv?.vote_commune_id ?? viewer?.shown_commune_id ?? -1);

  const district = districts.includes(rawDistrict ?? "") ? rawDistrict! : null;
  const q = fold((rawQ ?? "").trim().slice(0, 60));
  const list = showcases
    .filter((s) => (!district || s.district === district) && (!q || fold(`${s.name} ${s.department} ${s.region} ${s.tagline}`).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const featured = showcases.filter((s) => s.featured && s.photos.length);
  const browsing = !district && !q;

  return (
    <>
      <PageHeader title={fr ? "Découvertes" : "Discoveries"} subtitle={fr ? `${showcases.length} communes, chacune sa vitrine` : `${showcases.length} communes, each with its showcase`} />
      <div className="border-b border-line px-4 py-3.5">
        <p className="text-[14px] leading-relaxed text-muted">
          {fr
            ? "Ce que chaque commune a de spécial à offrir : ses sites, sa culture, ses saveurs, ses fêtes et ses produits. Les mairies présentes sur POLITIQUE y ajoutent leur touche personnelle."
            : "What makes each commune special: its sights, culture, flavours, festivals and products. Town halls on POLITIQUE add their personal touch."}
        </p>
        <form action="/decouvertes" className="mt-3 flex gap-2">
          <label className="flex-1">
            <span className="sr-only">{fr ? "Chercher une commune" : "Search a commune"}</span>
            <input name="q" type="search" defaultValue={rawQ ?? ""} placeholder={fr ? "Chercher une commune, une région…" : "Search a commune, a region…"} className="input h-11" />
          </label>
          {district && <input type="hidden" name="district" value={district} />}
          <button type="submit" className="btn-ghost h-11">OK</button>
        </form>
        <nav aria-label={fr ? "Par district" : "By district"} className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5">
          <Link href="/decouvertes" className={browsing ? "pill-on" : "pill"}>{fr ? "Tout le pays" : "Whole country"}</Link>
          {districts.map((d) => (
            <Link key={d} href={`/decouvertes?district=${encodeURIComponent(d)}`} className={district === d ? "pill-on" : "pill"}>{d}</Link>
          ))}
        </nav>
      </div>

      {browsing && mine && (
        <section className="border-b border-line px-4 py-4">
          <h2 className="section-title">{fr ? "Votre commune" : "Your commune"}</h2>
          <Link href={`/decouvertes/${mine.slug}`} className="tap mt-3 flex items-center gap-3 rounded-2xl border border-line p-2.5 hover:bg-paper/60">
            <Cover s={mine} lowData={lowData} className="h-[72px] w-[96px] flex-none rounded-xl" />
            <span className="min-w-0">
              <span className="block font-display text-[17px] font-bold">{mine.name}</span>
              <span className="line-clamp-2 text-[13.5px] leading-snug text-muted">{mine.tagline}</span>
            </span>
          </Link>
        </section>
      )}

      {browsing && featured.length > 0 && (
        <section className="border-b border-line py-4">
          <h2 className="section-title px-4">{fr ? "À la une" : "In the spotlight"}</h2>
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {featured.map((s) => <Card key={s.id} s={s} lowData={lowData} wide />)}
          </div>
        </section>
      )}

      <section className="px-4 py-4">
        <h2 className="section-title">
          {district ?? (fr ? "Toutes les communes" : "All communes")}
          <span className="ml-2 text-[14px] font-medium text-muted">{list.length}</span>
        </h2>
        {list.length === 0 ? (
          <Empty>{fr ? "Aucune commune ne correspond à cette recherche." : "No commune matches this search."}</Empty>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {list.map((s) => <li key={s.id}><Card s={s} lowData={lowData} /></li>)}
          </ul>
        )}
      </section>
    </>
  );
}
