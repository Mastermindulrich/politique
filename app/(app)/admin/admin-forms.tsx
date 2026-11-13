"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBarometer, moderate, reviewVerification, upsertOfficial } from "@/lib/actions";
import { communes, departments, regions } from "@/lib/ci-geo";
import { t as dict } from "@/lib/i18n";
import type { Mandate } from "@/lib/types";

type Lang = "fr" | "en";

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean }>, after?: () => void) =>
    start(async () => {
      setError(false);
      const r = await fn();
      if (!r.ok) return setError(true);
      setDone(true);
      after?.();
      router.refresh();
    });
  return { pending, error, done, run, setDone };
}

export function ReportActions({ reportId, postId, userId, lang }: { reportId: string; postId: string | null; userId: string | null; lang: Lang }) {
  const t = dict(lang);
  const { pending, error, done, run } = useAct();
  if (done) return <p className="text-[14px] font-semibold text-green-deep">{t.admin.actioned}</p>;
  const act = (action: "hide_post" | "suspend" | "ban" | "dismiss") => {
    if (action === "ban" && !window.confirm(lang === "fr" ? "Bannir ce compte définitivement ?" : "Ban this account permanently?")) return;
    run(() => moderate({ reportId, postId: postId ?? undefined, userId: userId ?? undefined, action }));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {postId && <button type="button" className="btn-dark btn-sm" disabled={pending} onClick={() => act("hide_post")}>{t.admin.hidePost}</button>}
      {userId && <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => act("suspend")}>{t.admin.suspend7}</button>}
      {userId && <button type="button" className="btn-ghost btn-sm text-orange" disabled={pending} onClick={() => act("ban")}>{t.admin.ban}</button>}
      <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => act("dismiss")}>{t.admin.dismiss}</button>
      {error && <span role="alert" className="text-[13px] font-medium text-orange">{t.common.error}</span>}
    </div>
  );
}

export function VerificationActions({ id, lang }: { id: string; lang: Lang }) {
  const t = dict(lang);
  const { pending, error, done, run } = useAct();
  const [notes, setNotes] = useState("");
  if (done) return <p className="text-[14px] font-semibold text-green-deep">{t.admin.actioned}</p>;
  return (
    <div className="flex flex-col gap-2">
      <input className="input h-10" placeholder={lang === "fr" ? "Motif (envoyé à la personne en cas de refus)" : "Reason (sent to the person if declined)"} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={() => run(() => reviewVerification(id, true, notes || undefined))}>{t.admin.approve}</button>
        <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => run(() => reviewVerification(id, false, notes || undefined))}>{t.admin.reject}</button>
        {error && <span role="alert" className="text-[13px] font-medium text-orange">{t.common.error}</span>}
      </div>
    </div>
  );
}

const MANDATES: Mandate[] = ["maire", "depute", "senateur", "president_conseil_regional", "gouverneur_district", "ministre", "president", "conseiller_municipal", "conseiller_regional", "autre"];
// Which level of geography a mandate is attached to.
const LEVEL: Record<Mandate, "commune" | "department" | "region" | "national"> = {
  maire: "commune", conseiller_municipal: "commune", depute: "department", senateur: "region", president_conseil_regional: "region",
  conseiller_regional: "region", gouverneur_district: "region", ministre: "national", president: "national", autre: "national",
};

