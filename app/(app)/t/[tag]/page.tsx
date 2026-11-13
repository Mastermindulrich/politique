import type { Metadata } from "next";
import { Feed } from "@/app/components/feed";
import { PageHeader } from "@/app/components/shell/shell";
import { fetchHashtag } from "@/lib/data/posts";
import { loadHashtag } from "@/lib/feed-actions";
import { createClient, getViewer } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${decodeURIComponent(tag)}` };
}

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = decodeURIComponent(raw).toLowerCase().slice(0, 50);
  const viewer = await getViewer();
  const lang = viewer?.lang ?? "fr";
  const supabase = await createClient();
  const [posts, meta] = await Promise.all([
    fetchHashtag(supabase, tag, viewer?.id ?? null),
    supabase.from("hashtags").select("posts_count").eq("tag", tag).maybeSingle(),
  ]);
  return (
    <>
      <PageHeader title={`#${tag}`} subtitle={meta.data ? `${meta.data.posts_count} posts` : undefined} back="/explorer" />
      <Feed initial={posts} viewerId={viewer?.id ?? null} lang={lang} lowData={viewer?.low_data} loadMore={loadHashtag.bind(null, tag)} empty={lang === "fr" ? "Aucune publication avec ce mot-clé." : "No posts with this hashtag."} />
    </>
  );
}
