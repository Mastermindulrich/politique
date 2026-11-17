import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OfficialCard, StatusChip } from "@/app/components/official-card";
import { PageHeader } from "@/app/components/shell/shell";
import { I } from "@/app/components/ui/icons";
import { communeLabel, regionById, departmentById } from "@/lib/ci-geo";
import { attachProfiles, getMyPrivate } from "@/lib/data/people";
import { t as dict, formatDate } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Barometer, Interpellation, Official, Permanence } from "@/lib/types";

export const metadata: Metadata = { title: "Mes élus" };

export default async function MyOfficialsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const lang = viewer.lang;
  const t = dict(lang);
  const supabase = await createClient();
  const priv = await getMyPrivate();
  const place = communeLabel(priv?.vote_commune_id);
  const placeText = place
    ? `${place.commune} · ${place.region}`
    : priv?.vote_department_id
      ? departmentById.get(priv.vote_department_id)?.name
      : priv?.vote_region_id
        ? regionById.get(priv.vote_region_id)?.name
        : null;

  // The match happens inside the database function; nothing about the place leaves this request.
  const { data: mine } = await supabase.rpc("my_officials");
  const officials = await attachProfiles(supabase, (mine ?? []) as Official[]);
  const ids = officials.map((o) => o.id);

  const [interRes, permRes, baroRes] = await Promise.all([
    ids.length ? supabase.from("interpellations").select("*").in("official_id", ids).eq("status", "ouverte").order("upvotes_count", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("permanences").select("*").in("official_id", ids).in("status", ["planifiee", "en_cours"]).order("starts_at").limit(3) : Promise.resolve({ data: [] }),
    supabase.from("barometers").select("*").lte("opens_at", new Date().toISOString()).gte("closes_at", new Date().toISOString()).order("month", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const interpellations = (interRes.data ?? []) as Interpellation[];
  const permanences = (permRes.data ?? []) as Permanence[];
  const barometer = baroRes.data as Barometer | null;
  const byId = new Map(officials.map((o) => [o.id, o]));

  return (
    <>
      <PageHeader title={t.myOfficials.title} />
      <div className="border-b border-line px-4 py-3.5">
        <p className="text-[14px] leading-relaxed text-muted">{t.myOfficials.intro}</p>
        {placeText && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl bg-paper px-3.5 py-3 text-[14px]">
            <I.pin className="h-4 w-4 text-green-deep" />
            <span>{t.myOfficials.yourVotingPlace} <b>{placeText}</b></span>
            <span className="chip bg-bg text-muted">{t.myOfficials.privateNote}</span>
            <Link href="/parametres#vote" className="font-semibold text-green-deep hover:underline">{t.common.edit}</Link>
          </p>
        )}
      </div>

      {officials.length === 0 ? (
        <p className="border-b border-line px-6 py-10 text-center text-[15px] text-muted">{placeText ? t.myOfficials.none : t.myOfficials.setLocation}</p>
      ) : (
        <ul>{officials.map((o) => <li key={o.id}><OfficialCard o={o} lang={lang} /></li>)}</ul>
      )}

      {permanences.length > 0 && (
        <section className="border-b border-line">
          <h2 className="px-4 pt-4 font-display text-[18px] font-bold">{t.permanence.upcoming}</h2>
          <ul>
            {permanences.map((p) => (
              <li key={p.id}>
                <Link href={p.post_id ? `/p/${p.post_id}` : `/elus/${p.official_id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-paper/60">
                  <I.calendar className="mt-0.5 h-5 w-5 flex-none text-green-deep" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[15px] font-bold">{p.title} <StatusChip status={p.status} label={t.permanence.status[p.status]} /></span>
                    <span className="block text-[13px] text-muted">{byId.get(p.official_id)?.full_name} · {formatDate(p.starts_at, lang, true)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {interpellations.length > 0 && (
        <section className="border-b border-line">
          <h2 className="px-4 pt-4 font-display text-[18px] font-bold">{t.myOfficials.interpellations}</h2>
          <ul>
            {interpellations.map((i) => (
              <li key={i.id}>
                <Link href={`/interpellations/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper/60">
                  <span className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-xl border border-line text-[13px] font-bold">{i.upvotes_count}</span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-snug">{i.title}</span>
                    <span className="block truncate text-[13px] text-muted">→ {byId.get(i.official_id)?.full_name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <Link href="/barometre" className="rounded-2xl border border-line p-4 hover:bg-paper/60">
          <I.chart className="h-6 w-6 text-green-deep" />
          <h2 className="mt-2 font-display text-[17px] font-bold">{t.myOfficials.barometer}</h2>
          <p className="mt-1 text-[14px] text-muted">{barometer ? barometer.question : t.barometer.none}</p>
        </Link>
        <Link href={priv?.vote_commune_id ? `/idees?commune=${priv.vote_commune_id}` : "/idees"} className="rounded-2xl border border-line p-4 hover:bg-paper/60">
          <I.bulb className="h-6 w-6 text-orange" />
          <h2 className="mt-2 font-display text-[17px] font-bold">{t.myOfficials.ideas}</h2>
          <p className="mt-1 text-[14px] text-muted">{t.ideas.intro}</p>
        </Link>
        <Link href="/elus" className="rounded-2xl border border-line p-4 hover:bg-paper/60 sm:col-span-2">
          <I.landmark className="h-6 w-6 text-green-deep" />
          <h2 className="mt-2 font-display text-[17px] font-bold">{t.officials.title}</h2>
          <p className="mt-1 text-[14px] text-muted">{t.officials.intro}</p>
        </Link>
      </div>
    </>
  );
}
