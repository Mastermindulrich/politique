"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { departmentById, communeById, regionById } from "@/lib/ci-geo";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: "invalid" | "handle_taken" | "no_account" | "rate" | "code" | "config" | "failed" };

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

async function confirmUrl() {
  const h = await headers();
  const origin = h.get("origin") || (h.get("host") ? `https://${h.get("host")}` : process.env.SITE_URL || "");
  return `${origin}${base}/auth/confirm`;
}

const signupSchema = z.object({
  email: z.string().email().max(200),
  display_name: z.string().trim().min(1).max(50),
  handle: z.string().regex(/^[a-z0-9_]{3,20}$/),
  lang: z.enum(["fr", "en"]),
  vote_region_id: z.number().int(),
  vote_department_id: z.number().int(),
  vote_commune_id: z.number().int().nullable(),
  vote_locality: z.string().max(100),
  is_registered_voter: z.boolean(),
});

/** Step 1 of sign-up: store the identity and the private voting place as sign-up metadata, then email a code. */
export async function requestSignupCode(input: z.infer<typeof signupSchema>): Promise<Result> {
  if (!supabaseConfigured) return { ok: false, error: "config" };
  const p = signupSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const d = p.data;
  // The three levels must agree with each other.
  const dep = departmentById.get(d.vote_department_id);
  const com = d.vote_commune_id ? communeById.get(d.vote_commune_id) : null;
  if (!regionById.has(d.vote_region_id) || !dep || dep.regionId !== d.vote_region_id) return { ok: false, error: "invalid" };
  if (d.vote_commune_id && (!com || com.departmentId !== d.vote_department_id)) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { data: free } = await supabase.rpc("handle_available", { h: d.handle });
  if (free === false) return { ok: false, error: "handle_taken" };

  const { error } = await supabase.auth.signInWithOtp({
    email: d.email.toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: await confirmUrl(),
      // Read once by the handle_new_user trigger. The voting place lands in private_profiles only.
      data: {
        handle: d.handle,
        display_name: d.display_name,
        lang: d.lang,
        vote_region_id: String(d.vote_region_id),
        vote_department_id: String(d.vote_department_id),
        vote_commune_id: d.vote_commune_id ? String(d.vote_commune_id) : "",
        vote_locality: d.vote_locality.trim(),
        is_registered_voter: d.is_registered_voter,
      },
    },
  });
  if (error) return { ok: false, error: error.status === 429 ? "rate" : "failed" };
  return { ok: true };
}

/** Log-in: email a code to an existing account. */
export async function requestLoginCode(email: string): Promise<Result> {
  if (!supabaseConfigured) return { ok: false, error: "config" };
  const p = z.string().email().max(200).safeParse(email);
  if (!p.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email: p.data.toLowerCase(), options: { shouldCreateUser: false, emailRedirectTo: await confirmUrl() } });
  if (error) {
    if (error.status === 429) return { ok: false, error: "rate" };
    if (/signups? not allowed|not found/i.test(error.message)) return { ok: false, error: "no_account" };
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

/** Exchange the emailed code for a session cookie. */
export async function verifyCode(email: string, token: string): Promise<Result> {
  if (!supabaseConfigured) return { ok: false, error: "config" };
  const code = token.replace(/\s+/g, "");
  if (!/^\d{6,8}$/.test(code)) return { ok: false, error: "code" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.toLowerCase(), token: code, type: "email" });
  if (error) return { ok: false, error: "code" };
  return { ok: true };
}
