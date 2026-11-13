import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedPost, Poll, Post, PostLabel, Profile } from "@/lib/types";

export const AUTHOR_COLS = "id, handle, display_name, avatar_url, verified, account_type";
export const PAGE = 25;

type Author = FeedPost["author"];

/**
 * Turns raw post rows into FeedPost objects: author, poll, quoted post, labels
 * and the viewer's own like/repost/bookmark/vote state. Five small queries,
 * whatever the page size.
 */
export async function hydratePosts(supabase: SupabaseClient, rows: Post[], viewerId: string | null): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const quotedIds = rows.map((r) => r.quoted_id).filter((x): x is string => Boolean(x));

  const [quotedRes] = await Promise.all([
    quotedIds.length ? supabase.from("posts").select("*").in("id", quotedIds) : Promise.resolve({ data: [] as Post[] }),
  ]);
  const quotedRows = (quotedRes.data ?? []) as Post[];
  const authorIds = Array.from(new Set([...rows.map((r) => r.author_id), ...quotedRows.map((r) => r.author_id)]));
  const allIds = [...ids, ...quotedRows.map((q) => q.id)];

  const [authorsRes, pollsRes, labelsRes, likesRes, repostsRes, bookmarksRes, votesRes] = await Promise.all([
    supabase.from("profiles").select(AUTHOR_COLS).in("id", authorIds),
    supabase.from("polls").select("*").in("post_id", allIds),
    supabase.from("post_labels").select("*").in("post_id", ids),
    viewerId ? supabase.from("likes").select("post_id").eq("user_id", viewerId).in("post_id", allIds) : Promise.resolve({ data: [] }),
    viewerId ? supabase.from("reposts").select("post_id").eq("user_id", viewerId).in("post_id", allIds) : Promise.resolve({ data: [] }),
    viewerId ? supabase.from("bookmarks").select("post_id").eq("user_id", viewerId).in("post_id", allIds) : Promise.resolve({ data: [] }),
    viewerId ? supabase.from("poll_votes").select("post_id, option_idx").eq("user_id", viewerId).in("post_id", allIds) : Promise.resolve({ data: [] }),
  ]);

  const authors = new Map<string, Author>(((authorsRes.data ?? []) as Author[]).map((a) => [a.id, a]));
  const polls = new Map<string, Poll>(((pollsRes.data ?? []) as Poll[]).map((p) => [p.post_id, p]));
  const labels = new Map<string, PostLabel[]>();
  for (const l of (labelsRes.data ?? []) as PostLabel[]) labels.set(l.post_id, [...(labels.get(l.post_id) ?? []), l]);
  const liked = new Set(((likesRes.data ?? []) as { post_id: string }[]).map((x) => x.post_id));
  const reposted = new Set(((repostsRes.data ?? []) as { post_id: string }[]).map((x) => x.post_id));
  const bookmarked = new Set(((bookmarksRes.data ?? []) as { post_id: string }[]).map((x) => x.post_id));
  const voted = new Map(((votesRes.data ?? []) as { post_id: string; option_idx: number }[]).map((x) => [x.post_id, x.option_idx]));
  const quoted = new Map(quotedRows.map((q) => [q.id, q]));

  const fallback = (id: string): Author => ({ id, handle: "compte", display_name: "Compte", avatar_url: null, verified: false, account_type: "citoyen" });

  return rows.map((r) => {
    const q = r.quoted_id ? quoted.get(r.quoted_id) : null;
    return {
      ...r,
      author: authors.get(r.author_id) ?? fallback(r.author_id),
      poll: polls.get(r.id) ?? null,
      quoted: q ? { ...q, author: authors.get(q.author_id) ?? fallback(q.author_id) } : null,
      labels: labels.get(r.id) ?? [],
      liked: liked.has(r.id),
      reposted: reposted.has(r.id),
      bookmarked: bookmarked.has(r.id),
      voted: voted.get(r.id) ?? null,
    };
  });
}

