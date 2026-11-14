import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { dispatchNotifications } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The database posts freshly inserted notification ids here (pg_net, see migration 0004). */
export async function POST(req: NextRequest) {
  const secret = process.env.PUSH_DISPATCH_SECRET || "";
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 1000) : [];
  const res = await dispatchNotifications(ids);
  return NextResponse.json(res);
}
