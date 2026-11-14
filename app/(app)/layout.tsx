import { redirect } from "next/navigation";
import { Shell } from "../components/shell/shell";
import { PrefsSync } from "../components/shell/prefs-sync";
import { getViewer, getViewerPrivate, supabaseConfigured } from "@/lib/supabase/server";
import { t as dict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // One database trip for the member and their voting place; the switches come from the server cache.
  const [viewer, priv, settings] = await Promise.all([getViewer(), getViewerPrivate(), getSettings()]);
  // Every account must say where it votes before using the app.
  if (viewer && !priv?.vote_region_id) redirect("/bienvenue");
  if (!supabaseConfigured) {
    const t = dict("fr");
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flag" aria-hidden="true"><span /><span /><span /></span>
        <p className="text-[15px] text-muted">{t.auth.notConfigured}</p>
      </div>
    );
  }
  const lang = viewer?.lang ?? "fr";
  const staff = Boolean(viewer?.is_admin || viewer?.is_owner);
  if (settings.maintenance && !staff) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flag" aria-hidden="true"><span /><span /><span /></span>
        <h1 className="font-display text-[24px] font-bold">{lang === "fr" ? "POLITIQUE revient très vite" : "POLITIQUE will be back shortly"}</h1>
        <p className="text-[15px] text-muted">
          {lang === "fr" ? "Le site est en maintenance pendant quelques instants. Merci de votre patience." : "The site is briefly down for maintenance. Thank you for your patience."}
        </p>
      </div>
    );
  }
  // Tell members plainly when the owner has paused something, instead of letting actions fail silently.
  const names: Record<string, [string, string]> = {
    posting: ["les publications", "posting"], interactions: ["les réactions et abonnements", "likes and follows"],
    messages: ["les messages privés", "direct messages"], interpellations: ["les interpellations", "questions to officials"],
    promises: ["les promesses", "promises"], ideas: ["la boîte à idées", "the idea box"], barometer: ["le baromètre", "the barometer"],
    media_uploads: ["l'envoi de photos et vidéos", "photo and video uploads"], verification_requests: ["les demandes de certification", "verification requests"],
  };
  const paused = viewer && !staff ? Object.keys(names).filter((k) => !settings[k as keyof typeof settings]).map((k) => names[k][lang === "fr" ? 0 : 1]) : [];
  const a = settings.announcement;
  const text = (lang === "en" && a.en) || a.fr;
  return (
    <>
      {settings.maintenance && staff && (
        <p role="status" className="bg-orange px-4 py-2 text-center text-[13px] font-semibold text-white">
          {lang === "fr" ? "Mode maintenance actif : seule l'équipe voit le site." : "Maintenance mode is on: only staff can see the site."}
        </p>
      )}
      {text && (
        <p role="status" className={`px-4 py-2 text-center text-[14px] font-medium ${a.tone === "warning" ? "bg-orange-soft text-orange" : "bg-green-soft text-green-deep"}`}>{text}</p>
      )}
      {paused.length > 0 && (
        <p role="status" className="bg-paper px-4 py-2 text-center text-[13px] text-muted">
          {lang === "fr" ? "Momentanément suspendu : " : "Temporarily paused: "}{paused.join(", ")}.
        </p>
      )}
      {viewer && <PrefsSync theme={viewer.theme} lang={viewer.lang} />}
      <Shell viewer={viewer}>{children}</Shell>
    </>
  );
}
