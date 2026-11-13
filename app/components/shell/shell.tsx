import Link from "next/link";
import { t as dict } from "@/lib/i18n";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { communeById } from "@/lib/ci-geo";
import { Avatar } from "../ui/avatar";
import { VerifiedBadge } from "../ui/badge";
import { FollowButton } from "../follow-button";
import { NavLinks, MobileNav, ComposeFab } from "./nav";
import { SearchBox } from "./search-box";

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flag" aria-hidden="true"><span /><span /><span /></span>
      <span className="hidden font-display text-[22px] font-bold tracking-[0.14em] xl:inline">POLITIQUE</span>
    </span>
  );
}

async function sideData(viewer: Profile | null) {
  if (!supabaseConfigured) return { trends: [], suggestions: [], unread: { notifications: 0, messages: 0 } };
  const supabase = await createClient();
  const [trends, suggestions, unread] = await Promise.all([
    supabase.rpc("trending_hashtags", { cid: viewer?.shown_commune_id ?? null, lim: 6 }),
    supabase.rpc("suggested_profiles", { lim: 4 }),
    viewer ? supabase.rpc("unread_counts") : Promise.resolve({ data: null }),
  ]);
  let tr = (trends.data ?? []) as { tag: string; posts_24h: number; posts_total: number }[];
  if (tr.length === 0 && viewer?.shown_commune_id) {
    const all = await supabase.rpc("trending_hashtags", { cid: null, lim: 6 });
    tr = (all.data ?? []) as typeof tr;
  }
  const u = (unread.data as { notifications: number; messages: number }[] | null)?.[0];
  return {
    trends: tr,
    suggestions: (suggestions.data ?? []) as Profile[],
    unread: { notifications: Number(u?.notifications ?? 0), messages: Number(u?.messages ?? 0) },
  };
}

/** Three-column app shell: nav rail, main column, right rail. Bottom nav on phones. */
export async function Shell({ viewer, children, hideRight = false }: { viewer: Profile | null; children: React.ReactNode; hideRight?: boolean }) {
  const lang = viewer?.lang ?? "fr";
  const t = dict(lang);
  const { trends, suggestions, unread } = await sideData(viewer);
  const city = viewer?.shown_commune_id ? communeById.get(viewer.shown_commune_id)?.name : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] justify-center">
      {/* Left rail */}
      <header className="sticky top-0 hidden h-screen w-[72px] flex-none flex-col justify-between border-r border-line px-2 py-3 sm:flex xl:w-[260px] xl:px-4">
        <div className="flex flex-col gap-1">
          <Link href={viewer ? "/accueil" : "/"} className="mb-2 flex h-12 items-center px-3" aria-label="POLITIQUE">
            <Wordmark />
          </Link>
          <NavLinks lang={lang} handle={viewer?.handle ?? null} unread={unread} isModerator={Boolean(viewer?.is_moderator || viewer?.is_admin || viewer?.is_owner)} isStaff={Boolean(viewer?.is_admin || viewer?.is_owner)} signedIn={Boolean(viewer)} />
        </div>
        {viewer ? (
          <Link href={`/u/${viewer.handle}`} className="flex items-center gap-3 rounded-full p-2 hover:bg-paper">
            <Avatar src={viewer.avatar_url} name={viewer.display_name} size={40} />
            <span className="hidden min-w-0 xl:block">
              <span className="flex items-center gap-1 truncate text-[15px] font-bold">
                <span className="truncate">{viewer.display_name}</span>
                {viewer.verified && <VerifiedBadge type={viewer.account_type} size={16} />}
              </span>
              <span className="block truncate text-[14px] text-muted">@{viewer.handle}</span>
            </span>
          </Link>
        ) : (
          <div className="hidden flex-col gap-2 xl:flex">
            <Link href="/inscription" className="btn-primary">{t.nav.signup}</Link>
            <Link href="/connexion" className="btn-ghost">{t.nav.login}</Link>
          </div>
        )}
      </header>

      {/* Main column */}
      <main className="min-h-screen w-full min-w-0 max-w-[620px] border-line pb-20 sm:border-r sm:pb-0">{children}</main>

      {/* Right rail */}
      {!hideRight && (
        <aside className="sticky top-0 hidden h-screen w-[340px] flex-none flex-col gap-4 overflow-y-auto px-5 py-3 lg:flex">
          <SearchBox placeholder={t.explore.search} hideOn="/explorer" />
          <section className="rounded-2xl border border-line">
            <h2 className="px-4 pt-3 font-display text-[19px] font-bold">{city ? `${t.explore.trendsIn} ${city}` : t.explore.trends}</h2>
            {trends.length === 0 ? (
              <p className="px-4 py-3 text-[14px] text-muted">{lang === "fr" ? "Les tendances apparaîtront dès les premières publications." : "Trends will appear with the first posts."}</p>
            ) : (
              <ul className="py-1">
                {trends.map((tr) => (
                  <li key={tr.tag}>
                    <Link href={`/t/${encodeURIComponent(tr.tag)}`} className="block px-4 py-2 hover:bg-paper">
                      <span className="block text-[15px] font-bold">#{tr.tag}</span>
                      <span className="block text-[13px] text-muted">{tr.posts_total} {t.explore.posts}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/explorer" className="block rounded-b-2xl px-4 py-3 text-[14px] font-semibold text-green-deep hover:bg-paper">{t.common.showMore}</Link>
          </section>
          {suggestions.length > 0 && (
            <section className="rounded-2xl border border-line">
              <h2 className="px-4 pt-3 font-display text-[19px] font-bold">{t.explore.whoToFollow}</h2>
              <ul className="py-1">
                {suggestions.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                    <Link href={`/u/${p.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar src={p.avatar_url} name={p.display_name} size={40} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-[15px] font-bold">
                          <span className="truncate">{p.display_name}</span>
                          {p.verified && <VerifiedBadge type={p.account_type} size={16} />}
                        </span>
                        <span className="block truncate text-[13px] text-muted">@{p.handle}</span>
                      </span>
                    </Link>
                    <FollowButton userId={p.id} initial={false} lang={lang} signedIn={Boolean(viewer)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="px-1 text-[12px] leading-relaxed text-muted">
            © {new Date().getFullYear()} POLITIQUE · <Link href="/regles" className="hover:underline">{lang === "fr" ? "Règles" : "Rules"}</Link> · <Link href="/confidentialite" className="hover:underline">{lang === "fr" ? "Confidentialité" : "Privacy"}</Link>
          </p>
        </aside>
      )}

      <MobileNav lang={lang} handle={viewer?.handle ?? null} unread={unread} signedIn={Boolean(viewer)} />
      {viewer && <ComposeFab lang={lang} />}
    </div>
  );
}

/** Sticky page title bar for the main column. */
export function PageHeader({ title, subtitle, back, children }: { title: string; subtitle?: string; back?: string; children?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="flex min-h-[56px] items-center gap-3 px-4 py-2">
        {back && (
          <Link href={back} aria-label="Retour" className="-ml-2 rounded-full p-2 hover:bg-paper">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[20px] font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-[13px] text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-14 text-center text-[15px] text-muted">{children}</div>;
}
