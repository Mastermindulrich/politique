import { createHmac } from "node:crypto";
import { env } from "@/lib/supabase/server";

/**
 * Voice and video calls: server side.
 *
 * Media never touches our servers. Each phone sends its audio/video to Cloudflare's TURN relay,
 * which forwards it to the other phone, encrypted end to end by WebRTC (DTLS-SRTP).
 * Calls are relay-only on purpose (Ulrich, 2026-11-14): no direct phone-to-phone path,
 * so a member's IP address is never shown to the person they call.
 *
 * Signalling ("ringing", offers, answers) goes over Supabase Realtime broadcast. Nothing
 * about a call is written to the database.
 *
 * Environment (Vercel, server only):
 *   CLOUDFLARE_TURN_KEY_ID          Turn Token ID from dash.cloudflare.com > Realtime > TURN
 *   CLOUDFLARE_TURN_KEY_API_TOKEN   its API token
 * Without them calls are switched off and the call buttons are hidden.
 */

const TURN_ID = process.env.CLOUDFLARE_TURN_KEY_ID || "";
const TURN_TOKEN = process.env.CLOUDFLARE_TURN_KEY_API_TOKEN || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Longest call a relay credential is good for. A call past this keeps going; only a reconnect would fail. */
const ICE_TTL = 4 * 60 * 60;

export function callsConfigured() {
  return Boolean(TURN_ID && TURN_TOKEN && SERVICE_KEY && env.url);
}

/**
 * The private Realtime topic where a member's phones listen for incoming calls.
 * It is derived from a server secret, so nobody can guess it from a user id and ring or spy on someone.
 */
export function inboxTopic(userId: string) {
  const mac = createHmac("sha256", `politique-call-inbox:${SERVICE_KEY}`).update(userId).digest("base64url").slice(0, 32);
  return `ring-${mac}`;
}

/** Short-lived relay credentials for one call. Only TURN servers are returned: calls are relay-only. */
export async function iceServers(): Promise<RTCIceServer[] | null> {
  if (!callsConfigured()) return null;
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(TURN_ID)}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TURN_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: ICE_TTL }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("turn credentials failed", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
    const list = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
    // Keep TURN entries only; drop port 53 (blocked by browsers and many networks).
    const turn = list
      .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => /^turns?:/.test(u) && !/:53(\?|$)/.test(u)) }))
      .filter((s) => s.urls.length && s.username && s.credential);
    return turn.length ? turn : null;
  } catch (e) {
    console.error("turn credentials failed", (e as Error).message);
    return null;
  }
}

/** Sends one Realtime broadcast from the server (used to ring a member's inbox). */
export async function broadcast(topic: string, event: string, payload: Record<string, unknown>) {
  if (!SERVICE_KEY || !env.url) return false;
  const headers: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json" };
  // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys only in apikey.
  if (SERVICE_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  try {
    const res = await fetch(`${env.url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
      cache: "no-store",
    });
    if (!res.ok) console.error("call broadcast failed", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error("call broadcast failed", (e as Error).message);
    return false;
  }
}
