"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { Media } from "@/lib/types";

export function MediaGrid({ media, lowData = false, compact = false }: { media: Media[]; lowData?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(!lowData);
  if (!media.length) return null;

  if (!loaded) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setLoaded(true); }} className="mt-3 flex h-24 w-full items-center justify-center rounded-2xl border border-dashed border-line bg-paper text-[14px] font-semibold text-muted">
        {media.length} média{media.length > 1 ? "s" : ""} · touchez pour afficher
      </button>
    );
  }

  const n = media.length;
  const cls = n === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <>
      <div className={`mt-3 grid gap-0.5 overflow-hidden rounded-2xl border border-line ${cls}`} onClick={(e) => e.stopPropagation()}>
        {media.map((m, i) => (
          <div key={i} className={`relative bg-paper ${n === 3 && i === 0 ? "row-span-2" : ""} ${compact ? "max-h-56" : ""}`}>
            {m.type === "video" ? (
              <video src={m.url} poster={m.poster} controls preload="metadata" playsInline className="h-full w-full max-h-[520px] bg-black object-contain" />
            ) : (
              <button type="button" onClick={() => setOpen(i)} className="block h-full w-full">
                <img src={m.url} alt={m.alt ?? ""} loading="lazy" className={`h-full w-full object-cover ${n === 1 ? "max-h-[520px]" : "aspect-square"}`} />
              </button>
            )}
          </div>
        ))}
      </div>
      {open !== null && media[open]?.type === "image" && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={(e) => { e.stopPropagation(); setOpen(null); }}>
          <img src={media[open].url} alt={media[open].alt ?? ""} className="max-h-full max-w-full rounded-lg object-contain" />
          <button type="button" aria-label="Fermer" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" onClick={() => setOpen(null)}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      )}
    </>
  );
}
