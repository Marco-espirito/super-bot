import { NextResponse } from "next/server";
import { createSession } from "@/lib/server/auth";
import { isDatabaseConfigured, query, transaction } from "@/lib/server/db";
import { assertSameOrigin, hashPassword, isValidEmail, normalizeEmail } from "@/lib/server/security";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine de requête refusée." }, { status: 403 }); }
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "La base de données n’est pas encore configurée." }, { status: 503 });

  const body = await request.json().catch(() => null) as { name?: unknown; email?: unknown; password?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (name.length < 2 || !isValidEmail(email) || password.length < 10 || password.length > 128) {
    return NextResponse.json({ error: "Nom, e-mail ou mot de passe invalide (10 caractères minimum)." }, { status: 400 });
  }

  const exists = await query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (exists.rowCount) return NextResponse.json({ error: "Un compte existe déjà avec cet e-mail." }, { status: 409 });

  const passwordHash = await hashPassword(password);
  let user: { id: string; email: string; name: string; plan: string };
  try {
    user = await transaction(async (client) => {
      const result = await client.query<{ id: string; email: string; name: string; plan: string }>(
        "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, plan",
        [email, name, passwordHash],
      );
      await client.query("INSERT INTO user_preferences (user_id) VALUES ($1)", [result.rows[0].id]);
      return result.rows[0];
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Un compte existe déjà avec cet e-mail." }, { status: 409 });
    }
    throw error;
  }
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, plan: user.plan } }, { status: 201 });
}
