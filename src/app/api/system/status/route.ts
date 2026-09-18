import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { isDatabaseConfigured } from "@/lib/server/db";
import { isGeminiConfigured } from "@/lib/server/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = isDatabaseConfigured();
  const user = database ? await getCurrentUser().catch(() => null) : null;
  return NextResponse.json({ gemini: isGeminiConfigured(), database, authenticated: Boolean(user) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
