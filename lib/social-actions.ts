"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { fetchPreview, firstUrl, signPreview, verifyPreview } from "@/lib/link-preview";
import { createClient, createServiceClient, getViewer } from "@/lib/supabase/server";
import type { LinkPreview, Media } from "@/lib/types";

/**
 * Server actions for editing and pinning posts, link cards, group conversations and the
 * moderators' word filter. The database enforces every rule (who, when, how often);
 * these functions only pass the request on and translate the answer.
 */

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
type Signed = { preview: LinkPreview; sig: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function viewerOrFail() {
  const viewer = await getViewer();
  if (!viewer) throw new Error("unauthenticated");
  return viewer;
}

// ---------------------------------------------------------------------------
// Link cards
// ---------------------------------------------------------------------------
const signedSchema = z.object({
  preview: z.object({ url: z.string().url().max(600), title: z.string().max(140), description: z.string().max(240).optional(), image: z.string().url().max(600).optional(), site: z.string().max(60) }),
  sig: z.string().max(200),
});

/**
 * Attaches the card of the first link of a post. Only the server can write it.
 * A card the composer already fetched and signed is written at once; otherwise the page
 * is fetched after the response, so a slow site never slows down publishing.
 */
export async function attachLink(postId: string, text: string, signed?: Signed | null): Promise<void> {
  const viewer = await viewerOrFail();
  const admin = createServiceClient();
  const url = firstUrl(text);
  if (!admin || !url || !UUID.test(postId)) return;
  // Only on the caller's own post, and only when its text really contains that link.
  const { data: post } = await admin.from("posts").select("author_id, text, media, quoted_id").eq("id", postId).maybeSingle();
  const row = post as { author_id: string; text: string; media: Media[]; quoted_id: string | null } | null;
  if (!row || row.author_id !== viewer.id || firstUrl(row.text) !== url || row.media.length || row.quoted_id) return;
  const s = signed ? signedSchema.safeParse(signed) : null;
  if (s?.success && s.data.preview.url === url && verifyPreview(s.data.preview, s.data.sig)) {
    await admin.from("posts").update({ link: s.data.preview }).eq("id", postId);
    return;
  }
  after(async () => {
    const preview = await fetchPreview(url, 3000);
    if (preview) await admin.from("posts").update({ link: preview }).eq("id", postId);
  });
}

/** The card for the first link of a draft, signed so publishing does not fetch it again. */
const previewCache = new Map<string, { at: number; value: Signed | null }>();
export async function previewLink(url: string): Promise<Signed | null> {
  await viewerOrFail();
  if (typeof url !== "string" || url.length > 600) return null;
  const hit = previewCache.get(url);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
  const preview = await fetchPreview(url);
  const value = preview ? { preview, sig: signPreview(preview) } : null;
  if (previewCache.size > 500) previewCache.clear();
  previewCache.set(url, { at: Date.now(), value });
  return value;
}

// ---------------------------------------------------------------------------
// Editing and pinning
// ---------------------------------------------------------------------------
/** Edit your own post during the hour after publishing. The earlier text stays visible in the history. */
export async function editPost(id: string, text: string): Promise<Result<{ text: string; edited_at: string | null; link: LinkPreview | null }>> {
  await viewerOrFail();
  const s = z.object({ id: z.string().uuid(), text: z.string().max(500) }).safeParse({ id, text });
  if (!s.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("edit_post", { pid: s.data.id, new_text: s.data.text });
  if (error || !data) return { ok: false, error: error?.message ?? "error" };
  const row = data as { text: string; edited_at: string | null; link: LinkPreview | null };
  if (!row.link) await attachLink(s.data.id, row.text);
  revalidatePath(`/p/${s.data.id}`);
  return { ok: true, data: { text: row.text, edited_at: row.edited_at, link: row.link } };
}

export async function getPostEdits(id: string): Promise<{ text: string; created_at: string }[]> {
  if (!UUID.test(id)) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("post_edits").select("text, created_at").eq("post_id", id).order("created_at", { ascending: false }).limit(10);
  return (data ?? []) as { text: string; created_at: string }[];
}

/** Pin one of your posts to the top of your profile, or unpin it. */
export async function pinPost(id: string, pinned: boolean): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!UUID.test(id)) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pin_post", { pid: id, pinned: Boolean(pinned) });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/u/${viewer.handle}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Group conversations
// ---------------------------------------------------------------------------
/** Start a group conversation with two to forty-nine other people. */
export async function createGroup(title: string, memberIds: string[]): Promise<Result<{ id: string }>> {
  await viewerOrFail();
  const s = z.object({ title: z.string().max(60), memberIds: z.array(z.string().uuid()).min(2).max(49) }).safeParse({ title, memberIds });
  if (!s.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", { group_title: s.data.title, member_ids: s.data.memberIds });
  if (error || !data) return { ok: false, error: error?.message ?? "error" };
  revalidatePath("/messages");
  return { ok: true, data: { id: data as string } };
}

export async function leaveConversation(conversationId: string): Promise<Result> {
  await viewerOrFail();
  if (!UUID.test(conversationId)) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_conversation", { cid: conversationId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  return { ok: true };
}

/** People search for the "new message" picker. */
export async function searchPeople(q: string) {
  const viewer = await viewerOrFail();
  const term = String(q ?? "").trim().replace(/^@/, "").slice(0, 40);
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_profiles", { q: term, lim: 12 });
  return ((data ?? []) as { id: string; handle: string; display_name: string; avatar_url: string | null; verified: boolean; account_type: "citoyen" | "elu" | "institution" | "media" }[])
    .filter((p) => p.id !== viewer.id)
    .map(({ id, handle, display_name, avatar_url, verified, account_type }) => ({ id, handle, display_name, avatar_url, verified, account_type }));
}

// ---------------------------------------------------------------------------
// Word filter (moderators; row-level security enforces the role)
// ---------------------------------------------------------------------------
export async function addBlockedTerm(term: string): Promise<Result> {
  const viewer = await viewerOrFail();
  const value = String(term ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (value.length < 2) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_terms").insert({ term: value, created_by: viewer.id });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function removeBlockedTerm(term: string): Promise<Result> {
  await viewerOrFail();
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_terms").delete().eq("term", String(term ?? ""));
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
