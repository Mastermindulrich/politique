import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Explore, the officials directory, profiles, posts and the idea box stay readable signed out.
const PROTECTED = ["/accueil", "/notifications", "/messages", "/mes-elus", "/parametres", "/admin", "/signets", "/barometre", "/bienvenue"];
const AUTH_PAGES = ["/connexion", "/inscription", "/rejoindre"];
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

  // A visitor reaching a members' page is invited to join (sign-up first, log-in second)
  // rather than dropped on a bare login form.
  const toJoin = () => {
    if (path === "/bienvenue") return toLogin();
    const to = req.nextUrl.clone();
    to.pathname = "/rejoindre";
    to.search = "";
    to.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(to);
  };

  // Visitors carry no session cookie: nothing to check or refresh, so no network call.
  const hasSession = req.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasSession) {
    // A visitor who chose English gets the English landing page.
    if (path === "/" && req.cookies.get("lang")?.value === "en") {
      const to = req.nextUrl.clone();
      to.pathname = "/en";
      return NextResponse.redirect(to);
    }
    return within(path, PROTECTED) ? toJoin() : res;
  }

  // Fast path: a session token that is still valid for a while needs no refresh, so the
  // redirects below can be decided from the cookie alone, with no call to Supabase (which
  // sits in another continent from most members: each call adds a long round trip to every
  // page). This is only routing: pages still prove who is asking through the database's
  // row level security, so a forged cookie gets nothing but an empty page and a redirect.
  const fresh = freshSession(req);
  if (fresh) {
    if (within(path, AUTH_PAGES) || LANDING.includes(path)) {
      const to = req.nextUrl.clone();
      to.pathname = "/accueil";
      to.search = "";
      return NextResponse.redirect(to);
    }
    return res;
  }

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

/**
 * True when the session cookie holds an access token that expires more than two minutes
 * from now. The token is read, not verified (see above). @supabase/ssr stores the session
 * as "base64-<base64url JSON>", possibly split over chunks named <name>.0, <name>.1, ...
 */
function freshSession(req: NextRequest): boolean {
  try {
    const all = req.cookies.getAll().filter((c) => c.name.startsWith("sb-") && /-auth-token(\.\d+)?$/.test(c.name));
    if (!all.length) return false;
    const base = all[0].name.replace(/\.\d+$/, "");
    const whole = req.cookies.get(base)?.value ?? all
      .filter((c) => c.name.startsWith(base + "."))
      .sort((a, b) => Number(a.name.slice(base.length + 1)) - Number(b.name.slice(base.length + 1)))
      .map((c) => c.value)
      .join("");
    const json = whole.startsWith("base64-") ? fromB64url(whole.slice(7)) : whole;
    const token: unknown = JSON.parse(json)?.access_token;
    if (typeof token !== "string") return false;
    const claims = JSON.parse(fromB64url(token.split(".")[1]));
    return typeof claims?.sub === "string" && typeof claims?.exp === "number" && claims.exp * 1000 - Date.now() > 120_000;
  } catch {
    return false;
  }
}

function fromB64url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

/** Keeps a refreshed (or cleared) session cookie when the answer is a redirect. */
function withCookies(to: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach((c) => to.cookies.set(c));
  return to;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2|pdf|zip)$).*)"],
};
