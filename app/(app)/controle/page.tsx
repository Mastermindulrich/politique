import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { formatDate, timeAgo } from "@/lib/i18n";
import { FEATURES, getSettings, type Feature } from "@/lib/settings";
import { createClient, getViewer } from "@/lib/supabase/server";
import { AnnouncementForm, MemberActions, MemberSearch, Switch } from "./controls";

export const metadata: Metadata = { title: "Centre de contrôle", robots: { index: false } };

const TABS = ["apercu", "reglages", "membres", "journal"] as const;
type Tab = (typeof TABS)[number];

const COPY = {
  fr: {
    title: "Centre de contrôle",
    tabs: { apercu: "Vue d'ensemble", reglages: "Réglages du site", membres: "Membres et accès", journal: "Journal" },
    moderation: "Modération",
    stats: {
      members: "Membres", members_7d: "Nouveaux (7 jours)", members_24h: "Nouveaux (24 h)", posts: "Publications",
      posts_24h: "Publications (24 h)", messages_24h: "Messages privés (24 h)", open_reports: "Signalements à traiter",
      pending_verifs: "Vérifications en attente", officials: "Mandats dans l'annuaire", suspended: "Comptes suspendus", staff: "Équipe",
    },
    features: {
      signups_open: ["Inscriptions", "Les nouvelles personnes peuvent créer un compte."],
      posting: ["Publications et réponses", "Les membres peuvent publier, répondre et créer des sondages."],
      interactions: ["J'aime, partages, abonnements", "Les membres peuvent aimer, partager, s'abonner et voter aux sondages."],
      messages: ["Messages privés", "Les membres peuvent écrire en privé."],
      interpellations: ["Interpellations", "Les citoyens peuvent interpeller leurs élus et soutenir les interpellations."],
      promises: ["Promesses", "Ajout de promesses et de leurs mises à jour."],
      ideas: ["Boîte à idées", "Propositions des citoyens à leur commune et votes."],
      barometer: ["Baromètre", "Vote au baromètre mensuel."],
      media_uploads: ["Photos et vidéos", "Envoi de photos et de vidéos."],
      verification_requests: ["Demandes de certification", "Les élus, médias et institutions peuvent demander le badge."],
    } as Record<Feature, [string, string]>,
    maintenance: ["Mode maintenance", "Le site est fermé à tous sauf à l'équipe. La connexion reste possible."],
    staffNote: "Vous et les administrateurs gardez l'accès à tout, même quand une fonction est coupée.",
    ownerOnly: "Seul le propriétaire peut modifier ces réglages.",
    announcement: "Bandeau d'annonce",
    filters: { all: "Tous", staff: "Équipe", suspended: "Suspendus", verified: "Certifiés" },
    noMembers: "Aucun membre ne correspond.",
    joined: "inscrit",
    lastSeen: "dernière connexion",
    posts: "publications",
    log: { setting: "Réglage modifié", role: "Rôle modifié", badge: "Badge modifié", remove_member: "Membre supprimé", suspend: "Suspension", ban: "Bannissement", unban: "Sanction levée" },
    noLog: "Aucune action pour l'instant.",
    by: "par",
  },
  en: {
    title: "Control center",
    tabs: { apercu: "Overview", reglages: "Site settings", membres: "Members and access", journal: "Log" },
    moderation: "Moderation",
    stats: {
      members: "Members", members_7d: "New (7 days)", members_24h: "New (24 h)", posts: "Posts", posts_24h: "Posts (24 h)",
      messages_24h: "Direct messages (24 h)", open_reports: "Reports to review", pending_verifs: "Pending verifications",
      officials: "Mandates in the directory", suspended: "Suspended accounts", staff: "Staff",
    },
    features: {
      signups_open: ["Sign-ups", "New people can create an account."],
      posting: ["Posts and replies", "Members can post, reply and create polls."],
      interactions: ["Likes, reposts, follows", "Members can like, repost, follow and vote in polls."],
      messages: ["Direct messages", "Members can write privately."],
      interpellations: ["Questions to officials", "Citizens can question their officials and back questions."],
      promises: ["Promises", "Adding promises and their updates."],
      ideas: ["Idea box", "Citizens' proposals to their commune, and votes."],
      barometer: ["Barometer", "Voting in the monthly barometer."],
      media_uploads: ["Photos and videos", "Uploading photos and videos."],
      verification_requests: ["Verification requests", "Officials, media and institutions can request the badge."],
    } as Record<Feature, [string, string]>,
    maintenance: ["Maintenance mode", "The site is closed to everyone but staff. Logging in still works."],
    staffNote: "You and the admins keep access to everything, even when a feature is off.",
    ownerOnly: "Only the owner can change these settings.",
    announcement: "Announcement banner",
    filters: { all: "All", staff: "Staff", suspended: "Suspended", verified: "Verified" },
    noMembers: "No member matches.",
    joined: "joined",
    lastSeen: "last login",
    posts: "posts",
    log: { setting: "Setting changed", role: "Role changed", badge: "Badge changed", remove_member: "Member removed", suspend: "Suspension", ban: "Ban", unban: "Sanction lifted" },
    noLog: "No actions yet.",
    by: "by",
  },
} as const;

