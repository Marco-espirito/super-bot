import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { isDatabaseConfigured, query } from "@/lib/server/db";
import { assertSameOrigin } from "@/lib/server/security";

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ preferences: null, mode: "local" });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const result = await query(
    `SELECT theme, locale, default_agent AS "defaultAgent", memory_enabled AS "memoryEnabled"
     FROM user_preferences WHERE user_id = $1`,
    [user.id],
  );
  return NextResponse.json({ preferences: result.rows[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine de requête refusée." }, { status: 403 }); }
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Base de données non configurée." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await request.json().catch(() => null) as { theme?: unknown; memoryEnabled?: unknown } | null;
  const theme = typeof body?.theme === "string" && ["light", "dark", "system"].includes(body.theme) ? body.theme : null;
  const memoryEnabled = typeof body?.memoryEnabled === "boolean" ? body.memoryEnabled : null;
  if (theme === null || memoryEnabled === null) return NextResponse.json({ error: "Préférences invalides." }, { status: 400 });
  await query("UPDATE user_preferences SET theme = $2, memory_enabled = $3, updated_at = now() WHERE user_id = $1", [user.id, theme, memoryEnabled]);
  return NextResponse.json({ ok: true });
}
