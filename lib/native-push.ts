import { createSign, sign as cryptoSign, createPrivateKey } from "node:crypto";
import http2 from "node:http2";

/**
 * Native push for the Android and iOS apps (folder `mobile/`), with no extra dependency.
 *
 * Android goes through Firebase Cloud Messaging (HTTP v1):
 *   FCM_SERVICE_ACCOUNT  the Firebase service-account JSON (raw or base64)
 * iPhone goes straight to Apple (APNs, token auth):
 *   APNS_KEY             the .p8 key text (raw, base64, or with \n escapes)
 *   APNS_KEY_ID, APNS_TEAM_ID
 *   APNS_BUNDLE_ID       default org.prototypex.politique
 *   APNS_ENV             "production" or "sandbox"; unset tries production, then sandbox
 *
 * Devices are stored in push_subscriptions with endpoint https://native.invalid/<android|ios>/<token>.
 */

export const NATIVE_PREFIX = "https://native.invalid/";

export type NativeMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
  type: string;
  urgent: boolean;
  ttlSeconds: number;
  badge?: number;
};

/** "ok" delivered, "gone" the token is dead (remove it), "error" anything else. */
export type NativeResult = "ok" | "gone" | "error";

export function parseNative(endpoint: string): { platform: "android" | "ios"; token: string } | null {
  if (!endpoint.startsWith(NATIVE_PREFIX)) return null;
  const [platform, ...rest] = endpoint.slice(NATIVE_PREFIX.length).split("/");
  const token = rest.join("/");
  if ((platform === "android" || platform === "ios") && token) return { platform, token };
  return null;
}

function secretText(v: string | undefined) {
  if (!v) return "";
  const t = v.trim();
  if (t.startsWith("{") || t.startsWith("-----")) return t.replace(/\\n/g, "\n");
  try {
    return Buffer.from(t, "base64").toString("utf8").trim();
  } catch {
    return "";
  }
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

// ---------------------------------------------------------------------------
// Android: FCM HTTP v1
// ---------------------------------------------------------------------------
type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let account: ServiceAccount | null | undefined;
let fcmToken: { value: string; exp: number } | null = null;

function fcmAccount() {
  if (account !== undefined) return account;
  try {
    const a = JSON.parse(secretText(process.env.FCM_SERVICE_ACCOUNT)) as ServiceAccount;
    account = a.project_id && a.client_email && a.private_key ? a : null;
  } catch {
    account = null;
  }
  return account;
}

export const fcmConfigured = () => Boolean(fcmAccount());

async function fcmAccessToken(a: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  if (fcmToken && fcmToken.exp - 120 > now) return fcmToken.value;
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${claims}`);
  const jwt = `${head}.${claims}.${b64url(signer.sign(a.private_key))}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!r.ok) throw new Error(`fcm oauth ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  fcmToken = { value: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}

export async function sendFcm(token: string, m: NativeMessage): Promise<NativeResult> {
  const a = fcmAccount();
  if (!a) return "error";
  try {
    const access = await fcmAccessToken(a);
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: m.title, body: m.body },
          data: { url: m.url, type: m.type, tag: m.tag },
          android: {
            priority: m.urgent ? "high" : "normal",
            ttl: `${m.ttlSeconds}s`,
            collapse_key: m.tag.slice(0, 64),
            notification: {
              tag: m.tag,
              channel_id: m.type === "message" ? "messages" : "general",
              icon: "ic_stat_politique",
              color: "#F07C00",
              default_sound: true,
              notification_count: m.badge,
            },
          },
        },
      }),
    });
    if (r.ok) return "ok";
    const text = await r.text();
    if (r.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(text)) return "gone";
    if (r.status === 400 && /INVALID_ARGUMENT/.test(text) && /token/i.test(text)) return "gone";
    console.error("fcm failed", r.status, text.slice(0, 300));
    return "error";
  } catch (e) {
    console.error("fcm failed", (e as Error).message);
    return "error";
  }
}

// ---------------------------------------------------------------------------
// iPhone: APNs over HTTP/2 with a token (.p8) key
// ---------------------------------------------------------------------------
let apnsJwt: { value: string; at: number } | null = null;

export const apnsConfigured = () => Boolean(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);

function apnsToken() {
  const now = Math.floor(Date.now() / 1000);
  // Apple wants a token refreshed between 20 and 60 minutes.
  if (apnsJwt && now - apnsJwt.at < 40 * 60) return apnsJwt.value;
  const key = createPrivateKey(secretText(process.env.APNS_KEY));
  const head = b64url(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: now }));
  const sig = cryptoSign("sha256", Buffer.from(`${head}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  apnsJwt = { value: `${head}.${claims}.${b64url(sig)}`, at: now };
  return apnsJwt.value;
}

function apnsRequest(host: string, token: string, headers: Record<string, string>, body: string) {
  return new Promise<{ status: number; reason: string }>((resolve) => {
    const client = http2.connect(`https://${host}`);
    let settled = false;
    const done = (status: number, reason: string) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve({ status, reason });
    };
    client.on("error", (e) => done(0, e.message));
    client.setTimeout(10000, () => done(0, "timeout"));
    const req = client.request({ ":method": "POST", ":path": `/3/device/${token}`, ...headers });
    let status = 0;
    let data = "";
    req.setEncoding("utf8");
    req.on("response", (h) => (status = Number(h[":status"]) || 0));
    req.on("data", (c: string) => (data += c));
    req.on("end", () => {
      let reason = "";
      try {
        reason = data ? (JSON.parse(data) as { reason?: string }).reason ?? "" : "";
      } catch {}
      done(status, reason);
    });
    req.on("error", (e) => done(0, e.message));
    req.end(body);
  });
}

export async function sendApns(token: string, m: NativeMessage): Promise<NativeResult> {
  if (!apnsConfigured()) return "error";
  try {
    const headers: Record<string, string> = {
      authorization: `bearer ${apnsToken()}`,
      "apns-topic": process.env.APNS_BUNDLE_ID || "org.prototypex.politique",
      "apns-push-type": "alert",
      "apns-priority": m.urgent ? "10" : "5",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + m.ttlSeconds),
      "apns-collapse-id": m.tag.slice(0, 64),
      "content-type": "application/json",
    };
    const body = JSON.stringify({
      aps: { alert: { title: m.title, body: m.body }, sound: "default", "thread-id": m.tag, ...(typeof m.badge === "number" ? { badge: m.badge } : {}) },
      url: m.url,
      type: m.type,
    });
    const env = process.env.APNS_ENV;
    const hosts = env === "sandbox" ? ["api.sandbox.push.apple.com"] : env === "production" ? ["api.push.apple.com"] : ["api.push.apple.com", "api.sandbox.push.apple.com"];
    let last = { status: 0, reason: "" };
    for (const host of hosts) {
      last = await apnsRequest(host, token, headers, body);
      if (last.status === 200) return "ok";
      // A development build's token is refused by production (and the reverse): try the other one.
      if (last.reason !== "BadDeviceToken") break;
    }
    if (last.status === 410 || last.reason === "Unregistered" || last.reason === "BadDeviceToken" || last.reason === "DeviceTokenNotForTopic") return "gone";
    console.error("apns failed", last.status, last.reason);
    return "error";
  } catch (e) {
    console.error("apns failed", (e as Error).message);
    return "error";
  }
}

export async function sendNative(endpoint: string, m: NativeMessage): Promise<NativeResult> {
  const n = parseNative(endpoint);
  if (!n) return "error";
  return n.platform === "android" ? sendFcm(n.token, m) : sendApns(n.token, m);
}
