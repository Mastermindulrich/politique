"use client";

import Link from "next/link";
import { joinHref } from "@/lib/join";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePost, toggleBookmark, toggleLike, toggleRepost } from "@/lib/actions";
import { formatCount, t as dict, timeAgo } from "@/lib/i18n";
import type { FeedPost } from "@/lib/types";
import { communeLabel } from "@/lib/ci-geo";
import { Avatar } from "../ui/avatar";
import { NameBadge } from "../ui/badge";
import { I } from "../ui/icons";
import { MediaGrid } from "./media-grid";
import { PollCard } from "./poll-card";
import { PostText } from "./post-text";
import { ReportDialog } from "./report-dialog";
import { Composer } from "../composer";

type Props = {
  post: FeedPost;
  viewerId: string | null;
  lang: "fr" | "en";
  lowData?: boolean;
  /** detail = the main post on its page: bigger text, full date, no link wrapper */
  variant?: "feed" | "detail" | "thread" | "compact";
  showReason?: boolean;
  isModerator?: boolean;
};

export function PostCard({ post, viewerId, lang, lowData = false, variant = "feed", showReason = false, isModerator = false }: Props) {
  const t = dict(lang);
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [reposted, setReposted] = useState(post.reposted);
  const [reposts, setReposts] = useState(post.repost_count);
  const [bookmarked, setBookmarked] = useState(post.bookmarked);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [quote, setQuote] = useState(false);
  const [replying, setReplying] = useState(false);
  const [gone, setGone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();

  if (gone) return null;
  const canAct = Boolean(viewerId);
  const detail = variant === "detail";
  const href = `/p/${post.id}`;

  function like() {
    if (!canAct) return router.push(joinHref());
    const on = !liked;
    setLiked(on);
    setLikes((n) => n + (on ? 1 : -1));
    start(() => void toggleLike(post.id, on));
  }
  function repost() {
    if (!canAct) return router.push(joinHref());
    const on = !reposted;
    setReposted(on);
    setReposts((n) => n + (on ? 1 : -1));
    start(() => void toggleRepost(post.id, on));
  }
  function bookmark() {
    if (!canAct) return router.push(joinHref());
    const on = !bookmarked;
    setBookmarked(on);
    start(() => void toggleBookmark(post.id, on));
    setMenu(false);
  }
  async function share() {
    const url = `${window.location.origin}${href}`;
    if (navigator.share) {
      try { await navigator.share({ url, text: post.text.slice(0, 120) }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function remove() {
    setMenu(false);
    start(async () => {
      const r = await deletePost(post.id);
      if (r.ok) setGone(true);
    });
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    detail ? (
      <article className="px-4 pt-3">{children}</article>
    ) : (
      <article
        className={`relative cursor-pointer px-4 py-3 transition-colors duration-150 hover:bg-paper/60 active:bg-paper ${variant === "thread" ? "" : "border-b border-line"}`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("a, button, video, input, textarea, [role=dialog]")) return;
          router.push(href);
        }}
      >
        {children}
      </article>
    );

  const labelTone = (l: FeedPost["labels"][number]["label"]) =>
    l === "fausse" ? "border-orange/40 bg-orange-soft text-orange" : l === "officiel" ? "border-green/30 bg-green-soft text-green-deep" : "border-line bg-paper text-muted";

  return (
    <Wrapper>
      {post.reposted_by && (
        <div className="mb-1 flex items-center gap-2 pl-8 text-[13px] font-semibold text-muted">
          <I.repost className="h-4 w-4" />
          {post.reposted_by.display_name} {t.feed.reposted}
        </div>
      )}
      {showReason && post.reason === "votre_elu" && (
        <div className="mb-1 flex items-center gap-2 pl-8 text-[13px] font-semibold text-green-deep">
          <I.landmark className="h-4 w-4" />
          {t.feed.yourOfficial}
        </div>
      )}
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <Link href={`/u/${post.author.handle}`} className="flex-none" aria-label={post.author.display_name}>
            <Avatar src={post.author.avatar_url} name={post.author.display_name} size={detail ? 44 : 40} />
          </Link>
          {variant === "thread" && <span aria-hidden="true" className="mt-1 w-0.5 flex-1 rounded bg-line" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className={`min-w-0 ${detail ? "flex flex-col" : "flex flex-wrap items-center gap-x-1.5"} text-[15px] leading-tight`}>
              <Link href={`/u/${post.author.handle}`} className="inline-flex max-w-full items-center gap-1 truncate font-bold hover:underline">
                <span className="truncate">{post.author.display_name}</span>
                <NameBadge p={post.author} lang={lang} verifiedTitle={t.profile.verified} />
              </Link>
              <span className="truncate text-muted">@{post.author.handle}</span>
              {!detail && (
                <>
                  <span className="text-muted">·</span>
                  <Link href={href} className="text-muted hover:underline" title={new Date(post.created_at).toLocaleString()}>
                    <time dateTime={post.created_at}>{timeAgo(post.created_at, lang)}</time>
                  </Link>
                </>
              )}
            </div>
            <div className="relative flex-none">
              <button type="button" aria-label={t.nav.more} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="tap -mr-2 -mt-1 rounded-full p-2 text-muted hover:bg-paper hover:text-ink active:bg-line/60">
                <I.more className="h-5 w-5" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div role="menu" className="fade-in absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-2xl border border-line bg-card py-1 shadow-xl">
                    {canAct && (
                      <button role="menuitem" type="button" onClick={bookmark} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-paper active:bg-line/60">
                        <I.bookmark className="h-4 w-4" filled={bookmarked} /> {bookmarked ? t.post.unbookmark : t.post.bookmark}
                      </button>
                    )}
                    <button role="menuitem" type="button" onClick={() => { setMenu(false); share(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-paper active:bg-line/60">
                      <I.share className="h-4 w-4" /> {t.post.share}
                    </button>
                    <a role="menuitem" href={`https://wa.me/?text=${encodeURIComponent(post.text.slice(0, 200) + " " + (typeof window !== "undefined" ? window.location.origin : "") + href)}`} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-paper active:bg-line/60">
                      <I.whatsapp className="h-4 w-4" /> {t.post.whatsapp}
                    </a>
                    {canAct && viewerId !== post.author_id && (
                      <button role="menuitem" type="button" onClick={() => { setMenu(false); setReport(true); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-paper active:bg-line/60">
                        <I.flag className="h-4 w-4" /> {t.post.report}
                      </button>
                    )}
                    {(viewerId === post.author_id || isModerator) && (
                      <button role="menuitem" type="button" onClick={remove} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-orange transition-colors hover:bg-paper active:bg-line/60">
                        <I.trash className="h-4 w-4" /> {t.post.delete}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {post.kind === "reply" && post.parent_id && variant !== "thread" && !detail && (
            <div className="mt-0.5 text-[13px] text-muted">
              <Link href={`/p/${post.parent_id}`} className="hover:underline">{t.feed.showThread}</Link>
            </div>
          )}

          {post.is_hidden ? (
            <p className="mt-2 rounded-xl border border-line bg-paper px-3 py-2 text-[14px] text-muted">{t.post.hidden}</p>
          ) : (
            <PostText text={post.text} className={detail ? "mt-3 text-[19px] leading-snug" : "mt-1"} />
          )}

          {post.labels.map((l) => (
            <div key={l.id} className={`mt-2 rounded-xl border px-3 py-2 text-[13px] ${labelTone(l.label)}`}>
              <span className="font-bold">{t.post.labels[l.label]}</span>
              {l.note && <span> · {l.note}</span>}
              {l.source_url && (
                <>
                  {" "}
                  <a href={l.source_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">source</a>
                </>
              )}
            </div>
          ))}

          {post.media.length > 0 && !post.is_hidden && <MediaGrid media={post.media} lowData={lowData} compact={variant === "compact"} />}
          {post.poll && <PollCard poll={post.poll} voted={post.voted} canVote={canAct} t={t.post} lang={lang} />}

          {post.quoted && (
            <Link href={`/p/${post.quoted.id}`} className="mt-3 block rounded-2xl border border-line p-3 hover:bg-paper/60" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 text-[14px]">
                <Avatar src={post.quoted.author.avatar_url} name={post.quoted.author.display_name} size={20} />
                <span className="font-bold">{post.quoted.author.display_name}</span>
                <NameBadge p={post.quoted.author} size={16} lang={lang} />
                <span className="text-muted">@{post.quoted.author.handle} · {timeAgo(post.quoted.created_at, lang)}</span>
              </div>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[14px] leading-snug">{post.quoted.text}</p>
              {post.quoted.media.length > 0 && <div className="mt-1 text-[13px] text-muted">{post.quoted.media.length} média{post.quoted.media.length > 1 ? "s" : ""}</div>}
            </Link>
          )}

          {post.commune_id && <CommuneTag id={post.commune_id} />}

          {detail && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-3 text-[14px] text-muted">
              <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeStyle: "short" })}</time>
              <span>·</span>
              <span><b className="text-ink">{formatCount(post.view_count, lang)}</b> {t.post.views}</span>
              {reposts > 0 && <span><b className="text-ink">{formatCount(reposts, lang)}</b> {t.post.repost.toLowerCase()}s</span>}
              {post.quote_count > 0 && <span><b className="text-ink">{post.quote_count}</b> {t.post.quote.toLowerCase()}s</span>}
            </div>
          )}

          <div className={`-ml-2 flex items-center justify-between ${detail ? "mt-1 max-w-md" : "mt-2 max-w-sm"} text-muted`}>
            <button type="button" onClick={() => (canAct ? setReplying((r) => !r) : router.push(joinHref()))} className="tap flex items-center gap-1.5 rounded-full p-2 text-[13px] hover:bg-green-soft hover:text-green-deep active:scale-90 active:bg-green-soft" aria-label={t.post.reply}>
              <I.reply className="h-[18px] w-[18px]" />
              {post.reply_count > 0 && <span>{formatCount(post.reply_count, lang)}</span>}
            </button>
            <button type="button" onClick={repost} aria-pressed={reposted} className={`tap flex items-center gap-1.5 rounded-full p-2 text-[13px] hover:bg-green-soft hover:text-green-deep active:scale-90 active:bg-green-soft ${reposted ? "text-green-deep" : ""}`} aria-label={reposted ? t.post.unrepost : t.post.repost}>
              <span key={reposted ? "on" : "off"} className={reposted ? "pop" : ""}><I.repost className="h-[18px] w-[18px]" /></span>
              {reposts > 0 && <span>{formatCount(reposts, lang)}</span>}
            </button>
            {canAct && (
              <button type="button" onClick={() => setQuote(true)} className="tap flex items-center gap-1.5 rounded-full p-2 text-[13px] hover:bg-green-soft hover:text-green-deep active:scale-90 active:bg-green-soft" aria-label={t.post.quote}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round"><path d="M7 7h10M7 11h6" /><path d="M4 4h16v12H9l-5 4z" /></svg>
              </button>
            )}
            <button type="button" onClick={like} aria-pressed={liked} className={`tap flex items-center gap-1.5 rounded-full p-2 text-[13px] hover:bg-orange-soft hover:text-orange active:scale-90 active:bg-orange-soft ${liked ? "text-orange" : ""}`} aria-label={t.post.like}>
              <span key={liked ? "on" : "off"} className={liked ? "pop" : ""}><I.heart className="h-[18px] w-[18px]" filled={liked} /></span>
              {likes > 0 && <span>{formatCount(likes, lang)}</span>}
            </button>
            {!detail && (
              <span className="flex items-center gap-1.5 p-2 text-[13px]" title={t.post.views}>
                <I.eye className="h-[18px] w-[18px]" />
                {post.view_count > 0 && <span>{formatCount(post.view_count, lang)}</span>}
              </span>
            )}
            <button type="button" onClick={share} className="tap flex items-center gap-1.5 rounded-full p-2 text-[13px] hover:bg-green-soft hover:text-green-deep active:scale-90 active:bg-green-soft" aria-label={t.post.share}>
              <I.share className="h-[18px] w-[18px]" />
              {copied && <span className="text-green-deep">{t.post.copied}</span>}
            </button>
          </div>

          {replying && viewerId && (
            <div className="mt-2 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
              <Composer lang={lang} parentId={post.id} replyTo={post.author.handle} autoFocus onPosted={() => { setReplying(false); router.refresh(); }} compact />
            </div>
          )}
        </div>
      </div>

      {report && <ReportDialog postId={post.id} t={t} onClose={() => setReport(false)} />}
      {quote && viewerId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setQuote(false)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-card p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <Composer lang={lang} quotedId={post.id} quotedPreview={post} autoFocus onPosted={() => { setQuote(false); router.refresh(); }} />
          </div>
        </div>
      )}
    </Wrapper>
  );
}

function CommuneTag({ id }: { id: number }) {
  const l = communeLabel(id);
  if (!l) return null;
  return (
    <Link href={`/explorer?ville=${id}`} className="mt-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-green-deep" onClick={(e) => e.stopPropagation()}>
      <I.pin className="h-3.5 w-3.5" /> {l.commune}
    </Link>
  );
}