type Member = {
  id: string; handle: string; display_name: string; avatar_url: string | null; account_type: string; verified: boolean;
  is_owner: boolean; is_admin: boolean; is_moderator: boolean; suspended_until: string | null; posts_count: number;
  followers_count: number; created_at: string; email: string | null; last_sign_in_at: string | null;
};

export default async function ControlCenter({ searchParams }: { searchParams: Promise<{ onglet?: string; q?: string; filtre?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  // Only the owner and admins; everyone else gets a plain 404.
  if (!viewer || !(viewer.is_owner || viewer.is_admin)) notFound();
  const lang = viewer.lang;
  const c = COPY[lang];
  const owner = Boolean(viewer.is_owner);
  const tab: Tab = TABS.includes(sp.onglet as Tab) ? (sp.onglet as Tab) : "apercu";
  const supabase = await createClient();

  return (
    <>
      <PageHeader title={c.title} back="/accueil" />
      <nav className="flex overflow-x-auto border-b border-line" aria-label={c.title}>
        {TABS.map((k) => (
          <Link key={k} href={`/controle?onglet=${k}`} aria-current={tab === k ? "page" : undefined} className={`flex-none px-4 py-3 text-[14px] font-semibold ${tab === k ? "border-b-2 border-green text-ink" : "text-muted hover:bg-paper"}`}>
            {c.tabs[k]}
          </Link>
        ))}
        <Link href="/admin" className="flex-none px-4 py-3 text-[14px] font-semibold text-muted hover:bg-paper">{c.moderation} →</Link>
      </nav>
      {tab === "apercu" && <Overview supabase={supabase} lang={lang} />}
      {tab === "reglages" && <Settings lang={lang} owner={owner} />}
      {tab === "membres" && <Members supabase={supabase} lang={lang} owner={owner} viewerId={viewer.id} q={sp.q ?? ""} filter={sp.filtre ?? "all"} />}
      {tab === "journal" && <Log supabase={supabase} lang={lang} />}
    </>
  );
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function Overview({ supabase, lang }: { supabase: Client; lang: "fr" | "en" }) {
  const c = COPY[lang];
  const { data } = await supabase.rpc("admin_stats");
  const s = (data ?? {}) as Record<keyof typeof c.stats, number>;
  const links: Partial<Record<keyof typeof c.stats, string>> = { open_reports: "/admin?onglet=signalements", pending_verifs: "/admin?onglet=verifications", officials: "/admin?onglet=elus", suspended: "/controle?onglet=membres&filtre=suspended", staff: "/controle?onglet=membres&filtre=staff", members: "/controle?onglet=membres" };
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
      {(Object.keys(c.stats) as (keyof typeof c.stats)[]).map((k) => {
        const body = (
          <>
            <span className="block font-display text-[28px] font-bold leading-none">{Number(s[k] ?? 0).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")}</span>
            <span className="mt-2 block text-[13px] text-muted">{c.stats[k]}</span>
          </>
        );
        const cls = `rounded-2xl border border-line p-4 ${(k === "open_reports" || k === "pending_verifs") && Number(s[k]) > 0 ? "border-orange/40 bg-orange-soft" : "bg-card"}`;
        const href = links[k];
        return href ? <Link key={k} href={href} className={`${cls} hover:bg-paper`}>{body}</Link> : <div key={k} className={cls}>{body}</div>;
      })}
    </div>
  );
}

async function Settings({ lang, owner }: { lang: "fr" | "en"; owner: boolean }) {
  const c = COPY[lang];
  const s = await getSettings();
  return (
    <div className="flex flex-col">
      <p className="border-b border-line px-4 py-3 text-[13px] text-muted">{owner ? c.staffNote : c.ownerOnly}</p>
      <div className="border-b border-line">
        <Switch k="maintenance" on={s.maintenance} title={c.maintenance[0]} body={c.maintenance[1]} danger disabled={!owner} lang={lang} />
      </div>
      <ul>
        {FEATURES.map((f) => (
          <li key={f} className="border-b border-line">
            <Switch k={f} on={s[f]} title={c.features[f][0]} body={c.features[f][1]} disabled={!owner} lang={lang} />
          </li>
        ))}
      </ul>
      <div className="px-4 py-5">
        <h2 className="font-display text-[18px] font-bold">{c.announcement}</h2>
        <div className="mt-3"><AnnouncementForm initial={s.announcement} disabled={!owner} lang={lang} /></div>
      </div>
    </div>
  );
}

async function Members({ supabase, lang, owner, viewerId, q, filter }: { supabase: Client; lang: "fr" | "en"; owner: boolean; viewerId: string; q: string; filter: string }) {
  const c = COPY[lang];
  const f = ["all", "staff", "suspended", "verified"].includes(filter) ? filter : "all";
  const { data } = await supabase.rpc("admin_members", { q: q.slice(0, 80) || null, filter: f, lim: 100, off: 0 });
  const rows = (data ?? []) as Member[];
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
        <MemberSearch initial={q} filter={f} lang={lang} owner={owner} />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(c.filters) as (keyof typeof c.filters)[]).map((k) => (
            <Link key={k} href={`/controle?onglet=membres&filtre=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={f === k ? "page" : undefined} className={`chip ${f === k ? "bg-ink text-white" : "bg-paper text-muted hover:text-ink"}`}>
              {c.filters[k]}
            </Link>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty>{c.noMembers}</Empty>
      ) : (
        <ul>
          {rows.map((m) => {
            const suspended = m.suspended_until && new Date(m.suspended_until) > new Date();
            const role = m.is_owner ? "owner" : m.is_admin ? "admin" : m.is_moderator ? "moderator" : "member";
            return (
              <li key={m.id} className="border-b border-line px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/u/${m.handle}`} className="text-[15px] font-semibold hover:underline">{m.display_name}</Link>
                  <span className="text-[14px] text-muted">@{m.handle}</span>
                  {role !== "member" && <span className="chip bg-green-soft text-green-deep">{roleLabel(role, lang)}</span>}
                  {m.verified && <span className="chip bg-paper text-ink">✓ {m.account_type}</span>}
                  {suspended && <span className="chip bg-orange-soft text-orange">{lang === "fr" ? "Suspendu jusqu'au" : "Suspended until"} {formatDate(m.suspended_until!, lang)}</span>}
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {m.email && <>{m.email} · </>}
                  {c.joined} {formatDate(m.created_at, lang)} · {m.posts_count} {c.posts}
                  {m.last_sign_in_at && <> · {c.lastSeen} {timeAgo(m.last_sign_in_at, lang)}</>}
                </p>
                {m.id !== viewerId && !m.is_owner && (
                  <div className="mt-3">
                    <MemberActions id={m.id} handle={m.handle} role={role as "admin" | "moderator" | "member"} verified={m.verified} suspended={Boolean(suspended)} owner={owner} lang={lang} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function roleLabel(role: string, lang: "fr" | "en") {
  const fr: Record<string, string> = { owner: "Propriétaire", admin: "Administrateur", moderator: "Modérateur", member: "Membre" };
  const en: Record<string, string> = { owner: "Owner", admin: "Admin", moderator: "Moderator", member: "Member" };
  return (lang === "fr" ? fr : en)[role];
}

type LogRow = { id: number; actor_id: string | null; action: string; target_user_id: string | null; details: Record<string, unknown> | null; created_at: string };
type ModRow = { id: string; moderator_id: string | null; target_user_id: string | null; action: string; reason: string | null; created_at: string };

async function Log({ supabase, lang }: { supabase: Client; lang: "fr" | "en" }) {
  const c = COPY[lang];
  const [{ data: a }, { data: m }] = await Promise.all([
    supabase.from("admin_log").select("*").order("created_at", { ascending: false }).limit(60),
    supabase.from("moderation_actions").select("id, moderator_id, target_user_id, action, reason, created_at").order("created_at", { ascending: false }).limit(60),
  ]);
  const entries = [
    ...((a ?? []) as LogRow[]).map((r) => ({ key: `a${r.id}`, actor: r.actor_id, target: r.target_user_id, action: r.action, detail: describe(r, lang), at: r.created_at })),
    ...((m ?? []) as ModRow[]).map((r) => ({ key: `m${r.id}`, actor: r.moderator_id, target: r.target_user_id, action: r.action, detail: r.reason ?? "", at: r.created_at })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 80);
  if (!entries.length) return <Empty>{c.noLog}</Empty>;
  const ids = [...new Set(entries.flatMap((e) => [e.actor, e.target]).filter((x): x is string => Boolean(x)))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, handle").in("id", ids) : { data: [] };
  const handle = new Map(((people ?? []) as { id: string; handle: string }[]).map((p) => [p.id, p.handle]));
  const label = (k: string) => (c.log as Record<string, string>)[k] ?? k.replace(/_/g, " ");
  return (
    <ul>
      {entries.map((e) => (
        <li key={e.key} className="border-b border-line px-4 py-3 text-[14px]">
          <p>
            <span className="font-semibold">{label(e.action)}</span>
            {e.target && handle.get(e.target) && <> · <Link href={`/u/${handle.get(e.target)}`} className="hover:underline">@{handle.get(e.target)}</Link></>}
            {e.detail && <span className="text-muted"> · {e.detail}</span>}
          </p>
          <p className="text-[13px] text-muted">{timeAgo(e.at, lang)}{e.actor && handle.get(e.actor) ? ` · ${c.by} @${handle.get(e.actor)}` : ""}</p>
        </li>
      ))}
    </ul>
  );
}

function describe(r: LogRow, lang: "fr" | "en") {
  const d = r.details ?? {};
  if (r.action === "setting") {
    const key = String(d.key);
    const name = key === "maintenance" ? COPY[lang].maintenance[0] : key === "announcement" ? COPY[lang].announcement : COPY[lang].features[key as Feature]?.[0] ?? key;
    const v = d.value;
    return typeof v === "boolean" ? `${name} : ${v ? (lang === "fr" ? "activé" : "on") : (lang === "fr" ? "coupé" : "off")}` : name;
  }
  if (r.action === "role") return roleLabel(String(d.role), lang);
  if (r.action === "badge") return d.verified ? (lang === "fr" ? "badge accordé" : "badge granted") : (lang === "fr" ? "badge retiré" : "badge removed");
  if (r.action === "remove_member") return `@${String(d.handle ?? "")}`;
  return "";
}
