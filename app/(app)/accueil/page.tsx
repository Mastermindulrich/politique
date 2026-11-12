import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Feed } from "@/app/components/feed";
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
      <div className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <h1 className="sr-only">{t.nav.home}</h1>
        <nav aria-label="Fils" className="flex">
          {[
            { href: "/accueil", label: t.feed.forYou, on: !following },
            { href: "/accueil?fil=abonnements", label: t.feed.following, on: following },
          ].map((tab) => (
            <Link key={tab.href} href={tab.href} aria-current={tab.on ? "page" : undefined} className="flex flex-1 flex-col items-center gap-3 pt-4 text-[15px] hover:bg-paper">
              <span className={tab.on ? "font-bold" : "font-medium text-muted"}>{tab.label}</span>
              <span className={`h-1 w-16 rounded-full ${tab.on ? "bg-green" : "bg-transparent"}`} />
            </Link>
          ))}
        </nav>
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
