"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeMember, sanction, setAnnouncement, setBadge, setRole, setSwitch } from "@/lib/owner-actions";
import type { Announcement } from "@/lib/settings";

type Lang = "fr" | "en";
const tr = (lang: Lang, fr: string, en: string) => (lang === "fr" ? fr : en);

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "failed");
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

function ErrorText({ error, lang }: { error: string | null; lang: Lang }) {
  if (!error) return null;
  const msg =
    error === "forbidden" ? tr(lang, "Vous n'avez pas le droit de faire cela.", "You are not allowed to do this.")
    : error === "confirm" ? tr(lang, "Le nom d'utilisateur ne correspond pas.", "The handle does not match.")
    : tr(lang, "Une erreur s'est produite. Réessayez.", "Something went wrong. Try again.");
  return <span role="alert" className="text-[13px] font-medium text-orange">{msg}</span>;
}

export function Switch({ k, on, title, body, disabled, danger, lang }: { k: string; on: boolean; title: string; body: string; disabled?: boolean; danger?: boolean; lang: Lang }) {
  const { pending, error, run } = useRun();
  const [value, setValue] = useState(on);
  const flip = () => {
    const next = !value;
    setValue(next);
    run(() => setSwitch(k, next));
  };
  return (
    <div className={`flex items-start justify-between gap-4 px-4 py-4 ${danger && value ? "bg-orange-soft" : ""}`}>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted">{body}</p>
        <ErrorText error={error} lang={lang} />
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={title}
        disabled={disabled || pending}
        onClick={flip}
        className={`relative mt-1 h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-50 ${value ? (danger ? "bg-orange" : "bg-green") : "bg-line"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

export function AnnouncementForm({ initial, disabled, lang }: { initial: Announcement; disabled?: boolean; lang: Lang }) {
  const { pending, error, run } = useRun();
  const [fr, setFr] = useState(initial.fr);
  const [en, setEn] = useState(initial.en);
  const [tone, setTone] = useState<Announcement["tone"]>(initial.tone);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setAnnouncement({ fr, en, tone }), () => setSaved(true));
      }}
    >
      <p className="text-[13px] text-muted">{tr(lang, "Affiché en haut de toutes les pages. Laissez vide pour ne rien afficher.", "Shown at the top of every page. Leave empty to show nothing.")}</p>
      <label>
        <span className="label">{tr(lang, "Texte en français", "French text")}</span>
        <textarea className="input min-h-[72px] py-2" maxLength={280} disabled={disabled} value={fr} onChange={(e) => { setSaved(false); setFr(e.target.value); }} />
      </label>
      <label>
        <span className="label">{tr(lang, "Texte en anglais (facultatif)", "English text (optional)")}</span>
        <textarea className="input min-h-[72px] py-2" maxLength={280} disabled={disabled} value={en} onChange={(e) => { setSaved(false); setEn(e.target.value); }} />
      </label>
      <label>
        <span className="label">{tr(lang, "Style", "Style")}</span>
        <select className="select" disabled={disabled} value={tone} onChange={(e) => { setSaved(false); setTone(e.target.value as Announcement["tone"]); }}>
          <option value="info">{tr(lang, "Information (vert)", "Information (green)")}</option>
          <option value="warning">{tr(lang, "Alerte (orange)", "Warning (orange)")}</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary btn-sm" disabled={disabled || pending}>{tr(lang, "Enregistrer", "Save")}</button>
        {saved && <span className="text-[13px] font-semibold text-green-deep">{tr(lang, "Enregistré", "Saved")}</span>}
        <ErrorText error={error} lang={lang} />
      </div>
    </form>
  );
}

export function MemberSearch({ initial, filter, lang, owner }: { initial: string; filter: string; lang: Lang; owner: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/controle?onglet=membres&filtre=${filter}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`);
      }}
    >
      <input
        className="input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={owner ? tr(lang, "Nom, nom d'utilisateur ou e-mail", "Name, handle or e-mail") : tr(lang, "Nom ou nom d'utilisateur", "Name or handle")}
        aria-label={tr(lang, "Chercher un membre", "Search members")}
      />
    </form>
  );
}

