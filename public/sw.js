/* POLITIQUE service worker: Web Push and notification clicks. No offline caching. */
const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";
const isApple = /Safari/.test(self.navigator.userAgent) && !/Chrome|Chromium|Android/.test(self.navigator.userAgent);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "POLITIQUE", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "POLITIQUE";
  const url = data.url || "/notifications";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const focused = wins.find((w) => w.focused && w.visibilityState === "visible");
      // The open, focused tab already shows its own banner and plays its sound. Browsers other
      // than Safari allow skipping the system notification then; Safari requires one per push.
      if (focused && !isApple && data.type !== "verification") {
        focused.postMessage({ kind: "push", data });
        return;
      }
      if (typeof data.unread === "number" && self.navigator.setAppBadge) {
        try { await self.navigator.setAppBadge(data.unread); } catch {}
      }
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: data.icon || ICON,
        badge: BADGE,
        tag: data.tag,
        renotify: Boolean(data.tag),
        timestamp: data.ts || Date.now(),
        data: { url },
        lang: "fr",
        // An incoming call stays on screen and buzzes until it is answered or replaced by "missed call".
        requireInteraction: data.type === "call",
        vibrate: data.type === "call" ? [400, 200, 400, 200, 400] : undefined,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/notifications", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = wins.find((w) => w.url === target) || wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (same) {
        await same.focus();
        if (same.url !== target && "navigate" in same) {
          try { await same.navigate(target); } catch { same.postMessage({ kind: "navigate", url: target }); }
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// The push service rotated the keys: save the new subscription for the same member.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const opts = event.oldSubscription && event.oldSubscription.options;
      if (!opts) return;
      const sub = await self.registration.pushManager.subscribe(opts);
      await fetch("/api/push/subscribe", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    })(),
  );
});
