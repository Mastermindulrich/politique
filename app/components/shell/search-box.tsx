"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { I } from "../ui/icons";

export function SearchBox({ placeholder, initial = "", autoFocus = false }: { placeholder: string; initial?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
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
        className="h-11 w-full rounded-full border border-transparent bg-paper pl-11 pr-4 text-[15px] placeholder:text-muted focus:border-green focus:bg-card focus:outline-none"
      />
    </form>
  );
}
