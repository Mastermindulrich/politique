import { messagePreview } from "@/lib/dm-media";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { GroupAvatar } from "@/app/components/ui/group-avatar";
import { S } from "@/app/components/ui/icons-social";
import { NameBadge } from "@/app/components/ui/badge";
import { fetchConversations } from "@/lib/data/messages";
import { t as dict, timeAgo } from "@/lib/i18n";
import { social } from "@/lib/i18n-social";
import { createClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const lang = viewer.lang;
  const t = dict(lang);
  const s = social(lang);
  const conversations = await fetchConversations(await createClient(), viewer.id);
  return (
    <>
      <PageHeader title={t.messages.title}>
        <Link href="/messages/nouveau" aria-label={s.messages.new} title={s.messages.new} className="tap -mr-2 flex h-9 w-9 flex-none items-center justify-center rounded-full text-green-deep hover:bg-green-soft">
          <S.compose className="h-[21px] w-[21px]" />
        </Link>
      </PageHeader>
      {conversations.length === 0 ? (
        <Empty>
          <p>{t.messages.empty}</p>
          <Link href="/messages/nouveau" className="btn-primary btn-sm mt-5 inline-flex">{s.messages.new}</Link>
        </Empty>
      ) : (
        <ul>
          {conversations.map((c) => {
            const me = c.members.find((m) => m.user_id === viewer.id);
            const others = c.members.filter((m) => m.user_id !== viewer.id);
            const other = others[0]?.profile;
            const unread = c.last_message_at && (!me?.last_read_at || me.last_read_at < c.last_message_at);
            const title = c.title ?? (others.map((o) => o.profile.display_name).join(", ") || s.messages.emptyGroup);
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-paper/60 active:bg-paper">
                  <GroupAvatar people={c.is_group ? others.map((o) => o.profile) : other ? [other] : []} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[15px]">
                      <span className={`truncate ${unread ? "font-bold" : "font-semibold"}`}>{title}</span>
                      {!c.is_group && other && <NameBadge p={other} size={16} lang={lang} />}
                      {c.last_message_at && <span className="flex-none text-[13px] text-muted">· {timeAgo(c.last_message_at, lang)}</span>}
                    </div>
                    <p className={`mt-0.5 truncate text-[15px] ${unread ? "font-semibold text-ink" : "text-muted"}`}>
                      {c.last_message?.sender_id === viewer.id ? `${t.messages.you} : ` : ""}
                      {c.last_message ? messagePreview(c.last_message.text, c.last_message.media, lang) : c.is_group ? `${c.members.length} ${s.messages.members}` : ""}
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
