/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Feed } from "@/app/components/feed";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { Avatar } from "@/app/components/ui/avatar";
import { NameBadge, OwnerChip, TypeChip } from "@/app/components/ui/badge";
import { I } from "@/app/components/ui/icons";
import { communeById } from "@/lib/ci-geo";
import { fetchProfilePosts } from "@/lib/data/posts";
import { loadProfile } from "@/lib/feed-actions";
import { formatCount, t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Official, Profile } from "@/lib/types";
import { ProfileActions } from "./profile-actions";

type Tab = "posts" | "replies" | "media" | "likes";

async function getProfile(handle: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("handle", handle.toLowerCase()).maybeSingle();
  return data as Profile | null;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const p = await getProfile(decodeURIComponent(handle));
  if (!p) return { title: "Profil" };
  return { title: `${p.display_name} (@${p.handle})`, description: p.bio ?? undefined };
}

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { handle } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "replies" || rawTab === "media" || rawTab === "likes" ? rawTab : "posts";
  const viewer = await getViewer();
  const lang = viewer?.lang ?? "fr";
  const t = dict(lang);
  const profile = await getProfile(decodeURIComponent(handle));
  if (!profile) {
    return (
      <>
        <PageHeader title={t.nav.profile} back="/explorer" />
        <Empty>{t.profile.notFound}</Empty>
      </>
    );
  }
  if (!/^[a-z0-9_]{3,20}$/.test(profile.handle)) notFound();

  const supabase = await createClient();
  const isMe = viewer?.id === profile.id;
  const [followRes, followsMeRes, blockRes, muteRes, officialsRes, posts] = await Promise.all([
    viewer && !isMe ? supabase.from("follows").select("follower_id").eq("follower_id", viewer.id).eq("followee_id", profile.id).maybeSingle() : Promise.resolve({ data: null }),
    viewer && !isMe ? supabase.from("follows").select("follower_id").eq("follower_id", profile.id).eq("followee_id", viewer.id).maybeSingle() : Promise.resolve({ data: null }),
    viewer && !isMe ? supabase.from("blocks").select("blocker_id").eq("blocker_id", viewer.id).eq("blocked_id", profile.id).maybeSingle() : Promise.resolve({ data: null }),
    viewer && !isMe ? supabase.from("mutes").select("muter_id").eq("muter_id", viewer.id).eq("muted_id", profile.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("officials").select("*").eq("profile_id", profile.id),
    fetchProfilePosts(supabase, profile.id, tab, viewer?.id ?? null),
  ]);
  const officials = (officialsRes.data ?? []) as Official[];
  const suspended = profile.suspended_until && new Date(profile.suspended_until) > new Date();
  const city = profile.shown_commune_id ? communeById.get(profile.shown_commune_id)?.name : null;
  const tabs: { key: Tab; label: string }[] = [
    { key: "posts", label: t.profile.posts },
    { key: "replies", label: t.profile.repliesTab },
    { key: "media", label: t.profile.media },
    { key: "likes", label: t.profile.likes },
  ];

  return (
    <>
      <PageHeader title={profile.display_name} subtitle={`${formatCount(profile.posts_count, lang)} ${t.profile.posts.toLowerCase()}`} back={viewer ? "/accueil" : "/explorer"} />
      <div className="relative">
        <div className="h-32 bg-paper sm:h-44">
          {profile.banner_url && <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="px-4">
          <div className="-mt-10 flex items-end justify-between sm:-mt-14">
            <Avatar src={profile.avatar_url} name={profile.display_name} size={96} className="border-4 border-bg" />
            <div className="pb-1">
              {isMe ? (
                <Link href="/parametres" className="btn-ghost btn-sm">{t.profile.edit}</Link>
              ) : (
                <ProfileActions
                  userId={profile.id}
                  lang={lang}
                  signedIn={Boolean(viewer)}
                  following={Boolean(followRes.data)}
                  blocked={Boolean(blockRes.data)}
                  muted={Boolean(muteRes.data)}
                  isModerator={Boolean(viewer?.is_moderator || viewer?.is_admin)}
                  suspended={Boolean(suspended)}
                />
              )}
            </div>
          </div>
          <div className="mt-3">
            <h2 className="flex items-center gap-1.5 font-display text-[22px] font-bold leading-tight">
              {profile.display_name}
              <NameBadge p={profile} size={22} lang={lang} verifiedTitle={t.profile.verified} />
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
              <span>@{profile.handle}</span>
              {profile.is_owner && <OwnerChip lang={lang} />}
              {profile.account_type !== "citoyen" && <TypeChip type={profile.account_type} label={t.profile.types[profile.account_type]} />}
              {Boolean(followsMeRes.data) && <span className="chip bg-paper text-muted">{t.profile.followsYou}</span>}
            </div>
          </div>
          {suspended && <p className="mt-3 rounded-xl border border-orange/30 bg-orange-soft px-3 py-2 text-[14px] font-medium text-orange">{t.profile.suspended}</p>}
          {profile.bio && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-snug">{profile.bio}</p>}

          {officials.map((o) => (
            <Link key={o.id} href={`/elus/${o.id}`} className="mt-3 flex items-center gap-3 rounded-2xl border border-green/30 bg-green-soft px-4 py-3 hover:opacity-90">
              <I.landmark className="h-5 w-5 flex-none text-green-deep" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-green-deep">{o.title ?? t.officials.mandates[o.mandate]}</span>
                <span className="block text-[13px] text-muted">{t.profile.officialPage} · {t.officials.interpellations}, {t.officials.promises.toLowerCase()}, {t.officials.permanences.toLowerCase()}</span>
              </span>
              <span className="text-[13px] font-semibold text-green-deep">{t.profile.interpellate} →</span>
            </Link>
          ))}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
            {city && <span className="inline-flex items-center gap-1"><I.pin className="h-4 w-4" />{city}</span>}
            {profile.website && (
              <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-green-deep hover:underline">
                <I.globe className="h-4 w-4" />{profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span className="inline-flex items-center gap-1"><I.calendar className="h-4 w-4" />{t.profile.joined} {new Date(profile.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" })}</span>
          </div>
          <div className="mt-3 flex gap-5 text-[14px]">
            <span><b>{formatCount(profile.following_count, lang)}</b> <span className="text-muted">{t.profile.followingCount}</span></span>
            <span><b>{formatCount(profile.followers_count, lang)}</b> <span className="text-muted">{t.profile.followers}</span></span>
          </div>
        </div>

        <nav aria-label="Profil" className="mt-3 flex border-b border-line">
          {tabs.map((x) => (
            <Link key={x.key} href={x.key === "posts" ? `/u/${profile.handle}` : `/u/${profile.handle}?tab=${x.key}`} aria-current={tab === x.key ? "page" : undefined} className="tab pt-3 text-[14px] sm:text-[15px]">
              <span className={tab === x.key ? "font-bold" : "font-medium text-muted"}>{x.label}</span>
              <span className={`h-1 w-12 rounded-full ${tab === x.key ? "bg-green" : "bg-transparent"}`} />
            </Link>
          ))}
        </nav>
      </div>

      <Feed
        key={tab}
        initial={posts}
        viewerId={viewer?.id ?? null}
        lang={lang}
        lowData={viewer?.low_data}
        isModerator={Boolean(viewer?.is_moderator || viewer?.is_admin)}
        loadMore={loadProfile.bind(null, profile.id, tab)}
        empty={lang === "fr" ? "Rien à afficher ici pour l'instant." : "Nothing to show here yet."}
      />
    </>
  );
}
