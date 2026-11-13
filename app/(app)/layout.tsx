import { redirect } from "next/navigation";
import { Shell } from "../components/shell/shell";
import { getMyPrivate } from "@/lib/data/people";
import { getViewer, supabaseConfigured } from "@/lib/supabase/server";
import { t as dict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer) {
    // Every account must say where it votes before using the app.
    const priv = await getMyPrivate();
    if (!priv?.vote_region_id) redirect("/bienvenue");
  }
  if (!supabaseConfigured) {
    const t = dict("fr");
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flag" aria-hidden="true"><span /><span /><span /></span>
        <p className="text-[15px] text-muted">{t.auth.notConfigured}</p>
      </div>
    );
  }
  return <Shell viewer={viewer}>{children}</Shell>;
}
