import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Profile } from "@/lib/types";
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

/** Service-role client for trusted server work (waitlist, admin jobs). Never ship to the browser. */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createServerClient(env.url, key, { db: { schema: DB_SCHEMA }, cookies: { getAll: () => [], setAll: () => {} } });
}

/** The signed-in user's profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Profile | null> => {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (data) return data as Profile;
  // Signed in to the shared auth project but not a POLITIQUE member yet (for example an
  // account made on the other site): join now; /bienvenue then asks where they vote.
  const { data: joined } = await supabase.rpc("join_politique");
  if (!joined) return null;
  const { data: fresh } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (fresh as Profile | null) ?? null;
});
