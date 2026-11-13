import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, PageHeader } from "@/app/components/shell/shell";
import { communeById, departmentById, regionById } from "@/lib/ci-geo";
import { attachProfiles, fetchAuthors } from "@/lib/data/people";
import { formatDate, t as dict, timeAgo } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { Barometer, Official, Post, Report, VerificationRequest } from "@/lib/types";
import { BarometerForm, OfficialForm, ReportActions, VerificationActions } from "./admin-forms";

export const metadata: Metadata = { title: "Modération", robots: { index: false } };

const TABS = ["signalements", "verifications", "elus", "barometres"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet } = await searchParams;
  const viewer = await getViewer();
  // Citizens get a plain 404: the dashboard's existence is not advertised.
  if (!viewer || (!viewer.is_moderator && !viewer.is_admin)) notFound();
  const lang = viewer.lang;
  const t = dict(lang);
  const tab: Tab = TABS.includes(onglet as Tab) ? (onglet as Tab) : "signalements";
  const supabase = await createClient();
  const labels: Record<Tab, string> = { signalements: t.admin.reports, verifications: t.admin.verifications, elus: t.admin.officials, barometres: t.admin.barometers };

  return (
    <>
      <PageHeader title={t.admin.title} back="/accueil" />
      <nav className="flex overflow-x-auto border-b border-line" aria-label={t.admin.title}>
        {TABS.filter((k) => k !== "barometres" || viewer.is_admin).map((k) => (
          <Link key={k} href={`/admin?onglet=${k}`} aria-current={tab === k ? "page" : undefined} className={`flex-none px-4 py-3 text-[14px] font-semibold ${tab === k ? "border-b-2 border-green text-ink" : "text-muted hover:bg-paper"}`}>
            {labels[k]}
          </Link>
        ))}
      </nav>
      {tab === "signalements" && <Reports supabase={supabase} lang={lang} />}
      {tab === "verifications" && <Verifications supabase={supabase} lang={lang} />}
      {tab === "elus" && <Officials supabase={supabase} lang={lang} />}
      {tab === "barometres" && viewer.is_admin && <Barometers supabase={supabase} lang={lang} />}
    </>
  );
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function Reports({ supabase, lang }: { supabase: Client; lang: "fr" | "en" }) {
  const t = dict(lang);
  const { data } = await supabase.from("reports").select("*").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(50);
  const reports = (data ?? []) as Report[];
  if (!reports.length) return <Empty>{t.admin.noReports}</Empty>;
  const postIds = reports.map((r) => r.post_id).filter((x): x is string => Boolean(x));
  const { data: postRows } = postIds.length ? await supabase.from("posts").select("id, text, author_id, is_hidden").in("id", postIds) : { data: [] };
  const posts = new Map(((postRows ?? []) as Pick<Post, "id" | "text" | "author_id" | "is_hidden">[]).map((p) => [p.id, p]));
  const people = await fetchAuthors(supabase, [...reports.map((r) => r.reporter_id), ...reports.map((r) => r.profile_id), ...[...posts.values()].map((p) => p.author_id)]);
  return (
    <ul>
      {reports.map((r) => {
        const post = r.post_id ? posts.get(r.post_id) : null;
        const target = people.get(post?.author_id ?? r.profile_id ?? "");
        const reporter = people.get(r.reporter_id);
        return (
          <li key={r.id} className="border-b border-line px-4 py-4">
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span className="chip bg-orange-soft text-orange">{t.report.reasons[r.reason as keyof typeof t.report.reasons] ?? r.reason}</span>
              <span>{timeAgo(r.created_at, lang)}</span>
              {reporter && <span>· {t.common.by} <Link href={`/u/${reporter.handle}`} className="hover:underline">@{reporter.handle}</Link></span>}
            </p>
            {target && (
              <p className="mt-2 text-[14px]">
                <Link href={`/u/${target.handle}`} className="font-semibold hover:underline">{target.display_name}</Link> <span className="text-muted">@{target.handle}</span>
              </p>
            )}
            {post && (
              <Link href={`/p/${post.id}`} className="mt-1 block rounded-2xl border border-line bg-paper px-3 py-2 text-[14px] hover:bg-card">
                <span className="line-clamp-4 whitespace-pre-wrap">{post.text || "…"}</span>
                {post.is_hidden && <span className="mt-1 block text-[12px] font-semibold text-orange">{lang === "fr" ? "Déjà masqué" : "Already hidden"}</span>}
              </Link>
            )}
            {r.message_id && <p className="mt-1 text-[13px] text-muted">{lang === "fr" ? "Message privé signalé" : "Reported direct message"}</p>}
            {r.details && <p className="mt-2 whitespace-pre-wrap text-[14px] text-muted">« {r.details} »</p>}
            <div className="mt-3"><ReportActions reportId={r.id} postId={post?.id ?? null} userId={target?.id ?? null} lang={lang} /></div>
          </li>
        );
      })}
    </ul>
  );
}

