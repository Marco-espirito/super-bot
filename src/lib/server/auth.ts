import "server-only";

import { cookies } from "next/headers";
import { query } from "./db";
import { createSessionToken, sha256 } from "./security";

const SESSION_COOKIE = "superbot_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = { id: string; email: string; name: string; plan: "free" | "pro" | "business" };

export async function createSession(userId: string) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [userId, sha256(token), expiresAt]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    priority: "high",
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await query<SessionUser>(
    `SELECT u.id, u.email, u.name, u.plan
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  return result.rows[0] ?? null;
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}
