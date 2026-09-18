import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { isDatabaseConfigured } from "@/lib/server/db";

export async function GET() {
  const user = isDatabaseConfigured() ? await getCurrentUser() : null;
  return NextResponse.json({ user, databaseConfigured: isDatabaseConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
