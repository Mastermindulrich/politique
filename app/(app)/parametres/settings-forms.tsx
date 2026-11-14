"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import { VotingPlaceFields, votingPlaceComplete, type VotingPlace } from "@/app/components/voting-place";
import { deleteAccount, requestVerification, signOut, toggleBlock, toggleMute, updatePrefs, updatePrivateProfile, updateProfile, updateProfileImage } from "@/lib/actions";
import { communes } from "@/lib/ci-geo";
import { t as dict } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { AccountType, Official, Profile } from "@/lib/types";

type Lang = "fr" | "en";

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "saved" | string>("idle");
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      setState("idle");
      const r = await fn();
      if (!r.ok) return setState(r.error);
      setState("saved");
      router.refresh();
    });
  return { pending, state, run, setState };
}

function SaveRow({ pending, state, label, lang, errors = {} }: { pending: boolean; state: string; label: string; lang: Lang; errors?: Record<string, string> }) {
  const t = dict(lang);
  return (
    <div className="flex items-center gap-3">
      <button type="submit" className="btn-primary btn-sm" disabled={pending}>{label}</button>
      <span role="status" className="text-[14px] font-medium">
        {state === "saved" && <span className="text-green-deep">{t.settings.saved}</span>}
        {state !== "saved" && state !== "idle" && <span className="text-orange">{errors[state] ?? t.common.error}</span>}
      </span>
    </div>
  );
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function uploadImage(userId: string, file: File, kind: "avatar" | "banner") {
  if (!IMAGE_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) return null;
  const supabase = supabaseBrowser();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("politique-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return null;
  return supabase.storage.from("politique-media").getPublicUrl(path).data.publicUrl as string;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export function ProfileForm({ viewer, lang }: { viewer: Profile; lang: Lang }) {
  const t = dict(lang);
  const { pending, state, run, setState } = useSave();
  const [displayName, setDisplayName] = useState(viewer.display_name);
  const [handle, setHandle] = useState(viewer.handle);
  const [bio, setBio] = useState(viewer.bio ?? "");
  const [website, setWebsite] = useState(viewer.website ?? "");
  const [avatar, setAvatar] = useState(viewer.avatar_url);
  const [banner, setBanner] = useState(viewer.banner_url);
  const [commune, setCommune] = useState<number | null>(viewer.shown_commune_id);
  const [uploading, setUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File | undefined, kind: "avatar" | "banner") => {
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(viewer.id, file, kind);
    setUploading(false);
    if (!url) return setState("upload");
    if (kind === "avatar") setAvatar(url);
    else setBanner(url);
    run(() => updateProfileImage(kind, url));
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const site = website.trim();
        run(() => updateProfile({ display_name: displayName.trim(), handle, bio: bio.trim() || null, website: site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : null, avatar_url: avatar, banner_url: banner, shown_commune_id: commune }));
      }}
    >
      <div>
        <button type="button" onClick={() => bannerRef.current?.click()} aria-label={t.settings.banner} className="relative block h-28 w-full overflow-hidden rounded-2xl border border-line bg-paper sm:h-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {banner && <img src={banner} alt="" className="h-full w-full object-cover" />}
          <span className="absolute bottom-2 right-2 rounded-full bg-ink/80 px-3 py-1 text-[12px] font-semibold text-bg">{t.settings.banner}</span>
        </button>
        <div className="-mt-9 ml-4 flex items-end gap-3">
          <button type="button" onClick={() => avatarRef.current?.click()} aria-label={t.settings.avatar} className="relative rounded-full ring-4 ring-bg">
            <Avatar src={avatar} name={displayName || viewer.handle} size={72} />
          </button>
          <button type="button" onClick={() => avatarRef.current?.click()} className="mb-1 text-[13px] font-semibold text-green-deep hover:underline">{uploading ? t.common.loading : t.settings.avatar}</button>
        </div>
        <input ref={avatarRef} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => pickFile(e.target.files?.[0], "avatar")} />
        <input ref={bannerRef} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => pickFile(e.target.files?.[0], "banner")} />
      </div>
      <label>
        <span className="label">{t.settings.displayName}</span>
        <input className="input" required maxLength={50} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <label>
        <span className="label">{t.settings.handle}</span>
        <span className="relative block">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-muted">@</span>
          <input className="input pl-8" required minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" autoCapitalize="none" spellCheck={false} value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
        </span>
      </label>
      <label>
        <span className="label">{t.settings.bio} <span className="font-normal">({bio.length}/240)</span></span>
        <textarea className="textarea" maxLength={240} value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      <label>
        <span className="label">{t.settings.website}</span>
        <input className="input" maxLength={200} inputMode="url" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      <label>
        <span className="label">{t.settings.shownCommune}</span>
        <select className="select" value={commune ?? ""} onChange={(e) => setCommune(e.target.value ? Number(e.target.value) : null)}>
          <option value="">{t.settings.none}</option>
          {[...communes].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="mt-1.5 block text-[13px] leading-relaxed text-muted">
          {lang === "fr"
            ? "Cette commune s'affiche sur votre profil. Elle n'a aucun lien avec votre lieu de vote, qui reste privé."
            : "This commune shows on your profile. It is unrelated to your voting place, which stays private."}
        </span>
      </label>
      <SaveRow pending={pending || uploading} state={state} label={t.settings.save} lang={lang} errors={{ handle_taken: t.auth.handleTaken, reserved_name: lang === "fr" ? "Ce nom est réservé au fondateur de POLITIQUE." : "This name is reserved for the founder of POLITIQUE.", upload: lang === "fr" ? "Image refusée (JPG, PNG ou WebP, 5 Mo max)." : "Image rejected (JPG, PNG or WebP, 5 MB max)." }} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Private voting place
// ---------------------------------------------------------------------------
export function VoteForm({ initial, lang }: { initial: VotingPlace; lang: Lang }) {
  const t = dict(lang);
  const { pending, state, run } = useSave();
  const [place, setPlace] = useState<VotingPlace>(initial);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!votingPlaceComplete(place)) return;
        run(() => updatePrivateProfile({ ...place, vote_locality: place.vote_locality.trim() || null }));
      }}
    >
      <VotingPlaceFields value={place} onChange={setPlace} lang={lang} showNotice={false} />
      <SaveRow pending={pending} state={state} label={t.settings.save} lang={lang} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------
