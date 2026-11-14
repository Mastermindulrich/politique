"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { signOut } from "@/lib/actions";
import { t as dict } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Composer } from "../composer";
import { LangSwitch } from "../lang-switch";
import { Avatar } from "../ui/avatar";
import { I } from "../ui/icons";

type Unread = { notifications: number; messages: number };
type Item = { href: string; label: string; icon: keyof typeof I; badge?: number; match?: string[] };
type Lang = "fr" | "en";

const NONE: Unread = { notifications: 0, messages: 0 };

function items(lang: Lang, handle: string | null, unread: Unread, isModerator: boolean, signedIn: boolean, isStaff = false): Item[] {
  const t = dict(lang).nav;
  const pub: Item[] = [
    { href: signedIn ? "/accueil" : "/explorer", label: signedIn ? t.home : t.explore, icon: signedIn ? "home" : "search" },
  ];
  if (!signedIn) return [...pub, { href: "/elus", label: t.officials, icon: "landmark" }];
  return [
    ...pub,
    { href: "/explorer", label: t.explore, icon: "search", match: ["/explorer", "/t/"] },
    { href: "/mes-elus", label: t.myOfficials, icon: "landmark", match: ["/mes-elus", "/elus", "/interpellations", "/barometre", "/idees"] },
    { href: "/notifications", label: t.notifications, icon: "bell", badge: unread.notifications },
    { href: "/messages", label: t.messages, icon: "mail", badge: unread.messages },
    { href: "/signets", label: t.bookmarks, icon: "bookmark" },
    { href: `/u/${handle}`, label: t.profile, icon: "user" },
    { href: "/parametres", label: t.settings, icon: "settings" },
    ...(isModerator ? [{ href: "/admin", label: t.admin, icon: "shield" as const }] : []),
    ...(isStaff ? [{ href: "/controle", label: lang === "fr" ? "Centre de contrôle" : "Control center", icon: "sliders" as const }] : []),
  ];
}

/**
 * Unread counts: the server starts counting when the page is requested and hands the
 * answer over as a promise, so the menus show at once and the badges fill in a moment
 * later. New notifications then arrive live.
 */
