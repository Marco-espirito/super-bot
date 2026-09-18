import "server-only";

import { isDatabaseConfigured, transaction } from "./db";
import { sha256 } from "./security";
import type { SessionUser } from "./auth";

type Bucket = { minute: number[]; day: number[] };
const memoryBuckets = new Map<string, Bucket>();

function actorFor(request: Request, user: SessionUser | null) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const actor = user?.id ?? forwarded ?? "local";
  return sha256(`${process.env.RATE_LIMIT_SALT ?? "dev-only-salt"}:${actor}`);
}

export async function consumeChatQuota(request: Request, user: SessionUser | null) {
  const actorHash = actorFor(request, user);
  const minuteLimit = user?.plan === "business" ? 120 : user?.plan === "pro" ? 60 : 15;
  const dailyLimit = user?.plan === "business" ? 5_000 : user?.plan === "pro" ? 1_000 : Number(process.env.FREE_DAILY_MESSAGES ?? 50);

  if (isDatabaseConfigured()) {
    return transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [actorHash]);
      const counts = await client.query<{ minute_count: string; day_count: string }>(
        `SELECT
          count(*) FILTER (WHERE created_at > now() - interval '1 minute') AS minute_count,
          count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS day_count
         FROM usage_events WHERE actor_hash = $1 AND event_type = 'chat'`,
        [actorHash],
      );
      const minuteCount = Number(counts.rows[0]?.minute_count ?? 0);
      const dayCount = Number(counts.rows[0]?.day_count ?? 0);
      if (minuteCount >= minuteLimit || dayCount >= dailyLimit) return { allowed: false, remaining: Math.max(0, dailyLimit - dayCount), actorHash };
      await client.query("INSERT INTO usage_events (user_id, actor_hash, event_type) VALUES ($1, $2, 'chat')", [user?.id ?? null, actorHash]);
      return { allowed: true, remaining: Math.max(0, dailyLimit - dayCount - 1), actorHash };
    });
  }

  const now = Date.now();
  const bucket = memoryBuckets.get(actorHash) ?? { minute: [], day: [] };
  bucket.minute = bucket.minute.filter((timestamp) => timestamp > now - 60_000);
  bucket.day = bucket.day.filter((timestamp) => timestamp > now - 86_400_000);
  if (bucket.minute.length >= minuteLimit || bucket.day.length >= dailyLimit) return { allowed: false, remaining: Math.max(0, dailyLimit - bucket.day.length), actorHash };
  bucket.minute.push(now);
  bucket.day.push(now);
  memoryBuckets.set(actorHash, bucket);
  return { allowed: true, remaining: dailyLimit - bucket.day.length, actorHash };
}