export function OfficialForm({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const { pending, error, done, run, setDone } = useAct();
  const [fullName, setFullName] = useState("");
  const [mandate, setMandate] = useState<Mandate>("maire");
  const [title, setTitle] = useState("");
  const [party, setParty] = useState("");
  const [region, setRegion] = useState<number | null>(null);
  const [department, setDepartment] = useState<number | null>(null);
  const [commune, setCommune] = useState<number | null>(null);
  const [handle, setHandle] = useState("");
  const level = LEVEL[mandate];
  const deps = region ? departments.filter((d) => d.regionId === region) : [];
  const coms = department ? communes.filter((c) => c.departmentId === department) : [];
  const ready = fullName.trim().length >= 2 && (level === "national" || (level === "region" && region) || (level === "department" && department) || (level === "commune" && commune));

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        run(
          () => upsertOfficial({
            full_name: fullName.trim(), mandate, title: title.trim() || null, party: party.trim() || null,
            region_id: level === "national" ? null : region,
            department_id: level === "department" || level === "commune" ? department : null,
            commune_id: level === "commune" ? commune : null,
            handle: handle.trim() || null,
          }),
          () => { setFullName(""); setTitle(""); setParty(""); setHandle(""); },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">{t.admin.fullName}</span>
          <input className="input" required minLength={2} maxLength={120} value={fullName} onChange={(e) => { setDone(false); setFullName(e.target.value); }} />
        </label>
        <label>
          <span className="label">{t.admin.mandate}</span>
          <select className="select" value={mandate} onChange={(e) => setMandate(e.target.value as Mandate)}>
            {MANDATES.map((m) => <option key={m} value={m}>{t.officials.mandates[m]}</option>)}
          </select>
        </label>
        <label>
          <span className="label">{t.admin.titleField}</span>
          <input className="input" maxLength={140} placeholder={lang === "fr" ? "Maire de Cocody" : "Mayor of Cocody"} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          <span className="label">{t.admin.party}</span>
          <input className="input" maxLength={80} value={party} onChange={(e) => setParty(e.target.value)} />
        </label>
        {level !== "national" && (
          <label>
            <span className="label">{t.admin.region}</span>
            <select className="select" required value={region ?? ""} onChange={(e) => { setRegion(e.target.value ? Number(e.target.value) : null); setDepartment(null); setCommune(null); }}>
              <option value="" disabled>—</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        )}
        {(level === "department" || level === "commune") && (
          <label>
            <span className="label">{t.admin.department}</span>
            <select className="select" required disabled={!deps.length} value={department ?? ""} onChange={(e) => { setDepartment(e.target.value ? Number(e.target.value) : null); setCommune(null); }}>
              <option value="" disabled>—</option>
              {deps.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        )}
        {level === "commune" && (
          <label>
            <span className="label">{t.admin.commune}</span>
            <select className="select" required disabled={!coms.length} value={commune ?? ""} onChange={(e) => setCommune(e.target.value ? Number(e.target.value) : null)}>
              <option value="" disabled>—</option>
              {coms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label>
          <span className="label">{t.admin.linkProfile}</span>
          <input className="input" maxLength={21} placeholder="@" autoCapitalize="none" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary btn-sm" disabled={pending || !ready}>{t.admin.save}</button>
        {done && <span role="status" className="text-[14px] font-medium text-green-deep">{t.settings.saved}</span>}
        {error && <span role="alert" className="text-[14px] font-medium text-orange">{t.common.error}</span>}
      </div>
    </form>
  );
}

export function BarometerForm({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const { pending, error, done, run, setDone } = useAct();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(lang === "fr" ? "Oui\nNon\nSans avis" : "Yes\nNo\nNo opinion");
  const [closes, setCloses] = useState("");
  const list = options.split("\n").map((o) => o.trim()).filter(Boolean);
  const ready = question.trim().length >= 5 && list.length >= 2 && list.length <= 6 && Boolean(closes) && /^\d{4}-\d{2}$/.test(month);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        run(() => createBarometer({ month: `${month}-01`, question: question.trim(), options: list, closes_at: new Date(`${closes}T23:59:59`).toISOString() }), () => setQuestion(""));
      }}
    >
      <label>
        <span className="label">{t.admin.question}</span>
        <input className="input" required minLength={5} maxLength={200} value={question} onChange={(e) => { setDone(false); setQuestion(e.target.value); }} />
      </label>
      <label>
        <span className="label">{t.admin.options}</span>
        <textarea className="textarea" rows={4} value={options} onChange={(e) => setOptions(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">{t.admin.month}</span>
          <input className="input" type="month" required value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <label>
          <span className="label">{t.admin.closes}</span>
          <input className="input" type="date" required value={closes} onChange={(e) => setCloses(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary btn-sm" disabled={pending || !ready}>{t.admin.save}</button>
        {done && <span role="status" className="text-[14px] font-medium text-green-deep">{t.settings.saved}</span>}
        {error && <span role="alert" className="text-[14px] font-medium text-orange">{t.common.error}</span>}
      </div>
    </form>
  );
}
