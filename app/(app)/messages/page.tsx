import { messagePreview } from "@/lib/dm-media";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { Avatar } from "@/app/components/ui/avatar";
import { NameBadge } from "@/app/components/ui/badge";
import { fetchConversations } from "@/lib/data/messages";
import { t as dict, timeAgo } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const lang = viewer.lang;
  const t = dict(lang);
  const conversations = await fetchConversations(await createClient(), viewer.id);
  return (
    <>
      <PageHeader title={t.messages.title} />
      {conversations.length === 0 ? (
        <Empty>{t.messages.empty}</Empty>
      ) : (
        <ul>
          {conversations.map((c) => {
            const me = c.members.find((m) => m.user_id === viewer.id);
            const others = c.members.filter((m) => m.user_id !== viewer.id);
            const other = others[0]?.profile;
            const unread = c.last_message_at && (!me?.last_read_at || me.last_read_at < c.last_message_at);
            const title = c.title ?? others.map((o) => o.profile.display_name).join(", ");
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-paper/60">
                  <Avatar src={other?.avatar_url} name={other?.display_name ?? "?"} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[15px]">
                      <span className={`truncate ${unread ? "font-bold" : "font-semibold"}`}>{title}</span>
                      {other && <NameBadge p={other} size={16} lang={lang} />}
                      {c.last_message_at && <span className="flex-none text-[13px] text-muted">· {timeAgo(c.last_message_at, lang)}</span>}
                    </div>
                    <p className={`truncate text-[14px] ${unread ? "font-semibold text-ink" : "text-muted"}`}>
                      {c.last_message?.sender_id === viewer.id ? `${t.messages.you} : ` : ""}
                      {c.last_message ? messagePreview(c.last_message.text, c.last_message.media, lang) : ""}
                    </p>
                  </div>
                  {unread && <span aria-label="non lu" className="h-2.5 w-2.5 flex-none rounded-full bg-green" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
