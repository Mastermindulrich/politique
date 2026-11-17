"use client";

/**
 * The POLITIQUE Android and iOS apps (folder `mobile/`, Capacitor) open this site in a
 * native WebView. Capacitor injects `window.Capacitor` into our pages, which lets the site
 * reach native push (FCM on Android, APNs on iPhone) instead of Web Push.
 *
 * A native device is stored in `push_subscriptions` like a browser, with a recognisable
 * endpoint `https://native.invalid/<android|ios>/<token>`; lib/push.ts sends to it natively.
 * Plugins are imported lazily, so the website itself never downloads them.
 */

import type { PushState } from "./push-client";

type Platform = "android" | "ios";
type CapGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

export const NATIVE_HOST = "https://native.invalid/";
const OFF_KEY = "native-push-off";
const TOKEN_KEY = "native-push-endpoint";

function cap(): CapGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapGlobal }).Capacitor;
}

export const isNativeApp = () => Boolean(cap()?.isNativePlatform?.());

export function nativePlatform(): Platform | null {
  if (!isNativeApp()) return null;
  const p = cap()?.getPlatform?.();
  return p === "android" || p === "ios" ? p : null;
}

const push = async () => (await import("@capacitor/push-notifications")).PushNotifications;

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {}
  },
};

/** Asks the OS for this install's push token (FCM on Android, APNs on iPhone). */
async function fetchToken(): Promise<string | null> {
  const P = await push();
  return new Promise<string | null>((resolve) => {
    let done = false;
    const handles: Promise<{ remove: () => Promise<void> }>[] = [];
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      handles.forEach((h) => void h.then((x) => x.remove()).catch(() => {}));
      resolve(v);
    };
    handles.push(P.addListener("registration", (t) => finish(t.value)));
    handles.push(P.addListener("registrationError", () => finish(null)));
    window.setTimeout(() => finish(null), 15000);
    P.register().catch(() => finish(null));
  });
}

async function saveToken(platform: Platform, token: string) {
  const endpoint = `${NATIVE_HOST}${platform}/${token}`;
  const r = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, keys: { p256dh: platform, auth: "native" } }),
  });
  if (r.ok) store.set(TOKEN_KEY, endpoint);
  return r.ok;
}

export async function nativePushState(): Promise<PushState> {
  try {
    const perm = await (await push()).checkPermissions();
    if (perm.receive === "denied") return "denied";
    if (perm.receive !== "granted") return "default";
    return store.get(OFF_KEY) || !store.get(TOKEN_KEY) ? "off" : "on";
  } catch {
    return "unsupported";
  }
}

/** Permission prompt, token, saved for the signed-in member. */
export async function enableNativePush(): Promise<PushState> {
  const platform = nativePlatform();
  if (!platform) return "unsupported";
  try {
    const P = await push();
    let perm = await P.checkPermissions();
    if (perm.receive !== "granted") perm = await P.requestPermissions();
    if (perm.receive === "denied") return "denied";
    if (perm.receive !== "granted") return "default";
    const token = await fetchToken();
    if (!token) return "off";
    store.set(OFF_KEY, null);
    return (await saveToken(platform, token)) ? "on" : "off";
  } catch {
    return "off";
  }
}

async function forgetEndpoint() {
  const endpoint = store.get(TOKEN_KEY);
  store.set(TOKEN_KEY, null);
  if (!endpoint) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

export async function disableNativePush(): Promise<PushState> {
  store.set(OFF_KEY, "1");
  await forgetEndpoint();
  return nativePushState();
}

/** Sign-out: the server forgets this phone and the OS token is revoked (so a late send is refused too). */
export async function forgetNativeDevice() {
  await forgetEndpoint();
  try {
    await (await push()).unregister();
  } catch {}
}

/** Keeps the token current and tied to whoever is signed in (tokens rotate). Once per app session. */
export async function syncNativePush() {
  const platform = nativePlatform();
  if (!platform || store.get(OFF_KEY)) return;
  try {
    if (sessionStorage.getItem("push-synced")) return;
    const perm = await (await push()).checkPermissions();
    if (perm.receive !== "granted") return;
    const token = await fetchToken();
    if (token && (await saveToken(platform, token))) sessionStorage.setItem("push-synced", "1");
  } catch {}
}

/**
 * App-wide native hooks: Android notification channels, and opening the right page when a
 * notification is tapped. Returns a cleanup function.
 */
export async function initNative(navigate: (path: string) => void) {
  const platform = nativePlatform();
  if (!platform) return () => {};
  const P = await push();
  if (platform === "android") {
    const lang = document.documentElement.lang === "en" ? "en" : "fr";
    await P.createChannel({ id: "messages", name: "Messages", description: lang === "fr" ? "Messages privés" : "Direct messages", importance: 5, visibility: 0, vibration: true }).catch(() => {});
    await P.createChannel({ id: "general", name: lang === "fr" ? "Activité" : "Activity", description: lang === "fr" ? "Réponses, mentions, élus suivis" : "Replies, mentions, followed officials", importance: 4, visibility: 0, vibration: true }).catch(() => {});
  }
  const h = await P.addListener("pushNotificationActionPerformed", (a) => {
    const url = (a.notification.data as { url?: unknown } | undefined)?.url;
    if (typeof url === "string" && url.startsWith("/")) navigate(url);
  });
  return () => void h.remove();
}
