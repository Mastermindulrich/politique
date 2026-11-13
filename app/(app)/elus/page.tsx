import type { Metadata } from "next";
import Link from "next/link";
import { OfficialCard } from "@/app/components/official-card";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { I } from "@/app/components/ui/icons";
import { communes, departments, regions } from "@/lib/ci-geo";
import { attachProfiles } from "@/lib/data/people";
import { t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Mandate, Official } from "@/lib/types";

export const metadata: Metadata = { title: "Les élus", description: "L'annuaire des élus de Côte d'Ivoire sur POLITIQUE : interpellations, promesses, permanences." };

const MANDATES: Mandate[] = ["maire", "depute", "senateur", "president_conseil_regional", "gouverneur_district", "ministre", "president"];

export default async function OfficialsPage({ searchParams }: { searchParams: Promise<{ q?: string; mandat?: string }> }) {
  const { q: rawQ, mandat } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 80).replace(/[%,()]/g, "");
  const mandate = MANDATES.includes(mandat as Mandate) ? (mandat as Mandate) : null;
  const viewer = await getViewer();
  const lang = viewer?.lang ?? "fr";
  const t = dict(lang);
  const supabase = await createClient();

  let query = supabase.from("officials").select("*").order("claimed_at", { ascending: false, nullsFirst: false }).order("full_name").limit(100);
  if (mandate) query = query.eq("mandate", mandate);
  if (q) {
    // Match on name, title, party, or a place name resolved to its ids.
    const low = q.toLowerCase();
    const cIds = communes.filter((c) => c.name.toLowerCase().includes(low)).map((c) => c.id);
    const dIds = departments.filter((d) => d.name.toLowerCase().includes(low)).map((d) => d.id);
    const rIds = regions.filter((r) => r.name.toLowerCase().includes(low)).map((r) => r.id);
    const parts = [`full_name.ilike.%${q}%`, `title.ilike.%${q}%`, `party.ilike.%${q}%`];
    if (cIds.length) parts.push(`commune_id.in.(${cIds.join(",")})`);
    if (dIds.length) parts.push(`department_id.in.(${dIds.join(",")})`);
    if (rIds.length) parts.push(`region_id.in.(${rIds.join(",")})`);
    query = query.or(parts.join(","));
  }
  const { data } = await query;
  const officials = await attachProfiles(supabase, (data ?? []) as Official[]);

  return (
    <>
      <PageHeader title={t.officials.title} back={viewer ? "/mes-elus" : undefined} />
      <div className="border-b border-line px-4 py-3">
        <p className="text-[14px] text-muted">{t.officials.intro}</p>
        <form action="/elus" role="search" className="relative mt-3">
          {mandate && <input type="hidden" name="mandat" value={mandate} />}
          <I.search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input type="search" name="q" defaultValue={q} placeholder={t.officials.search} aria-label={t.officials.search} className="h-11 w-full rounded-full border border-transparent bg-paper pl-11 pr-4 text-[15px] placeholder:text-muted focus:border-green focus:bg-card focus:outline-none" />
        </form>
        <nav aria-label={t.officials.filterMandate} className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={q ? `/elus?q=${encodeURIComponent(q)}` : "/elus"} className={`chip h-8 flex-none px-3 ${!mandate ? "bg-ink text-bg" : "bg-paper text-ink"}`}>{t.officials.all}</Link>
          {MANDATES.map((m) => (
            <Link key={m} href={`/elus?mandat=${m}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`chip h-8 flex-none px-3 ${mandate === m ? "bg-ink text-bg" : "bg-paper text-ink"}`}>
              {t.officials.mandates[m]}
            </Link>
          ))}
        </nav>
      </div>
      {officials.length === 0 ? (
        <Empty>{q || mandate ? t.explore.noResults : lang === "fr" ? "L'annuaire est en cours de constitution. Les premiers mandats arrivent avec la bêta." : "The directory is being built. The first mandates arrive with the beta."}</Empty>
      ) : (
        <ul>{officials.map((o) => <li key={o.id}><OfficialCard o={o} lang={lang} /></li>)}</ul>
      )}
    </>
  );
}
