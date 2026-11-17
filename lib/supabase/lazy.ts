"use client";
// The Supabase browser library is ~65 KB (gzip). Pages that only need it for live updates
// (notifications, calls, uploads) load it here, after the page is already on screen,
// instead of making every member page wait for it before becoming usable.
import type { supabaseBrowser } from "./client";

type Client = ReturnType<typeof supabaseBrowser>;
let loading: Promise<Client> | null = null;

export function browserClient(): Promise<Client> {
  if (!loading) loading = import("./client").then((m) => m.supabaseBrowser());
  return loading;
}
