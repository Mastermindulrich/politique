import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POLITIQUE sends its own login codes through Resend, as "POLITIQUE", so the
 * shared Supabase project keeps "Prototype X" as the sender for Prototype X.
 * Supabase still creates and checks the codes; we only deliver the email.
 * Without RESEND_API_KEY or the service key, callers fall back to Supabase's mailer.
 */

const FROM = process.env.AUTH_EMAIL_FROM || "POLITIQUE <politique@prototypex.org>";

export const ownMailer = () => Boolean(process.env.RESEND_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

type Outcome = "sent" | "no_account" | "rate" | "failed";

const hash = (email: string) => createHash("sha256").update(email).digest("hex");

/** At most one code a minute and five an hour per address. */
async function allowed(admin: NonNullable<ReturnType<typeof createServiceClient>>, email: string) {
  const { data, error } = await admin.rpc("auth_email_allowed", { h: hash(email) });
  if (error) return true; // Never lock people out because of the limiter itself.
  return data !== false;
}

export async function sendCode(email: string, kind: "login" | "signup", lang: "fr" | "en", meta?: Record<string, unknown>): Promise<Outcome> {
  const admin = createServiceClient();
  if (!admin) return "failed";
  if (!(await allowed(admin, email))) return "rate";

  let link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error && kind === "signup" && link.error.status === 404) {
    // New to the shared auth project: create the login, then issue the code.
    // The session only exists once the emailed code is entered.
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta });
    if (created.error) return "failed";
    link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  }
  if (link.error) return link.error.status === 404 ? "no_account" : link.error.status === 429 ? "rate" : "failed";
  const code = link.data.properties?.email_otp;
  if (!code) return "failed";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [email], subject: subject(kind, lang, code), html: html(kind, lang, code), text: text(kind, lang, code) }),
  });
  return res.ok ? "sent" : "failed";
}

function subject(kind: "login" | "signup", lang: "fr" | "en", code: string) {
  if (lang === "en") return kind === "signup" ? `Your POLITIQUE sign-up code: ${code}` : `Your POLITIQUE code: ${code}`;
  return kind === "signup" ? `Votre code d'inscription POLITIQUE : ${code}` : `Votre code POLITIQUE : ${code}`;
}

function lines(kind: "login" | "signup", lang: "fr" | "en") {
  if (lang === "en")
    return {
      hello: kind === "signup" ? "Welcome to POLITIQUE," : "Hello,",
      intro: kind === "signup" ? "To finish creating your account, enter this code:" : "Here is your login code:",
      how: "Enter it on the page open in your browser.",
      foot: "This code is only valid for a short time and works once. If you didn't ask for it, you can ignore this email.",
    };
  return {
    hello: kind === "signup" ? "Bienvenue sur POLITIQUE," : "Bonjour,",
    intro: kind === "signup" ? "Pour finaliser votre inscription, saisissez ce code :" : "Voici votre code de connexion :",
    how: "Saisissez-le sur la page ouverte dans votre navigateur.",
    foot: "Ce code n'est valable que peu de temps et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez simplement ce message.",
  };
}

function text(kind: "login" | "signup", lang: "fr" | "en", code: string) {
  const l = lines(kind, lang);
  return `${l.hello}\n\n${l.intro}\n\n${code}\n\n${l.how}\n\n${l.foot}\n\nPOLITIQUE`;
}

function html(kind: "login" | "signup", lang: "fr" | "en", code: string) {
  const l = lines(kind, lang);
  return `<!doctype html><html lang="${lang}"><body style="margin:0;background:#ffffff">
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#16181C">
<p style="font-size:20px;font-weight:700;letter-spacing:2px;margin:0 0 24px">POLITIQUE</p>
<p style="font-size:16px;margin:0 0 12px">${l.hello}</p>
<p style="font-size:16px;margin:0 0 16px">${l.intro}</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px;color:#0A7A4A">${code}</p>
<p style="font-size:15px;margin:0 0 16px">${l.how}</p>
<p style="font-size:13px;color:#5B6169;margin:24px 0 0">${l.foot}</p>
</div></body></html>`;
}
