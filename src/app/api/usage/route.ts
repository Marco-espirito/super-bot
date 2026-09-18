import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { isDatabaseConfigured, query } from "@/lib/server/db";

export const dynamic = "force-dynamic";

function limitFor(plan: string) {
  if (plan === "business") return 5_000;
  if (plan === "pro") return 1_000;
  return Number(process.env.FREE_DAILY_MESSAGES ?? 50);
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    const limit = limitFor("invité");
    return NextResponse.json({ used: 0, limit, remaining: limit, plan: "invité" }, { headers: { "Cache-Control": "no-store" } });
  }

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    const limit = limitFor("invité");
    return NextResponse.json({ used: 0, limit, remaining: limit, plan: "invité" }, { headers: { "Cache-Control": "no-store" } });
  }

  const result = await query<{ count: string }>(
    "SELECT count(*) FROM usage_events WHERE user_id = $1 AND event_type = 'chat' AND created_at > now() - interval '24 hours'",
    [user.id],
  );
  const used = Number(result.rows[0]?.count ?? 0);
  const limit = limitFor(user.plan);
  return NextResponse.json({ used, limit, remaining: Math.max(0, limit - used), plan: user.plan }, {
    headers: { "Cache-Control": "no-store" },
  });
}
