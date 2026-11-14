"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { messagePreview } from "@/lib/dm-media";
import { describe, hrefFor, type Lang, type NotifType } from "@/lib/notify";
import { forgetDevice, registerWorker, syncPush } from "@/lib/push-client";
import { supabaseBrowser } from "@/lib/supabase/client";
import { unreadStore, useUnread } from "@/lib/unread-store";
import { Avatar } from "../ui/avatar";
import { I } from "../ui/icons";
import { PushPrompt } from "./push-prompt";

type Row = { id: string; user_id: string; actor_id: string | null; type: NotifType; post_id: string | null; ref_id: string | null };
type Toast = { id: string; title: string; body: string; href: string; avatar: string | null; name: string; type: NotifType };

const TOAST_MS = 6000;
const MAX_TOASTS = 3;

// ---------------------------------------------------------------------------
// Sound: a short two-note chime made with Web Audio (no file to download).
// Browsers only allow sound after the person has touched the page once.
// ---------------------------------------------------------------------------
let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") void audio.resume();
  } catch {}
}
export function chime(kind: "message" | "other") {
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  const notes = kind === "message" ? [880, 1318.5] : [1046.5];
  notes.forEach((f, i) => {
    const o = audio!.createOscillator();
    const g = audio!.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const t = now + i * 0.11;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(audio!.destination);
    o.start(t);
    o.stop(t + 0.35);
  });
}

/**
 * Everything that makes the site feel alive when something happens to you:
 * live unread badges, a banner with a sound for each new notification or message,
 * the count in the tab title and on the installed app's icon, and the push
 * subscription kept in step with the signed-in account.
 */
