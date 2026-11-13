"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient, createServiceClient, getViewer } from "@/lib/supabase/server";
import type { Media } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function viewerOrFail() {
  const viewer = await getViewer();
  if (!viewer) throw new Error("unauthenticated");
  return viewer;
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------
const mediaSchema = z.array(
  z.object({ type: z.enum(["image", "video"]), url: z.string().url(), alt: z.string().max(400).optional(), width: z.number().optional(), height: z.number().optional(), duration: z.number().optional(), poster: z.string().optional() }),
).max(4);

const postSchema = z.object({
  text: z.string().max(1000),
  parentId: z.string().uuid().nullable().optional(),
  quotedId: z.string().uuid().nullable().optional(),
  media: mediaSchema.optional(),
  communeId: z.number().int().nullable().optional(),
  poll: z.object({ options: z.array(z.string().min(1).max(40)).min(2).max(4), days: z.number().int().min(1).max(7) }).nullable().optional(),
  visibility: z.enum(["public", "followers"]).optional(),
});

export async function createPost(input: z.infer<typeof postSchema>): Promise<Result<{ id: string }>> {
  const viewer = await viewerOrFail();
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { text, parentId, quotedId, media, communeId, poll, visibility } = parsed.data;
  if (!text.trim() && !(media && media.length)) return { ok: false, error: "empty" };
  const supabase = await createClient();
  const kind = parentId ? "reply" : quotedId ? "quote" : "post";
  const { data, error } = await supabase
    .from("posts")
    .insert({ author_id: viewer.id, kind, text: text.trim(), parent_id: parentId ?? null, quoted_id: quotedId ?? null, media: (media ?? []) as Media[], commune_id: communeId ?? null, visibility: visibility ?? "public", lang: viewer.lang })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert" };
  if (poll) {
    const ends = new Date(Date.now() + poll.days * 86400_000).toISOString();
    await supabase.from("polls").insert({ post_id: data.id, options: poll.options, ends_at: ends });
  }
  revalidatePath("/accueil");
  if (parentId) revalidatePath(`/p/${parentId}`);
  return { ok: true, data: { id: data.id } };
}

export async function deletePost(id: string): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  const { error } = await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("author_id", viewer.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/accueil");
  return { ok: true };
}

async function toggle(table: "likes" | "reposts" | "bookmarks", postId: string, on: boolean): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from(table).insert({ user_id: viewer.id, post_id: postId })
    : await supabase.from(table).delete().eq("user_id", viewer.id).eq("post_id", postId);
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}
export async function toggleLike(postId: string, on: boolean): Promise<Result> {
  return toggle("likes", postId, on);
}
export async function toggleRepost(postId: string, on: boolean): Promise<Result> {
  return toggle("reposts", postId, on);
}
export async function toggleBookmark(postId: string, on: boolean): Promise<Result> {
  return toggle("bookmarks", postId, on);
}

