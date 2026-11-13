import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Feed } from "@/app/components/feed";
import { PageHeader } from "@/app/components/shell/shell";
import { fetchBookmarks } from "@/lib/data/posts";
import { loadBookmarks } from "@/lib/feed-actions";
import { t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Signets" };

export default async function BookmarksPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const t = dict(viewer.lang);
  const posts = await fetchBookmarks(await createClient(), viewer.id);
  return (
    <>
      <PageHeader title={t.nav.bookmarks} subtitle={t.common.private} />
      <Feed initial={posts} viewerId={viewer.id} lang={viewer.lang} lowData={viewer.low_data} loadMore={loadBookmarks} empty={viewer.lang === "fr" ? "Enregistrez une publication depuis son menu pour la retrouver ici." : "Bookmark a post from its menu to find it here."} />
    </>
  );
}
