/* eslint-disable @next/next/no-img-element */
import type { LinkPreview } from "@/lib/types";

/** The card under a post that contains a link: picture, site, title, short description. */
export function LinkCard({ link, lowData = false, onRemove }: { link: LinkPreview; lowData?: boolean; onRemove?: () => void }) {
  const picture = link.image && !lowData;
  return (
    <div className="relative mt-3">
      <a href={link.url} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={(e) => e.stopPropagation()} className="flex overflow-hidden rounded-2xl border border-line bg-card transition-colors hover:bg-paper/60">
        {picture && <img src={link.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-auto w-24 flex-none border-r border-line bg-paper object-cover sm:w-32" />}
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2.5">
          <span className="truncate text-[12px] uppercase tracking-wide text-muted">{link.site}</span>
          <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink">{link.title}</span>
          {link.description && <span className="line-clamp-2 text-[13px] leading-snug text-muted">{link.description}</span>}
        </span>
      </a>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Retirer" className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      )}
    </div>
  );
}