export async function votePoll(postId: string, optionIdx: number): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  const { error } = await supabase.from("poll_votes").insert({ post_id: postId, user_id: viewer.id, option_idx: optionIdx });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function recordViews(ids: string[]) {
  if (!ids.length) return;
  const supabase = await createClient();
  await supabase.rpc("record_views", { ids: ids.slice(0, 50) });
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------
export async function toggleFollow(userId: string, on: boolean): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("follows").insert({ follower_id: viewer.id, followee_id: userId })
    : await supabase.from("follows").delete().eq("follower_id", viewer.id).eq("followee_id", userId);
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}
export async function toggleBlock(userId: string, on: boolean): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  if (on) {
    await supabase.from("follows").delete().or(`and(follower_id.eq.${viewer.id},followee_id.eq.${userId}),and(follower_id.eq.${userId},followee_id.eq.${viewer.id})`);
  }
  const { error } = on
    ? await supabase.from("blocks").insert({ blocker_id: viewer.id, blocked_id: userId })
    : await supabase.from("blocks").delete().eq("blocker_id", viewer.id).eq("blocked_id", userId);
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}
export async function toggleMute(userId: string, on: boolean): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("mutes").insert({ muter_id: viewer.id, muted_id: userId })
    : await supabase.from("mutes").delete().eq("muter_id", viewer.id).eq("muted_id", userId);
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
const reportSchema = z.object({
  postId: z.string().uuid().optional(),
  profileId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  reason: z.enum(["haine", "harcelement", "desinformation", "spam", "violence", "usurpation", "contenu_adulte", "autre"]),
  details: z.string().max(1000).optional(),
});
export async function submitReport(input: z.infer<typeof reportSchema>): Promise<Result> {
  const viewer = await viewerOrFail();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({ reporter_id: viewer.id, post_id: parsed.data.postId ?? null, profile_id: parsed.data.profileId ?? null, message_id: parsed.data.messageId ?? null, reason: parsed.data.reason, details: parsed.data.details ?? null });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile & settings
// ---------------------------------------------------------------------------
const profileSchema = z.object({
  display_name: z.string().min(1).max(50),
  handle: z.string().regex(/^[a-z0-9_]{3,20}$/),
  bio: z.string().max(240).nullable(),
  website: z.string().max(200).nullable(),
  avatar_url: z.string().url().nullable().optional(),
  banner_url: z.string().url().nullable().optional(),
  shown_commune_id: z.number().int().nullable(),
});
export async function updateProfile(input: z.infer<typeof profileSchema>): Promise<Result> {
  const viewer = await viewerOrFail();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", viewer.id);
  if (error) return { ok: false, error: error.message.includes("profiles_handle_key") ? "handle_taken" : error.message };
  revalidatePath("/parametres");
  revalidatePath(`/u/${parsed.data.handle}`);
  return { ok: true };
}

const prefsSchema = z.object({ lang: z.enum(["fr", "en"]), theme: z.enum(["system", "light", "dark"]), low_data: z.boolean() });
export async function updatePrefs(input: z.infer<typeof prefsSchema>): Promise<Result> {
  const viewer = await viewerOrFail();
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", viewer.id);
  if (error) return { ok: false, error: error.message };
  const store = await cookies();
  store.set("theme", parsed.data.theme, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  store.set("lang", parsed.data.lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true };
}

const privateSchema = z.object({
  vote_region_id: z.number().int().nullable(),
  vote_department_id: z.number().int().nullable(),
  vote_commune_id: z.number().int().nullable(),
  vote_locality: z.string().max(100).nullable(),
  is_registered_voter: z.boolean().nullable(),
});
export async function updatePrivateProfile(input: z.infer<typeof privateSchema>): Promise<Result> {
  const viewer = await viewerOrFail();
  const parsed = privateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("private_profiles").upsert({ user_id: viewer.id, ...parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mes-elus");
  revalidatePath("/parametres");
  return { ok: true };
}

export async function completeOnboarding(): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", viewer.id);
  return { ok: true };
}

const verifSchema = z.object({
  requested_type: z.enum(["elu", "institution", "media"]),
  full_name: z.string().min(2).max(120),
  official_id: z.string().uuid().nullable(),
  organisation: z.string().max(120).nullable(),
  document_path: z.string().nullable(),
  proof_path: z.string().nullable(),
});
export async function requestVerification(input: z.infer<typeof verifSchema>): Promise<Result> {
  const viewer = await viewerOrFail();
  const parsed = verifSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("verification_requests").insert({ user_id: viewer.id, ...parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Permanently deletes the account. Every table cascades from auth.users. */
export async function deleteAccount(confirmHandle: string): Promise<Result> {
  const viewer = await viewerOrFail();
  if (confirmHandle.replace(/^@/, "").toLowerCase() !== viewer.handle.toLowerCase()) return { ok: false, error: "confirm" };
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "unavailable" };
  // The login is shared with the other site in this Supabase project, so only the
  // POLITIQUE data is removed (everything cascades from the profile).
  const { error } = await admin.from("profiles").delete().eq("id", viewer.id);
  if (error) return { ok: false, error: error.message };
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Ivorian features
// ---------------------------------------------------------------------------
export async function createInterpellation(input: { officialId: string; title: string; body?: string }): Promise<Result<{ id: string }>> {
  const viewer = await viewerOrFail();
  const s = z.object({ officialId: z.string().uuid(), title: z.string().min(5).max(140), body: z.string().max(2000).optional() }).safeParse(input);
  if (!s.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: official } = await supabase.from("officials").select("full_name, profile_id").eq("id", s.data.officialId).maybeSingle();
  if (!official) return { ok: false, error: "not_found" };
  // The question is also a public post so it lives in the feed and can be replied to.
  let handle: string | null = null;
  if (official.profile_id) {
    const { data: p } = await supabase.from("profiles").select("handle").eq("id", official.profile_id).maybeSingle();
    handle = p?.handle ?? null;
  }
  const text = `${handle ? "@" + handle + " " : ""}${s.data.title}${s.data.body ? "\n\n" + s.data.body : ""}\n#Interpellation`.slice(0, 1000);
  const { data: post } = await supabase.from("posts").insert({ author_id: viewer.id, kind: "post", text, lang: viewer.lang }).select("id").single();
  const { data, error } = await supabase.from("interpellations").insert({ author_id: viewer.id, official_id: s.data.officialId, post_id: post?.id ?? null, title: s.data.title, body: s.data.body ?? null }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert" };
  await supabase.from("interpellation_votes").insert({ interpellation_id: data.id, user_id: viewer.id });
  revalidatePath(`/elus/${s.data.officialId}`);
  return { ok: true, data: { id: data.id } };
}

export async function toggleInterpellationVote(id: string, on: boolean): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("interpellation_votes").insert({ interpellation_id: id, user_id: viewer.id })
    : await supabase.from("interpellation_votes").delete().eq("interpellation_id", id).eq("user_id", viewer.id);
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}

export async function answerInterpellation(id: string, text: string): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!text.trim()) return { ok: false, error: "empty" };
  const supabase = await createClient();
  const { data: it } = await supabase.from("interpellations").select("post_id, official_id").eq("id", id).maybeSingle();
  if (!it) return { ok: false, error: "not_found" };
  const { data: post, error: pe } = await supabase.from("posts").insert({ author_id: viewer.id, kind: it.post_id ? "reply" : "post", parent_id: it.post_id, text: text.trim().slice(0, 1000), lang: viewer.lang }).select("id").single();
  if (pe || !post) return { ok: false, error: pe?.message ?? "post" };
  const { error } = await supabase.from("interpellations").update({ status: "repondue", answer_post_id: post.id }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/interpellations/${id}`);
  return { ok: true };
}

export async function closeInterpellation(id: string): Promise<Result> {
  await viewerOrFail();
  const supabase = await createClient();
  const { error } = await supabase.from("interpellations").update({ status: "classee" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/interpellations/${id}`);
  return { ok: true };
}

const promiseSchema = z.object({ officialId: z.string().uuid(), title: z.string().min(5).max(200), description: z.string().max(2000).nullable(), source_url: z.string().url().nullable(), made_at: z.string().nullable(), due_at: z.string().nullable() });
export async function createPromise(input: z.infer<typeof promiseSchema>): Promise<Result> {
  const viewer = await viewerOrFail();
  const s = promiseSchema.safeParse(input);
  if (!s.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { officialId, ...rest } = s.data;
  const { error } = await supabase.from("promises").insert({ official_id: officialId, created_by: viewer.id, ...rest, made_at: rest.made_at || null, due_at: rest.due_at || null });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/elus/${officialId}`);
  return { ok: true };
}
export async function addPromiseUpdate(input: { promiseId: string; text: string; source_url?: string | null; new_status?: string | null }): Promise<Result> {
  const viewer = await viewerOrFail();
  const s = z.object({ promiseId: z.string().uuid(), text: z.string().min(1).max(1000), source_url: z.string().url().nullable().optional(), new_status: z.enum(["annoncee", "en_cours", "tenue", "partiellement_tenue", "non_tenue"]).nullable().optional() }).safeParse(input);
  if (!s.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("promise_updates").insert({ promise_id: s.data.promiseId, author_id: viewer.id, text: s.data.text, source_url: s.data.source_url ?? null, new_status: s.data.new_status ?? null });
  if (error) return { ok: false, error: error.message };
  if (s.data.new_status) {
    // Only moderators, verified media and the official themselves pass RLS here; others' status is a suggestion in the update.
    await supabase.from("promises").update({ status: s.data.new_status, verified_by: viewer.is_moderator || viewer.is_admin || (viewer.verified && viewer.account_type === "media") ? viewer.id : undefined }).eq("id", s.data.promiseId);
  }
  revalidatePath("/elus", "layout");
  return { ok: true };
}

export async function createPermanence(input: { officialId: string; title: string; description?: string; starts_at: string; ends_at: string }): Promise<Result> {
  const viewer = await viewerOrFail();
  const s = z.object({ officialId: z.string().uuid(), title: z.string().min(3).max(140), description: z.string().max(2000).optional(), starts_at: z.string(), ends_at: z.string() }).safeParse(input);
  if (!s.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const when = new Date(s.data.starts_at).toLocaleString(viewer.lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeStyle: "short" });
  const { data: post } = await supabase.from("posts").insert({ author_id: viewer.id, kind: "post", text: `${viewer.lang === "fr" ? "Permanence numérique" : "Live session"} — ${s.data.title}\n${when}\n${viewer.lang === "fr" ? "Posez vos questions en réponse à ce post." : "Ask your questions as replies to this post."} #Permanence`, lang: viewer.lang }).select("id").single();
  const { error } = await supabase.from("permanences").insert({ official_id: s.data.officialId, host_id: viewer.id, title: s.data.title, description: s.data.description ?? null, starts_at: s.data.starts_at, ends_at: s.data.ends_at, post_id: post?.id ?? null });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/elus/${s.data.officialId}`);
  return { ok: true };
}
export async function setPermanenceStatus(id: string, status: "planifiee" | "en_cours" | "terminee" | "annulee"): Promise<Result> {
  await viewerOrFail();
  const supabase = await createClient();
  const { error } = await supabase.from("permanences").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/elus", "layout");
  return { ok: true };
}

export async function voteBarometer(barometerId: string, optionIdx: number): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  const { error } = await supabase.from("barometer_votes").insert({ barometer_id: barometerId, user_id: viewer.id, option_idx: optionIdx });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/barometre");
  return { ok: true };
}

export async function createProposition(input: { communeId: number; title: string; body: string }): Promise<Result> {
  const viewer = await viewerOrFail();
  const s = z.object({ communeId: z.number().int(), title: z.string().min(5).max(140), body: z.string().min(1).max(2000) }).safeParse(input);
  if (!s.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("propositions").insert({ author_id: viewer.id, commune_id: s.data.communeId, title: s.data.title, body: s.data.body }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert" };
  await supabase.from("proposition_votes").insert({ proposition_id: data.id, user_id: viewer.id });
  revalidatePath("/idees");
  return { ok: true };
}
export async function togglePropositionVote(id: string, on: boolean): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("proposition_votes").insert({ proposition_id: id, user_id: viewer.id })
    : await supabase.from("proposition_votes").delete().eq("proposition_id", id).eq("user_id", viewer.id);
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  return { ok: true };
}
export async function setPropositionStatus(id: string, status: "nouvelle" | "etudiee" | "adoptee" | "refusee"): Promise<Result> {
  await viewerOrFail();
  const supabase = await createClient();
  const { error } = await supabase.from("propositions").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/idees");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Messages & notifications
// ---------------------------------------------------------------------------
export async function startConversation(userId: string): Promise<Result<{ id: string }>> {
  await viewerOrFail();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_dm", { other: userId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data as string } };
}
export async function sendMessage(conversationId: string, text: string, media: Media[] = []): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!text.trim() && !media.length) return { ok: false, error: "empty" };
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: viewer.id, text: text.trim().slice(0, 4000), media });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
export async function markConversationRead(conversationId: string) {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", viewer.id);
}
export async function markNotificationsRead() {
  await viewerOrFail();
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read");
  revalidatePath("/notifications");
}

// ---------------------------------------------------------------------------
// Moderation (RLS enforces is_moderator / is_admin)
// ---------------------------------------------------------------------------
export async function moderate(input: { reportId?: string; postId?: string; userId?: string; action: "hide_post" | "unhide_post" | "suspend" | "ban" | "unban" | "dismiss"; reason?: string }): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer.is_moderator && !viewer.is_admin) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const now = new Date();
  if (input.action === "hide_post" && input.postId) {
    await supabase.from("posts").update({ is_hidden: true }).eq("id", input.postId);
    await supabase.from("moderation_actions").insert({ moderator_id: viewer.id, target_user_id: input.userId ?? null, post_id: input.postId, report_id: input.reportId ?? null, action: "hide_post", reason: input.reason ?? null });
    if (input.userId) await supabase.rpc("mod_notify", { uid: input.userId, ntype: "moderation", pid: input.postId });
  }
  if (input.action === "unhide_post" && input.postId) await supabase.from("posts").update({ is_hidden: false }).eq("id", input.postId);
  if (input.action === "suspend" && input.userId) await supabase.rpc("mod_suspend", { uid: input.userId, until: new Date(now.getTime() + 7 * 86400_000).toISOString(), why: input.reason ?? null });
  if (input.action === "ban" && input.userId) await supabase.rpc("mod_suspend", { uid: input.userId, until: "2999-01-01T00:00:00Z", why: input.reason ?? null });
  if (input.action === "unban" && input.userId) await supabase.rpc("mod_suspend", { uid: input.userId, until: null, why: input.reason ?? null });
  if (input.action === "dismiss") await supabase.from("moderation_actions").insert({ moderator_id: viewer.id, report_id: input.reportId ?? null, action: "dismiss", reason: input.reason ?? null });
  if (input.reportId) await supabase.from("reports").update({ status: input.action === "dismiss" ? "dismissed" : "actioned", reviewed_by: viewer.id, reviewed_at: now.toISOString() }).eq("id", input.reportId);
  revalidatePath("/admin");
  return { ok: true };
}

export async function reviewVerification(id: string, approve: boolean, notes?: string): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer.is_moderator && !viewer.is_admin) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_verification", { rid: id, approve, note: notes ?? null });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function labelPost(input: { postId: string; label: "contexte" | "contestee" | "fausse" | "satire" | "officiel"; note?: string; source_url?: string }): Promise<Result> {
  const viewer = await viewerOrFail();
  const supabase = await createClient();
  const { error } = await supabase.from("post_labels").insert({ post_id: input.postId, label: input.label, note: input.note?.slice(0, 500) || null, source_url: input.source_url || null, labeled_by: viewer.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/p/${input.postId}`);
  return { ok: true };
}

export async function checkHandle(handle: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("handle_available", { h: handle.toLowerCase() });
  return Boolean(data);
}

const officialSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().min(2).max(120),
  mandate: z.enum(["president", "ministre", "depute", "senateur", "maire", "president_conseil_regional", "gouverneur_district", "conseiller_municipal", "conseiller_regional", "autre"]),
  title: z.string().max(140).nullable(),
  party: z.string().max(80).nullable(),
  region_id: z.number().int().nullable(),
  department_id: z.number().int().nullable(),
  commune_id: z.number().int().nullable(),
  handle: z.string().nullable().optional(),
});
export async function upsertOfficial(input: z.infer<typeof officialSchema>): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer.is_moderator && !viewer.is_admin) return { ok: false, error: "forbidden" };
  const s = officialSchema.safeParse(input);
  if (!s.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { handle, id, ...rest } = s.data;
  let profile_id: string | null = null;
  if (handle) {
    const { data: p } = await supabase.from("profiles").select("id").eq("handle", handle.replace(/^@/, "").toLowerCase()).maybeSingle();
    profile_id = p?.id ?? null;
  }
  const row = { ...rest, profile_id, created_by: viewer.id, claimed_at: profile_id ? new Date().toISOString() : null };
  const { error } = id ? await supabase.from("officials").update(row).eq("id", id) : await supabase.from("officials").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/elus");
  revalidatePath("/admin");
  return { ok: true };
}

export async function createBarometer(input: { month: string; question: string; options: string[]; closes_at: string }): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer.is_admin) return { ok: false, error: "forbidden" };
  const s = z.object({ month: z.string(), question: z.string().min(5).max(200), options: z.array(z.string().min(1).max(60)).min(2).max(6), closes_at: z.string() }).safeParse(input);
  if (!s.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("barometers").insert({ ...s.data, created_by: viewer.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/barometre");
  return { ok: true };
}
