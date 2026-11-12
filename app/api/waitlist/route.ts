import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = new Set(["citoyen", "elu", "media", "autre"]);

// Tiny in-memory rate limit per instance. Good enough for a waitlist;
// the real guard is Resend's own duplicate handling.
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n += 1;
  return h.n > 10;
}

export async function POST(req: Request) {
  let body: { email?: string; role?: string; lang?: string; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // Honeypot: real users never fill this field.
  if (body.website) return NextResponse.json({ ok: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ ok: false, error: "rate" }, { status: 429 });

  const email = (body.email || "").trim().toLowerCase();
  const role = ROLES.has(body.role || "") ? (body.role as string) : "autre";
  const lang = body.lang === "en" ? "en" : "fr";
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: "email" }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  const audience = process.env.RESEND_AUDIENCE_ID;

  if (!key || !audience) {
    console.log("[waitlist] (not stored: RESEND_API_KEY/RESEND_AUDIENCE_ID missing)", { email, role, lang });
    return NextResponse.json({ ok: true, stored: false });
  }

  const res = await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      unsubscribed: false,
      // Resend contacts only have first/last name as free text; we use
      // first_name to carry role and language until custom properties are set up.
      first_name: `${role}/${lang}`,
    }),
  });

  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => "");
    console.error("[waitlist] resend error", res.status, text);
    return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
  }

  const notifyTo = process.env.WAITLIST_NOTIFY_TO;
  const from = process.env.WAITLIST_FROM;
  if (notifyTo && from) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [notifyTo],
        subject: `POLITIQUE waitlist: ${role} (${lang})`,
        text: `${email}\nrole: ${role}\nlang: ${lang}`,
      }),
    }).catch((e) => console.error("[waitlist] notify failed", e));
  }

  return NextResponse.json({ ok: true, stored: true });
}
