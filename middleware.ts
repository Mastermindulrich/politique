import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Explore, the officials directory, profiles, posts and the idea box stay readable signed out.
const PROTECTED = ["/accueil", "/notifications", "/messages", "/mes-elus", "/parametres", "/admin", "/signets", "/barometre", "/bienvenue"];
const AUTH_PAGES = ["/connexion", "/inscription"];
// The landing pages are static: members are sent to their feed from here instead.
const LANDING = ["/", "/en"];

const within = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(p + "/"));

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let res = NextResponse.next({ request: req });
  if (!url || !key) return res;

  const path = req.nextUrl.pathname;
  const toLogin = () => {
    const to = req.nextUrl.clone();
    to.pathname = "/connexion";
    to.search = "";
    to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  };

  // Visitors carry no session cookie: nothing to check or refresh, so no network call.
  const hasSession = req.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasSession) return within(path, PROTECTED) ? toLogin() : res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie when it is about to expire, and checks the token's
  // signature (locally when the project signs with public keys). Do not remove.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && within(path, PROTECTED)) return withCookies(toLogin(), res);
  if (signedIn && (within(path, AUTH_PAGES) || LANDING.includes(path))) {
    const to = req.nextUrl.clone();
    to.pathname = "/accueil";
    to.search = "";
    return withCookies(NextResponse.redirect(to), res);
  }
  return res;
}

/** Keeps a refreshed (or cleared) session cookie when the answer is a redirect. */
function withCookies(to: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach((c) => to.cookies.set(c));
  return to;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)"],
};
