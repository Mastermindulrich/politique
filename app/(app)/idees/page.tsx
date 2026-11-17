import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import Link from "next/link";
import { PropositionForm, PropositionStatus, PropositionVote } from "@/app/components/civic";
import { StatusChip } from "@/app/components/official-card";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { communeById, communes } from "@/lib/ci-geo";
import { fetchAuthors } from "@/lib/data/people";
import { t as dict, timeAgo } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Proposition } from "@/lib/types";

export const metadata: Metadata = { title: "Boîte à idées" };

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ commune?: string }> }) {
  const { commune } = await searchParams;
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const t = dict(lang);
  const supabase = await createClient();
  const communeId = commune && communeById.has(Number(commune)) ? Number(commune) : viewer?.shown_commune_id ?? null;
  const name = communeId ? communeById.get(communeId)?.name : null;

  let rows: Proposition[] = [];
  let voted = new Set<string>();
  let canManage = Boolean(viewer?.is_moderator || viewer?.is_admin);
  if (communeId) {
    const { data } = await supabase.from("propositions").select("*").eq("commune_id", communeId).order("votes_count", { ascending: false }).order("created_at", { ascending: false }).limit(60);
    rows = (data ?? []) as Proposition[];
    if (viewer) {
      const [v, o] = await Promise.all([
        rows.length ? supabase.from("proposition_votes").select("proposition_id").eq("user_id", viewer.id).in("proposition_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] }),
        supabase.from("officials").select("id").eq("profile_id", viewer.id).eq("commune_id", communeId).limit(1),
      ]);
      voted = new Set(((v.data ?? []) as { proposition_id: string }[]).map((x) => x.proposition_id));
      if ((o.data ?? []).length) canManage = true;
    }
  }
  const authors = await fetchAuthors(supabase, rows.map((r) => r.author_id));

  return (
    <>
      <PageHeader title={t.ideas.title} subtitle={name ?? undefined} back={viewer ? "/mes-elus" : "/explorer"} />
      <div className="border-b border-line px-4 py-3.5">
        <p className="text-[14px] leading-relaxed text-muted">{t.ideas.intro}</p>
        <form action="/idees" className="mt-3 flex gap-2">
          <label className="flex-1">
            <span className="sr-only">{t.ideas.commune}</span>
            <select name="commune" className="select h-11" defaultValue={communeId ?? ""}>
              <option value="" disabled>{t.explore.chooseCity}</option>
              {[...communes].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-ghost h-11">OK</button>
        </form>
      </div>
      <div className="flex justify-end border-b border-line px-4 py-3">
        <PropositionForm communeId={communeId} lang={lang} signedIn={Boolean(viewer)} />
      </div>
      {!communeId ? (
        <Empty>{lang === "fr" ? "Choisissez une commune pour voir sa boîte à idées." : "Choose a commune to see its idea box."}</Empty>
      ) : rows.length === 0 ? (
        <Empty>{t.ideas.empty}</Empty>
      ) : (
        <ul>
          {rows.map((r) => {
            const a = authors.get(r.author_id);
            return (
              <li key={r.id} className="flex gap-3 border-b border-line px-4 py-4">
                <PropositionVote id={r.id} initial={voted.has(r.id)} count={r.votes_count} lang={lang} signedIn={Boolean(viewer)} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[16px] font-semibold leading-snug">{r.title}</h2>
                  <p className="mt-1 whitespace-pre-wrap text-[14px] text-muted">{r.body}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                    {canManage ? <PropositionStatus id={r.id} status={r.status} lang={lang} /> : <StatusChip status={r.status} label={t.ideas.status[r.status]} />}
                    {a && <Link href={`/u/${a.handle}`} className="hover:underline">@{a.handle}</Link>}
                    <span>· {timeAgo(r.created_at, lang)}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