/** "Pour vous": ranked by the SQL function, then hydrated. */
export async function fetchForYou(supabase: SupabaseClient, viewerId: string | null, offset = 0) {
  const { data, error } = await supabase.rpc("feed_for_you", { lim: PAGE, before: new Date().toISOString(), off: offset });
  if (error || !data?.length) return [] as FeedPost[];
  const ranked = data as { post_id: string; score: number; reason: string }[];
  const { data: rows } = await supabase.from("posts").select("*").in("id", ranked.map((r) => r.post_id));
  const byId = new Map(((rows ?? []) as Post[]).map((p) => [p.id, p]));
  const ordered = ranked.map((r) => byId.get(r.post_id)).filter((p): p is Post => Boolean(p));
  const hydrated = await hydratePosts(supabase, ordered, viewerId);
  const reasons = new Map(ranked.map((r) => [r.post_id, r.reason]));
  return hydrated.map((p) => ({ ...p, reason: reasons.get(p.id) ?? null }));
}

/** "Abonnements": chronological posts and reposts from followed accounts. */
export async function fetchFollowing(supabase: SupabaseClient, viewerId: string, before?: string) {
  const { data: f } = await supabase.from("follows").select("followee_id").eq("follower_id", viewerId);
  const ids = [viewerId, ...((f ?? []) as { followee_id: string }[]).map((x) => x.followee_id)];
  const cutoff = before ?? new Date().toISOString();
  const [postsRes, repostsRes] = await Promise.all([
    supabase.from("posts").select("*").in("author_id", ids).neq("kind", "reply").is("deleted_at", null).eq("is_hidden", false).lt("created_at", cutoff).order("created_at", { ascending: false }).limit(PAGE),
    supabase.from("reposts").select("post_id, user_id, created_at").in("user_id", ids).lt("created_at", cutoff).order("created_at", { ascending: false }).limit(PAGE),
  ]);
  const posts = (postsRes.data ?? []) as Post[];
  const reposts = (repostsRes.data ?? []) as { post_id: string; user_id: string; created_at: string }[];
  let repostPosts: Post[] = [];
  if (reposts.length) {
    const { data } = await supabase.from("posts").select("*").in("id", reposts.map((r) => r.post_id)).is("deleted_at", null).eq("is_hidden", false);
    repostPosts = (data ?? []) as Post[];
  }
  const reposters = new Map<string, Pick<Profile, "handle" | "display_name">>();
  if (reposts.length) {
    const { data } = await supabase.from("profiles").select("id, handle, display_name").in("id", Array.from(new Set(reposts.map((r) => r.user_id))));
    for (const p of (data ?? []) as { id: string; handle: string; display_name: string }[]) reposters.set(p.id, p);
  }
  // merge by activity time
  type Item = { post: Post; at: string; by: Pick<Profile, "handle" | "display_name"> | null };
  const items: Item[] = [
    ...posts.map((p) => ({ post: p, at: p.created_at, by: null })),
    ...reposts.map((r) => ({ post: repostPosts.find((p) => p.id === r.post_id)!, at: r.created_at, by: reposters.get(r.user_id) ?? null })).filter((i) => i.post),
  ];
  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  const seen = new Set<string>();
  const page = items.filter((i) => (seen.has(i.post.id) ? false : (seen.add(i.post.id), true))).slice(0, PAGE);
  const hydrated = await hydratePosts(supabase, page.map((i) => i.post), viewerId);
  return hydrated.map((p, i) => ({ ...p, reposted_by: page[i].by, created_at_sort: page[i].at })) as (FeedPost & { created_at_sort: string })[];
}

export async function fetchPost(supabase: SupabaseClient, id: string, viewerId: string | null) {
  const { data } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const [p] = await hydratePosts(supabase, [data as Post], viewerId);
  return p ?? null;
}

