import { NextResponse } from "next/server";
import { createSession } from "@/lib/server/auth";
import { isDatabaseConfigured, query } from "@/lib/server/db";
import { assertSameOrigin, normalizeEmail, verifyPassword } from "@/lib/server/security";

type UserRow = { id: string; email: string; name: string; plan: string; password_hash: string };

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine de requête refusée." }, { status: 403 }); }
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "La base de données n’est pas encore configurée." }, { status: 503 });

  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const result = await query<UserRow>("SELECT id, email, name, plan, password_hash FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
}
