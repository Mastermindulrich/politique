"use client";

import { useState, useTransition } from "react";
import { submitReport } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

type Reason = "haine" | "harcelement" | "desinformation" | "spam" | "violence" | "usurpation" | "contenu_adulte" | "autre";

export function ReportDialog({ postId, profileId, messageId, t, onClose }: { postId?: string; profileId?: string; messageId?: string; t: Dict; onClose: () => void }) {
  const [reason, setReason] = useState<Reason>("desinformation");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="report-title" className="font-display text-xl font-bold">{t.report.title}</h2>
        {done ? (
          <>
            <p className="mt-3 text-[15px] text-muted">{t.report.sent}</p>
            <button type="button" className="btn-primary mt-5 w-full" onClick={onClose}>{t.common.close}</button>
          </>
        ) : (
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await submitReport({ postId, profileId, messageId, reason, details: details || undefined });
                if (r.ok) setDone(true);
              });
            }}
          >
            <fieldset>
              <legend className="label">{t.report.reason}</legend>
              <div className="flex flex-col gap-1">
                {(Object.keys(t.report.reasons) as Reason[]).map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper">
                    <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-green" />
                    <span className="text-[15px]">{t.report.reasons[r]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              <span className="label">{t.report.details}</span>
              <textarea className="textarea" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={onClose}>{t.common.cancel}</button>
              <button type="submit" className="btn-primary flex-1" disabled={pending}>{t.report.submit}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
