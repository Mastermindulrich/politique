import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Feed } from "@/app/components/feed";
import { Tabs } from "@/app/components/shell/shell";
import { Avatar } from "@/app/components/ui/avatar";
import { fetchFollowing, fetchForYou } from "@/lib/data/posts";
import { loadFollowing, loadForYou } from "@/lib/feed-actions";
import { t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import { HomeComposer } from "./home-composer";

export const metadata: Metadata = { title: "Accueil" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ fil?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const { fil } = await searchParams;
  const following = fil === "abonnements";
  const t = dict(viewer.lang);
  const supabase = await createClient();
  const posts = following ? await fetchFollowing(supabase, viewer.id) : await fetchForYou(supabase, viewer.id);

  return (
    <>
      <span id="top" />
      <div className="bar sticky top-0 z-30 border-b">
        <h1 className="sr-only">{t.nav.home}</h1>
        {/* Phones: the flag sits above the tabs, like the app icon. Tapping it scrolls back to the top. */}
        <a href="#top" aria-hidden="true" tabIndex={-1} className="flex h-12 items-center justify-center sm:hidden">
          <span className="flag !h-7 !w-7 !rounded-lg"><span /><span /><span /></span>
        </a>
        <Tabs
          label="Fils"
          items={[
            { href: "/accueil", label: t.feed.forYou, on: !following },
            { href: "/accueil?fil=abonnements", label: t.feed.following, on: following },
          ]}
        />
      </div>

      <div className="hidden gap-3 border-b border-line px-4 py-3 sm:flex">
        <Avatar src={viewer.avatar_url} name={viewer.display_name} size={40} />
        <div className="min-w-0 flex-1">
          <HomeComposer lang={viewer.lang} defaultCommuneId={null} />
        </div>
      </div>

      <Feed
        key={following ? "following" : "foryou"}
        initial={posts}
        viewerId={viewer.id}
        lang={viewer.lang}
        lowData={viewer.low_data}
        isModerator={viewer.is_moderator || viewer.is_admin}
        showReason={!following}
        loadMore={following ? loadFollowing : loadForYou}
        empty={following ? t.feed.emptyFollowing : t.feed.empty}
      />
    </>
  );
}
