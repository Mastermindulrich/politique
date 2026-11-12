import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarometerVote } from "@/app/components/civic";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { formatDate, t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Barometer } from "@/lib/types";

export const metadata: Metadata = { title: "Baromètre" };

type Row = { commune_id: number | null; commune_name: string; votes: number; counts: number[] };

function Bars({ options, counts, total }: { options: string[]; counts: number[]; total: number }) {
  const max = Math.max(...counts.slice(0, options.length), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {options.map((o, i) => {
        const pct = total ? Math.round((100 * counts[i]) / total) : 0;
        return (
          <li key={i} className="relative h-9 overflow-hidden rounded-lg border border-line text-[14px]">
            <span className={`absolute inset-y-0 left-0 ${counts[i] === max && total > 0 ? "bg-green-soft" : "bg-paper"}`} style={{ width: `${pct}%` }} />
            <span className="relative flex h-full items-center justify-between gap-2 px-3">
              <span className="truncate font-medium">{o}</span>
              <span className="flex-none font-semibold text-muted">{pct} %</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function BarometerPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const lang = viewer.lang;
  const t = dict(lang);
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: current } = await supabase.from("barometers").select("*").lte("opens_at", now).order("month", { ascending: false }).limit(1).maybeSingle();
  const b = current as Barometer | null;

  if (!b) {
    return (
      <>
        <PageHeader title={t.barometer.title} back="/mes-elus" />
        <p className="border-b border-line bg-paper px-4 py-4 text-[14px] leading-relaxed text-muted">{t.barometer.intro}</p>
        <Empty>{t.barometer.none}</Empty>
      </>
    );
  }

  const closed = new Date(b.closes_at) < new Date();
  const { data: myVote } = await supabase.from("barometer_votes").select("option_idx").eq("barometer_id", b.id).eq("user_id", viewer.id).maybeSingle();
  const showResults = Boolean(myVote) || closed;
  let rows: Row[] = [];
  if (showResults) {
    const { data } = await supabase.rpc("barometer_results", { bid: b.id });
    rows = (data ?? []) as Row[];
  }
  const national = rows.find((r) => r.commune_id === null);
  const byCommune = rows.filter((r) => r.commune_id !== null).sort((a, z) => z.votes - a.votes);
  const month = new Date(b.month).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title={t.barometer.title} subtitle={month} back="/mes-elus" />
      <p className="border-b border-line bg-paper px-4 py-4 text-[14px] leading-relaxed text-muted">{t.barometer.intro}</p>
      <section className="border-b border-line px-4 py-5">
        <h2 className="font-display text-[22px] font-bold leading-tight">{b.question}</h2>
        <p className="mt-1 text-[13px] text-muted">{t.barometer.closes} : {formatDate(b.closes_at, lang)}</p>
        <div className="mt-4">
          {showResults ? (
            <>
              {myVote && <p className="mb-3 rounded-xl bg-green-soft px-3 py-2 text-[14px] font-medium text-green-deep">{t.barometer.voted}</p>}
              {national && (
                <>
                  <h3 className="mb-2 text-[14px] font-bold">{t.barometer.national} · {national.votes} {t.post.votes}</h3>
                  <Bars options={b.options} counts={national.counts} total={national.votes} />
                </>
              )}
            </>
          ) : (
            <BarometerVote id={b.id} options={b.options} lang={lang} />
          )}
        </div>
      </section>
      {showResults && (
        <section className="px-4 py-5">
          <h2 className="font-display text-[18px] font-bold">{t.barometer.byCommune}</h2>
          {byCommune.length === 0 ? (
            <p className="mt-2 text-[14px] text-muted">{t.barometer.noCommuneYet}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-5">
              {byCommune.map((r) => (
                <li key={r.commune_id}>
                  <h3 className="mb-2 text-[14px] font-bold">{r.commune_name} · {r.votes} {t.post.votes}</h3>
                  <Bars options={b.options} counts={r.counts} total={r.votes} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
