import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Writes a call's diagnostic timeline (lib/call-trace.ts) to the server log. Members only. */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const text = (await req.text().catch(() => "")).slice(0, 20_000);
  let body: { callId?: unknown; role?: unknown; ua?: unknown; final?: unknown; ev?: unknown } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!body || typeof body.callId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.callId) || !Array.isArray(body.ev)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  console.log(`call-trace ${body.callId.slice(0, 8)} ${String(body.role)} u=${viewer.id.slice(0, 8)} ${String(body.ua)} ${body.final ? "final" : "partial"} ${JSON.stringify(body.ev).slice(0, 15_000)}`);
  return NextResponse.json({ ok: true });
}
