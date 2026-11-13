import { cache } from "react";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

/** Site-wide switches the owner controls from the control center. */
export const FEATURES = ["signups_open", "posting", "interactions", "messages", "interpellations", "promises", "ideas", "barometer", "media_uploads", "verification_requests"] as const;
export type Feature = (typeof FEATURES)[number];

export type Announcement = { fr: string; en: string; tone: "info" | "warning" };
export type SiteSettings = Record<Feature, boolean> & { maintenance: boolean; announcement: Announcement };

const DEFAULTS: SiteSettings = {
  signups_open: true, posting: true, interactions: true, messages: true, interpellations: true, promises: true,
  ideas: true, barometer: true, media_uploads: true, verification_requests: true, maintenance: false,
  announcement: { fr: "", en: "", tone: "info" },
};

/** Read once per request. Missing rows fall back to "on", so a fresh database behaves normally. */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  if (!supabaseConfigured) return DEFAULTS;
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("key, value");
  const out: SiteSettings = { ...DEFAULTS, announcement: { ...DEFAULTS.announcement } };
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    if (row.key === "announcement" && row.value && typeof row.value === "object") {
      const a = row.value as Partial<Announcement>;
      out.announcement = { fr: a.fr ?? "", en: a.en ?? "", tone: a.tone === "warning" ? "warning" : "info" };
    } else if (row.key in out && typeof row.value === "boolean") {
      (out as Record<string, unknown>)[row.key] = row.value;
    }
  }
  return out;
});

/** Whether a feature is usable by this viewer: staff keep everything, like the database rules. */
export function allowed(s: SiteSettings, f: Feature, staff: boolean) {
  return staff || (s[f] && !s.maintenance);
}
