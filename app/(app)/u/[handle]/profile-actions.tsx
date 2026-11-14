"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FollowButton } from "@/app/components/follow-button";
import { ReportDialog } from "@/app/components/post/report-dialog";
import { I } from "@/app/components/ui/icons";
import { moderate, startConversation, toggleBlock, toggleMute } from "@/lib/actions";
import { t as dict } from "@/lib/i18n";

type Props = { userId: string; lang: "fr" | "en"; signedIn: boolean; following: boolean; blocked: boolean; muted: boolean; isModerator: boolean; suspended: boolean };

export function ProfileActions({ userId, lang, signedIn, following, blocked: b0, muted: m0, isModerator, suspended }: Props) {
  const t = dict(lang);
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [blocked, setBlocked] = useState(b0);
  const [muted, setMuted] = useState(m0);
  const [report, setReport] = useState(false);
  const [pending, start] = useTransition();

  const item = "flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold transition-colors hover:bg-paper active:bg-line/60";
  return (
    <div className="flex items-center gap-2">
      {signedIn && (
        <div className="relative">
          <button type="button" aria-label={t.nav.more} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="btn-ghost btn-sm w-9 !px-0">
            <I.more className="h-5 w-5" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div role="menu" className="fade-in absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-2xl border border-line/70 bg-card py-1.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.06)]">
                <button role="menuitem" type="button" className={item} onClick={() => { setMenu(false); const on = !muted; setMuted(on); start(() => void toggleMute(userId, on)); }}>
                  {muted ? t.profile.unmute : t.profile.mute}
                </button>
                <button role="menuitem" type="button" className={item} onClick={() => { setMenu(false); const on = !blocked; setBlocked(on); start(async () => { await toggleBlock(userId, on); router.refresh(); }); }}>
                  {blocked ? t.profile.unblock : t.profile.block}
                </button>
                <button role="menuitem" type="button" className={item} onClick={() => { setMenu(false); setReport(true); }}>
                  <I.flag className="h-[18px] w-[18px]" /> {t.profile.report}
                </button>
                {isModerator && (
                  <>
                    <hr className="my-1 border-line" />
                    {suspended ? (
                      <button role="menuitem" type="button" className={item} onClick={() => { setMenu(false); start(async () => { await moderate({ userId, action: "unban" }); router.refresh(); }); }}>
                        {lang === "fr" ? "Lever la suspension" : "Lift suspension"}
                      </button>
                    ) : (
                      <>
                        <button role="menuitem" type="button" className={`${item} text-orange`} onClick={() => { setMenu(false); start(async () => { await moderate({ userId, action: "suspend" }); router.refresh(); }); }}>
                          {t.admin.suspend7}
                        </button>
                        <button role="menuitem" type="button" className={`${item} text-orange`} onClick={() => { setMenu(false); start(async () => { await moderate({ userId, action: "ban" }); router.refresh(); }); }}>
                          {t.admin.ban}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {signedIn && !blocked && (
        <button
          type="button"
          aria-label={t.profile.message}
          disabled={pending}
          className="btn-ghost btn-sm w-9 !px-0"
          onClick={() =>
            start(async () => {
              const r = await startConversation(userId);
              if (r.ok && r.data) router.push(`/messages/${r.data.id}`);
            })
          }
        >
          <I.mail className="h-5 w-5" />
        </button>
      )}
      {blocked ? (
        <span className="chip bg-orange-soft text-orange">{t.profile.block}</span>
      ) : (
        <FollowButton userId={userId} initial={following} lang={lang} signedIn={signedIn} />
      )}
      {report && <ReportDialog profileId={userId} t={t} onClose={() => setReport(false)} />}
    </div>
  );
}
