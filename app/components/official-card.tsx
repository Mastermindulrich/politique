import Link from "next/link";
import * as geo from "@/lib/ci-geo";
import { officialPlace } from "@/lib/data/people";
import { t as dict } from "@/lib/i18n";
import type { Official } from "@/lib/types";
import { Avatar } from "./ui/avatar";
import { NameBadge } from "./ui/badge";

export function OfficialCard({ o, lang, highlight = false }: { o: Official; lang: "fr" | "en"; highlight?: boolean }) {
  const t = dict(lang);
  return (
    <Link href={`/elus/${o.id}`} className={`flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-paper/60 ${highlight ? "bg-green-soft/40" : ""}`}>
      <Avatar src={o.profile?.avatar_url ?? o.photo_url} name={o.full_name} size={48} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[16px] font-bold">
          <span className="truncate">{o.full_name}</span>
          {o.profile && <NameBadge p={{ ...o.profile, account_type: "elu" }} size={17} lang={lang} />}
        </span>
        <span className="block truncate text-[14px] text-muted">
          {o.title ?? `${t.officials.mandates[o.mandate]} · ${officialPlace(o, geo)}`}
          {o.party ? ` · ${o.party}` : ""}
        </span>
        <span className={`mt-0.5 inline-block text-[12px] font-semibold ${o.profile_id ? "text-green-deep" : "text-muted"}`}>{o.profile_id ? t.myOfficials.claimed : t.myOfficials.unclaimed}</span>
      </span>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 flex-none text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>
    </Link>
  );
}

const STATUS_TONE: Record<string, string> = {
  ouverte: "bg-orange-soft text-orange",
  repondue: "bg-green-soft text-green-deep",
  classee: "bg-paper text-muted",
  annoncee: "bg-paper text-muted",
  en_cours: "bg-orange-soft text-orange",
  tenue: "bg-green-soft text-green-deep",
  partiellement_tenue: "bg-green-soft text-green-deep",
  non_tenue: "bg-ink text-bg",
  planifiee: "bg-paper text-muted",
  terminee: "bg-paper text-muted",
  annulee: "bg-paper text-muted",
  nouvelle: "bg-paper text-muted",
  etudiee: "bg-orange-soft text-orange",
  adoptee: "bg-green-soft text-green-deep",
  refusee: "bg-ink text-bg",
};

export function StatusChip({ status, label }: { status: string; label: string }) {
  return <span className={`chip ${STATUS_TONE[status] ?? "bg-paper text-muted"}`}>{label}</span>;
}
