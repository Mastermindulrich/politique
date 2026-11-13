"use client";

import { createBrowserClient } from "@supabase/ssr";
import { DB_SCHEMA } from "./schema";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      { db: { schema: DB_SCHEMA } },
    );
  }
  return client;
}
