"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addPromiseUpdate, answerInterpellation, closeInterpellation, createInterpellation, createPermanence, createPromise,
  createProposition, setPermanenceStatus, setPropositionStatus, toggleInterpellationVote, togglePropositionVote, voteBarometer,
} from "@/lib/actions";
import { communes } from "@/lib/ci-geo";
import { t as dict } from "@/lib/i18n";
import { I } from "./ui/icons";

type Lang = "fr" | "en";

/** A button that reveals a form in place. Keeps the civic pages calm until someone wants to act. */
function Reveal({ label, children, signedIn, icon }: { label: string; children: (close: () => void) => React.ReactNode; signedIn: boolean; icon?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!open) {
    return (
      <button type="button" className="btn-primary btn-sm" onClick={() => (signedIn ? setOpen(true) : router.push("/connexion"))}>
        {icon}
        {label}
      </button>
    );
  }
  return <div className="w-full rounded-2xl border border-line bg-paper p-4">{children(() => setOpen(false))}</div>;
}

function useSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean }>, after?: () => void) =>
    start(async () => {
      setError(false);
      const r = await fn();
      if (!r.ok) return setError(true);
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

function FormActions({ pending, error, submit, onCancel, lang }: { pending: boolean; error: boolean; submit: string; onCancel: () => void; lang: Lang }) {
  const t = dict(lang);
  return (
    <>
      {error && <p role="alert" className="text-[13px] font-medium text-orange">{t.common.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>{t.common.cancel}</button>
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>{submit}</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Interpellations
// ---------------------------------------------------------------------------
export function InterpellationForm({ officialId, lang, signedIn }: { officialId: string; lang: Lang; signedIn: boolean }) {
  const t = dict(lang);
  const { pending, error, run } = useSubmit();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <Reveal label={t.officials.askQuestion} signedIn={signedIn} icon={<I.question className="h-4 w-4" />}>
      {(close) => (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run(() => createInterpellation({ officialId, title, body: body || undefined }), close); }}>
          <h3 className="font-display text-[17px] font-bold">{t.interpellation.new}</h3>
          <label><span className="label">{t.interpellation.titleField}</span><input className="input" required minLength={5} maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label><span className="label">{t.interpellation.bodyField}</span><textarea className="textarea" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
          <FormActions pending={pending} error={error} submit={t.interpellation.submit} onCancel={close} lang={lang} />
        </form>
      )}
    </Reveal>
  );
}

export function InterpellationVote({ id, initial, count, lang, signedIn, disabled }: { id: string; initial: boolean; count: number; lang: Lang; signedIn: boolean; disabled?: boolean }) {
  const t = dict(lang);
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [n, setN] = useState(count);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      title={on ? t.interpellation.upvoted : t.interpellation.upvote}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!signedIn) return router.push("/connexion");
        const next = !on;
        setOn(next);
        setN((x) => x + (next ? 1 : -1));
        start(async () => {
          const r = await toggleInterpellationVote(id, next);
          if (!r.ok) { setOn(!next); setN((x) => x + (next ? -1 : 1)); }
        });
      }}
      className={`flex h-14 w-14 flex-none flex-col items-center justify-center rounded-2xl border text-[13px] font-bold transition-colors disabled:opacity-60 ${on ? "border-green bg-green text-white" : "border-line bg-card text-ink hover:border-green"}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 6-6 6 6" /></svg>
      {n}
    </button>
  );
}

export function AnswerForm({ id, lang }: { id: string; lang: Lang }) {
  const t = dict(lang);
  const { pending, error, run } = useSubmit();
  const [text, setText] = useState("");
  return (
    <form className="flex flex-col gap-3 rounded-2xl border border-green/30 bg-green-soft p-4" onSubmit={(e) => { e.preventDefault(); run(() => answerInterpellation(id, text)); }}>
      <label><span className="label">{t.interpellation.answer}</span><textarea className="textarea" required maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.interpellation.answerPlaceholder} /></label>
      {error && <p role="alert" className="text-[13px] font-medium text-orange">{t.common.error}</p>}
      <div className="flex justify-between gap-2">
        <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => run(() => closeInterpellation(id))}>{t.interpellation.close}</button>
        <button type="submit" className="btn-primary btn-sm" disabled={pending || !text.trim()}>{t.interpellation.answer}</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Promises
// ---------------------------------------------------------------------------
export function PromiseForm({ officialId, lang, signedIn }: { officialId: string; lang: Lang; signedIn: boolean }) {
  const t = dict(lang);
  const { pending, error, run } = useSubmit();
  const [f, setF] = useState({ title: "", description: "", source_url: "", made_at: "", due_at: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Reveal label={t.officials.newPromise} signedIn={signedIn} icon={<I.plus className="h-4 w-4" />}>
      {(close) => (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run(() => createPromise({ officialId, title: f.title, description: f.description || null, source_url: f.source_url || null, made_at: f.made_at || null, due_at: f.due_at || null }), close); }}>
          <h3 className="font-display text-[17px] font-bold">{t.promises.new}</h3>
          <label><span className="label">{t.promises.titleField}</span><input className="input" required minLength={5} maxLength={200} value={f.title} onChange={set("title")} /></label>
          <label><span className="label">{t.promises.description}</span><textarea className="textarea" maxLength={2000} value={f.description} onChange={set("description")} /></label>
          <label><span className="label">{t.promises.source}</span><input className="input" type="url" required value={f.source_url} onChange={set("source_url")} placeholder="https://" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="label">{t.promises.madeAt}</span><input className="input" type="date" value={f.made_at} onChange={set("made_at")} /></label>
            <label><span className="label">{t.promises.dueAt}</span><input className="input" type="date" value={f.due_at} onChange={set("due_at")} /></label>
          </div>
          <FormActions pending={pending} error={error} submit={t.promises.submit} onCancel={close} lang={lang} />
        </form>
      )}
    </Reveal>
  );
}

const PROMISE_STATUSES = ["annoncee", "en_cours", "tenue", "partiellement_tenue", "non_tenue"] as const;

export function PromiseUpdateForm({ promiseId, lang, signedIn, canSetStatus }: { promiseId: string; lang: Lang; signedIn: boolean; canSetStatus: boolean }) {
  const t = dict(lang);
  const router = useRouter();
  const { pending, error, run } = useSubmit();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<string>("");
  if (!open) {
    return <button type="button" className="text-[13px] font-semibold text-green-deep" onClick={() => (signedIn ? setOpen(true) : router.push("/connexion"))}>+ {t.promises.update}</button>;
  }
  return (
    <form className="mt-2 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addPromiseUpdate({ promiseId, text, source_url: source || null, new_status: status || null }), () => { setOpen(false); setText(""); setSource(""); }); }}>
      <textarea className="textarea min-h-[64px]" required maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.promises.updateText} aria-label={t.promises.updateText} />
      <input className="input h-10" type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder={t.promises.source} aria-label={t.promises.source} />
      {canSetStatus && (
        <select className="select h-10" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t.promises.setStatus}>
          <option value="">{t.promises.setStatus}</option>
          {PROMISE_STATUSES.map((s) => <option key={s} value={s}>{t.promises.status[s]}</option>)}
        </select>
      )}
      <FormActions pending={pending} error={error} submit={t.common.save} onCancel={() => setOpen(false)} lang={lang} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Permanences
// ---------------------------------------------------------------------------
export function PermanenceForm({ officialId, lang }: { officialId: string; lang: Lang }) {
  const t = dict(lang);
  const { pending, error, run } = useSubmit();
  const [f, setF] = useState({ title: "", description: "", starts: "", ends: "" });
  return (
    <Reveal label={t.officials.newPermanence} signedIn icon={<I.calendar className="h-4 w-4" />}>
      {(close) => (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createPermanence({ officialId, title: f.title, description: f.description || undefined, starts_at: new Date(f.starts).toISOString(), ends_at: new Date(f.ends).toISOString() }), close);
          }}
        >
          <h3 className="font-display text-[17px] font-bold">{t.permanence.new}</h3>
          <label><span className="label">{t.permanence.titleField}</span><input className="input" required minLength={3} maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><span className="label">{t.permanence.starts}</span><input className="input" type="datetime-local" required value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} /></label>
            <label><span className="label">{t.permanence.ends}</span><input className="input" type="datetime-local" required min={f.starts} value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></label>
          </div>
          <FormActions pending={pending} error={error} submit={t.permanence.submit} onCancel={close} lang={lang} />
        </form>
      )}
    </Reveal>
  );
}

export function PermanenceControls({ id, status, lang }: { id: string; status: "planifiee" | "en_cours" | "terminee" | "annulee"; lang: Lang }) {
  const t = dict(lang);
  const { pending, run } = useSubmit();
  if (status === "terminee" || status === "annulee") return null;
  return (
    <div className="mt-2 flex gap-2">
      {status === "planifiee" && <button type="button" disabled={pending} className="btn-primary btn-sm" onClick={() => run(() => setPermanenceStatus(id, "en_cours"))}>{t.permanence.start}</button>}
      {status === "en_cours" && <button type="button" disabled={pending} className="btn-dark btn-sm" onClick={() => run(() => setPermanenceStatus(id, "terminee"))}>{t.permanence.end}</button>}
      {status === "planifiee" && <button type="button" disabled={pending} className="btn-ghost btn-sm" onClick={() => run(() => setPermanenceStatus(id, "annulee"))}>{t.permanence.cancel}</button>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barometer
// ---------------------------------------------------------------------------
export function BarometerVote({ id, options, lang }: { id: string; options: string[]; lang: Lang }) {
  const t = dict(lang);
  const { pending, error, run } = useSubmit();
  const [choice, setChoice] = useState<number | null>(null);
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (choice !== null) run(() => voteBarometer(id, choice)); }}>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t.barometer.vote}</legend>
        {options.map((o, i) => (
          <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-[15px] font-medium ${choice === i ? "border-green bg-green-soft" : "border-line bg-card hover:border-green"}`}>
            <input type="radio" name="baro" className="h-4 w-4 accent-green" checked={choice === i} onChange={() => setChoice(i)} />
            {o}
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="text-[13px] font-medium text-orange">{t.common.error}</p>}
      <button type="submit" className="btn-primary mt-1" disabled={pending || choice === null}>{t.barometer.vote}</button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Idea box
