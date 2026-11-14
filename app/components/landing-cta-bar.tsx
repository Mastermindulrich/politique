"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * On phones, once the hero's buttons have scrolled away, a slim bar keeps
 * "Create my account" one tap away. It steps aside again near the final call to action.
 */
export function LandingCtaBar({ label, login, loginLabel }: { label: string; login: string; loginLabel: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero-actions");
    const end = document.getElementById("final-cta");
    if (!hero) return;
    let heroOut = false;
    let endIn = false;
    const update = () => setShow(heroOut && !endIn);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) heroOut = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === end) endIn = e.isIntersecting;
      }
      update();
    });
    io.observe(hero);
    if (end) io.observe(end);
    return () => io.disconnect();
  }, []);
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/90 px-4 pt-3 backdrop-blur-lg transition-transform duration-300 ease-out md:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <div className="flex gap-2">
        <Link href="/inscription" tabIndex={show ? 0 : -1} className="btn-primary h-11 flex-1">{label}</Link>
        <Link href={login} tabIndex={show ? 0 : -1} className="btn-ghost h-11 px-5">{loginLabel}</Link>
      </div>
    </div>
  );
}
