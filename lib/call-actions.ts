"use server";

import { randomUUID } from "node:crypto";
import { broadcast, callsConfigured, iceServers, inboxTopic } from "@/lib/calls";
import { callText } from "@/lib/call-i18n";
import { pushCall } from "@/lib/push";
import { allowed, getSettings } from "@/lib/settings";
import { createClient, createServiceClient, getViewer } from "@/lib/supabase/server";

type Fail = { ok: false; error: "unauthenticated" | "unavailable" | "forbidden" | "blocked" | "invalid" };
export type Peer = { id: string; display_name: string; handle: string; avatar_url: string | null };
export type StartedCall = { ok: true; callId: string; ice: RTCIceServer[]; peer: Peer };

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Checks that the viewer may call in this conversation and returns the other member.
 * Calls are one-to-one: the conversation must have exactly two members, nobody blocked.
 */
async function check(conversationId: string) {
  if (!UUID.test(conversationId)) return { ok: false, error: "invalid" } as Fail;
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthenticated" } as Fail;
  if (!callsConfigured()) return { ok: false, error: "unavailable" } as Fail;
  const settings = await getSettings();
  if (!allowed(settings, "messages", Boolean(viewer.is_admin || viewer.is_owner))) return { ok: false, error: "unavailable" } as Fail;
  if (viewer.suspended_until && new Date(viewer.suspended_until) > new Date()) return { ok: false, error: "forbidden" } as Fail;
  // Row level security only lets members read a conversation's member list.
  const supabase = await createClient();
  const { data } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", conversationId);
  const ids = ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  if (ids.length !== 2 || !ids.includes(viewer.id)) return { ok: false, error: "forbidden" } as Fail;
  const otherId = ids.find((x) => x !== viewer.id)!;
  const { data: prof } = await supabase.from("profiles").select("id, display_name, handle, avatar_url, lang, deleted_at").eq("id", otherId).maybeSingle();
  const other = prof as (Peer & { lang: "fr" | "en"; deleted_at: string | null }) | null;
  if (!other || other.deleted_at) return { ok: false, error: "forbidden" } as Fail;
  const svc = createServiceClient();
  if (svc) {
    const { data: blocked } = await svc.rpc("is_blocked_between", { a: viewer.id, b: other.id });
    if (blocked) return { ok: false, error: "blocked" } as Fail;
  }
  const me: Peer = { id: viewer.id, display_name: viewer.display_name, handle: viewer.handle, avatar_url: viewer.avatar_url };
  return { ok: true as const, viewer: me, other };
}

function ringPayload(callId: string, conversationId: string, video: boolean, from: Peer) {
  return { call_id: callId, conversation_id: conversationId, video, from, at: Date.now() };
}

/** Starts a call: relay credentials for the caller, and the other member's phones start ringing. */
export async function startCall(conversationId: string, video: boolean): Promise<StartedCall | Fail> {
  const c = await check(conversationId);
  if (!c.ok) return c;
  const ice = await iceServers();
  if (!ice) return { ok: false, error: "unavailable" };
  const callId = randomUUID();
  await broadcast(inboxTopic(c.other.id), "ring", ringPayload(callId, conversationId, Boolean(video), c.viewer));
  const t = callText(c.other.lang);
  void pushCall(c.other.id, {
    title: video ? t.pushVideo(c.viewer.display_name) : t.pushVoice(c.viewer.display_name),
    body: t.pushTap,
    url: `/messages/${conversationId}`,
    tag: `call-${callId}`,
    icon: c.viewer.avatar_url,
    ringing: true,
  }).catch(() => {});
  return { ok: true, callId, ice, peer: { id: c.other.id, display_name: c.other.display_name, handle: c.other.handle, avatar_url: c.other.avatar_url } };
}

/**
 * Rings again while the call is unanswered, so a phone that opens the app from the notification
 * still sees the incoming call. No push this time.
 */
export async function ringAgain(callId: string, conversationId: string, video: boolean) {
  if (!UUID.test(callId)) return { ok: false };
  const c = await check(conversationId);
  if (!c.ok) return { ok: false };
  await broadcast(inboxTopic(c.other.id), "ring", ringPayload(callId, conversationId, Boolean(video), c.viewer));
  return { ok: true };
}

/** The caller gave up or nobody answered: stop the ringing everywhere and leave a "missed call" notification. */
export async function endRing(callId: string, conversationId: string, missed: boolean) {
  if (!UUID.test(callId)) return { ok: false };
  const c = await check(conversationId);
  if (!c.ok) return { ok: false };
  await broadcast(inboxTopic(c.other.id), "cancel", { call_id: callId });
  if (missed) {
    const t = callText(c.other.lang);
    await pushCall(c.other.id, { title: t.missedFrom(c.viewer.display_name), body: t.pushMissed, url: `/messages/${conversationId}`, tag: `call-${callId}`, icon: c.viewer.avatar_url, ringing: false }).catch(() => {});
  }
  return { ok: true };
}

/** Relay credentials for the person answering. */
export async function answerIce(conversationId: string): Promise<{ ok: true; ice: RTCIceServer[] } | Fail> {
  const c = await check(conversationId);
  if (!c.ok) return c;
  const ice = await iceServers();
  if (!ice) return { ok: false, error: "unavailable" };
  return { ok: true, ice };
}
