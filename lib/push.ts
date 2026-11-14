import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";
import { apnsConfigured, fcmConfigured, NATIVE_PREFIX, sendNative } from "@/lib/native-push";
import { DEFAULT_PREFS, describe, hrefFor, type Lang, type NotifType } from "@/lib/notify";

/**
 * Web Push sender. Keys come from the host's environment, never from the repo:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: URL).
 */
let ready: boolean | null = null;
/** Web Push or native (app) push: at least one way to reach a device. */
export const pushConfigured = () => webPushConfigured() || fcmConfigured() || apnsConfigured();
function webPushConfigured() {
  if (ready !== null) return ready;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://politique.prototypex.org", pub, priv);
  return (ready = true);
}

type Row = { id: string; user_id: string; actor_id: string | null; type: NotifType; post_id: string | null; ref_id: string | null; created_at: string };
type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag: string; icon?: string; badge?: string; ts: number; type: NotifType; unread?: number };

const URGENT: NotifType[] = ["message", "reply", "mention", "quote", "official_post", "interpellation_answer", "moderation", "verification"];

/** Sends every subscription of a user one payload. Removes subscriptions the push service says are gone. */
async function sendTo(subs: Sub[], payload: PushPayload) {
  const svc = createServiceClient();
  const gone: string[] = [];
  const used: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      // Android and iOS apps: native push (FCM / APNs).
      if (s.endpoint.startsWith(NATIVE_PREFIX)) {
        const r = await sendNative(s.endpoint, {
          title: payload.title,
          body: payload.body,
          url: payload.url,
          tag: payload.tag,
          type: payload.type,
          urgent: URGENT.includes(payload.type),
          ttlSeconds: payload.type === "message" ? 60 * 60 * 24 : 60 * 60 * 12,
          badge: payload.unread,
        });
        if (r === "ok") used.push(s.id);
        else if (r === "gone") gone.push(s.id);
        return;
      }
      if (!webPushConfigured()) return;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: payload.type === "message" ? 60 * 60 * 24 : 60 * 60 * 12,
          urgency: URGENT.includes(payload.type) ? "high" : "normal",
          topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
        });
        used.push(s.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error("push failed", code, (e as Error).message);
      }
    }),
  );
  if (svc && gone.length) await svc.from("push_subscriptions").delete().in("id", gone);
  if (svc && used.length) await svc.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", used);
  return { sent: used.length, removed: gone.length };
}

/** Called by the database (through /api/push/dispatch) with freshly inserted notification ids. */
export async function dispatchNotifications(ids: string[]) {
  const svc = createServiceClient();
  if (!svc || !pushConfigured() || !ids.length) return { sent: 0, removed: 0 };
  const { data: rows } = await svc.from("notifications").select("id, user_id, actor_id, type, post_id, ref_id, created_at").in("id", ids);
  const list = (rows ?? []) as Row[];
  if (!list.length) return { sent: 0, removed: 0 };

  const users = Array.from(new Set(list.map((r) => r.user_id)));
  const actors = Array.from(new Set(list.map((r) => r.actor_id).filter((x): x is string => Boolean(x))));
  const postIds = Array.from(new Set(list.map((r) => r.post_id).filter((x): x is string => Boolean(x))));
  const convIds = Array.from(new Set(list.filter((r) => r.type === "message" && r.ref_id).map((r) => r.ref_id as string)));

  const [subsRes, recipRes, actorRes, postRes, prefRes, msgRes, unreadRes] = await Promise.all([
    svc.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", users),
    svc.from("profiles").select("id, lang").in("id", users),
    actors.length ? svc.from("profiles").select("id, display_name, handle, avatar_url").in("id", actors) : Promise.resolve({ data: [] }),
    postIds.length ? svc.from("posts").select("id, text").in("id", postIds) : Promise.resolve({ data: [] }),
    svc.from("notification_prefs").select("user_id, previews").in("user_id", users),
    // The newest message per conversation is the one that just arrived.
    convIds.length ? svc.from("messages").select("conversation_id, sender_id, text, created_at").in("conversation_id", convIds).is("deleted_at", null).order("created_at", { ascending: false }).limit(convIds.length * 5) : Promise.resolve({ data: [] }),
    svc.from("notifications").select("user_id").in("user_id", users).is("read_at", null).neq("type", "message").limit(5000),
  ]);

  const subs = (subsRes.data ?? []) as Sub[];
  const lang = new Map(((recipRes.data ?? []) as { id: string; lang: Lang }[]).map((p) => [p.id, p.lang]));
  const actor = new Map(((actorRes.data ?? []) as { id: string; display_name: string; handle: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
  const post = new Map(((postRes.data ?? []) as { id: string; text: string }[]).map((p) => [p.id, p.text]));
  const previews = new Map(((prefRes.data ?? []) as { user_id: string; previews: boolean }[]).map((p) => [p.user_id, p.previews]));
  const msgs = (msgRes.data ?? []) as { conversation_id: string; sender_id: string; text: string }[];
  const unread = new Map<string, number>();
  for (const r of (unreadRes.data ?? []) as { user_id: string }[]) unread.set(r.user_id, (unread.get(r.user_id) ?? 0) + 1);

  let sent = 0, removed = 0;
  for (const r of list) {
    const mine = subs.filter((s) => s.user_id === r.user_id);
    if (!mine.length) continue;
    const a = r.actor_id ? actor.get(r.actor_id) : undefined;
    const msg = r.type === "message" ? msgs.find((m) => m.conversation_id === r.ref_id && m.sender_id === r.actor_id) : undefined;
    const { title, body } = describe({
      type: r.type,
      actorName: a?.display_name ?? null,
      postText: r.post_id ? post.get(r.post_id) : null,
      messageText: msg?.text ?? null,
      lang: lang.get(r.user_id) ?? "fr",
      previews: previews.get(r.user_id) ?? DEFAULT_PREFS.previews,
    });
    const res = await sendTo(mine, {
      title,
      body,
      url: hrefFor({ type: r.type, post_id: r.post_id, ref_id: r.ref_id, actorHandle: a?.handle }),
      // Messages of one conversation replace each other; the rest stack.
      tag: r.type === "message" ? `conv-${r.ref_id}` : r.id,
      icon: a?.avatar_url || "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      ts: new Date(r.created_at).getTime(),
      type: r.type,
      unread: unread.get(r.user_id),
    });
    sent += res.sent;
    removed += res.removed;
  }
  return { sent, removed };
}

/** "Send a test" button in Settings. */
export async function sendTestPush(userId: string, lang: Lang) {
  const svc = createServiceClient();
  if (!svc || !pushConfigured()) return { sent: 0, removed: 0, configured: false };
  const { data } = await svc.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("user_id", userId);
  const res = await sendTo((data ?? []) as Sub[], {
    title: "POLITIQUE",
    body: lang === "fr" ? "Les notifications fonctionnent sur cet appareil." : "Notifications work on this device.",
    url: "/notifications",
    tag: "test",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    ts: Date.now(),
    type: "verification",
  });
  return { ...res, configured: true };
}
