import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { Avatar } from "@/app/components/ui/avatar";
import { NameBadge } from "@/app/components/ui/badge";
import { I } from "@/app/components/ui/icons";
import { fetchAuthors } from "@/lib/data/people";
import { t as dict, timeAgo } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = { title: "Notifications" };

const ICON: Record<Notification["type"], { icon: keyof typeof I; tone: string }> = {
  like: { icon: "heart", tone: "text-orange" },
  reply: { icon: "reply", tone: "text-green-deep" },
  repost: { icon: "repost", tone: "text-green-deep" },
  quote: { icon: "repost", tone: "text-green-deep" },
  follow: { icon: "user", tone: "text-green-deep" },
  mention: { icon: "reply", tone: "text-green-deep" },
  poll_end: { icon: "poll", tone: "text-muted" },
  interpellation_answer: { icon: "question", tone: "text-green-deep" },
  official_post: { icon: "landmark", tone: "text-green-deep" },
  verification: { icon: "shield", tone: "text-green-deep" },
  moderation: { icon: "flag", tone: "text-orange" },
  message: { icon: "mail", tone: "text-muted" },
  following_post: { icon: "user", tone: "text-green-deep" },
};

export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const lang = viewer.lang;
  const t = dict(lang);
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", viewer.id).neq("type", "message").order("created_at", { ascending: false }).limit(80);
  const rows = (data ?? []) as Notification[];
  const postIds = Array.from(new Set(rows.map((r) => r.post_id).filter((x): x is string => Boolean(x))));
  const [authors, postsRes] = await Promise.all([
    fetchAuthors(supabase, rows.map((r) => r.actor_id)),
    postIds.length ? supabase.from("posts").select("id, text").in("id", postIds) : Promise.resolve({ data: [] }),
  ]);
  const posts = new Map(((postsRes.data ?? []) as { id: string; text: string }[]).map((p) => [p.id, p]));
  // Mark everything read now that it has been fetched for display.
  if (rows.some((r) => !r.read_at)) await supabase.rpc("mark_notifications_read");

  const href = (n: Notification) => {
    if (n.type === "follow" && n.actor_id) return `/u/${authors.get(n.actor_id)?.handle ?? ""}`;
    if (n.type === "interpellation_answer" && n.ref_id) return `/interpellations/${n.ref_id}`;
    if (n.type === "verification") return "/parametres#verification";
    if (n.post_id) return `/p/${n.post_id}`;
    return "/notifications";
  };

  return (
    <>
      <PageHeader title={t.notifications.title}>
        <Link href="/parametres#notifications" aria-label={t.notifications.settings} title={t.notifications.settings} className="icon-btn">
          <I.settings className="h-5 w-5" />
        </Link>
      </PageHeader>
      {rows.length === 0 ? (
        <Empty>{t.notifications.empty}</Empty>
      ) : (
        <ul>
          {rows.map((n) => {
            const actor = n.actor_id ? authors.get(n.actor_id) : null;
            const meta = ICON[n.type] ?? { icon: "bell" as const, tone: "text-muted" };
            const Icon = I[meta.icon];
            const post = n.post_id ? posts.get(n.post_id) : null;
            return (
              <li key={n.id}>
                <Link href={href(n)} className={`flex gap-3 border-b border-line px-4 py-3 hover:bg-paper/60 ${n.read_at ? "" : "bg-green-soft/40"}`}>
                  <Icon className={`mt-1 h-6 w-6 flex-none ${meta.tone}`} filled />
                  <div className="min-w-0 flex-1">
                    {actor && <Avatar src={actor.avatar_url} name={actor.display_name} size={32} />}
                    <p className="mt-1 text-[15px] leading-snug">
                      {actor && (
                        <span className="inline-flex items-center gap-1 font-bold">
                          {actor.display_name}
                          <NameBadge p={actor} size={16} lang={lang} />
                        </span>
                      )}{" "}
                      {t.notifications[n.type]}
                      <span className="text-muted"> · {timeAgo(n.created_at, lang)}</span>
                    </p>
                    {post && <p className="mt-1 line-clamp-2 text-[14px] text-muted">{post.text}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
