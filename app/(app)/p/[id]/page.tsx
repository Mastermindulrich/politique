import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import { notFound } from "next/navigation";
import { ReplyBox } from "./reply-box";
import { LabelForm } from "./label-form";
import { PostCard } from "@/app/components/post/post-card";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { fetchPost, fetchThread } from "@/lib/data/posts";
import { t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return {};
  const supabase = await createClient();
  const post = await fetchPost(supabase, id, null);
  if (!post || post.deleted_at) return { title: "Post" };
  const title = `${post.author.display_name} sur POLITIQUE`;
  const description = post.text.slice(0, 200);
  return { title, description, openGraph: { title, description, type: "article" } };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const t = dict(lang);
  const supabase = await createClient();
  const post = await fetchPost(supabase, id, viewer?.id ?? null);
  if (!post) notFound();
  const isMod = Boolean(viewer?.is_moderator || viewer?.is_admin);
  const canLabel = isMod || Boolean(viewer?.verified && viewer.account_type === "media");

  if (post.deleted_at) {
    return (
      <>
        <PageHeader title={t.post.thread} back="/accueil" />
        <Empty>{t.post.deleted}</Empty>
      </>
    );
  }

  const { ancestors, replies } = await fetchThread(supabase, post, viewer?.id ?? null);
  await supabase.rpc("record_views", { ids: [post.id] });

  return (
    <>
      <PageHeader title={t.post.thread} back={viewer ? "/accueil" : "/explorer"} />
      {ancestors.map((a) => (
        <PostCard key={a.id} post={a} viewerId={viewer?.id ?? null} lang={lang} lowData={viewer?.low_data} variant="thread" isModerator={isMod} />
      ))}
      <PostCard post={post} viewerId={viewer?.id ?? null} lang={lang} lowData={viewer?.low_data} variant="detail" isModerator={isMod} />
      {canLabel && <LabelForm postId={post.id} lang={lang} />}
      {viewer && (
        <div className="border-b border-line px-4 py-3">
          <ReplyBox lang={lang} parentId={post.id} replyTo={post.author.handle} />
        </div>
      )}
      <h2 className="sr-only">{t.post.replies}</h2>
      {replies.map((r) => (
        <PostCard key={r.id} post={r} viewerId={viewer?.id ?? null} lang={lang} lowData={viewer?.low_data} isModerator={isMod} />
      ))}
    </>
  );
}
