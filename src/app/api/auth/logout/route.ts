import { NextResponse } from "next/server";
import { deleteCurrentSession } from "@/lib/server/auth";
import { isDatabaseConfigured } from "@/lib/server/db";
import { assertSameOrigin } from "@/lib/server/security";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine de requête refusée." }, { status: 403 }); }
  if (isDatabaseConfigured()) await deleteCurrentSession();
  return NextResponse.json({ ok: true });
}
