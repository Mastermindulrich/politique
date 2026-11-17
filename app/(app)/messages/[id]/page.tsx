import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/app/components/ui/avatar";
import { GroupAvatar } from "@/app/components/ui/group-avatar";
import { NameBadge } from "@/app/components/ui/badge";
import { fetchConversation, signAttachments } from "@/lib/data/messages";
import { createClient, getViewer } from "@/lib/supabase/server";
import { CallButtons } from "@/app/components/call/call-buttons";
import { social } from "@/lib/i18n-social";
import { Chat } from "./chat";
import { LeaveGroup } from "./leave-group";
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
  const urls = await signAttachments(supabase, data.messages);
  await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", viewer.id);
  const others = data.conversation.members.filter((m) => m.user_id !== viewer.id);
  const other = others[0]?.profile;
  const group = data.conversation.is_group;
  const s = social(viewer.lang);
  const title = data.conversation.title ?? (others.map((o) => o.profile.display_name).join(", ") || s.messages.emptyGroup);

  return (
    <ChatViewport>
      <div className="z-10 flex min-h-[56px] flex-none items-center gap-3 border-b border-line/70 bg-bg/85 px-3 py-2 backdrop-blur-xl sm:px-4" style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
        <Link href="/messages" aria-label="Retour" className="tap -ml-1 flex h-9 w-9 flex-none items-center justify-center rounded-full hover:bg-paper active:bg-line/70">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></svg>
        </Link>
        {group && (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <GroupAvatar people={others.map((o) => o.profile)} size={38} />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold">{title}</span>
                <span className="block truncate text-[13px] text-muted">{data.conversation.members.length} {s.messages.members}</span>
              </span>
            </div>
            <LeaveGroup conversationId={id} lang={viewer.lang} />
          </>
        )}
        {!group && other && (
          <Link href={`/u/${other.handle}`} className="flex min-w-0 items-center gap-3">
            <Avatar src={other.avatar_url} name={other.display_name} size={38} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[15px] font-bold"><span className="truncate">{title}</span><NameBadge p={other} size={16} lang={viewer.lang} /></span>
              <span className="block truncate text-[13px] text-muted">@{other.handle}</span>
            </span>
          </Link>
        )}
        {!group && others.length === 1 && other && <CallButtons conversationId={id} peer={{ id: other.id, display_name: other.display_name, handle: other.handle, avatar_url: other.avatar_url }} lang={viewer.lang} />}
      </div>
      <Chat conversationId={id} viewerId={viewer.id} lang={viewer.lang} initial={data.messages} initialUrls={urls} members={data.conversation.members.map((m) => m.profile)} />
    </ChatViewport>
  );
}
