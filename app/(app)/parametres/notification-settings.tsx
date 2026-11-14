"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { chime } from "@/app/components/notify/notification-center";
import { CATEGORIES, CATEGORY_LABELS, defaultPref, type Category, type Lang, type Prefs } from "@/lib/notify";
import { sendTestNotification, updateNotificationPrefs } from "@/lib/notify-actions";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push-client";

const copy = {
  fr: {
    device: "Cet appareil",
    on: "Les notifications push sont activées sur cet appareil.",
    off: "Recevez les notifications sur cet appareil, même quand POLITIQUE est fermé.",
    denied: "Les notifications sont bloquées par votre navigateur. Autorisez-les dans les réglages du site (icône à gauche de l'adresse), puis rechargez la page.",
    unsupported: "Ce navigateur ne permet pas les notifications push. Essayez Chrome, Edge, Firefox ou Safari récent.",
    unconfigured: "Les notifications push ne sont pas encore disponibles sur le site.",
    ios: "Sur iPhone et iPad, ajoutez d'abord POLITIQUE à votre écran d'accueil : touchez Partager, puis « Sur l'écran d'accueil ». Ouvrez ensuite POLITIQUE depuis l'icône et revenez ici. (iOS 16.4 ou plus récent.)",
    enable: "Activer les notifications",
    disable: "Désactiver sur cet appareil",
    test: "Envoyer un test",
    testSent: "Test envoyé. Il arrive dans quelques secondes.",
    testNone: "Aucun appareil n'a reçu le test. Désactivez puis réactivez les notifications.",
    sound: "Son",
    soundHelp: "Un petit son quand une notification arrive pendant que le site est ouvert.",
    previews: "Aperçu des messages",
    previewsHelp: "Afficher le texte des messages privés dans les notifications push.",
    quiet: "Ne pas déranger",
    quietHelp: "Pas de notification push pendant ces heures (heure d'Abidjan). Tout reste dans l'onglet Notifications.",
    from: "De",
    to: "à",
    types: "Ce qui vous est notifié",
    app: "Dans l'app",
    push: "Push",
    saved: "Enregistré",
    error: "Une erreur s'est produite.",
  },
  en: {
    device: "This device",
    on: "Push notifications are on for this device.",
    off: "Get notifications on this device, even when POLITIQUE is closed.",
    denied: "Your browser blocks notifications for this site. Allow them in the site settings (icon left of the address), then reload.",
    unsupported: "This browser does not support push notifications. Try a recent Chrome, Edge, Firefox or Safari.",
    unconfigured: "Push notifications are not available on the site yet.",
    ios: "On iPhone and iPad, first add POLITIQUE to your Home Screen: tap Share, then “Add to Home Screen”. Open POLITIQUE from the icon and come back here. (iOS 16.4 or later.)",
    enable: "Turn on notifications",
    disable: "Turn off on this device",
    test: "Send a test",
    testSent: "Test sent. It arrives in a few seconds.",
    testNone: "No device received the test. Turn notifications off and on again.",
    sound: "Sound",
    soundHelp: "A short sound when a notification arrives while the site is open.",
    previews: "Message previews",
    previewsHelp: "Show the text of direct messages in push notifications.",
    quiet: "Do not disturb",
    quietHelp: "No push notifications during these hours (Abidjan time). Everything stays in the Notifications tab.",
    from: "From",
    to: "to",
    types: "What you are notified about",
    app: "In app",
    push: "Push",
    saved: "Saved",
    error: "Something went wrong.",
  },
};

