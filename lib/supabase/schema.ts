/**
 * POLITIQUE keeps all its tables in this Postgres schema, so it can share a Supabase
 * project with another app and later move out on its own. Add it to the project's
 * exposed schemas (Settings > API) so the API can reach it.
 */
export const DB_SCHEMA = "politique" as const;

export type Db = import("@supabase/supabase-js").SupabaseClient<any, typeof DB_SCHEMA>;
