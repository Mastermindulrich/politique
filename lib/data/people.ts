import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { FeedPost, Official, PrivateProfile } from "@/lib/types";
import { AUTHOR_COLS } from "./posts";

type Author = FeedPost["author"];

export async function fetchAuthors(supabase: SupabaseClient, ids: (string | null | undefined)[]) {
  const uniq = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
  if (!uniq.length) return new Map<string, Author>();
  const { data } = await supabase.from("profiles").select(AUTHOR_COLS).in("id", uniq);
  return new Map(((data ?? []) as Author[]).map((a) => [a.id, a]));
}

/** The viewer's private row (voting place). Only ever the caller's own. */
export const getMyPrivate = cache(async (): Promise<PrivateProfile | null> => {
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("private_profiles").select("*").eq("user_id", viewer.id).maybeSingle();
  return (data as PrivateProfile | null) ?? null;
});

/** Officials with their claimed profile attached. */
export async function attachProfiles(supabase: SupabaseClient, officials: Official[]): Promise<Official[]> {
  const authors = await fetchAuthors(supabase, officials.map((o) => o.profile_id));
  return officials.map((o) => ({ ...o, profile: o.profile_id ? authors.get(o.profile_id) ?? null : null }));
}

export function officialPlace(o: Pick<Official, "commune_id" | "department_id" | "region_id" | "circonscription">, geo: typeof import("@/lib/ci-geo")) {
  if (o.circonscription) return o.circonscription;
  if (o.commune_id) return geo.communeById.get(o.commune_id)?.name ?? "";
  if (o.department_id) return geo.departmentById.get(o.department_id)?.name ?? "";
  if (o.region_id) return geo.regionById.get(o.region_id)?.name ?? "";
  return "Côte d'Ivoire";
}
