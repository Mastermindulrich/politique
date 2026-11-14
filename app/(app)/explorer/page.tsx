import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import Link from "next/link";
import { Feed } from "@/app/components/feed";
import { FollowButton } from "@/app/components/follow-button";
import { SearchBox } from "@/app/components/shell/search-box";
import { Empty } from "@/app/components/shell/shell";
import { Avatar } from "@/app/components/ui/avatar";
import { VerifiedBadge } from "@/app/components/ui/badge";
import { I } from "@/app/components/ui/icons";
import { communeById, communes } from "@/lib/ci-geo";
import { fetchByCommune, searchPosts } from "@/lib/data/posts";
import { loadCommune } from "@/lib/feed-actions";
import { t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Official, Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Explorer" };

// The cities shown as quick filters; every commune stays reachable from the selector.
const CITIES = ["Cocody", "Yopougon", "Abobo", "Plateau", "Bouaké", "Yamoussoukro", "Korhogo", "San-Pédro", "Daloa", "Man", "Gagnoa", "Abengourou"];

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; ville?: string }> }) {
  const { q: rawQ, ville } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);
  const cityId = ville && communeById.has(Number(ville)) ? Number(ville) : null;
  const viewer = await getViewer();
  const lang = viewer?.lang ?? (await getLang());
  const t = dict(lang);
  const supabase = await createClient();

  const header = (
    <div className="sticky top-0 z-30 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur">
      <h1 className="sr-only">{t.explore.title}</h1>
      <SearchBox placeholder={t.explore.search} initial={q} />
      <nav aria-label={t.explore.byCity} className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href="/explorer" className={`chip h-8 flex-none px-3 ${!cityId && !q ? "bg-ink text-bg" : "bg-paper text-ink"}`}>{t.explore.everywhere}</Link>
        {CITIES.map((name) => {
          const c = communes.find((x) => x.name === name);
          if (!c) return null;
          return (
            <Link key={c.id} href={`/explorer?ville=${c.id}`} className={`chip h-8 flex-none px-3 ${cityId === c.id ? "bg-ink text-bg" : "bg-paper text-ink"}`}>
              {name}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  // --- Search results -----------------------------------------------------------
  if (q) {
    const [people, posts, officials] = await Promise.all([
      supabase.rpc("search_profiles", { q, lim: 6 }),
      searchPosts(supabase, q, viewer?.id ?? null),
      supabase.from("officials").select("*").or(`full_name.ilike.%${q.replace(/[%,()]/g, "")}%,title.ilike.%${q.replace(/[%,()]/g, "")}%,party.ilike.%${q.replace(/[%,()]/g, "")}%`).limit(5),
    ]);
    const profiles = (people.data ?? []) as Profile[];
    const offs = (officials.data ?? []) as Official[];
    return (
      <>
        {header}
        {offs.length > 0 && (
          <section className="border-b border-line">
            <h2 className="px-4 pt-3 font-display text-[18px] font-bold">{t.explore.officials}</h2>
            <ul>
              {offs.map((o) => (
                <li key={o.id}>
                  <Link href={`/elus/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-green-soft text-green-deep"><I.landmark className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold">{o.full_name}</span>
                      <span className="block truncate text-[13px] text-muted">{o.title ?? t.officials.mandates[o.mandate]}{o.party ? ` · ${o.party}` : ""}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {profiles.length > 0 && (
          <section className="border-b border-line">
            <h2 className="px-4 pt-3 font-display text-[18px] font-bold">{t.explore.people}</h2>
            <ul>
              {profiles.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/u/${p.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar src={p.avatar_url} name={p.display_name} size={40} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-[15px] font-bold"><span className="truncate">{p.display_name}</span>{p.verified && <VerifiedBadge type={p.account_type} size={16} />}</span>
                      <span className="block truncate text-[13px] text-muted">@{p.handle}{p.bio ? ` · ${p.bio}` : ""}</span>
                    </span>
                  </Link>
                  {viewer?.id !== p.id && <FollowButton userId={p.id} initial={false} lang={lang} signedIn={Boolean(viewer)} />}
                </li>
              ))}
            </ul>
          </section>
        )}
        <Feed initial={posts} viewerId={viewer?.id ?? null} lang={lang} lowData={viewer?.low_data} empty={profiles.length || offs.length ? " " : t.explore.noResults} />
      </>
    );
  }

  // --- City view or default -----------------------------------------------------
  const [trendsRes, cityPosts, officialsRes] = await Promise.all([
    supabase.rpc("trending_hashtags", { cid: cityId, lim: 10 }),
    cityId ? fetchByCommune(supabase, cityId, viewer?.id ?? null) : Promise.resolve([]),
    cityId ? supabase.from("officials").select("*").eq("commune_id", cityId).limit(6) : supabase.from("officials").select("*").not("profile_id", "is", null).limit(6),
  ]);
  const trends = (trendsRes.data ?? []) as { tag: string; posts_24h: number; posts_total: number }[];
  const officials = (officialsRes.data ?? []) as Official[];
  const cityName = cityId ? communeById.get(cityId)?.name : null;

  return (
    <>
      {header}
      <section className="border-b border-line">
        <h2 className="px-4 pt-3 font-display text-[19px] font-bold">{cityName ? `${t.explore.trendsIn} ${cityName}` : t.explore.trends}</h2>
        {trends.length === 0 ? (
          <p className="px-4 py-4 text-[14px] text-muted">{lang === "fr" ? "Aucune tendance pour l'instant. Ajoutez un #mot-clé à votre publication pour lancer la première." : "No trends here yet. Post with a #Hashtag to start the first one."}</p>
        ) : (
          <ol>
            {trends.map((tr, i) => (
              <li key={tr.tag}>
                <Link href={`/t/${encodeURIComponent(tr.tag)}`} className="flex items-baseline gap-3 px-4 py-2.5 hover:bg-paper">
                  <span className="w-5 text-[13px] tabular-nums text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">#{tr.tag}</span>
                    <span className="block text-[13px] text-muted">{tr.posts_24h} {t.explore.posts} · 24 h</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {officials.length > 0 && (
        <section className="border-b border-line">
          <div className="flex items-baseline justify-between px-4 pt-3">
            <h2 className="font-display text-[19px] font-bold">{cityName ? `${t.explore.officials} · ${cityName}` : t.explore.officials}</h2>
            <Link href="/elus" className="text-[14px] font-semibold text-green-deep">{t.common.showMore}</Link>
          </div>
          <ul className="py-1">
            {officials.map((o) => (
              <li key={o.id}>
                <Link href={`/elus/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-green-soft text-green-deep"><I.landmark className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold">{o.full_name}</span>
                    <span className="block truncate text-[13px] text-muted">{o.title ?? t.officials.mandates[o.mandate]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cityId ? (
        <Feed key={cityId} initial={cityPosts} viewerId={viewer?.id ?? null} lang={lang} lowData={viewer?.low_data} loadMore={loadCommune.bind(null, cityId)} empty={lang === "fr" ? `Aucun post localisé à ${cityName} pour l'instant.` : `No posts tagged in ${cityName} yet.`} />
      ) : (
        <section className="px-4 py-4">
          <h2 className="font-display text-[19px] font-bold">{t.explore.byCity}</h2>
          <form action="/explorer" className="mt-3 flex gap-2">
            <label className="flex-1">
              <span className="sr-only">{t.explore.chooseCity}</span>
              <select name="ville" className="select" defaultValue="">
                <option value="" disabled>{t.explore.chooseCity}</option>
                {[...communes].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary">OK</button>
          </form>
          {!viewer && <Empty>{lang === "fr" ? "Créez un compte pour suivre vos élus et participer." : "Create an account to follow your officials and take part."}</Empty>}
        </section>
      )}
    </>
  );
}