// ---------------------------------------------------------------------------
export function PropositionForm({ communeId, lang, signedIn }: { communeId: number | null; lang: Lang; signedIn: boolean }) {
  const t = dict(lang);
  const { pending, error, run } = useSubmit();
  const [commune, setCommune] = useState<number | "">(communeId ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <Reveal label={t.ideas.new} signedIn={signedIn} icon={<I.bulb className="h-4 w-4" />}>
      {(close) => (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (commune !== "") run(() => createProposition({ communeId: Number(commune), title, body }), close); }}>
          <h3 className="font-display text-[17px] font-bold">{t.ideas.new}</h3>
          <label>
            <span className="label">{t.ideas.commune}</span>
            <select className="select" required value={commune} onChange={(e) => setCommune(e.target.value ? Number(e.target.value) : "")}>
              <option value="" disabled>—</option>
              {[...communes].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="mt-1 block text-[12px] text-muted">{lang === "fr" ? "L'idée et sa commune sont publiques. Elles ne disent pas où vous votez : vous pouvez proposer pour n'importe quelle commune." : "The idea and its commune are public. They don't say where you vote: you can propose for any commune."}</span>
          </label>
          <label><span className="label">{t.ideas.titleField}</span><input className="input" required minLength={5} maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label><span className="label">{t.ideas.bodyField}</span><textarea className="textarea" required maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
          <FormActions pending={pending} error={error} submit={t.ideas.submit} onCancel={close} lang={lang} />
        </form>
      )}
    </Reveal>
  );
}

