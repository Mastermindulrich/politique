"use client";
// Call diagnostics: a short timeline of each call (signalling steps, ICE and connection states,
// relay errors) sent to the server log, so a failed call on a real phone can be explained.
// No media, no IP addresses, no names: only step names, states and Cloudflare error codes.

type Ev = { t: number; s: string; d?: unknown };
const buf = new Map<string, { start: number; role: string; ev: Ev[] }>();

export function trace(callId: string | undefined | null, step: string, detail?: unknown, role?: string) {
  if (!callId) return;
  let b = buf.get(callId);
  if (!b) {
    b = { start: Date.now(), role: role ?? "?", ev: [] };
    buf.set(callId, b);
  }
  if (role) b.role = role;
  if (b.ev.length < 200) b.ev.push({ t: Date.now() - b.start, s: step, d: detail });
}

/** Sends the timeline (on call end, and when the page is hidden mid-call). */
export function flushTrace(callId: string | undefined | null, final = true) {
  if (!callId) return;
  const b = buf.get(callId);
  if (!b || !b.ev.length) return;
  const body = JSON.stringify({ callId, role: b.role, ua: navigator.userAgent.slice(0, 160), final, ev: b.ev });
  if (final) buf.delete(callId);
  else b.ev = [];
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/call-trace", blob)) void fetch("/api/call-trace", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch {
    /* diagnostics only */
  }
}