function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 flex-none rounded-full transition-colors duration-150 disabled:opacity-40 ${checked ? "bg-green" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-150 ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

const hours = Array.from({ length: 24 }, (_, h) => h);

export function NotificationSettings({ lang, initial }: { lang: Lang; initial: Prefs }) {
  const t = copy[lang];
  const labels = CATEGORY_LABELS[lang];
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [device, setDevice] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [, start] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    void pushState().then(setDevice);
  }, []);

  // Saves shortly after each change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      start(async () => {
        const r = await updateNotificationPrefs(prefs);
        setStatus(r.ok ? t.saved : t.error);
        window.dispatchEvent(new CustomEvent("politique:prefs", { detail: { sound: prefs.sound } }));
      });
    }, 400);
    return () => window.clearTimeout(id);
  }, [prefs, t.saved, t.error]);

  const on = (c: Category, push: boolean) => (push ? prefs.push[c] ?? defaultPref(c, true) : prefs.inapp[c] ?? defaultPref(c, false));
  const set = (c: Category, push: boolean, v: boolean) =>
    setPrefs((p) => (push ? { ...p, push: { ...p.push, [c]: v } } : { ...p, inapp: { ...p.inapp, [c]: v } }));
  const quietOn = prefs.quiet_start !== null && prefs.quiet_end !== null;

  return (
    <div className="flex flex-col gap-6">
      {/* This device */}
      <div className="rounded-2xl border border-line p-4">
        <p className="text-[15px] font-bold">{t.device}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          {device === "on" ? t.on : device === "denied" ? t.denied : device === "unsupported" ? t.unsupported : device === "unconfigured" ? t.unconfigured : device === "ios-needs-install" ? t.ios : t.off}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(device === "default" || device === "off") && (
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setDevice(await enablePush().catch(() => "off" as PushState));
                setBusy(false);
              }}
            >
              {t.enable}
            </button>
          )}
          {device === "on" && (
            <>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await sendTestNotification().catch(() => ({ ok: false, sent: 0, configured: true }));
                  setStatus(r.ok ? t.testSent : r.configured ? t.testNone : t.unconfigured);
                  setBusy(false);
                }}
              >
                {t.test}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setDevice(await disablePush());
                  setBusy(false);
                }}
              >
                {t.disable}
              </button>
            </>
          )}
        </div>
      </div>

      {/* General */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <span className="text-[14px]">
            <span className="font-semibold">{t.sound}</span>
            <span className="block text-muted">{t.soundHelp}</span>
          </span>
          <Switch
            checked={prefs.sound}
            label={t.sound}
            onChange={(v) => {
              setPrefs((p) => ({ ...p, sound: v }));
              if (v) chime("message");
            }}
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-[14px]">
            <span className="font-semibold">{t.previews}</span>
            <span className="block text-muted">{t.previewsHelp}</span>
          </span>
          <Switch checked={prefs.previews} label={t.previews} onChange={(v) => setPrefs((p) => ({ ...p, previews: v }))} />
        </div>
        <div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-[14px]">
              <span className="font-semibold">{t.quiet}</span>
              <span className="block text-muted">{t.quietHelp}</span>
            </span>
            <Switch checked={quietOn} label={t.quiet} onChange={(v) => setPrefs((p) => ({ ...p, quiet_start: v ? 22 : null, quiet_end: v ? 7 : null }))} />
          </div>
          {quietOn && (
            <div className="mt-2 flex items-center gap-2 text-[14px]">
              <span>{t.from}</span>
              <select className="select !w-auto" value={prefs.quiet_start ?? 22} onChange={(e) => setPrefs((p) => ({ ...p, quiet_start: Number(e.target.value) }))}>
                {hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
              </select>
              <span>{t.to}</span>
              <select className="select !w-auto" value={prefs.quiet_end ?? 7} onChange={(e) => setPrefs((p) => ({ ...p, quiet_end: Number(e.target.value) }))}>
                {hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Per category */}
      <div>
        <div className="flex items-end justify-between gap-4 border-b border-line pb-2">
          <p className="text-[15px] font-bold">{t.types}</p>
          <div className="flex gap-3 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <span className="w-12 text-center">{t.app}</span>
            <span className="w-12 text-center">{t.push}</span>
          </div>
        </div>
        <ul>
          {CATEGORIES.map((c) => (
            <li key={c} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
              <span className="min-w-0 text-[14px]">
                <span className="font-semibold">{labels[c].label}</span>
                <span className="block text-muted">{labels[c].help}</span>
              </span>
              <div className="flex flex-none gap-3">
                <Switch checked={on(c, false)} label={`${labels[c].label} · ${t.app}`} onChange={(v) => set(c, false, v)} />
                <Switch checked={on(c, false) && on(c, true)} disabled={!on(c, false)} label={`${labels[c].label} · ${t.push}`} onChange={(v) => set(c, true, v)} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p role="status" className="min-h-[20px] text-[14px] font-medium text-green-deep">{status}</p>
    </div>
  );
}
