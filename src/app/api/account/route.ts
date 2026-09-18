import { NextResponse } from "next/server";
import { deleteCurrentSession, getCurrentUser } from "@/lib/server/auth";
import { isDatabaseConfigured, query } from "@/lib/server/db";
import { assertSameOrigin } from "@/lib/server/security";

export async function DELETE(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine de requête refusée." }, { status: 403 }); }
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Base de données non configurée." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== "SUPPRIMER") return NextResponse.json({ error: "Confirmation invalide." }, { status: 400 });
  await query("DELETE FROM users WHERE id = $1", [user.id]);
  await deleteCurrentSession();
  return NextResponse.json({ ok: true });
}
