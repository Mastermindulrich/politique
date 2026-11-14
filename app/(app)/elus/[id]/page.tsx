import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InterpellationForm, InterpellationVote, PermanenceControls, PermanenceForm, PromiseForm, PromiseUpdateForm } from "@/app/components/civic";
import { FollowButton } from "@/app/components/follow-button";
import { StatusChip } from "@/app/components/official-card";
import { PostCard } from "@/app/components/post/post-card";
import { Empty, PageHeader, Tabs } from "@/app/components/shell/shell";
import { Avatar } from "@/app/components/ui/avatar";
import { NameBadge } from "@/app/components/ui/badge";
import { I } from "@/app/components/ui/icons";
import * as geo from "@/lib/ci-geo";
import { attachProfiles, fetchAuthors, officialPlace } from "@/lib/data/people";
import { fetchProfilePosts } from "@/lib/data/posts";
import { formatDate, t as dict, timeAgo } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Interpellation, Official, Permanence, Promise_ } from "@/lib/types";

type Tab = "interpellations" | "promesses" | "permanences" | "posts";
type PromiseUpdate = { id: string; promise_id: string; author_id: string; new_status: Promise_["status"] | null; text: string; source_url: string | null; created_at: string };

async function getOfficial(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("officials").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const [o] = await attachProfiles(supabase, [data as Official]);
  return o;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const o = await getOfficial(id);
  if (!o) return { title: "Élu" };
  return { title: `${o.full_name} — ${o.title ?? "Élu"}`, description: `Interpellations, promesses et permanences de ${o.full_name} sur POLITIQUE.` };
}

