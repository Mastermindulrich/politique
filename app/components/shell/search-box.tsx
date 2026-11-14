"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { I } from "../ui/icons";

export function SearchBox({ placeholder, initial = "", autoFocus = false, hideOn }: { placeholder: string; initial?: string; autoFocus?: boolean; hideOn?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial);
  // The explore page has its own search field; the sidebar copy steps aside there.
  if (hideOn && pathname === hideOn) return null;
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (!v) return;
        if (v.startsWith("#")) router.push(`/t/${encodeURIComponent(v.slice(1).toLowerCase())}`);
        else if (v.startsWith("@")) router.push(`/u/${v.slice(1).toLowerCase()}`);
        else router.push(`/explorer?q=${encodeURIComponent(v)}`);
      }}
      className="relative"
    >
      <I.search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="search-field"
      />
    </form>
  );
}