export function MemberActions({ id, handle, role, verified, suspended, owner, lang }: { id: string; handle: string; role: "admin" | "moderator" | "member"; verified: boolean; suspended: boolean; owner: boolean; lang: Lang }) {
  const { pending, error, run } = useRun();
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const [confirm, setConfirm] = useState("");
  // Admins cannot act on other admins; the database refuses it too.
  const canSanction = owner || role !== "admin";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {owner && (
          <label className="flex items-center gap-2 text-[13px] text-muted">
            {tr(lang, "Rôle", "Role")}
            <select className="select h-9 w-auto py-0 text-[14px]" disabled={pending} value={role} onChange={(e) => run(() => setRole(id, e.target.value as typeof role))}>
              <option value="member">{tr(lang, "Membre", "Member")}</option>
              <option value="moderator">{tr(lang, "Modérateur", "Moderator")}</option>
              <option value="admin">{tr(lang, "Administrateur", "Admin")}</option>
            </select>
          </label>
        )}
        {canSanction && (
          <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => run(() => setBadge(id, !verified))}>
            {verified ? tr(lang, "Retirer le badge", "Remove badge") : tr(lang, "Donner le badge", "Grant badge")}
          </button>
        )}
      </div>
      {canSanction && (
        <div className="flex flex-wrap items-center gap-2">
          {suspended ? (
            <button type="button" className="btn-dark btn-sm" disabled={pending} onClick={() => run(() => sanction(id, null))}>{tr(lang, "Lever la sanction", "Lift sanction")}</button>
          ) : (
            <>
              <select className="select h-9 w-auto py-0 text-[14px]" value={days} onChange={(e) => setDays(e.target.value)} aria-label={tr(lang, "Durée", "Duration")}>
                <option value="1">{tr(lang, "1 jour", "1 day")}</option>
                <option value="7">{tr(lang, "7 jours", "7 days")}</option>
                <option value="30">{tr(lang, "30 jours", "30 days")}</option>
                <option value="ban">{tr(lang, "Définitivement", "Permanently")}</option>
              </select>
              <input className="input h-9 min-w-[160px] flex-1 text-[14px]" maxLength={300} placeholder={tr(lang, "Motif (facultatif)", "Reason (optional)")} value={reason} onChange={(e) => setReason(e.target.value)} />
              <button type="button" className="btn-ghost btn-sm text-orange" disabled={pending} onClick={() => run(() => sanction(id, days === "ban" ? "ban" : Number(days), reason), () => setReason(""))}>
                {days === "ban" ? tr(lang, "Bannir", "Ban") : tr(lang, "Suspendre", "Suspend")}
              </button>
            </>
          )}
        </div>
      )}
      {owner && (
        removing ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-orange/40 bg-orange-soft p-3">
            <p className="text-[13px]">
              {tr(lang,
                `Supprimer définitivement le compte POLITIQUE de @${handle}, ses publications et ses messages ? Tapez son nom d'utilisateur pour confirmer.`,
                `Permanently delete @${handle}'s POLITIQUE account, posts and messages? Type the handle to confirm.`)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input h-9 w-auto text-[14px]" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={handle} aria-label={tr(lang, "Nom d'utilisateur", "Handle")} />
              <button type="button" className="btn-dark btn-sm" disabled={pending || confirm.replace(/^@/, "").toLowerCase() !== handle} onClick={() => run(() => removeMember(id, confirm))}>{tr(lang, "Supprimer", "Delete")}</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => { setRemoving(false); setConfirm(""); }}>{tr(lang, "Annuler", "Cancel")}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="self-start text-[13px] font-semibold text-muted hover:text-orange" onClick={() => setRemoving(true)}>{tr(lang, "Supprimer ce compte…", "Delete this account…")}</button>
        )
      )}
      <ErrorText error={error} lang={lang} />
    </div>
  );
}
