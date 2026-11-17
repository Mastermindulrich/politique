import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import Link from "next/link";
import { OfficialCard } from "@/app/components/official-card";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { I } from "@/app/components/ui/icons";
import { communes, departments, regions } from "@/lib/ci-geo";
import { attachProfiles } from "@/lib/data/people";
import { t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Institution, Official } from "@/lib/types";

export const metadata: Metadata = { title: "Les élus", description: "L'annuaire des institutions et des élus de Côte d'Ivoire sur POLITIQUE : Présidence, Gouvernement, Assemblée nationale, Sénat, conseils régionaux, mairies et corps préfectoral." };

const PAGE = 50;

// Order of the directory, with the label shown on each section.
const SECTIONS: { key: Institution | "executif"; fr: string; en: string; frLong: string; enLong: string; match: Institution[] }[] = [
  { key: "executif", fr: "Exécutif", en: "Executive", frLong: "Présidence de la République et Gouvernement", enLong: "Presidency and Government", match: ["presidence", "gouvernement"] },
  { key: "assemblee", fr: "Assemblée", en: "Assembly", frLong: "Assemblée nationale", enLong: "National Assembly", match: ["assemblee"] },
  { key: "senat", fr: "Sénat", en: "Senate", frLong: "Sénat", enLong: "Senate", match: ["senat"] },
  { key: "region", fr: "Régions", en: "Regions", frLong: "Districts autonomes et conseils régionaux", enLong: "Autonomous districts and regional councils", match: ["district", "region"] },
  { key: "commune", fr: "Mairies", en: "Town halls", frLong: "Maires des communes", enLong: "Mayors", match: ["commune"] },
  { key: "prefectoral", fr: "Préfectures", en: "Prefectures", frLong: "Corps préfectoral", enLong: "Prefects and sub-prefects", match: ["prefectoral"] },
];