export function PropositionVote({ id, initial, count, lang, signedIn }: { id: string; initial: boolean; count: number; lang: Lang; signedIn: boolean }) {
  const t = dict(lang);
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [n, setN] = useState(count);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? t.ideas.supported : t.ideas.support}
      onClick={() => {
        if (!signedIn) return router.push("/connexion");
        const next = !on;
        setOn(next);
        setN((x) => x + (next ? 1 : -1));
        start(async () => {
          const r = await togglePropositionVote(id, next);
          if (!r.ok) { setOn(!next); setN((x) => x + (next ? -1 : 1)); }
        });
      }}
      className={`flex h-14 w-14 flex-none flex-col items-center justify-center rounded-2xl border text-[13px] font-bold transition-colors ${on ? "border-green bg-green text-white" : "border-line bg-card text-ink hover:border-green"}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 6-6 6 6" /></svg>
      {n}
    </button>
  );
}

const PROP_STATUSES = ["nouvelle", "etudiee", "adoptee", "refusee"] as const;
export function PropositionStatus({ id, status, lang }: { id: string; status: (typeof PROP_STATUSES)[number]; lang: Lang }) {
  const t = dict(lang);
  const { pending, run } = useSubmit();
  return (
    <select className="rounded-lg border border-line bg-card px-2 py-1 text-[13px]" aria-label="Statut" disabled={pending} value={status} onChange={(e) => run(() => setPropositionStatus(id, e.target.value as (typeof PROP_STATUSES)[number]))}>
      {PROP_STATUSES.map((s) => <option key={s} value={s}>{t.ideas.status[s]}</option>)}
    </select>
  );
}
