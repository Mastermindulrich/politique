import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerForm, InterpellationVote } from "@/app/components/civic";
import { StatusChip } from "@/app/components/official-card";
import { PostCard } from "@/app/components/post/post-card";
import { PageHeader } from "@/app/components/shell/shell";
import { Avatar } from "@/app/components/ui/avatar";
import { I } from "@/app/components/ui/icons";
import { attachProfiles, fetchAuthors } from "@/lib/data/people";
import { fetchPost, fetchThread } from "@/lib/data/posts";
import { formatDate, t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Interpellation, Official } from "@/lib/types";

export const metadata: Metadata = { title: "Interpellation" };

export default async function InterpellationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const t = dict(lang);
  const supabase = await createClient();
  const { data } = await supabase.from("interpellations").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const it = data as Interpellation;
  const { data: offRow } = await supabase.from("officials").select("*").eq("id", it.official_id).maybeSingle();
  if (!offRow) notFound();
  const [official] = await attachProfiles(supabase, [offRow as Official]);
  const isOfficial = Boolean(viewer && official.profile_id === viewer.id);
  const isMod = Boolean(viewer?.is_moderator || viewer?.is_admin);

  const [authors, voteRes, shareRes, answer, question] = await Promise.all([
    fetchAuthors(supabase, [it.author_id]),
    viewer ? supabase.from("interpellation_votes").select("interpellation_id").eq("interpellation_id", id).eq("user_id", viewer.id).maybeSingle() : Promise.resolve({ data: null }),
    isOfficial || isMod ? supabase.rpc("interpellation_constituent_share", { iid: id }) : Promise.resolve({ data: null }),
    it.answer_post_id ? fetchPost(supabase, it.answer_post_id, viewer?.id ?? null) : Promise.resolve(null),
    it.post_id ? fetchPost(supabase, it.post_id, viewer?.id ?? null) : Promise.resolve(null),
  ]);
  const author = authors.get(it.author_id);
  const share = shareRes.data as number | null;
  const replies = question ? (await fetchThread(supabase, question, viewer?.id ?? null)).replies.filter((r) => r.id !== it.answer_post_id) : [];

  return (
    <>
      <PageHeader title={t.interpellation.title} back={`/elus/${official.id}`} />
      <article className="border-b border-line px-4 py-4">
        <Link href={`/elus/${official.id}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-[13px] font-semibold hover:bg-card">
          <Avatar src={official.profile?.avatar_url ?? official.photo_url} name={official.full_name} size={24} />
          → {official.full_name}
        </Link>
        <div className="mt-3 flex gap-4">
          <InterpellationVote id={it.id} initial={Boolean(voteRes.data)} count={it.upvotes_count} lang={lang} signedIn={Boolean(viewer)} disabled={it.status !== "ouverte"} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[22px] font-bold leading-tight">{it.title}</h2>
            {it.body && <p className="mt-2 whitespace-pre-wrap text-[15px] leading-snug">{it.body}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <StatusChip status={it.status} label={t.interpellation.status[it.status]} />
              {author && <Link href={`/u/${author.handle}`} className="hover:underline">@{author.handle}</Link>}
              <span>· {formatDate(it.created_at, lang)}</span>
            </p>
            <p className="mt-2 text-[14px] text-muted"><b className="text-ink">{it.upvotes_count}</b> {t.interpellation.supporters}</p>
          </div>
        </div>

        {(isOfficial || isMod) && (
          <p className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-paper px-4 py-3 text-[14px]">
            <I.chart className="mt-0.5 h-5 w-5 flex-none text-green-deep" />
            {share === null ? <span className="text-muted">{t.interpellation.constituentShareHidden}</span> : <span><b>{share} %</b> {t.interpellation.constituentShare}</span>}
          </p>
        )}
      </article>

      {answer && (
        <section className="border-b border-line bg-green-soft/40">
          <h2 className="flex items-center gap-2 px-4 pt-3 text-[14px] font-bold text-green-deep"><I.check className="h-4 w-4" />{t.interpellation.answered}{it.answered_at ? ` · ${formatDate(it.answered_at, lang)}` : ""}</h2>
          <PostCard post={answer} viewerId={viewer?.id ?? null} lang={lang} lowData={viewer?.low_data} variant="thread" isModerator={isMod} />
        </section>
      )}

      {isOfficial && it.status === "ouverte" && (
        <div className="border-b border-line p-4"><AnswerForm id={it.id} lang={lang} /></div>
      )}

      {question && (
        <section>
          <h2 className="flex items-center justify-between px-4 pt-4 font-display text-[17px] font-bold">
            {t.post.replies}
            <Link href={`/p/${question.id}`} className="text-[13px] font-semibold text-green-deep hover:underline">{t.feed.showThread}</Link>
          </h2>
          {replies.length === 0 ? (
            <p className="px-4 py-6 text-[14px] text-muted">{lang === "fr" ? "Aucun citoyen n'a encore réagi. Ouvrez la discussion pour participer." : "No citizen replies yet. Open the thread to take part."}</p>
          ) : (
            replies.map((r) => <PostCard key={r.id} post={r} viewerId={viewer?.id ?? null} lang={lang} lowData={viewer?.low_data} isModerator={isMod} />)
          )}
        </section>
      )}
    </>
  );
}
