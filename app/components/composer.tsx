"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState, useTransition } from "react";
import { createPost } from "@/lib/actions";
import { communes } from "@/lib/ci-geo";
import { t as dict } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { FeedPost, Media } from "@/lib/types";
import { I } from "./ui/icons";

const MAX = 500;
const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 50 * 1024 * 1024;

type Props = {
  lang: "fr" | "en";
  parentId?: string;
  replyTo?: string;
  quotedId?: string;
  quotedPreview?: Pick<FeedPost, "text" | "author">;
  autoFocus?: boolean;
  compact?: boolean;
  defaultCommuneId?: number | null;
  onPosted?: (id: string) => void;
};

export function Composer({ lang, parentId, replyTo, quotedId, quotedPreview, autoFocus, compact, defaultCommuneId = null, onPosted }: Props) {
  const t = dict(lang);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [poll, setPoll] = useState<{ options: string[]; days: number } | null>(null);
  const [communeId, setCommuneId] = useState<number | null>(defaultCommuneId);
  const [showPlace, setShowPlace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const left = MAX - text.length;
  const pollOk = !poll || poll.options.filter((o) => o.trim()).length >= 2;
  const canPost = !pending && !uploading && left >= 0 && pollOk && (text.trim().length > 0 || media.length > 0);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = supabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("auth");
      const next: Media[] = [];
      for (const file of Array.from(files).slice(0, 4 - media.length)) {
        const isVideo = file.type.startsWith("video/");
        if (file.size > (isVideo ? VIDEO_MAX : IMAGE_MAX)) {
          setError(lang === "fr" ? `Fichier trop lourd (max ${isVideo ? "50" : "8"} Mo).` : `File too large (max ${isVideo ? "50" : "8"} MB).`);
          continue;
        }
        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("politique-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
        if (upErr) {
          setError(upErr.message);
          continue;
        }
        const { data } = supabase.storage.from("politique-media").getPublicUrl(path);
        next.push({ type: isVideo ? "video" : "image", url: data.publicUrl, alt: "" });
      }
      setMedia((m) => [...m, ...next].slice(0, 4));
      if (next.length) setPoll(null);
    } catch {
      setError(t.common.error);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit() {
    if (!canPost) return;
    setError(null);
    start(async () => {
      const r = await createPost({
        text,
        parentId: parentId ?? null,
        quotedId: quotedId ?? null,
        media,
        communeId,
        poll: poll ? { options: poll.options.map((o) => o.trim()).filter(Boolean), days: poll.days } : null,
      });
      if (!r.ok) {
        setError(t.common.error);
        return;
      }
      setText("");
      setMedia([]);
      setPoll(null);
      if (areaRef.current) areaRef.current.style.height = "auto";
      onPosted?.(r.data!.id);
    });
  }

  return (
    <div>
      {replyTo && (
        <div className="mb-1 text-[13px] text-muted">
          {t.feed.replyingTo} <span className="text-green-deep">@{replyTo}</span>
        </div>
      )}
      <label className="sr-only" htmlFor={`composer-${parentId ?? quotedId ?? "new"}`}>
        {parentId ? t.composer.replyPlaceholder : t.composer.placeholder}
      </label>
      <textarea
        id={`composer-${parentId ?? quotedId ?? "new"}`}
        ref={areaRef}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 320) + "px";
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        rows={compact ? 2 : 3}
        placeholder={parentId ? t.composer.replyPlaceholder : t.composer.placeholder}
        className={`w-full resize-none bg-transparent ${compact ? "text-[16px]" : "text-[19px]"} leading-snug text-ink placeholder:text-muted focus:outline-none`}
      />

      {quotedPreview && (
        <div className="mb-2 rounded-2xl border border-line p-3 text-[14px]">
          <span className="font-bold">{quotedPreview.author.display_name}</span> <span className="text-muted">@{quotedPreview.author.handle}</span>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{quotedPreview.text}</p>
        </div>
      )}

      {media.length > 0 && (
        <ul className={`mb-2 grid gap-2 ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {media.map((m, i) => (
            <li key={m.url} className="relative overflow-hidden rounded-2xl border border-line bg-paper">
              {m.type === "video" ? <video src={m.url} className="max-h-64 w-full bg-black" controls preload="metadata" /> : <img src={m.url} alt="" className="max-h-64 w-full object-cover" />}
              <button type="button" aria-label={t.composer.remove} onClick={() => setMedia((x) => x.filter((_, j) => j !== i))} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white">
                <I.x className="h-4 w-4" />
              </button>
              {m.type === "image" && (
                <input
                  type="text"
                  value={m.alt ?? ""}
                  maxLength={400}
                  onChange={(e) => setMedia((x) => x.map((y, j) => (j === i ? { ...y, alt: e.target.value } : y)))}
                  placeholder={t.composer.alt}
                  aria-label={t.composer.alt}
                  className="w-full border-t border-line bg-card px-3 py-2 text-[13px] focus:outline-none"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {poll && (
        <div className="mb-2 rounded-2xl border border-line p-3">
          <div className="flex flex-col gap-2">
            {poll.options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input h-10"
                  value={o}
                  maxLength={40}
                  placeholder={`${t.composer.option} ${i + 1}`}
                  aria-label={`${t.composer.option} ${i + 1}`}
                  onChange={(e) => setPoll((p) => p && { ...p, options: p.options.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                {poll.options.length > 2 && (
                  <button type="button" aria-label={t.composer.remove} className="rounded-full p-2 text-muted hover:bg-paper" onClick={() => setPoll((p) => p && { ...p, options: p.options.filter((_, j) => j !== i) })}>
                    <I.x className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            {poll.options.length < 4 ? (
              <button type="button" className="text-[14px] font-semibold text-green-deep" onClick={() => setPoll((p) => p && { ...p, options: [...p.options, ""] })}>
                + {t.composer.option}
              </button>
            ) : <span />}
            <label className="flex items-center gap-2 text-[13px] text-muted">
              {t.composer.pollDays}
              <select className="rounded-lg border border-line bg-card px-2 py-1 text-ink" value={poll.days} onChange={(e) => setPoll((p) => p && { ...p, days: Number(e.target.value) })}>
                {[1, 2, 3, 5, 7].map((d) => (
                  <option key={d} value={d}>{d} {d > 1 ? t.composer.days : t.composer.day}</option>
                ))}
              </select>
            </label>
            <button type="button" className="text-[13px] font-semibold text-orange" onClick={() => setPoll(null)}>{t.composer.remove}</button>
          </div>
        </div>
      )}

      {showPlace && (
        <label className="mb-2 block">
          <span className="sr-only">{t.composer.location}</span>
          <select className="select h-10" value={communeId ?? ""} onChange={(e) => setCommuneId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t.composer.noLocation}</option>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}

      {error && <p role="alert" className="mb-2 text-[13px] font-medium text-orange">{error}</p>}

      <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
        <div className="-ml-2 flex items-center text-green-deep">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button type="button" aria-label={t.composer.addImage} disabled={media.length >= 4 || Boolean(poll) || uploading} onClick={() => fileRef.current?.click()} className="rounded-full p-2 hover:bg-green-soft disabled:opacity-40">
            <I.image className="h-5 w-5" />
          </button>
          {!parentId && !quotedId && (
            <button type="button" aria-label={t.composer.addPoll} aria-pressed={Boolean(poll)} disabled={media.length > 0} onClick={() => setPoll((p) => (p ? null : { options: ["", ""], days: 3 }))} className="rounded-full p-2 hover:bg-green-soft disabled:opacity-40">
              <I.poll className="h-5 w-5" />
            </button>
          )}
          {!parentId && (
            <button type="button" aria-label={t.composer.location} aria-pressed={showPlace} onClick={() => setShowPlace((s) => !s)} className={`rounded-full p-2 hover:bg-green-soft ${communeId ? "bg-green-soft" : ""}`}>
              <I.pin className="h-5 w-5" />
            </button>
          )}
          {uploading && <span className="ml-2 text-[13px] text-muted">{t.composer.uploading}</span>}
        </div>
        <div className="flex items-center gap-3">
          {text.length > 0 && (
            <span aria-live="polite" className={`text-[13px] tabular-nums ${left < 0 ? "font-bold text-orange" : left < 40 ? "text-orange" : "text-muted"}`}>
              {left}
            </span>
          )}
          <button type="button" onClick={submit} disabled={!canPost} className="btn-primary btn-sm">
            {parentId ? t.composer.reply : t.composer.post}
          </button>
        </div>
      </div>
    </div>
  );
}