export function PrefsForm({ lang, theme, lowData }: { lang: Lang; theme: Profile["theme"]; lowData: boolean }) {
  const t = dict(lang);
  const { pending, state, run } = useSave();
  const [l, setL] = useState<Lang>(lang);
  const [th, setTh] = useState(theme);
  const [low, setLow] = useState(lowData);
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run(() => updatePrefs({ lang: l, theme: th, low_data: low })); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">{t.settings.language}</span>
          <select className="select" value={l} onChange={(e) => setL(e.target.value as Lang)}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          <span className="label">{t.settings.theme}</span>
          <select className="select" value={th} onChange={(e) => setTh(e.target.value as Profile["theme"])}>
            <option value="system">{t.settings.themes.system}</option>
            <option value="light">{t.settings.themes.light}</option>
            <option value="dark">{t.settings.themes.dark}</option>
          </select>
        </label>
      </div>
      <label className="flex items-start gap-3 text-[14px]">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#0A7A4A]" checked={low} onChange={(e) => setLow(e.target.checked)} />
        <span>
          <span className="font-semibold">{t.settings.lowData}</span>
          <span className="block text-muted">{t.settings.lowDataHelp}</span>
        </span>
      </label>
      <SaveRow pending={pending} state={state} label={t.settings.save} lang={lang} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Verification request
// ---------------------------------------------------------------------------
const DOC_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const BADGES: Exclude<AccountType, "citoyen">[] = ["elu", "institution", "media"];

export function VerificationForm({ lang, userId, defaultType, defaultName, officials }: { lang: Lang; userId: string; defaultType: AccountType; defaultName: string; officials: Pick<Official, "id" | "full_name" | "mandate" | "title">[] }) {
  const t = dict(lang);
  const { pending, state, run, setState } = useSave();
  const [type, setType] = useState<Exclude<AccountType, "citoyen">>(defaultType === "citoyen" ? "elu" : defaultType);
  const [fullName, setFullName] = useState(defaultName);
  const [organisation, setOrganisation] = useState("");
  const [officialId, setOfficialId] = useState("");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const labels: Record<string, string> = lang === "fr" ? { elu: "Élu", institution: "Institution", media: "Média" } : { elu: "Elected official", institution: "Institution", media: "Media" };

  const upload = async (file: File, kind: string) => {
    if (!DOC_TYPES.includes(file.type) || file.size > 10 * 1024 * 1024) return null;
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabaseBrowser().storage.from("politique-documents").upload(path, file, { contentType: file.type });
    return error ? null : path;
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!idDoc || !proof) return setState("docs");
        run(async () => {
          const [documentPath, proofPath] = await Promise.all([upload(idDoc, "piece"), upload(proof, "justificatif")]);
          if (!documentPath || !proofPath) return { ok: false as const, error: "docs" };
          return requestVerification({ requested_type: type, full_name: fullName.trim(), official_id: type === "elu" && officialId ? officialId : null, organisation: organisation.trim() || null, document_path: documentPath, proof_path: proofPath });
        });
      }}
    >
      <fieldset>
        <legend className="label">{t.settings.requestType}</legend>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map((k) => (
            <label key={k} className={`flex h-11 cursor-pointer items-center justify-center rounded-2xl border text-[14px] font-semibold ${type === k ? "border-green bg-green-soft text-green-deep" : "border-line bg-card text-ink hover:bg-paper"}`}>
              <input type="radio" name="badge" className="sr-only" checked={type === k} onChange={() => setType(k)} />
              {labels[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <span className="label">{t.settings.fullName}</span>
        <input className="input" required minLength={2} maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </label>
      {type === "elu" ? (
        <label>
          <span className="label">{t.settings.official}</span>
          <select className="select" value={officialId} onChange={(e) => setOfficialId(e.target.value)}>
            <option value="">{lang === "fr" ? "Mon mandat n'est pas dans la liste" : "My mandate is not listed"}</option>
            {officials.map((o) => <option key={o.id} value={o.id}>{o.full_name} · {o.title || t.officials.mandates[o.mandate]}</option>)}
          </select>
        </label>
      ) : (
        <label>
          <span className="label">{t.settings.organisation}</span>
          <input className="input" required maxLength={120} value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">{t.settings.document}</span>
          <input type="file" required accept={DOC_TYPES.join(",")} className="block w-full text-[13px] text-muted file:mr-3 file:h-10 file:rounded-full file:border-0 file:bg-paper file:px-4 file:text-[13px] file:font-semibold file:text-ink" onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          <span className="label">{t.settings.proof}</span>
          <input type="file" required accept={DOC_TYPES.join(",")} className="block w-full text-[13px] text-muted file:mr-3 file:h-10 file:rounded-full file:border-0 file:bg-paper file:px-4 file:text-[13px] file:font-semibold file:text-ink" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        {lang === "fr"
          ? "JPG, PNG ou PDF, 10 Mo max. Vos documents ne sont visibles que par l'équipe de vérification."
          : "JPG, PNG or PDF, 10 MB max. Your documents are only visible to the verification team."}
      </p>
      <SaveRow pending={pending} state={state} label={t.settings.request} lang={lang} errors={{ docs: lang === "fr" ? "Ajoutez les deux documents (JPG, PNG ou PDF, 10 Mo max)." : "Add both documents (JPG, PNG or PDF, 10 MB max)." }} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Blocked and muted accounts
// ---------------------------------------------------------------------------
type Person = { id: string; handle: string; display_name: string; avatar_url: string | null };

function PersonRow({ p, label, onRemove }: { p: Person; label: string; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar src={p.avatar_url} name={p.display_name} size={36} />
      <Link href={`/u/${p.handle}`} className="min-w-0 flex-1 truncate text-[14px]">
        <b>{p.display_name}</b> <span className="text-muted">@{p.handle}</span>
      </Link>
      <button type="button" className="btn-ghost btn-sm" onClick={onRemove}>{label}</button>
    </li>
  );
}

export function PeopleList({ lang, blocked, muted }: { lang: Lang; blocked: Person[]; muted: Person[] }) {
  const t = dict(lang);
  const router = useRouter();
  const [, start] = useTransition();
  const [gone, setGone] = useState<string[]>([]);
  const remove = (key: string, fn: () => Promise<unknown>) => {
    setGone((g) => [...g, key]);
    start(async () => { await fn(); router.refresh(); });
  };
  const b = blocked.filter((p) => !gone.includes(`b${p.id}`));
  const m = muted.filter((p) => !gone.includes(`m${p.id}`));
  return (
    <div className="flex flex-col gap-4">
      {b.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-muted">{t.settings.blocked}</h3>
          <ul>{b.map((p) => <PersonRow key={p.id} p={p} label={lang === "fr" ? "Débloquer" : "Unblock"} onRemove={() => remove(`b${p.id}`, () => toggleBlock(p.id, false))} />)}</ul>
        </div>
      )}
      {m.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-muted">{t.settings.muted}</h3>
          <ul>{m.map((p) => <PersonRow key={p.id} p={p} label={lang === "fr" ? "Réafficher" : "Unmute"} onRemove={() => remove(`m${p.id}`, () => toggleMute(p.id, false))} />)}</ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
export function AccountSection({ lang, email, handle, canDelete }: { lang: Lang; email: string; handle: string; canDelete: boolean }) {
  const t = dict(lang);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px]"><span className="text-muted">{t.settings.email} : </span><b className="break-all">{email}</b></p>
      <form action={signOut} data-signout><button type="submit" className="btn-ghost btn-sm">{t.settings.logout}</button></form>
      {canDelete && (
        <div className="rounded-2xl border border-line p-4">
          <h3 className="text-[15px] font-bold">{t.settings.delete}</h3>
          <p className="mt-1 text-[14px] text-muted">{t.settings.deleteHelp}</p>
          {!open ? (
            <button type="button" className="mt-3 text-[14px] font-semibold text-orange hover:underline" onClick={() => setOpen(true)}>{t.settings.delete}</button>
          ) : (
            <form
              className="mt-3 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  setError(false);
                  const r = await deleteAccount(confirm);
                  if (r && !r.ok) setError(true);
                });
              }}
            >
              <label>
                <span className="label">{lang === "fr" ? `Tapez @${handle} pour confirmer` : `Type @${handle} to confirm`}</span>
                <input className="input" value={confirm} autoCapitalize="none" spellCheck={false} onChange={(e) => setConfirm(e.target.value)} />
              </label>
              {error && <p role="alert" className="text-[13px] font-medium text-orange">{t.common.error}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>{t.common.cancel}</button>
                <button type="submit" className="btn-sm btn bg-orange text-white" disabled={pending || confirm.replace(/^@/, "").toLowerCase() !== handle.toLowerCase()}>{t.settings.delete}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
