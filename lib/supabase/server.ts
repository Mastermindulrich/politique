import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import type { PrivateProfile, Profile } from "@/lib/types";
import { DB_SCHEMA } from "./schema";

export const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

export const supabaseConfigured = Boolean(env.url && env.key);

/** Server-side Supabase client bound to the request's cookies (RSC, route handlers, server actions). */
export async function createClient() {
  const store = await cookies();
  return createServerClient(env.url, env.key, {
    db: { schema: DB_SCHEMA },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by the middleware instead.
        }
      },
    },
  });
}

/** Service-role client for trusted server work (account deletion, signed document links). Never ship to the browser. */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createServerClient(env.url, key, { db: { schema: DB_SCHEMA }, cookies: { getAll: () => [], setAll: () => {} } });
}

/**
 * Signed-out client with no cookies, for data that is the same for everyone
 * (site settings, national trends). Safe to use inside a cached function.
 */
export function createPublicClient() {
  return createPlainClient(env.url, env.key, { db: { schema: DB_SCHEMA }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** The `sub` of a JWT, read without checking it. Only ever used to ask the database, which does check. */
function subOf(token: string | undefined): string | null {
  try {
    const sub = JSON.parse(Buffer.from(token!.split(".")[1], "base64url").toString("utf8")).sub;
    return typeof sub === "string" && /^[0-9a-f-]{36}$/i.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

type Me = { profile: Profile; private: PrivateProfile | null };

/**
 * The signed-in member and their private row, in one trip to the database.
 *
 * Who is asking is decided by the database, not by the cookie: `private_profiles`
 * only ever returns the caller's own row (row level security, user_id = auth.uid()),
 * and the API refuses a forged or expired token before that. So a row coming back
 * proves the session, without a separate call to the auth server on every page.
 * Visitors with no session cookie cost no network call at all.
 */
const getMe = cache(async (): Promise<Me | null> => {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  // Reads the cookie only. The middleware has already refreshed it for this request.
  const { data } = await supabase.auth.getSession();
  const uid = subOf(data.session?.access_token);
  if (!uid) return null;

  const mine = async (): Promise<Me | null> => {
    const { data: row } = await supabase.from("private_profiles").select("*, profile:profiles!inner(*)").eq("user_id", uid).maybeSingle();
    if (!row) return null;
    const { profile, ...priv } = row as PrivateProfile & { profile: Profile };
    return { profile: withOwner(profile), private: priv as PrivateProfile };
  };

  const me = await mine();
  if (me) return me;

  // Rare path: signed in to the shared auth project but not a POLITIQUE member yet (for
  // example an account made on the other site). Check the session with the auth server,
  // join, then read again; /bienvenue asks where they vote.
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub !== uid) return null;
  await supabase.rpc("join_politique");
  const joined = await mine();
  if (joined) return joined;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  return profile ? { profile: withOwner(profile as Profile), private: null } : null;
});

/** The signed-in user's profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Profile | null> => (await getMe())?.profile ?? null);

/** The signed-in user's private row (voting place). Only ever the caller's own. Cached per request. */
export const getViewerPrivate = cache(async (): Promise<PrivateProfile | null> => (await getMe())?.private ?? null);

/** The owner has every admin power; the database's is_admin() says the same. */
const withOwner = (p: Profile): Profile => (p.is_owner ? { ...p, is_admin: true } : p);
