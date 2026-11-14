"use client";

/** Browser side of Web Push: service worker, permission, subscription. */

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export type PushState = "unsupported" | "ios-needs-install" | "unconfigured" | "denied" | "default" | "on" | "off";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const isIOS = () =>
  typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

async function currentSubscription() {
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerWorker());
  return reg ? { reg, sub: await reg.pushManager.getSubscription() } : null;
}

export async function pushState(): Promise<PushState> {
  // iPhone Safari only offers Web Push once the site is added to the Home Screen.
  if (isIOS() && !isStandalone()) return "ios-needs-install";
  if (!pushSupported()) return "unsupported";
  if (!VAPID) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") return "default";
  const cur = await currentSubscription();
  return cur?.sub ? "on" : "off";
}

async function save(sub: PushSubscription) {
  const r = await fetch("/api/push/subscribe", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  return r.ok;
}

/** Asks for permission (must run from a tap or click), subscribes and saves this device. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported() || !VAPID) return pushState();
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "default";
  const cur = await currentSubscription();
  if (!cur) return "unsupported";
  let sub = cur.sub;
  if (!sub) sub = await cur.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
  return (await save(sub)) ? "on" : "off";
}

export async function disablePush(): Promise<PushState> {
  const cur = pushSupported() ? await currentSubscription() : null;
  if (cur?.sub) {
    await fetch("/api/push/subscribe", { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: cur.sub.endpoint }) }).catch(() => {});
    await cur.sub.unsubscribe().catch(() => false);
  }
  return pushState();
}

/** On sign-out: this browser stops receiving the account's notifications at once. */
export async function forgetDevice() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe().catch(() => false);
}

/** Re-saves an existing subscription for whoever is signed in now (once per tab session). */
export async function syncPush() {
  if (!pushSupported() || !VAPID || Notification.permission !== "granted") return;
  try {
    if (sessionStorage.getItem("push-synced")) return;
  } catch {}
  const cur = await currentSubscription();
  if (cur?.sub && (await save(cur.sub))) {
    try {
      sessionStorage.setItem("push-synced", "1");
    } catch {}
  }
}
