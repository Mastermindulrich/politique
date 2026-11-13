"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { recordViews } from "@/lib/actions";
import { t as dict } from "@/lib/i18n";
import type { FeedPost } from "@/lib/types";
import { PostCard } from "./post/post-card";

type Props = {
  initial: FeedPost[];
  viewerId: string | null;
  lang: "fr" | "en";
  lowData?: boolean;
  isModerator?: boolean;
  showReason?: boolean;
  empty?: React.ReactNode;
  /** Server action returning the next page given the last item's timestamp. Omit for a fixed list. */
  loadMore?: (before: string, count: number) => Promise<FeedPost[]>;
};

export function Feed({ initial, viewerId, lang, lowData, isModerator, showReason, empty, loadMore }: Props) {
  const t = dict(lang);
  const [posts, setPosts] = useState(initial);
  const [done, setDone] = useState(!loadMore || initial.length < 10);
  const [pending, start] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    setPosts(initial);
    setDone(!loadMore || initial.length < 10);
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count views once per post per page load, in small batches.
  useEffect(() => {
    const fresh = posts.map((p) => p.id).filter((id) => !seen.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => seen.current.add(id));
    const timer = setTimeout(() => void recordViews(fresh), 1500);
    return () => clearTimeout(timer);
  }, [posts]);

  function more() {
    if (!loadMore || pending || done || !posts.length) return;
    const last = posts[posts.length - 1] as FeedPost & { created_at_sort?: string };
    start(async () => {
      const next = await loadMore(last.created_at_sort ?? last.created_at, posts.length);
      const known = new Set(posts.map((p) => p.id));
      const add = next.filter((p) => !known.has(p.id));
      if (!add.length) setDone(true);
      setPosts((p) => [...p, ...add]);
    });
  }

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && more(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  });

  if (!posts.length) return <div className="px-6 py-14 text-center text-[15px] text-muted">{empty ?? t.feed.empty}</div>;

  return (
    <div>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} viewerId={viewerId} lang={lang} lowData={lowData} isModerator={isModerator} showReason={showReason} />
      ))}
      {!done && (
        <div ref={sentinel} className="flex justify-center py-6">
          <button type="button" onClick={more} disabled={pending} className="btn-ghost btn-sm">
            {pending ? t.common.loading : t.feed.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
