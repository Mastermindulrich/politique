import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/accueil", "/explorer", "/notifications", "/messages", "/mes-elus", "/parametres", "/admin", "/signets", "/idees", "/barometre"];
const AUTH_PAGES = ["/connexion", "/inscription"];

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let res = NextResponse.next({ request: req });
  if (!url || !key) return res;

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

  // Refreshes the session cookie when needed. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));
  const isAuthPage = AUTH_PAGES.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && isProtected) {
    const to = req.nextUrl.clone();
    to.pathname = "/connexion";
    to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  }
  if (user && isAuthPage) {
    const to = req.nextUrl.clone();
    to.pathname = "/accueil";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|api/waitlist|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