function useLiveUnread(initial: Promise<Unread> | null, signedIn: boolean) {
  const [unread, setUnread] = useState<Unread>(NONE);
  const pathname = usePathname();
  // The desktop and mobile navs each mount this hook: a channel name can only be subscribed once.
  const instance = useId();
  useEffect(() => {
    let live = true;
    // React hands over a thenable, not a full Promise: wrap it before chaining.
    if (initial) Promise.resolve(initial).then((u) => live && setUnread(u), () => {});
    return () => {
      live = false;
    };
  }, [initial]);
  useEffect(() => {
    if (!signedIn) return;
    const supabase = supabaseBrowser();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // The cookie is enough to name the channel; the database decides what this session may hear.
    supabase.auth.getSession().then(({ data }: { data: { session: { user: { id: string } } | null } }) => {
      const uid = data.session?.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`notif-${uid}-${instance}`)
        .on("postgres_changes", { event: "INSERT", schema: "politique", table: "notifications", filter: `user_id=eq.${uid}` }, (payload: { new: { type: string } }) => {
          setUnread((u) => (payload.new.type === "message" ? { ...u, messages: u.messages + 1 } : { ...u, notifications: u.notifications + 1 }));
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [signedIn, instance]);
  // Opening the page clears its badge locally; the server marks rows read.
  useEffect(() => {
    if (pathname === "/notifications") setUnread((u) => ({ ...u, notifications: 0 }));
    if (pathname.startsWith("/messages")) setUnread((u) => ({ ...u, messages: 0 }));
  }, [pathname]);
  return unread;
}

function active(pathname: string, it: Item) {
  const m = it.match ?? [it.href];
  return m.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/"));
}

function Badge({ n, small = false }: { n?: number; small?: boolean }) {
  if (!n) return null;
  return (
    <span className={`pop absolute flex items-center justify-center rounded-full bg-orange px-1 font-bold text-white ring-2 ring-bg ${small ? "-right-1.5 -top-1 h-[17px] min-w-[17px] text-[10px]" : "-right-1.5 -top-1.5 h-[18px] min-w-[18px] text-[11px]"}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Closes a dialog on Escape and stops the page behind it from scrolling. */
function useDialog(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
}

export function NavLinks({ lang, handle, unread: initial, isModerator, isStaff = false, signedIn }: { lang: Lang; handle: string | null; unread: Promise<Unread> | null; isModerator: boolean; isStaff?: boolean; signedIn: boolean }) {
  const pathname = usePathname();
  const unread = useLiveUnread(initial, signedIn);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = dict(lang);
  useDialog(open, () => setOpen(false));
  return (
    <>
      <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
        {items(lang, handle, unread, isModerator, signedIn, isStaff).map((it) => {
          const Icon = I[it.icon];
          const on = active(pathname, it);
          return (
            <Link key={it.href + it.label} href={it.href} aria-current={on ? "page" : undefined} className={`tap flex h-12 items-center gap-4 rounded-full px-3 text-[18px] hover:bg-paper active:bg-line/60 ${on ? "font-bold" : "font-medium"}`}>
              <span className="relative">
                <Icon className="h-[26px] w-[26px]" filled={on} />
                <Badge n={it.badge} />
              </span>
              <span className="hidden xl:inline">{it.label}</span>
            </Link>
          );
        })}
      </nav>
      {signedIn && (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary mt-3 h-12 w-12 !px-0 xl:w-full xl:!px-6" aria-label={t.nav.post}>
          <I.plus className="h-6 w-6 xl:hidden" />
          <span className="hidden xl:inline">{t.nav.post}</span>
        </button>
      )}
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t.nav.post} className="fade-in fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-0 sm:p-4 sm:pt-[10vh]" onClick={() => setOpen(false)}>
          <div className="sheet-up w-full max-w-xl rounded-b-3xl bg-card p-4 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button type="button" aria-label={t.common.close} onClick={() => setOpen(false)} className="icon-btn"><I.x className="h-5 w-5" /></button>
            </div>
            <Composer lang={lang} autoFocus onPosted={(id) => { setOpen(false); router.push(`/p/${id}`); }} />
          </div>
        </div>
      )}
    </>
  );
}

type MobileProps = {
  lang: Lang;
  handle: string | null;
  name?: string | null;
  avatar?: string | null;
  unread: Promise<Unread> | null;
  signedIn: boolean;
  isModerator?: boolean;
  isStaff?: boolean;
};

export function MobileNav({ lang, handle, name, avatar, unread: initial, signedIn, isModerator = false, isStaff = false }: MobileProps) {
  const pathname = usePathname();
  const unread = useLiveUnread(initial, signedIn);
  const [menu, setMenu] = useState(false);
  const t = dict(lang).nav;
  useDialog(menu, () => setMenu(false));
  // Any navigation closes the menu.
  useEffect(() => setMenu(false), [pathname]);

  const list: Item[] = signedIn
    ? [
        { href: "/accueil", label: t.home, icon: "home" },
        { href: "/explorer", label: t.explore, icon: "search", match: ["/explorer", "/t/"] },
        { href: "/mes-elus", label: t.myOfficials, icon: "landmark", match: ["/mes-elus", "/elus", "/interpellations", "/barometre", "/idees"] },
        { href: "/notifications", label: t.notifications, icon: "bell", badge: unread.notifications },
        { href: "/messages", label: t.messages, icon: "mail", badge: unread.messages },
      ]
    : [
        { href: "/explorer", label: t.explore, icon: "search" },
        { href: "/elus", label: t.officials, icon: "landmark" },
        { href: "/connexion", label: t.login, icon: "user" },
      ];

  // Everything that does not fit in the bar lives in the menu sheet, so a phone reaches every page.
  const more: Item[] = signedIn
    ? [
        { href: `/u/${handle}`, label: t.profile, icon: "user" },
        { href: "/signets", label: t.bookmarks, icon: "bookmark" },
        { href: "/barometre", label: lang === "fr" ? "Baromètre" : "Barometer", icon: "chart" },
        { href: "/idees", label: lang === "fr" ? "Boîte à idées" : "Idea box", icon: "bulb" },
        { href: "/parametres", label: t.settings, icon: "settings" },
        ...(isModerator ? [{ href: "/admin", label: t.admin, icon: "shield" as const }] : []),
        ...(isStaff ? [{ href: "/controle", label: lang === "fr" ? "Centre de contrôle" : "Control center", icon: "sliders" as const }] : []),
      ]
    : [];
  const menuOn = more.some((it) => active(pathname, it)) && !list.some((it) => active(pathname, it));

  return (
    <>
      <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-lg sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex h-[58px] max-w-[620px] items-stretch px-1">
          {list.map((it) => {
            const Icon = I[it.icon];
            const on = active(pathname, it);
            return (
              <Link key={it.href} href={it.href} aria-label={it.label} aria-current={on ? "page" : undefined} className={`tap group relative flex flex-1 flex-col items-center justify-center active:scale-90 ${on ? "text-ink" : "text-muted"}`}>
                <span className={`relative flex h-9 w-12 items-center justify-center rounded-full transition-colors duration-150 group-active:bg-line/60 ${on ? "bg-paper" : ""}`}>
                  <Icon className="h-[25px] w-[25px]" filled={on} />
                  <Badge n={it.badge} small />
                </span>
              </Link>
            );
          })}
          {signedIn && (
            <button type="button" aria-label={t.more} aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu(true)} className="tap group flex flex-1 items-center justify-center active:scale-90">
              <span className={`flex h-9 w-12 items-center justify-center rounded-full transition-colors duration-150 group-active:bg-line/60 ${menuOn ? "bg-paper" : ""}`}>
                <Avatar src={avatar} name={name || handle || "?"} size={28} className={menuOn ? "ring-2 ring-ink" : "ring-1 ring-line"} />
              </span>
            </button>
          )}
        </div>
      </nav>

      {menu && (
        <div role="dialog" aria-modal="true" aria-label={t.more} className="fade-in fixed inset-0 z-50 flex items-end bg-black/50 sm:hidden" onClick={() => setMenu(false)}>
          <div className="sheet-up max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] bg-card px-2 pt-2 shadow-2xl" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }} onClick={(e) => e.stopPropagation()}>
            <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line" />
            <Link href={`/u/${handle}`} className="tap-row flex items-center gap-3 rounded-2xl px-3 py-3">
              <Avatar src={avatar} name={name || handle || "?"} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-bold">{name}</span>
                <span className="block truncate text-[14px] text-muted">@{handle}</span>
              </span>
            </Link>
            <div className="mx-3 my-1 border-t border-line" />
            <ul>
              {more.slice(1).map((it) => {
                const Icon = I[it.icon];
                const on = active(pathname, it);
                return (
                  <li key={it.href}>
                    <Link href={it.href} aria-current={on ? "page" : undefined} className={`tap-row flex h-[52px] items-center gap-4 rounded-2xl px-3 text-[16px] ${on ? "font-bold" : "font-medium"}`}>
                      <Icon className="h-6 w-6 text-muted" />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mx-3 my-1 border-t border-line" />
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[15px] font-medium">{lang === "fr" ? "Langue" : "Language"}</span>
              <LangSwitch lang={lang} />
            </div>
            <div className="mx-3 my-1 border-t border-line" />
            <div className="flex items-center justify-between px-3 py-2">
              <span className="flex gap-4 text-[13px] text-muted">
                <Link href="/regles" className="hover:underline">{lang === "fr" ? "Règles" : "Rules"}</Link>
                <Link href="/confidentialite" className="hover:underline">{lang === "fr" ? "Confidentialité" : "Privacy"}</Link>
              </span>
              <form action={signOut}>
                <button type="submit" className="tap flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-semibold text-muted hover:bg-paper active:bg-line/60">
                  <I.logout className="h-[18px] w-[18px]" />
                  {t.logout}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ComposeFab({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const t = dict(lang);
  useDialog(open, () => setOpen(false));
  if (pathname.startsWith("/messages/") || pathname.startsWith("/parametres") || pathname.startsWith("/controle") || pathname.startsWith("/admin")) return null;
  return (
    <>
      <button
        type="button"
        aria-label={t.nav.post}
        onClick={() => setOpen(true)}
        className="tap fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green text-white shadow-[0_10px_24px_-8px_rgba(10,122,74,0.8)] active:scale-90 active:bg-[#085C39] sm:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 74px)" }}
      >
        <I.plus className="h-7 w-7" />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t.nav.post} className="sheet-up fixed inset-0 z-50 overflow-y-auto bg-card p-4 sm:hidden">
          <div className="mb-2 flex justify-between">
            <button type="button" onClick={() => setOpen(false)} className="tap -ml-2 rounded-full px-3 py-1.5 text-[15px] font-semibold active:bg-line/60">{t.common.cancel}</button>
          </div>
          <Composer lang={lang} autoFocus onPosted={(id) => { setOpen(false); router.push(`/p/${id}`); }} />
        </div>
      )}
    </>
  );
}
