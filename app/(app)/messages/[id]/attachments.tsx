"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { I } from "@/app/components/ui/icons";
import { formatDuration, formatSize, withDownload } from "@/lib/dm-media";
import { t as dict } from "@/lib/i18n";
import type { DmAttachment } from "@/lib/types";

type Lang = "fr" | "en";

function extOf(name?: string) {
  const e = name?.split(".").pop();
  return e && e !== name ? e.slice(0, 4).toUpperCase() : "";
}

/** Photos of one message, then its files, as they appear in the conversation. */
export function MessageAttachments({ items, urls, mine, lang, onOpen, onLoaded }: { items: DmAttachment[]; urls: Record<string, string>; mine: boolean; lang: Lang; onOpen: (a: DmAttachment) => void; onLoaded: () => void }) {
  const visual = items.filter((a) => a.type === "image");
  const files = items.filter((a) => a.type === "file");
  const one = visual.length === 1;
  return (
    <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
      {visual.length > 0 && (
        <div className={`grid w-[264px] max-w-full gap-1 overflow-hidden rounded-3xl ${one ? "grid-cols-1" : "grid-cols-2"} ${mine ? "rounded-br-md" : "rounded-bl-md"}`}>
          {visual.map((a, i) => {
            const url = urls[a.path];
            // Three items: the first spans the full width so the grid has no hole.
            const wide = visual.length === 3 && i === 0;
            const ratio = one && a.width && a.height ? `${a.width} / ${a.height}` : "1 / 1";
            return (
              <div key={a.path} className={`relative min-h-0 overflow-hidden bg-paper ${wide ? "col-span-2" : ""}`} style={{ aspectRatio: wide ? "2 / 1" : ratio, maxHeight: one ? 360 : undefined }}>
                {!url ? (
                  <div className="flex h-full w-full items-center justify-center text-muted"><I.image className="h-6 w-6" /></div>
                ) : (
                  <button type="button" onClick={() => onOpen(a)} className="absolute inset-0 block" aria-label={a.name || "Photo"}>
                    <img src={url} alt={a.name || ""} loading="lazy" onLoad={onLoaded} className="h-full w-full object-cover" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {files.map((a) =>
        a.voice ? <VoiceNotePlayer key={a.path} a={a} url={urls[a.path]} mine={mine} lang={lang} /> : <FileCard key={a.path} a={a} url={urls[a.path]} mine={mine} lang={lang} />,
      )}
    </div>
  );
}

function FileCard({ a, url, mine, lang }: { a: DmAttachment; url?: string; mine: boolean; lang: Lang }) {
  const t = dict(lang);
  const ext = extOf(a.name);
  const body = (
    <>
      <span className={`relative flex h-11 w-11 flex-none items-center justify-center rounded-xl ${mine ? "bg-white/20" : "bg-card"}`}>
        <I.file className="h-6 w-6" />
        {ext && <span className={`absolute bottom-1 text-[8px] font-bold tracking-wide ${mine ? "text-white" : "text-green-deep"}`}>{ext}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{a.name || t.messages.file}</span>
        <span className={`block text-[12px] ${mine ? "text-white/80" : "text-muted"}`}>{[formatSize(a.size, lang), ext].filter(Boolean).join(" · ")}</span>
      </span>
      <I.download className="h-5 w-5 flex-none" />
    </>
  );
  const cls = `flex w-[260px] max-w-full items-center gap-3 rounded-3xl px-3 py-2.5 text-left ${mine ? "rounded-br-md bg-green text-white" : "rounded-bl-md bg-paper text-ink"}`;
  if (!url) return <div className={`${cls} opacity-70`}>{body}</div>;
  return (
    <a href={url.startsWith("blob:") ? url : withDownload(url, a.name)} download={a.name || true} target="_blank" rel="noopener noreferrer" className={cls} aria-label={`${t.messages.download} ${a.name ?? ""}`}>
      {body}
    </a>
  );
}

/** Full-screen photo viewer, above the chat overlay. */
export function Lightbox({ a, url, lang, onClose }: { a: DmAttachment; url: string; lang: Lang; onClose: () => void }) {
  const t = dict(lang);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Portal: the chat overlay moves with the iPhone keyboard (transform), the viewer must not.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={a.name || "Photo"} className="fixed inset-0 z-[70] flex flex-col bg-black text-white" onClick={onClose}>
      <div className="flex flex-none items-center justify-between px-2" style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label={t.messages.close} className="rounded-full p-3 hover:bg-white/10">
          <I.x className="h-6 w-6" />
        </button>
        {!url.startsWith("blob:") && (
          <a href={withDownload(url, a.name || "photo.jpg")} download aria-label={t.messages.download} className="rounded-full p-3 hover:bg-white/10">
            <I.download className="h-6 w-6" />
          </a>
        )}
      </div>
      <div className={`min-h-0 flex-1 ${zoom ? "overflow-auto" : "flex items-center justify-center overflow-hidden"}`} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <img
          src={url}
          alt={a.name || ""}
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => !z);
          }}
          className={zoom ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"}
        />
      </div>
    </div>,
    document.body,
  );
}

/** Only one voice note plays at a time across the conversation. */
let playing: HTMLAudioElement | null = null;

/** Voice note bubble: play/pause, a waveform you can tap to seek, and the time. */
function VoiceNotePlayer({ a, url, mine, lang }: { a: DmAttachment; url?: string; mine: boolean; lang: Lang }) {
  const t = dict(lang);
  const audio = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState(0);
  const [total, setTotal] = useState(a.duration ?? 0);
  const peaks = a.peaks?.length ? a.peaks : Array.from({ length: 48 }, (_, i) => 20 + ((i * 37) % 60));
  const progress = total ? Math.min(1, pos / total) : 0;

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      if (playing && playing !== el) playing.pause();
      playing = el;
      void el.play().catch(() => setOn(false));
    } else el.pause();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audio.current;
    if (!el || !total) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total;
    setPos(el.currentTime);
  }

  return (
    <div className={`flex w-[260px] max-w-full items-center gap-2.5 rounded-3xl py-2 pl-2 pr-4 ${mine ? "rounded-br-md bg-green text-white" : "rounded-bl-md bg-paper text-ink"} ${url ? "" : "opacity-70"}`}>
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onPlay={() => setOn(true)}
          onPause={() => setOn(false)}
          onEnded={() => { setOn(false); setPos(0); }}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0 && setTotal(e.currentTarget.duration)}
        />
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={on ? t.messages.pause : t.messages.play}
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${mine ? "bg-white text-green-deep" : "bg-green text-white"}`}
      >
        {on ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div role="slider" aria-label={t.messages.voiceNote} aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(pos)} tabIndex={-1} onClick={seek} className="flex h-8 cursor-pointer items-center gap-[2px]">
          {peaks.map((p, i) => (
            <span
              key={i}
              className={`w-[3px] flex-1 rounded-full transition-colors ${(i + 0.5) / peaks.length <= progress ? (mine ? "bg-white" : "bg-green") : mine ? "bg-white/45" : "bg-ink/25"}`}
              style={{ height: `${Math.max(12, p)}%` }}
            />
          ))}
        </div>
        <span className={`block text-[11px] tabular-nums ${mine ? "text-white/85" : "text-muted"}`}>{formatDuration(on || pos ? pos : total)}</span>
      </div>
    </div>
  );
}
