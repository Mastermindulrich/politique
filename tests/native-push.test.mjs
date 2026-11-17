// Checks the native push sender without reaching Google or Apple: token parsing,
// the FCM service-account JWT and message shape, and the APNs ES256 key handling.
// Run: node --experimental-strip-types tests/native-push.test.mjs
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
process.env.FCM_SERVICE_ACCOUNT = Buffer.from(
  JSON.stringify({ project_id: "politique-test", client_email: "push@politique-test.iam.gserviceaccount.com", private_key: rsa.privateKey.export({ type: "pkcs8", format: "pem" }) }),
).toString("base64");
process.env.APNS_KEY = ec.privateKey.export({ type: "pkcs8", format: "pem" }).replace(/\n/g, "\\n");
process.env.APNS_KEY_ID = "ABC123DEFG";
process.env.APNS_TEAM_ID = "TEAM123456";

const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }), { status: 200 });
  const token = JSON.parse(init.body).message.token;
  if (token === "dead") return new Response(JSON.stringify({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 });
  return new Response("{}", { status: 200 });
};

const m = await import("../lib/native-push.ts");

assert.deepEqual(m.parseNative("https://native.invalid/android/abc:DEF_1"), { platform: "android", token: "abc:DEF_1" });
assert.deepEqual(m.parseNative("https://native.invalid/ios/0a1b2c"), { platform: "ios", token: "0a1b2c" });
assert.equal(m.parseNative("https://fcm.googleapis.com/fcm/send/x"), null);
assert.equal(m.parseNative("https://native.invalid/web/x"), null);
assert.ok(m.fcmConfigured());
assert.ok(m.apnsConfigured());

const msg = { title: "Awa", body: "Bonjour", url: "/messages/1", tag: "conv-1", type: "message", urgent: true, ttlSeconds: 86400, badge: 3 };
assert.equal(await m.sendNative("https://native.invalid/android/tok1", msg), "ok");
const oauth = calls.find((c) => c.url.includes("oauth2"));
const jwt = new URLSearchParams(oauth.init.body).get("assertion");
const [h, c, s] = jwt.split(".");
const v = createVerify("RSA-SHA256");
v.update(`${h}.${c}`);
assert.ok(v.verify(rsa.publicKey, Buffer.from(s, "base64url")), "FCM JWT signature");
assert.equal(JSON.parse(Buffer.from(c, "base64url")).scope, "https://www.googleapis.com/auth/firebase.messaging");
const send = calls.find((x) => x.url.includes("messages:send"));
assert.equal(send.url, "https://fcm.googleapis.com/v1/projects/politique-test/messages:send");
const body = JSON.parse(send.init.body).message;
assert.equal(body.data.url, "/messages/1");
assert.equal(body.android.notification.channel_id, "messages");
assert.equal(body.android.priority, "high");
assert.equal(await m.sendNative("https://native.invalid/android/dead", msg), "gone");
// The OAuth token is reused, not fetched for every message.
assert.equal(calls.filter((x) => x.url.includes("oauth2")).length, 1);

console.log("native push: all checks passed");
