"use server";

import { fetchBookmarks, fetchByCommune, fetchFollowing, fetchForYou, fetchHashtag, fetchProfilePosts } from "@/lib/data/posts";
import { createClient, getViewer } from "@/lib/supabase/server";

// "Load more" server actions for <Feed>. Each takes (before, count) as its last two arguments.

export async function loadForYou(_before: string, count: number) {
  const viewer = await getViewer();
  return fetchForYou(await createClient(), viewer?.id ?? null, count);
}

export async function loadFollowing(before: string) {
  const viewer = await getViewer();
  if (!viewer) return [];
  return fetchFollowing(await createClient(), viewer.id, before);
}

export async function loadProfile(authorId: string, tab: "posts" | "replies" | "media" | "likes", before: string) {
  const viewer = await getViewer();
  return fetchProfilePosts(await createClient(), authorId, tab, viewer?.id ?? null, before);
}

export async function loadHashtag(tag: string, before: string) {
  const viewer = await getViewer();
  return fetchHashtag(await createClient(), tag, viewer?.id ?? null, before);
}

export async function loadCommune(communeId: number, before: string) {
  const viewer = await getViewer();
  return fetchByCommune(await createClient(), communeId, viewer?.id ?? null, before);
}

export async function loadBookmarks(before: string) {
  const viewer = await getViewer();
  if (!viewer) return [];
  return fetchBookmarks(await createClient(), viewer.id, before);
}
