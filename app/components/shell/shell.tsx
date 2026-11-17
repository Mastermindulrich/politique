import { unstable_cache } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { t as dict } from "@/lib/i18n";
import { createClient, createPublicClient, supabaseConfigured } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { communeById } from "@/lib/ci-geo";
import { Avatar } from "../ui/avatar";
import { NameBadge } from "../ui/badge";
import { FollowButton } from "../follow-button";
import { NavLinks, MobileNav, ComposeFab } from "./nav";
import { SearchBox } from "./search-box";
import { NotificationCenter } from "../notify/notification-center";
import { I } from "../ui/icons";
import { LangSwitch } from "../lang-switch";

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flag" aria-hidden="true"><span /><span /><span /></span>
      <span className="hidden font-display text-[22px] font-bold tracking-[0.14em] xl:inline">POLITIQUE</span>
    </span>
  );
}

type Unread = { notifications: number; messages: number };
type Trend = { tag: string; posts_24h: number; posts_total: number };

/** Unread badge counts. Not awaited by the shell: the menus render first and the badges fill in. */
async function unreadCounts(): Promise<Unread> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("unread_counts");
  const u = (data as Unread[] | null)?.[0];
  return { notifications: Number(u?.notifications ?? 0), messages: Number(u?.messages ?? 0) };
}

/** Trends are the same for everyone in a commune, so one read serves every visitor for a minute. */
const trendsFor = unstable_cache(
  async (cid: number | null): Promise<Trend[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase.rpc("trending_hashtags", { cid, lim: 6 });
    let tr = (data ?? []) as Trend[];
    if (tr.length === 0 && cid) tr = ((await supabase.rpc("trending_hashtags", { cid: null, lim: 6 })).data ?? []) as Trend[];
    return tr;
  },
  ["trends"],
  { revalidate: 60 },
);

