"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { t as dict } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Composer } from "../composer";
import { I } from "../ui/icons";

type Unread = { notifications: number; messages: number };
type Item = { href: string; label: string; icon: keyof typeof I; badge?: number; match?: string[] };

function items(lang: "fr" | "en", handle: string | null, unread: Unread, isModerator: boolean, signedIn: boolean): Item[] {
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
  ];
}

function useLiveUnread(initial: Unread, signedIn: boolean) {
  const [unread, setUnread] = useState(initial);
  const pathname = usePathname();
  // The desktop and mobile navs each mount this hook: a channel name can only be subscribed once.
  const instance = useId();
  useEffect(() => setUnread(initial), [initial.notifications, initial.messages]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!signedIn) return;
    const supabase = supabaseBrowser();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      const uid = data.user?.id;
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

export function NavLinks({ lang, handle, unread: initial, isModerator, signedIn }: { lang: "fr" | "en"; handle: string | null; unread: Unread; isModerator: boolean; signedIn: boolean }) {
  const pathname = usePathname();
  const unread = useLiveUnread(initial, signedIn);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = dict(lang);
  return (
    <>
      <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
        {items(lang, handle, unread, isModerator, signedIn).map((it) => {
          const Icon = I[it.icon];
          const on = active(pathname, it);
          return (
            <Link key={it.href + it.label} href={it.href} aria-current={on ? "page" : undefined} className={`flex h-12 items-center gap-4 rounded-full px-3 text-[18px] hover:bg-paper ${on ? "font-bold" : "font-medium"}`}>
              <span className="relative">
                <Icon className="h-[26px] w-[26px]" filled={on} />
                {Boolean(it.badge) && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange px-1 text-[11px] font-bold text-white">{it.badge! > 99 ? "99+" : it.badge}</span>
                )}
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
        <div role="dialog" aria-modal="true" aria-label={t.nav.post} className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-0 sm:p-4 sm:pt-[10vh]" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl rounded-b-3xl bg-card p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button type="button" aria-label={t.common.close} onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-paper"><I.x className="h-5 w-5" /></button>
            </div>
            <Composer lang={lang} autoFocus onPosted={(id) => { setOpen(false); router.push(`/p/${id}`); }} />
          </div>
        </div>
      )}
    </>
  );
}

export function MobileNav({ lang, handle, unread: initial, signedIn }: { lang: "fr" | "en"; handle: string | null; unread: Unread; signedIn: boolean }) {
  const pathname = usePathname();
  const unread = useLiveUnread(initial, signedIn);
  const t = dict(lang).nav;
  const list: Item[] = signedIn
    ? [
        { href: "/accueil", label: t.home, icon: "home" },
        { href: "/explorer", label: t.explore, icon: "search", match: ["/explorer", "/t/"] },
        { href: "/mes-elus", label: t.myOfficials, icon: "landmark", match: ["/mes-elus", "/elus", "/interpellations", "/barometre", "/idees"] },
        { href: "/notifications", label: t.notifications, icon: "bell", badge: unread.notifications },
        { href: "/messages", label: t.messages, icon: "mail", badge: unread.messages },
        { href: `/u/${handle}`, label: t.profile, icon: "user" },
      ]
    : [
        { href: "/explorer", label: t.explore, icon: "search" },
        { href: "/elus", label: t.officials, icon: "landmark" },
        { href: "/connexion", label: t.login, icon: "user" },
      ];
  return (
    <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-line bg-bg/95 backdrop-blur sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {list.map((it) => {
        const Icon = I[it.icon];
        const on = active(pathname, it);
        return (
          <Link key={it.href} href={it.href} aria-label={it.label} aria-current={on ? "page" : undefined} className={`relative flex flex-1 items-center justify-center ${on ? "text-ink" : "text-muted"}`}>
            <span className="relative">
              <Icon className="h-[26px] w-[26px]" filled={on} />
              {Boolean(it.badge) && <span className="absolute -right-1.5 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold text-white">{it.badge! > 99 ? "99+" : it.badge}</span>}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ComposeFab({ lang }: { lang: "fr" | "en" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const t = dict(lang);
  if (pathname.startsWith("/messages/")) return null;
  return (
    <>
      <button type="button" aria-label={t.nav.post} onClick={() => setOpen(true)} className="fixed bottom-[72px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green text-white shadow-lg sm:hidden">
        <I.plus className="h-7 w-7" />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t.nav.post} className="fixed inset-0 z-50 bg-card p-4 sm:hidden">
          <div className="mb-2 flex justify-between">
            <button type="button" onClick={() => setOpen(false)} className="text-[15px] font-semibold">{t.common.cancel}</button>
          </div>
          <Composer lang={lang} autoFocus onPosted={(id) => { setOpen(false); router.push(`/p/${id}`); }} />
        </div>
      )}
    </>
  );
}
