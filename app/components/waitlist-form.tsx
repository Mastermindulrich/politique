"use client";

import { useState } from "react";
import type { Content, Lang } from "@/lib/content";

export default function WaitlistForm({ t, lang, id }: { t: Content["form"]; lang: Lang; id: string }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState("sending");
    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${base}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          role: data.get("role"),
          website: data.get("website"),
          lang,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("ok");
      form.reset();
    } catch {
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <p role="status" className="rounded-2xl border border-green/30 bg-green-soft px-5 py-4 text-[15px] font-medium text-green-deep">
        {t.success}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate={false}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">{t.email}</span>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder={t.emailPlaceholder}
            className="h-12 w-full rounded-full border border-line bg-white px-5 text-[15px] text-ink placeholder:text-muted focus:border-green focus:outline-none focus:ring-2 focus:ring-green/30"
          />
        </label>
        <label className="sm:w-56">
          <span className="sr-only">{t.role}</span>
          <select
            id={`${id}-role`}
            name="role"
            defaultValue="citoyen"
            className="h-12 w-full appearance-none rounded-full border border-line bg-white px-5 pr-10 text-[15px] text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/30"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235B6168' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 16px center",
            }}
          >
            {t.roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button type="submit" disabled={state === "sending"} className="btn-primary disabled:opacity-60">
          {state === "sending" ? t.sending : t.submit}
        </button>
      </div>
      {state === "error" && (
        <p role="alert" className="text-sm font-medium text-orange">
          {t.error}
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted">{t.consent}</p>
    </form>
  );
}
