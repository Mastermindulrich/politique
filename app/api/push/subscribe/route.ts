import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Saves this browser's push subscription for the signed-in member (also called by the service worker when it renews). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: body.endpoint,
    p_p256dh: body.keys.p256dh,
    p_auth: body.keys.auth,
    p_user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (error) return NextResponse.json({ error: "refused" }, { status: 401 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.endpoint) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const supabase = await createClient();
  await supabase.rpc("delete_push_subscription", { p_endpoint: body.endpoint });
  return NextResponse.json({ ok: true });
}
