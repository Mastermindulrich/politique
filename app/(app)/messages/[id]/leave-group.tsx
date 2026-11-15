"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { S } from "@/app/components/ui/icons-social";
import { leaveConversation } from "@/lib/social-actions";
import { t as dict } from "@/lib/i18n";
import { social } from "@/lib/i18n-social";

export function LeaveGroup({ conversationId, lang }: { conversationId: string; lang: "fr" | "en" }) {
  const t = dict(lang);
  const s = social(lang);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={s.messages.leave} title={s.messages.leave} className="-mr-2 flex-none rounded-full p-2 text-muted hover:bg-paper hover:text-ink">
        <S.exit className="h-5 w-5" />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={s.messages.leave} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-t-3xl bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">{s.messages.leave}</h2>
            <p className="mt-2 text-[15px] text-muted">{s.messages.leaveConfirm}</p>
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setOpen(false)}>{t.common.cancel}</button>
              <button
                type="button"
                className="btn-dark flex-1"
                disabled={pending}
                onClick={() => start(async () => {
                  const r = await leaveConversation(conversationId);
                  if (r.ok) router.replace("/messages");
                })}
              >
                {s.messages.leave}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
