"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Tell the bar a navigation started from code (router.push) rather than from a link. */
export function navStart() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("politique:nav"));
}

/**
 * A thin progress bar across the top of the screen from the moment a link is pressed
 * until the next page shows, so a tap is always answered at once.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [busy, setBusy] = useState(false);

  // The address changed: the new page is on screen.
  useEffect(() => setBusy(false), [pathname, search]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      setBusy(true);
      clearTimeout(timer);
      timer = setTimeout(() => setBusy(false), 8000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin) return;
      if (to.pathname === window.location.pathname && to.search === window.location.search) return;
      start();
    };
    document.addEventListener("click", onClick);
    window.addEventListener("politique:nav", start);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", onClick);
      window.removeEventListener("politique:nav", start);
    };
  }, []);

  return busy ? <div aria-hidden="true" className="nav-progress" /> : null;
}
