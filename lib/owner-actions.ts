"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FEATURES } from "@/lib/settings";
import { createClient, getViewer } from "@/lib/supabase/server";

// Control center actions. The database re-checks every permission (owner_set_setting,
// owner_set_role, mod_suspend…), so these checks only give a clean error early.

type Result = { ok: true } | { ok: false; error: string };

async function staff(owner = false) {
  const v = await getViewer();
  if (!v || (owner ? !v.is_owner : !(v.is_owner || v.is_admin))) return null;
  return v;
}

const done = (error: { message: string } | null): Result => {
  if (error) return { ok: false, error: /forbidden/.test(error.message) ? "forbidden" : "failed" };
  revalidatePath("/", "layout");
  return { ok: true };
};

const settingKey = z.enum([...FEATURES, "maintenance"]);

export async function setSwitch(key: string, on: boolean): Promise<Result> {
  if (!(await staff(true))) return { ok: false, error: "forbidden" };
  const k = settingKey.safeParse(key);
  if (!k.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_set_setting", { k: k.data, v: on });
  return done(error);
}

const announcementSchema = z.object({ fr: z.string().trim().max(280), en: z.string().trim().max(280), tone: z.enum(["info", "warning"]) });

export async function setAnnouncement(input: z.infer<typeof announcementSchema>): Promise<Result> {
  if (!(await staff(true))) return { ok: false, error: "forbidden" };
  const a = announcementSchema.safeParse(input);
  if (!a.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_set_setting", { k: "announcement", v: a.data });
  return done(error);
}

export async function setRole(userId: string, role: "member" | "moderator" | "admin"): Promise<Result> {
  if (!(await staff(true))) return { ok: false, error: "forbidden" };
  if (!z.string().uuid().safeParse(userId).success || !["member", "moderator", "admin"].includes(role)) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_set_role", { uid: userId, role });
  return done(error);
}

export async function setBadge(userId: string, on: boolean): Promise<Result> {
  if (!(await staff())) return { ok: false, error: "forbidden" };
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_badge", { uid: userId, on_off: on });
  return done(error);
}

/** days: a number of days, "ban" for a permanent ban, or null to lift any sanction. */
export async function sanction(userId: string, days: number | "ban" | null, reason?: string): Promise<Result> {
  if (!(await staff())) return { ok: false, error: "forbidden" };
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, error: "invalid" };
  if (typeof days === "number" && !(Number.isInteger(days) && days >= 1 && days <= 365)) return { ok: false, error: "invalid" };
  const until = days === null ? null : days === "ban" ? new Date(Date.now() + 100 * 365 * 864e5).toISOString() : new Date(Date.now() + days * 864e5).toISOString();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_suspend", { uid: userId, until, why: reason?.slice(0, 300) || null });
  return done(error);
}

export async function removeMember(userId: string, confirmHandle: string): Promise<Result> {
  if (!(await staff(true))) return { ok: false, error: "forbidden" };
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("handle").eq("id", userId).maybeSingle();
  if (!data || data.handle !== confirmHandle.trim().replace(/^@/, "").toLowerCase()) return { ok: false, error: "confirm" };
  const { error } = await supabase.rpc("owner_remove_member", { uid: userId });
  return done(error);
}
