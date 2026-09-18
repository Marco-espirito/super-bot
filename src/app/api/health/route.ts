import { NextResponse } from "next/server";
import { isDatabaseConfigured, query } from "@/lib/server/db";
import { isGeminiConfigured } from "@/lib/server/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  let database: "unconfigured" | "up" | "down" = isDatabaseConfigured() ? "down" : "unconfigured";
  if (isDatabaseConfigured()) {
    try { await query("SELECT 1"); database = "up"; } catch { database = "down"; }
  }
  const healthy = database !== "down";
  return NextResponse.json({ status: healthy ? "ok" : "degraded", database, gemini: isGeminiConfigured() ? "configured" : "unconfigured" }, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