export default async function OfficialsPage({ searchParams }: { searchParams: Promise<{ q?: string; inst?: string; page?: string }> }) {
  const { q: rawQ, inst, page: rawPage } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 80).replace(/[%,()]/g, "");
  const section = SECTIONS.find((s) => s.key === inst) ?? null;
  const page = Math.max(1, Math.min(40, Number(rawPage) || 1));
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const t = dict(lang);
  const fr = lang === "fr";
  const supabase = await createClient();
  const browsing = Boolean(section || q);

  let officials: Official[] = [];
  let more = false;
  let counts: Record<string, number> = {};
  let heads: Official[] = [];

  if (browsing) {
    // Within a section the import's rank gives the protocol order (rank ties: by name).
    let query = supabase.from("officials").select("*");
    if (!section || section.key === "region") query = query.order("institution");
    query = query.order("rank").order("full_name").range((page - 1) * PAGE, page * PAGE);
    if (section) query = query.in("institution", section.match);
    if (q) {
      // Match on name, title, role, party, or a place name resolved to its ids.
      const low = q.toLowerCase();
      const cIds = communes.filter((c) => c.name.toLowerCase().includes(low)).map((c) => c.id);
      const dIds = departments.filter((d) => d.name.toLowerCase().includes(low)).map((d) => d.id);
      const rIds = regions.filter((r) => r.name.toLowerCase().includes(low)).map((r) => r.id);
      const parts = [`full_name.ilike.%${q}%`, `title.ilike.%${q}%`, `role.ilike.%${q}%`, `party.ilike.%${q}%`, `circonscription.ilike.%${q}%`];
      if (cIds.length) parts.push(`commune_id.in.(${cIds.join(",")})`);
      if (dIds.length) parts.push(`department_id.in.(${dIds.join(",")})`);
      if (rIds.length) parts.push(`region_id.in.(${rIds.join(",")})`);
      query = query.or(parts.join(","));
    }
    const { data } = await query;
    const rows = (data ?? []) as Official[];
    more = rows.length > PAGE;
    officials = await attachProfiles(supabase, rows.slice(0, PAGE));
  } else {
    // Landing: the heads of institutions, then one card per section with its size.
    const [headRes, ...countRes] = await Promise.all([
      supabase.from("officials").select("*").in("office_key", ["president-republique", "vice-president-republique", "premier-ministre", "president-assemblee-nationale", "president-senat"]),
      ...SECTIONS.map((s) => supabase.from("officials").select("id", { count: "exact", head: true }).in("institution", s.match)),
    ]);
    const order = ["president-republique", "vice-president-republique", "premier-ministre", "president-assemblee-nationale", "president-senat"];
    heads = await attachProfiles(supabase, ((headRes.data ?? []) as Official[]).sort((a, b) => order.indexOf(a.office_key ?? "") - order.indexOf(b.office_key ?? "")));
    counts = Object.fromEntries(SECTIONS.map((s, i) => [s.key, countRes[i].count ?? 0]));
  }

  const href = (p: { q?: string; inst?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (p.q) sp.set("q", p.q);
    if (p.inst) sp.set("inst", p.inst);
    if (p.page && p.page > 1) sp.set("page", String(p.page));
    const s = sp.toString();
    return s ? `/elus?${s}` : "/elus";
  };

  return (
    <>
      <PageHeader title={t.officials.title} back={viewer ? "/mes-elus" : undefined} />
      <div className="border-b border-line px-4 py-3">
        <p className="text-[14px] leading-relaxed text-muted">
          {fr
            ? "Chaque fonction publique a son compte officiel, au nom de son titulaire actuel. Le compte reste attaché à la fonction et passe au successeur ; le titulaire peut aussi relier son compte personnel."
            : "Every public office has an official account, under its current holder's name. The account stays with the office and passes to the successor; the holder can also link a personal account."}
        </p>
        <form action="/elus" role="search" className="relative mt-3">
          {section && <input type="hidden" name="inst" value={section.key} />}
          <I.search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input type="search" name="q" defaultValue={q} placeholder={t.officials.search} aria-label={t.officials.search} className="search-field" />
        </form>
        <nav aria-label={fr ? "Institutions" : "Institutions"} className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <Link href={href({ q })} className={!section ? "pill-on" : "pill"}>{t.officials.all}</Link>
          {SECTIONS.map((s) => (
            <Link key={s.key} href={href({ q, inst: s.key })} className={section?.key === s.key ? "pill-on" : "pill"}>{fr ? s.fr : s.en}</Link>
          ))}
        </nav>
      </div>

      {!browsing ? (
        <>
          <h2 className="section-title px-4 pb-1 pt-5">{fr ? "À la tête des institutions" : "Heads of institutions"}</h2>
          <ul>{heads.map((o) => <li key={o.id}><OfficialCard o={o} lang={lang} /></li>)}</ul>
          <h2 className="section-title px-4 pb-2 pt-6">{fr ? "Parcourir l'annuaire" : "Browse the directory"}</h2>
          <ul className="grid grid-cols-1 gap-2 px-4 pb-6 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <Link href={href({ inst: s.key })} className="card flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-paper/60">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold">{fr ? s.frLong : s.enLong}</span>
                    <span className="block text-[13px] text-muted">{counts[s.key] ?? 0} {fr ? "comptes officiels" : "official accounts"}</span>
                  </span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] flex-none text-muted/70" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : officials.length === 0 ? (
        <Empty>{t.explore.noResults}</Empty>
      ) : (
        <>
          {section && <h2 className="section-title px-4 pb-1 pt-4">{fr ? section.frLong : section.enLong}</h2>}
          <ul>{officials.map((o) => <li key={o.id}><OfficialCard o={o} lang={lang} /></li>)}</ul>
          {(more || page > 1) && (
            <nav aria-label={fr ? "Pages" : "Pages"} className="flex items-center justify-between px-4 py-4">
              {page > 1 ? <Link href={href({ q, inst: section?.key, page: page - 1 })} className="btn-ghost btn-sm">{fr ? "← Précédents" : "← Previous"}</Link> : <span />}
              <span className="text-[13px] text-muted">{fr ? "Page" : "Page"} {page}</span>
              {more ? <Link href={href({ q, inst: section?.key, page: page + 1 })} className="btn-ghost btn-sm">{fr ? "Suivants →" : "Next →"}</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
