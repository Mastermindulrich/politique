import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

/** Landing route for links in auth emails (magic link, sign-up confirmation). */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = url.searchParams.get("next");
  const dest = url.clone();
  dest.search = "";
  dest.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : "/accueil";

  const fail = url.clone();
  fail.search = "";
  fail.pathname = "/connexion";
  fail.searchParams.set("erreur", "lien");

  if (!supabaseConfigured) return NextResponse.redirect(fail);
  const supabase = await createClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return NextResponse.redirect(error ? fail : dest);
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(error ? fail : dest);
  }
  return NextResponse.redirect(fail);
}
