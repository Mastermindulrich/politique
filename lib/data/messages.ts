import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Message } from "@/lib/types";
import { fetchAuthors } from "./people";

export async function fetchConversations(supabase: SupabaseClient, viewerId: string): Promise<Conversation[]> {
  const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", viewerId);
  const ids = ((mine ?? []) as { conversation_id: string }[]).map((m) => m.conversation_id);
  if (!ids.length) return [];
  const [convRes, memRes] = await Promise.all([
    supabase.from("conversations").select("*").in("id", ids).not("last_message_at", "is", null).order("last_message_at", { ascending: false }).limit(50),
    supabase.from("conversation_members").select("conversation_id, user_id, last_read_at").in("conversation_id", ids),
  ]);
  const convs = (convRes.data ?? []) as Omit<Conversation, "members">[];
  const members = (memRes.data ?? []) as { conversation_id: string; user_id: string; last_read_at: string | null }[];
  const authors = await fetchAuthors(supabase, members.map((m) => m.user_id));
  // last message of each conversation (one small query each; the list is capped at 50)
  const lasts = await Promise.all(
    convs.map((c) => supabase.from("messages").select("text, sender_id, created_at").eq("conversation_id", c.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle()),
  );
  return convs.map((c, i) => ({
    ...c,
    members: members
      .filter((m) => m.conversation_id === c.id)
      .map((m) => ({ user_id: m.user_id, last_read_at: m.last_read_at, profile: authors.get(m.user_id) ?? { id: m.user_id, handle: "compte", display_name: "Compte", avatar_url: null, verified: false, account_type: "citoyen" as const } })),
    last_message: (lasts[i].data as Conversation["last_message"]) ?? null,
  }));
}

export async function fetchConversation(supabase: SupabaseClient, id: string, viewerId: string) {
  const [convRes, memRes, msgRes] = await Promise.all([
    supabase.from("conversations").select("*").eq("id", id).maybeSingle(),
    supabase.from("conversation_members").select("conversation_id, user_id, last_read_at").eq("conversation_id", id),
    supabase.from("messages").select("*").eq("conversation_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
  ]);
  if (!convRes.data) return null;
  const members = (memRes.data ?? []) as { user_id: string; last_read_at: string | null }[];
  if (!members.some((m) => m.user_id === viewerId)) return null;
  const authors = await fetchAuthors(supabase, members.map((m) => m.user_id));
  return {
    conversation: {
      ...(convRes.data as Omit<Conversation, "members">),
      members: members.map((m) => ({ ...m, profile: authors.get(m.user_id)! })).filter((m) => m.profile),
    } as Conversation,
    messages: ((msgRes.data ?? []) as Message[]).reverse(),
  };
}
