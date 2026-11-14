import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createPublicClient, supabaseConfigured } from "@/lib/supabase/server";

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

export const SETTINGS_TAG = "site-settings";

/**
 * The switches are the same for everyone, so they are kept in the server cache instead of
 * being read from the database on every page. The owner's actions clear the cache at once
 * (revalidateTag); the 30 seconds only cover a change made straight in the database.
 * Missing rows fall back to "on", so a fresh database behaves normally.
 */
const readSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const { data } = await createPublicClient().from("site_settings").select("key, value");
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
  },
  ["site-settings"],
  { revalidate: 30, tags: [SETTINGS_TAG] },
);

export const getSettings = cache(async (): Promise<SiteSettings> => (supabaseConfigured ? readSettings() : DEFAULTS));

/** Whether a feature is usable by this viewer: staff keep everything, like the database rules. */
export function allowed(s: SiteSettings, f: Feature, staff: boolean) {
  return staff || (s[f] && !s.maintenance);
}