export function NotificationCenter({ lang, viewerId, initial }: { lang: Lang; viewerId: string; initial: Promise<{ notifications: number; messages: number }> | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnread();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sound = useRef(true);
  const path = useRef(pathname);
  path.current = pathname;

  // First counts from the server, then live.
  useEffect(() => {
    let live = true;
    if (initial) Promise.resolve(initial).then((u) => live && unreadStore.set(u), () => {});
    return () => {
      live = false;
    };
  }, [initial]);

  const refresh = useCallback(async () => {
    const { data } = await supabaseBrowser().rpc("unread_counts");
    const u = (data as { notifications: number; messages: number }[] | null)?.[0];
    if (u) unreadStore.set({ notifications: Number(u.notifications), messages: Number(u.messages) });
  }, []);

  // Sound preference, read once and updated live by the settings form.
  useEffect(() => {
    supabaseBrowser()
      .from("notification_prefs")
      .select("sound")
      .eq("user_id", viewerId)
      .maybeSingle()
      .then(({ data }: { data: { sound: boolean } | null }) => {
        if (data) sound.current = data.sound;
      });
    const onPrefs = (e: Event) => {
      const d = (e as CustomEvent<{ sound?: boolean }>).detail;
      if (typeof d?.sound === "boolean") sound.current = d.sound;
    };
    window.addEventListener("politique:prefs", onPrefs);
    return () => window.removeEventListener("politique:prefs", onPrefs);
  }, [viewerId]);

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    async (row: Row) => {
      const supabase = supabaseBrowser();
      const [actor, post, msg] = await Promise.all([
        row.actor_id ? supabase.from("profiles").select("display_name, handle, avatar_url").eq("id", row.actor_id).maybeSingle() : Promise.resolve({ data: null }),
        row.post_id ? supabase.from("posts").select("text").eq("id", row.post_id).maybeSingle() : Promise.resolve({ data: null }),
        row.type === "message" && row.ref_id
          ? supabase.from("messages").select("text, media").eq("conversation_id", row.ref_id).order("created_at", { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const a = actor.data as { display_name: string; handle: string; avatar_url: string | null } | null;
      const { title, body } = describe({
        type: row.type,
        actorName: a?.display_name ?? null,
        postText: (post.data as { text: string } | null)?.text ?? null,
        messageText: msg.data ? messagePreview((msg.data as { text: string; media: unknown }).text, (msg.data as { media: unknown }).media, lang) || null : null,
        lang,
      });
      const toast: Toast = { id: row.id, title, body, href: hrefFor({ ...row, actorHandle: a?.handle }), avatar: a?.avatar_url ?? null, name: a?.display_name ?? "POLITIQUE", type: row.type };
      setToasts((t) => [toast, ...t.filter((x) => x.id !== row.id && !(row.type === "message" && x.type === "message" && x.href === toast.href))].slice(0, MAX_TOASTS));
      if (sound.current && document.visibilityState === "visible") chime(row.type === "message" ? "message" : "other");
      window.setTimeout(() => dismiss(row.id), TOAST_MS);
    },
    [lang, dismiss],
  );

  // Live notifications over Supabase Realtime.
  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`notify-${viewerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "politique", table: "notifications", filter: `user_id=eq.${viewerId}` }, (payload: { new: Row }) => {
        const row = payload.new;
        const openChat = row.type === "message" && path.current === `/messages/${row.ref_id}`;
        if (row.type === "message") {
          // The conversation on screen is read as it arrives: no badge, no banner.
          if (!openChat && !path.current.startsWith("/messages")) unreadStore.set((u) => ({ ...u, messages: u.messages + 1 }));
          if (openChat) return;
        } else if (path.current === "/notifications") {
          // Already looking at the list: it refreshes, no badge.
          router.refresh();
        } else {
          unreadStore.set((u) => ({ ...u, notifications: u.notifications + 1 }));
        }
        void show(row);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewerId, show, router]);

  // Phones pause the live connection in the background: recount when the page comes back.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Opening a page clears its badge locally; the server marks rows read.
  useEffect(() => {
    if (pathname === "/notifications") unreadStore.set((u) => ({ ...u, notifications: 0 }));
    if (pathname.startsWith("/messages")) unreadStore.set((u) => ({ ...u, messages: 0 }));
    setToasts((t) => t.filter((x) => x.href !== pathname));
  }, [pathname]);

  // Count in the tab title and on the installed app's icon.
  const total = unread.notifications + unread.messages;
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\+?\) /, "");
      const want = total ? `(${total > 99 ? "99+" : total}) ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (total && nav.setAppBadge) nav.setAppBadge(total).catch(() => {});
    else if (!total && nav.clearAppBadge) nav.clearAppBadge().catch(() => {});
    return () => mo.disconnect();
  }, [total]);

  // Service worker: register, keep the subscription with this account, follow taps on notifications.
  useEffect(() => {
    void registerWorker().then(() => syncPush());
    const onMsg = (e: MessageEvent) => {
      if (e.data?.kind === "navigate" && typeof e.data.url === "string") router.push(new URL(e.data.url).pathname);
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    // Signing out unsubscribes this browser, so a shared phone stops receiving the account's notifications.
    const onSubmit = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-signout]")) {
        try {
          sessionStorage.removeItem("push-synced");
        } catch {}
        void forgetDevice();
      }
    };
    document.addEventListener("submit", onSubmit, true);
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [router]);

  return (
    <>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end sm:px-0"
        style={{ paddingTop: "max(env(safe-area-inset-top), 10px)" }}
      >
        {toasts.map((t) => (
          <div key={t.id} role="status" className="toast-in pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-2xl border border-line bg-card/95 p-3 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] backdrop-blur sm:w-[380px]">
            <Link href={t.href} onClick={() => dismiss(t.id)} className="flex min-w-0 flex-1 items-start gap-3">
              <span className="relative flex-none">
                <Avatar src={t.avatar} name={t.name} size={40} />
                <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-card ${t.type === "message" ? "bg-green text-white" : "bg-orange text-white"}`}>
                  {t.type === "message" ? <I.mail className="h-3 w-3" /> : <I.bell className="h-3 w-3" />}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{t.title}</span>
                {t.body && <span className="line-clamp-2 block text-[14px] leading-snug text-muted">{t.body}</span>}
              </span>
            </Link>
            <button type="button" onClick={() => dismiss(t.id)} aria-label={lang === "fr" ? "Fermer" : "Close"} className="icon-btn -mr-1 -mt-1 flex-none">
              <I.x className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <PushPrompt lang={lang} />
    </>
  );
}