/** Three-column app shell: nav rail, main column, right rail. Bottom nav on phones. */
export function Shell({ viewer, lang, children, hideRight = false }: { viewer: Profile | null; lang: "fr" | "en"; children: React.ReactNode; hideRight?: boolean }) {
  const t = dict(lang);
  // Started here, read by the menus when it arrives: the page never waits for it.
  const unread = viewer && supabaseConfigured ? unreadCounts().catch(() => ({ notifications: 0, messages: 0 })) : null;
  const staff = Boolean(viewer?.is_admin || viewer?.is_owner);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] justify-center">
      {/* Left rail */}
      <header className="sticky top-0 hidden h-screen w-[72px] flex-none flex-col justify-between border-r border-line px-2 py-3 sm:flex xl:w-[260px] xl:px-4">
        <div className="flex flex-col gap-1">
          <Link href={viewer ? "/accueil" : "/"} className="tap mb-2 flex h-12 items-center rounded-full px-3" aria-label="POLITIQUE">
            <Wordmark />
          </Link>
          <NavLinks lang={lang} handle={viewer?.handle ?? null} unread={unread} isModerator={Boolean(viewer?.is_moderator || staff)} isStaff={staff} signedIn={Boolean(viewer)} />
          {/* No right rail below this width: the language switch lives here instead. */}
          <LangSwitch lang={lang} className="mt-3 self-center lg:hidden xl:self-start" />
        </div>
        {viewer ? (
          <Link href={`/u/${viewer.handle}`} className="tap flex items-center gap-3 rounded-full p-2 hover:bg-paper">
            <Avatar src={viewer.avatar_url} name={viewer.display_name} size={40} />
            <span className="hidden min-w-0 xl:block">
              <span className="flex items-center gap-1 truncate text-[15px] font-bold">
                <span className="truncate">{viewer.display_name}</span>
                <NameBadge p={viewer} size={16} lang={lang} />
              </span>
              <span className="block truncate text-[14px] text-muted">@{viewer.handle}</span>
            </span>
          </Link>
        ) : (
          <>
            <div className="hidden flex-col gap-2 xl:flex">
              <Link href="/inscription" className="btn-primary">{t.nav.signup}</Link>
              <Link href="/connexion" className="btn-ghost">{t.nav.login}</Link>
            </div>
            {/* Narrow rail (tablets): the same two doors, as icons. */}
            <div className="flex flex-col items-center gap-2 xl:hidden">
              <Link href="/inscription" aria-label={t.nav.signup} title={t.nav.signup} className="btn-primary h-12 w-12 !px-0"><I.plus className="h-6 w-6" /></Link>
              <Link href="/connexion" aria-label={t.nav.login} title={t.nav.login} className="btn-ghost h-12 w-12 !px-0"><I.user className="h-6 w-6" /></Link>
            </div>
          </>
        )}
      </header>

      {/* Main column */}
      <main className={`min-h-screen w-full min-w-0 max-w-[620px] border-line sm:border-r sm:pb-0 ${viewer ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : "pb-[calc(8.5rem+env(safe-area-inset-bottom))]"}`}>{children}</main>

      {/* Right rail: streamed in after the page, so a slow list never holds the page back. */}
      {!hideRight && (
        <aside className="sticky top-0 hidden h-screen w-[340px] flex-none flex-col gap-4 overflow-y-auto px-5 py-3 lg:flex">
          <SearchBox placeholder={t.explore.search} hideOn="/explorer" />
          {!viewer && <JoinCard lang={lang} />}
          <Suspense fallback={<RailSkeleton />}>
            <RightRail viewer={viewer} lang={lang} />
          </Suspense>
          <LangSwitch lang={lang} className="self-start" />
          <p className="px-1 text-[12px] leading-relaxed text-muted">
            © {new Date().getFullYear()} POLITIQUE · <Link href="/regles" className="hover:underline">{lang === "fr" ? "Règles" : "Rules"}</Link> · <Link href="/confidentialite" className="hover:underline">{lang === "fr" ? "Confidentialité" : "Privacy"}</Link>
          </p>
        </aside>
      )}

      <MobileNav lang={lang} handle={viewer?.handle ?? null} name={viewer?.display_name} avatar={viewer?.avatar_url} unread={unread} signedIn={Boolean(viewer)} isModerator={Boolean(viewer?.is_moderator || staff)} isStaff={staff} />
      {viewer ? <ComposeFab lang={lang} /> : <JoinBar lang={lang} />}
      {viewer && supabaseConfigured && <NotificationCenter lang={lang} viewerId={viewer.id} initial={unread} />}
    </div>
  );
}

/** Visitors on a wide screen: an invitation at the top of the right rail. */
function JoinCard({ lang }: { lang: "fr" | "en" }) {
  const fr = lang === "fr";
  return (
    <section className="rounded-2xl border border-line p-4">
      <h2 className="font-display text-[19px] font-bold leading-tight">{fr ? "Nouveau sur POLITIQUE ?" : "New to POLITIQUE?"}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
        {fr ? "Créez votre compte pour suivre vos élus, les interpeller et réagir aux publications." : "Create your account to follow your officials, question them and react to posts."}
      </p>
      <Link href="/inscription" className="btn-primary mt-3 h-11 w-full">{fr ? "Créer mon compte" : "Create my account"}</Link>
      <Link href="/connexion" className="btn-ghost mt-2 h-11 w-full">{fr ? "Se connecter" : "Log in"}</Link>
    </section>
  );
}

/** Visitors on a phone: a slim invitation just above the bottom bar. */
function JoinBar({ lang }: { lang: "fr" | "en" }) {
  const fr = lang === "fr";
  return (
    <div className="fixed inset-x-0 z-40 border-t border-line bg-card/95 px-4 py-2.5 backdrop-blur-lg sm:hidden" style={{ bottom: "calc(env(safe-area-inset-bottom) + 58px)" }}>
      <div className="mx-auto flex max-w-[620px] items-center gap-3">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted">
          <span className="block font-semibold text-ink">{fr ? "Rejoignez la conversation" : "Join the conversation"}</span>
          {fr ? "Suivez et interpellez vos élus." : "Follow and question your officials."}
        </p>
        <LangSwitch lang={lang} />
        <Link href="/inscription" className="btn-primary h-10 flex-none px-4 text-[14px]">{fr ? "S'inscrire" : "Sign up"}</Link>
      </div>
    </div>
  );
}

function RailSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-2xl border border-line p-4">
      <div className="skeleton h-5 w-28" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mt-4">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-1.5 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

async function RightRail({ viewer, lang }: { viewer: Profile | null; lang: "fr" | "en" }) {
  const t = dict(lang);
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const [trends, sugg] = await Promise.all([
    trendsFor(viewer?.shown_commune_id ?? null).catch(() => [] as Trend[]),
    supabase.rpc("suggested_profiles", { lim: 4 }),
  ]);
  const suggestions = (sugg.data ?? []) as Profile[];
  const city = viewer?.shown_commune_id ? communeById.get(viewer.shown_commune_id)?.name : null;
  return (
    <>
      <section className="rounded-2xl border border-line">
        <h2 className="px-4 pt-3 font-display text-[19px] font-bold">{city ? `${t.explore.trendsIn} ${city}` : t.explore.trends}</h2>
        {trends.length === 0 ? (
          <p className="px-4 py-3 text-[14px] text-muted">{lang === "fr" ? "Les tendances apparaîtront dès les premières publications." : "Trends will appear with the first posts."}</p>
        ) : (
          <ul className="py-1">
            {trends.map((tr) => (
              <li key={tr.tag}>
                <Link href={`/t/${encodeURIComponent(tr.tag)}`} prefetch={false} className="block px-4 py-2 transition-colors hover:bg-paper active:bg-paper">
                  <span className="block text-[15px] font-bold">#{tr.tag}</span>
                  <span className="block text-[13px] text-muted">{tr.posts_total} {t.explore.posts}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/explorer" className="block rounded-b-2xl px-4 py-3 text-[14px] font-semibold text-green-deep transition-colors hover:bg-paper active:bg-paper">{t.common.showMore}</Link>
      </section>
      {suggestions.length > 0 && (
        <section className="rounded-2xl border border-line">
          <h2 className="px-4 pt-3 font-display text-[19px] font-bold">{t.explore.whoToFollow}</h2>
          <ul className="py-1">
            {suggestions.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                <Link href={`/u/${p.handle}`} prefetch={false} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar src={p.avatar_url} name={p.display_name} size={40} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-[15px] font-bold">
                      <span className="truncate">{p.display_name}</span>
                      <NameBadge p={p} size={16} lang={lang} />
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
    </>
  );
}

/** Sticky page title bar for the main column. */
export function PageHeader({ title, subtitle, back, children }: { title: string; subtitle?: string; back?: string; children?: React.ReactNode }) {
  return (
    <div className="bar sticky top-0 z-30 border-b">
      <div className="flex min-h-[54px] items-center gap-2 px-4 py-1.5">
        {back && (
          <Link href={back} aria-label="Retour" className="tap -ml-2 mr-1 flex h-9 w-9 flex-none items-center justify-center rounded-full text-ink hover:bg-paper active:bg-line/70">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></svg>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[19px] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
          {subtitle && <p className="truncate text-[13px] leading-tight text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Underlined tab strip (feed, profile, official). Like X: the green bar is as wide as the
 * label, the strip scrolls sideways instead of wrapping when the labels don't fit.
 */
export function Tabs({ label, items, className = "" }: { label: string; items: { href: string; label: string; on: boolean }[]; className?: string }) {
  return (
    <nav aria-label={label} className={`no-scrollbar flex overflow-x-auto ${className}`}>
      {items.map((x) => (
        <Link key={x.href} href={x.href} aria-current={x.on ? "page" : undefined} className="tap-row flex h-[52px] min-w-fit flex-1 items-stretch justify-center whitespace-nowrap px-4 text-[15px]">
          <span className={`relative flex items-center ${x.on ? "font-bold text-ink" : "font-medium text-muted"}`}>
            {x.label}
            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 rounded-full transition-colors ${x.on ? "bg-green" : "bg-transparent"}`} />
          </span>
        </Link>
      ))}
    </nav>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[340px] px-6 py-16 text-center text-[15px] leading-relaxed text-muted">{children}</div>;
}
