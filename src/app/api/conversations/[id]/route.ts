import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { isDatabaseConfigured, query } from "@/lib/server/db";
import { assertSameOrigin } from "@/lib/server/security";

type ConversationContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: ConversationContext) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Base de données non configurée." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await context.params;
  const conversation = await query("SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!conversation.rowCount) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  const messages = await query(
    `SELECT id, role, content, agent_id AS "agentId", created_at AS "createdAt"
     FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200`,
    [id],
  );
  return NextResponse.json({ conversation: conversation.rows[0], messages: messages.rows });
}

export async function DELETE(request: Request, context: ConversationContext) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine de requête refusée." }, { status: 403 }); }
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Base de données non configurée." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await context.params;
  await query("DELETE FROM conversations WHERE id = $1 AND user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