async function Verifications({ supabase, lang }: { supabase: Client; lang: "fr" | "en" }) {
  const t = dict(lang);
  const { data } = await supabase.from("verification_requests").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(50);
  const rows = (data ?? []) as VerificationRequest[];
  if (!rows.length) return <Empty>{t.admin.noVerifications}</Empty>;
  const people = await fetchAuthors(supabase, rows.map((r) => r.user_id));
  const officialIds = rows.map((r) => r.official_id).filter((x): x is string => Boolean(x));
  const { data: offRows } = officialIds.length ? await supabase.from("officials").select("*").in("id", officialIds) : { data: [] };
  const officials = new Map(((offRows ?? []) as Official[]).map((o) => [o.id, o]));
  // Short-lived signed links: documents never get a public URL.
  const sign = async (path: string | null) => (path ? (await supabase.storage.from("documents").createSignedUrl(path, 600)).data?.signedUrl ?? null : null);
  const links = await Promise.all(rows.map(async (r) => ({ id: r.id, doc: await sign(r.document_path), proof: await sign(r.proof_path) })));
  const linkById = new Map(links.map((l) => [l.id, l]));
  return (
    <ul>
      {rows.map((r) => {
        const u = people.get(r.user_id);
        const o = r.official_id ? officials.get(r.official_id) : null;
        const l = linkById.get(r.id);
        return (
          <li key={r.id} className="border-b border-line px-4 py-4">
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span className="chip bg-green-soft text-green-deep">{r.requested_type}</span>
              <span>{formatDate(r.created_at, lang)}</span>
            </p>
            <p className="mt-2 text-[15px] font-semibold">{r.full_name}</p>
            {u && <p className="text-[14px] text-muted"><Link href={`/u/${u.handle}`} className="hover:underline">@{u.handle}</Link> · {u.display_name}</p>}
            {o && <p className="mt-1 text-[14px]"><Link href={`/elus/${o.id}`} className="font-semibold text-green-deep hover:underline">{o.full_name}</Link> · {o.title || t.officials.mandates[o.mandate]}</p>}
            {r.organisation && <p className="mt-1 text-[14px]">{r.organisation}</p>}
            <p className="mt-2 flex flex-wrap gap-3 text-[14px]">
              <span className="text-muted">{t.admin.documents} :</span>
              {l?.doc ? <a href={l.doc} target="_blank" rel="noreferrer" className="font-semibold text-green-deep hover:underline">{t.settings.document}</a> : <span className="text-muted">—</span>}
              {l?.proof ? <a href={l.proof} target="_blank" rel="noreferrer" className="font-semibold text-green-deep hover:underline">{t.settings.proof}</a> : <span className="text-muted">—</span>}
            </p>
            <div className="mt-3"><VerificationActions id={r.id} lang={lang} /></div>
          </li>
        );
      })}
    </ul>
  );
}

async function Officials({ supabase, lang }: { supabase: Client; lang: "fr" | "en" }) {
  const t = dict(lang);
  const { data } = await supabase.from("officials").select("*").order("created_at", { ascending: false }).limit(100);
  const officials = await attachProfiles(supabase, (data ?? []) as Official[]);
  return (
    <>
      <div className="border-b border-line px-4 py-5">
        <h2 className="font-display text-[18px] font-bold">{t.admin.newOfficial}</h2>
        <div className="mt-4"><OfficialForm lang={lang} /></div>
      </div>
      {officials.length === 0 ? (
        <Empty>{t.admin.empty}</Empty>
      ) : (
        <ul>
          {officials.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-[14px]">
              <span className="min-w-0">
                <Link href={`/elus/${o.id}`} className="font-semibold hover:underline">{o.full_name}</Link>
                <span className="block truncate text-muted">
                  {o.title || t.officials.mandates[o.mandate]}
                  {" · "}
                  {communeById.get(o.commune_id ?? 0)?.name ?? departmentById.get(o.department_id ?? 0)?.name ?? regionById.get(o.region_id ?? 0)?.name ?? "Côte d'Ivoire"}
                  {o.party ? ` · ${o.party}` : ""}
                </span>
              </span>
              <span className={`chip flex-none ${o.profile ? "bg-green-soft text-green-deep" : "bg-paper text-muted"}`}>{o.profile ? `@${o.profile.handle}` : t.myOfficials.unclaimed}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function Barometers({ supabase, lang }: { supabase: Client; lang: "fr" | "en" }) {
  const t = dict(lang);
  const { data } = await supabase.from("barometers").select("*").order("month", { ascending: false }).limit(24);
  const rows = (data ?? []) as Barometer[];
  return (
    <>
      <div className="border-b border-line px-4 py-5">
        <h2 className="font-display text-[18px] font-bold">{t.admin.newBarometer}</h2>
        <div className="mt-4"><BarometerForm lang={lang} /></div>
      </div>
      {rows.length === 0 ? (
        <Empty>{t.admin.empty}</Empty>
      ) : (
        <ul>
          {rows.map((b) => (
            <li key={b.id} className="border-b border-line px-4 py-3 text-[14px]">
              <span className="font-semibold">{b.question}</span>
              <span className="block text-muted">
                {new Date(b.month).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" })} · {b.options.join(" / ")} · {t.admin.closes} {formatDate(b.closes_at, lang)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