/** Ancestors (oldest first) and direct replies of a post. */
export async function fetchThread(supabase: SupabaseClient, post: Post, viewerId: string | null) {
  const ancestors: Post[] = [];
  let cur = post;
  for (let i = 0; i < 20 && cur.parent_id; i++) {
    const { data } = await supabase.from("posts").select("*").eq("id", cur.parent_id).maybeSingle();
    if (!data) break;
    ancestors.unshift(data as Post);
    cur = data as Post;
  }
  const { data: replies } = await supabase.from("posts").select("*").eq("parent_id", post.id).is("deleted_at", null).order("like_count", { ascending: false }).order("created_at", { ascending: true }).limit(100);
  const [a, r] = await Promise.all([hydratePosts(supabase, ancestors, viewerId), hydratePosts(supabase, (replies ?? []) as Post[], viewerId)]);
  return { ancestors: a, replies: r };
}

export async function fetchProfilePosts(supabase: SupabaseClient, authorId: string, tab: "posts" | "replies" | "media" | "likes", viewerId: string | null, before?: string) {
  const cutoff = before ?? new Date().toISOString();
  if (tab === "likes") {
    const { data: likes } = await supabase.from("likes").select("post_id, created_at").eq("user_id", authorId).lt("created_at", cutoff).order("created_at", { ascending: false }).limit(PAGE);
    const ids = ((likes ?? []) as { post_id: string }[]).map((l) => l.post_id);
    if (!ids.length) return [];
    const { data } = await supabase.from("posts").select("*").in("id", ids).is("deleted_at", null);
    const byId = new Map(((data ?? []) as Post[]).map((p) => [p.id, p]));
    return hydratePosts(supabase, ids.map((i) => byId.get(i)).filter((p): p is Post => Boolean(p)), viewerId);
  }
  let q = supabase.from("posts").select("*").eq("author_id", authorId).is("deleted_at", null).lt("created_at", cutoff).order("created_at", { ascending: false }).limit(PAGE);
  if (tab === "posts") q = q.neq("kind", "reply");
  if (tab === "replies") q = q.eq("kind", "reply");
  if (tab === "media") q = q.neq("media", "[]");
  const { data } = await q;
  return hydratePosts(supabase, (data ?? []) as Post[], viewerId);
}

export async function fetchHashtag(supabase: SupabaseClient, tag: string, viewerId: string | null, before?: string) {
  const cutoff = before ?? new Date().toISOString();
  const { data } = await supabase.from("posts").select("*").contains("hashtags", [tag.toLowerCase()]).is("deleted_at", null).eq("is_hidden", false).lt("created_at", cutoff).order("created_at", { ascending: false }).limit(PAGE);
  return hydratePosts(supabase, (data ?? []) as Post[], viewerId);
}

export async function fetchByCommune(supabase: SupabaseClient, communeId: number, viewerId: string | null, before?: string) {
  const cutoff = before ?? new Date().toISOString();
  const { data } = await supabase.from("posts").select("*").eq("commune_id", communeId).neq("kind", "reply").is("deleted_at", null).eq("is_hidden", false).lt("created_at", cutoff).order("created_at", { ascending: false }).limit(PAGE);
  return hydratePosts(supabase, (data ?? []) as Post[], viewerId);
}

export async function fetchBookmarks(supabase: SupabaseClient, viewerId: string, before?: string) {
  const cutoff = before ?? new Date().toISOString();
  const { data: bm } = await supabase.from("bookmarks").select("post_id").eq("user_id", viewerId).lt("created_at", cutoff).order("created_at", { ascending: false }).limit(PAGE);
  const ids = ((bm ?? []) as { post_id: string }[]).map((b) => b.post_id);
  if (!ids.length) return [];
  const { data } = await supabase.from("posts").select("*").in("id", ids).is("deleted_at", null);
  const byId = new Map(((data ?? []) as Post[]).map((p) => [p.id, p]));
  return hydratePosts(supabase, ids.map((i) => byId.get(i)).filter((p): p is Post => Boolean(p)), viewerId);
}

export async function searchPosts(supabase: SupabaseClient, q: string, viewerId: string | null) {
  const { data } = await supabase.rpc("search_posts", { q, lim: 30 });
  return hydratePosts(supabase, (data ?? []) as Post[], viewerId);
}
