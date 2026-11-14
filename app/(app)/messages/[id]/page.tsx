import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/app/components/ui/avatar";
import { NameBadge } from "@/app/components/ui/badge";
import { fetchConversation } from "@/lib/data/messages";
import { createClient, getViewer } from "@/lib/supabase/server";
import { Chat } from "./chat";
import { ChatViewport } from "./chat-viewport";

export const metadata: Metadata = { title: "Messages" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const supabase = await createClient();
  const data = await fetchConversation(supabase, id, viewer.id);
  if (!data) notFound();
  await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", viewer.id);
  const others = data.conversation.members.filter((m) => m.user_id !== viewer.id);
  const other = others[0]?.profile;

  return (
    <ChatViewport>
      <div className="flex min-h-[56px] flex-none items-center gap-3 border-b border-line px-4 py-2" style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
        <Link href="/messages" aria-label="Retour" className="-ml-2 rounded-full p-2 hover:bg-paper">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>
        </Link>
        {other && (
          <Link href={`/u/${other.handle}`} className="flex min-w-0 items-center gap-3">
            <Avatar src={other.avatar_url} name={other.display_name} size={36} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[15px] font-bold"><span className="truncate">{data.conversation.title ?? others.map((o) => o.profile.display_name).join(", ")}</span><NameBadge p={other} size={16} lang={viewer.lang} /></span>
              <span className="block truncate text-[13px] text-muted">@{other.handle}</span>
            </span>
          </Link>
        )}
      </div>
      <Chat conversationId={id} viewerId={viewer.id} lang={viewer.lang} initial={data.messages} members={data.conversation.members.map((m) => m.profile)} />
    </ChatViewport>
  );
}
