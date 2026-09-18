import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { isDatabaseConfigured, query } from "@/lib/server/db";
import { assertSameOrigin } from "@/lib/server/security";

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ conversations: [], mode: "local" });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const result = await query(
    `SELECT id, title, active_agent AS "activeAgent", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`,
    [user.id],
  );
  return NextResponse.json({ conversations: result.rows });
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine de requête refusée." }, { status: 403 }); }
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Base de données non configurée." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { title?: unknown };
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) || "Nouvelle conversation" : "Nouvelle conversation";
  const result = await query(
    `INSERT INTO conversations (user_id, title) VALUES ($1, $2)
     RETURNING id, title, active_agent AS "activeAgent", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [user.id, title],
  );
  return NextResponse.json({ conversation: result.rows[0] }, { status: 201 });
}
