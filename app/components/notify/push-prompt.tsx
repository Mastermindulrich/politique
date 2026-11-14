"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/notify";
import { enablePush, pushState, type PushState } from "@/lib/push-client";
import { I } from "../ui/icons";

const KEY = "push-prompt-dismissed";
const WAIT_DAYS = 14;

const copy = {
  fr: {
    title: "Ne manquez aucun message",
    body: "Recevez une notification sur cet appareil quand on vous écrit, vous répond ou quand vos élus publient.",
    enable: "Activer",
    later: "Plus tard",
    iosTitle: "Notifications sur iPhone",
    iosBody: "Ajoutez POLITIQUE à votre écran d'accueil pour recevoir les notifications :",
    iosStep1: "Touchez le bouton Partager",
    iosStep2: "Choisissez « Sur l'écran d'accueil »",
    iosStep3: "Ouvrez POLITIQUE depuis l'icône, puis activez les notifications",
    ok: "Compris",
  },
  en: {
    title: "Never miss a message",
    body: "Get a notification on this device when someone writes to you, replies, or when your officials post.",
    enable: "Turn on",
    later: "Not now",
    iosTitle: "Notifications on iPhone",
    iosBody: "Add POLITIQUE to your Home Screen to get notifications:",
    iosStep1: "Tap the Share button",
    iosStep2: "Choose “Add to Home Screen”",
    iosStep3: "Open POLITIQUE from the icon, then turn notifications on",
    ok: "Got it",
  },
};

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(KEY) || 0);
    return Date.now() - at < WAIT_DAYS * 86400000;
  } catch {
    return false;
  }
}

/** A gentle ask (never the browser's prompt on page load): shown a few seconds in, at most every two weeks. */
export function PushPrompt({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const pathname = usePathname();
  const [state, setState] = useState<PushState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dismissedRecently()) return;
    const timer = window.setTimeout(async () => {
      const s = await pushState();
      setState(s);
      if (s === "default" || s === "ios-needs-install") setOpen(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open || !state || pathname.startsWith("/parametres") || pathname.startsWith("/messages/")) return null;

  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setOpen(false);
  };

  const ios = state === "ios-needs-install";
  return (
    <div
      role="dialog"
      aria-label={ios ? t.iosTitle : t.title}
      className="sheet-up fixed inset-x-3 z-[55] rounded-2xl border border-line bg-card p-4 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[380px]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 74px)" }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-green/10 text-green-deep">
          <I.bell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold">{ios ? t.iosTitle : t.title}</p>
          <p className="mt-0.5 text-[14px] leading-snug text-muted">{ios ? t.iosBody : t.body}</p>
          {ios && (
            <ol className="mt-2 flex flex-col gap-1.5 text-[14px]">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-paper text-[12px] font-bold">1</span>
                <span>
                  {t.iosStep1}{" "}
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="inline h-[18px] w-[18px] align-[-3px] text-[#0A84FF]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
                </span>
              </li>
              <li className="flex items-center gap-2"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-paper text-[12px] font-bold">2</span>{t.iosStep2}</li>
              <li className="flex items-center gap-2"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-paper text-[12px] font-bold">3</span>{t.iosStep3}</li>
            </ol>
          )}
          <div className="mt-3 flex gap-2">
            {ios ? (
              <button type="button" className="btn-primary btn-sm" onClick={close}>{t.ok}</button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const s = await enablePush().catch(() => "off" as PushState);
                    setBusy(false);
                    setState(s);
                    if (s !== "default") close();
                  }}
                >
                  {t.enable}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={close}>{t.later}</button>
              </>
            )}
          </div>
        </div>
        <button type="button" onClick={close} aria-label={lang === "fr" ? "Fermer" : "Close"} className="icon-btn -mr-1 -mt-1 flex-none">
          <I.x className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