export default async function OfficialPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; tri?: string }> }) {
  const { id } = await params;
  const { tab: rawTab, tri } = await searchParams;
  const tab: Tab = rawTab === "promesses" || rawTab === "permanences" || rawTab === "posts" ? rawTab : "interpellations";
  const o = await getOfficial(id);
  if (!o) notFound();
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const t = dict(lang);
  const supabase = await createClient();
  const isOfficial = Boolean(viewer && o.profile_id === viewer.id);
  const isMod = Boolean(viewer?.is_moderator || viewer?.is_admin);
  const canSetStatus = isOfficial || isMod || Boolean(viewer?.verified && viewer.account_type === "media");

  const [countRes, followRes, statsRes] = await Promise.all([
    supabase.rpc("official_constituents_count", { oid: o.id }),
    viewer && o.profile_id && !isOfficial ? supabase.from("follows").select("follower_id").eq("follower_id", viewer.id).eq("followee_id", o.profile_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("interpellations").select("status").eq("official_id", o.id),
  ]);
  const constituents = countRes.data as number | null;
  const all = (statsRes.data ?? []) as { status: Interpellation["status"] }[];
  const answered = all.filter((x) => x.status === "repondue").length;
  const open = all.filter((x) => x.status === "ouverte").length;
  const rate = answered + open > 0 ? Math.round((100 * answered) / (answered + open)) : null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "interpellations", label: t.officials.interpellations },
    { key: "promesses", label: t.officials.promises },
    { key: "permanences", label: t.officials.permanences },
    ...(o.profile_id ? [{ key: "posts" as const, label: t.profile.posts }] : []),
  ];

  let body: React.ReactNode = null;

  if (tab === "interpellations") {
    const sortNew = tri === "recentes";
    let q = supabase.from("interpellations").select("*").eq("official_id", o.id).limit(50);
    q = sortNew ? q.order("created_at", { ascending: false }) : q.order("status").order("upvotes_count", { ascending: false });
    const { data } = await q;
    const rows = (data ?? []) as Interpellation[];
    const [authors, votesRes] = await Promise.all([
      fetchAuthors(supabase, rows.map((r) => r.author_id)),
      viewer && rows.length ? supabase.from("interpellation_votes").select("interpellation_id").eq("user_id", viewer.id).in("interpellation_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] }),
    ]);
    const voted = new Set(((votesRes.data ?? []) as { interpellation_id: string }[]).map((v) => v.interpellation_id));
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex gap-2 text-[13px] font-semibold">
            <Link href={`/elus/${o.id}`} className={!sortNew ? "pill-on" : "pill"}>{t.interpellation.sortTop}</Link>
            <Link href={`/elus/${o.id}?tri=recentes`} className={sortNew ? "pill-on" : "pill"}>{t.interpellation.sortNew}</Link>
          </div>
          {!isOfficial && <InterpellationForm officialId={o.id} lang={lang} signedIn={Boolean(viewer)} />}
        </div>
        {rows.length === 0 ? (
          <Empty>{t.officials.noInterpellations}</Empty>
        ) : (
          <ul>
            {rows.map((r) => {
              const a = authors.get(r.author_id);
              return (
                <li key={r.id} className="flex gap-3 border-b border-line px-4 py-3">
                  <InterpellationVote id={r.id} initial={voted.has(r.id)} count={r.upvotes_count} lang={lang} signedIn={Boolean(viewer)} disabled={r.status !== "ouverte"} />
                  <Link href={`/interpellations/${r.id}`} className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold leading-snug hover:underline">{r.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                      <StatusChip status={r.status} label={t.interpellation.status[r.status]} />
                      {a && <span>@{a.handle}</span>}
                      <span>· {timeAgo(r.created_at, lang)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  if (tab === "promesses") {
    const { data } = await supabase.from("promises").select("*").eq("official_id", o.id).order("created_at", { ascending: false }).limit(50);
    const rows = (data ?? []) as Promise_[];
    const { data: upd } = rows.length ? await supabase.from("promise_updates").select("*").in("promise_id", rows.map((r) => r.id)).order("created_at", { ascending: false }).limit(200) : { data: [] };
    const updates = (upd ?? []) as PromiseUpdate[];
    const authors = await fetchAuthors(supabase, updates.map((u) => u.author_id));
    const kept = rows.filter((r) => r.status === "tenue" || r.status === "partiellement_tenue").length;
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="text-[14px] text-muted">{rows.length > 0 ? (lang === "fr" ? `${kept} tenue${kept > 1 ? "s" : ""} sur ${rows.length} suivie${rows.length > 1 ? "s" : ""}` : `${kept} kept out of ${rows.length} tracked`) : ""}</p>
          <PromiseForm officialId={o.id} lang={lang} signedIn={Boolean(viewer)} />
        </div>
        {rows.length === 0 ? (
          <Empty>{t.officials.noPromises}</Empty>
        ) : (
          <ul>
            {rows.map((p) => (
              <li key={p.id} className="border-b border-line px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={p.status} label={t.promises.status[p.status]} />
                  <span className={`text-[12px] font-semibold ${p.verified_by ? "text-green-deep" : "text-muted"}`}>{p.verified_by ? t.promises.verified : t.promises.unverified}</span>
                </div>
                <h3 className="mt-2 text-[16px] font-semibold leading-snug">{p.title}</h3>
                {p.description && <p className="mt-1 whitespace-pre-wrap text-[14px] text-muted">{p.description}</p>}
                <p className="mt-2 flex flex-wrap gap-x-3 text-[13px] text-muted">
                  {p.made_at && <span>{t.promises.madeAt} : {formatDate(p.made_at, lang)}</span>}
                  {p.due_at && <span>{t.promises.dueAt} : {formatDate(p.due_at, lang)}</span>}
                  {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer nofollow" className="text-green-deep hover:underline">source</a>}
                </p>
                {updates.filter((u) => u.promise_id === p.id).length > 0 && (
                  <ol className="mt-3 flex flex-col gap-2 border-l-2 border-line pl-3">
                    {updates.filter((u) => u.promise_id === p.id).map((u) => (
                      <li key={u.id} className="text-[14px]">
                        <span className="text-muted">{formatDate(u.created_at, lang)} · @{authors.get(u.author_id)?.handle}</span>
                        {u.new_status && <> · <b>{t.promises.status[u.new_status]}</b></>}
                        <p className="whitespace-pre-wrap">{u.text}</p>
                        {u.source_url && <a href={u.source_url} target="_blank" rel="noopener noreferrer nofollow" className="text-[13px] text-green-deep hover:underline">source</a>}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-2"><PromiseUpdateForm promiseId={p.id} lang={lang} signedIn={Boolean(viewer)} canSetStatus={canSetStatus} /></div>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  if (tab === "permanences") {
    const { data } = await supabase.from("permanences").select("*").eq("official_id", o.id).order("starts_at", { ascending: false }).limit(30);
    const rows = (data ?? []) as Permanence[];
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="max-w-sm text-[14px] text-muted">{t.permanence.intro}</p>
          {isOfficial && <PermanenceForm officialId={o.id} lang={lang} />}
        </div>
        {rows.length === 0 ? (
          <Empty>{t.officials.noPermanences}</Empty>
        ) : (
          <ul>
            {rows.map((p) => (
              <li key={p.id} className="border-b border-line px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={p.status === "en_cours" ? "ouverte" : p.status} label={t.permanence.status[p.status]} />
                  <span className="text-[13px] text-muted">{formatDate(p.starts_at, lang, true)} → {new Date(p.ends_at).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <h3 className="mt-2 text-[16px] font-semibold">{p.title}</h3>
                {p.description && <p className="mt-1 text-[14px] text-muted">{p.description}</p>}
                {p.post_id && p.status !== "annulee" && (
                  <Link href={`/p/${p.post_id}`} className="mt-2 inline-block text-[14px] font-semibold text-green-deep hover:underline">{t.permanence.askNow} →</Link>
                )}
                {isOfficial && <PermanenceControls id={p.id} status={p.status} lang={lang} />}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  if (tab === "posts" && o.profile_id) {
    const posts = await fetchProfilePosts(supabase, o.profile_id, "posts", viewer?.id ?? null);
    body = posts.length === 0 ? <Empty>—</Empty> : <>{posts.map((p) => <PostCard key={p.id} post={p} viewerId={viewer?.id ?? null} lang={lang} lowData={viewer?.low_data} isModerator={isMod} />)}</>;
  }

  return (
    <>
      <PageHeader title={o.full_name} subtitle={o.title ?? t.officials.mandates[o.mandate]} back="/elus" />
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-start gap-4">
          <Avatar src={o.profile?.avatar_url ?? o.photo_url} name={o.full_name} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 font-display text-[22px] font-bold leading-tight">
              {o.full_name}
              {o.profile && <NameBadge p={{ ...o.profile, account_type: "elu" }} size={22} lang={lang} />}
            </h2>
            <p className="text-[15px] text-muted">{o.title ?? `${t.officials.mandates[o.mandate]} · ${officialPlace(o, geo)}`}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-muted">
              {o.party && <span>{o.party}</span>}
              <span className="inline-flex items-center gap-1"><I.pin className="h-3.5 w-3.5" />{officialPlace(o, geo)}</span>
              {o.term_start && <span>{new Date(o.term_start).getFullYear()}{o.term_end ? `–${new Date(o.term_end).getFullYear()}` : ""}</span>}
            </p>
          </div>
        </div>
        {o.bio && <p className="mt-3 text-[15px] leading-snug">{o.bio}</p>}

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="flex min-h-[78px] flex-col-reverse items-center justify-center rounded-2xl bg-paper px-2 py-3">
            <dt className="mt-1 text-[12px] leading-tight text-muted">{t.interpellation.open}</dt>
            <dd className="font-display text-[22px] font-bold leading-none tabular-nums">{open}</dd>
          </div>
          <div className="flex min-h-[78px] flex-col-reverse items-center justify-center rounded-2xl bg-paper px-2 py-3">
            <dt className="mt-1 text-[12px] leading-tight text-muted">{lang === "fr" ? "Taux de réponse" : "Answer rate"}</dt>
            <dd className="font-display text-[22px] font-bold leading-none tabular-nums">{rate === null ? "—" : `${rate} %`}</dd>
          </div>
          <div className="flex min-h-[78px] flex-col-reverse items-center justify-center rounded-2xl bg-paper px-2 py-3">
            <dt className="mt-1 text-[12px] leading-tight text-muted">{lang === "fr" ? "Électeurs inscrits ici" : "Voters registered here"}</dt>
            <dd className="font-display text-[22px] font-bold leading-none tabular-nums">{constituents ?? "< 50"}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {o.profile ? (
            <>
              <Link href={`/u/${o.profile.handle}`} className="btn-ghost btn-sm">@{o.profile.handle}</Link>
              {!isOfficial && <FollowButton userId={o.profile.id} initial={Boolean(followRes.data)} lang={lang} signedIn={Boolean(viewer)} />}
            </>
          ) : (
            <p className="rounded-xl border border-line bg-paper px-3 py-2 text-[13px] text-muted">
              {t.officials.notOnPlatform}{" "}
              <Link href="/parametres#verification" className="font-semibold text-green-deep hover:underline">{t.officials.claim}</Link>
            </p>
          )}
        </div>
      </div>

      <Tabs label={o.full_name} className="border-b border-line" items={tabs.map((x) => ({ href: x.key === "interpellations" ? `/elus/${o.id}` : `/elus/${o.id}?tab=${x.key}`, label: x.label, on: tab === x.key }))} />
      {body}
    </>
  );
}
