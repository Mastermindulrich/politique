"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { I } from "@/app/components/ui/icons";
import { formatSize, withDownload } from "@/lib/dm-media";
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
      {files.map((a) => (
        <FileCard key={a.path} a={a} url={urls[a.path]} mine={mine} lang={lang} />
      ))}
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
