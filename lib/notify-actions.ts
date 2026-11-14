"use server";

import { z } from "zod";
import { CATEGORIES } from "@/lib/notify";
import { sendTestPush } from "@/lib/push";
import { createClient, getViewer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const flags = z.object(Object.fromEntries(CATEGORIES.map((c) => [c, z.boolean().optional()])) as Record<(typeof CATEGORIES)[number], z.ZodOptional<z.ZodBoolean>>).strict();
const hour = z.number().int().min(0).max(23).nullable();
const prefsSchema = z.object({ inapp: flags, push: flags, sound: z.boolean(), previews: z.boolean(), quiet_start: hour, quiet_end: hour });

export async function updateNotificationPrefs(input: z.infer<typeof prefsSchema>): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthenticated" };
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("notification_prefs").upsert({ user_id: viewer.id, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Sends a test notification to every device this member turned push on for. */
export async function sendTestNotification(): Promise<{ ok: boolean; sent: number; configured: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, sent: 0, configured: true };
  const r = await sendTestPush(viewer.id, viewer.lang);
  return { ok: r.sent > 0, sent: r.sent, configured: r.configured };
}
