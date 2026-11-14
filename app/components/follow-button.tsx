"use client";

import { useRouter } from "next/navigation";
import { joinHref } from "@/lib/join";
import { useState, useTransition } from "react";
import { toggleFollow } from "@/lib/actions";
import { t as dict } from "@/lib/i18n";

export function FollowButton({ userId, initial, lang, signedIn, size = "sm" }: { userId: string; initial: boolean; lang: "fr" | "en"; signedIn: boolean; size?: "sm" | "md" }) {
  const t = dict(lang);
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [hover, setHover] = useState(false);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!signedIn) return router.push(joinHref());
        const next = !on;
        setOn(next);
        start(async () => {
          const r = await toggleFollow(userId, next);
          if (!r.ok) setOn(!next);
        });
      }}
      className={`${on ? "btn-ghost" : "btn-dark"} ${size === "sm" ? "btn-sm" : "h-10 px-5"} flex-none ${on && hover ? "!border-orange !text-orange" : ""}`}
    >
      {on ? (hover ? t.profile.unfollow : t.profile.following) : t.profile.follow}
    </button>
  );
}
