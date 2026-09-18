import { NextResponse } from "next/server";
import { buildDemoResponse, getAgent, isAgentId, routeIntent, type AgentId, type AttachmentInput } from "@/lib/agents";
import { getCurrentUser, type SessionUser } from "@/lib/server/auth";
import { isDatabaseConfigured, query } from "@/lib/server/db";
import { createEmbedding, streamGeminiResponse, type ModelMessage } from "@/lib/server/gemini";
import { log } from "@/lib/server/logger";
import { consumeChatQuota } from "@/lib/server/rate-limit";
import { assertSameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";

type ChatBody = { message?: string; agent?: AgentId | "auto"; conversationId?: string; attachments?: AttachmentInput[] };
const MAX_REQUEST_BYTES = 100_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 20_000;

function isAttachment(value: unknown): value is AttachmentInput {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.name === "string" && item.name.length > 0 && item.name.length <= 180
    && typeof item.type === "string" && item.type.length <= 120
    && typeof item.size === "number" && Number.isFinite(item.size) && item.size >= 0 && item.size <= MAX_FILE_BYTES
    && (item.content === undefined || (typeof item.content === "string" && item.content.length <= MAX_CONTENT_LENGTH));
}

async function getOrCreateConversation(user: SessionUser, requestedId: string | undefined, message: string) {
  if (requestedId) {
    const existing = await query<{ id: string }>("SELECT id FROM conversations WHERE id = $1 AND user_id = $2", [requestedId, user.id]);
    if (existing.rows[0]) return requestedId;
  }
  const title = message.replace(/\s+/g, " ").slice(0, 72) || "Nouvelle conversation";
  const created = await query<{ id: string }>("INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id", [user.id, title]);
  return created.rows[0].id;
}

async function loadHistory(conversationId: string | null): Promise<ModelMessage[]> {
  if (!conversationId) return [];
  const result = await query<{ role: "user" | "assistant"; content: string }>(
    "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 16",
    [conversationId],
  );
  return result.rows.reverse();
}

async function loadRelevantMemory(user: SessionUser | null, message: string) {
  if (!user || !isDatabaseConfigured()) return [];
  try {
    const embedding = await createEmbedding(message);
    if (!embedding) return [];
    const result = await query<{ content: string }>(
      `SELECT content FROM memories WHERE user_id = $1 AND embedding IS NOT NULL
       ORDER BY embedding <=> $2::vector LIMIT 5`,
      [user.id, `[${embedding.join(",")}]`],
    );
    return result.rows.map((row) => row.content);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine de requête refusée." }, { status: 403 }); }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) return NextResponse.json({ error: "La requête dépasse la limite autorisée." }, { status: 413 });

  const body = await request.json().catch(() => null) as ChatBody | null;
  if (!body) return NextResponse.json({ error: "Le corps de la requête est invalide." }, { status: 400 });
  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "Écris un message avant de l’envoyer." }, { status: 400 });
  if (message.length > 8_000) return NextResponse.json({ error: "Le message dépasse la limite de 8 000 caractères." }, { status: 413 });
  if (body?.agent !== undefined && body.agent !== "auto" && !isAgentId(body.agent)) return NextResponse.json({ error: "L’agent demandé n’existe pas." }, { status: 400 });
  if (body?.attachments !== undefined && (!Array.isArray(body.attachments) || body.attachments.length > 3 || !body.attachments.every(isAttachment))) {
    return NextResponse.json({ error: "La pièce jointe est invalide ou trop volumineuse." }, { status: 400 });
  }

  const attachments = body.attachments ?? [];
  const automaticRouting = routeIntent(`${message} ${attachments.map((item) => item.name).join(" ")}`);
  const isManual = body.agent !== undefined && body.agent !== "auto";
  const agentId: AgentId = isManual ? body.agent as AgentId : automaticRouting.agent.id;
  const selectedAgent = getAgent(agentId);
  const user = isDatabaseConfigured() ? await getCurrentUser() : null;
  const quota = await consumeChatQuota(request, user);
  if (!quota.allowed) return NextResponse.json({ error: "Quota atteint. Réessaie plus tard ou change de plan.", remaining: 0 }, { status: 429 });

  let conversationId: string | null = null;
  let history: ModelMessage[] = [];
  let memoryEnabled = false;
  if (user) {
    conversationId = await getOrCreateConversation(user, body.conversationId, message);
    history = await loadHistory(conversationId);
    await query("INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)", [conversationId, message]);
    const preferences = await query<{ memory_enabled: boolean }>("SELECT memory_enabled FROM user_preferences WHERE user_id = $1", [user.id]);
    memoryEnabled = preferences.rows[0]?.memory_enabled ?? false;
  }
  const memory = await loadRelevantMemory(user, message);
  const responseId = crypto.randomUUID();
  const encoder = new TextEncoder();
  const encodeEvent = (event: unknown) => encoder.encode(`${JSON.stringify(event)}\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encodeEvent({
        type: "meta", id: responseId, conversationId, remaining: quota.remaining,
        routing: {
          agentId, agentName: selectedAgent.name,
          confidence: isManual ? 1 : automaticRouting.confidence,
          reasons: isManual ? ["sélection manuelle"] : automaticRouting.reasons,
          mode: isManual ? "manual" : "automatic",
        },
      }));

      let fullContent = "";
      try {
        const geminiStream = await streamGeminiResponse({ message, agentId, attachments, history, memory });
        if (geminiStream) {
          for await (const chunk of geminiStream) {
            const delta = chunk.text ?? "";
            if (!delta) continue;
            fullContent += delta;
            controller.enqueue(encodeEvent({ type: "delta", delta }));
          }
        } else {
          const fallback = buildDemoResponse(message, agentId, attachments);
          for (const delta of fallback.match(/[\s\S]{1,48}(?:\s|$)/g) ?? [fallback]) {
            fullContent += delta;
            controller.enqueue(encodeEvent({ type: "delta", delta }));
          }
        }

        if (conversationId && fullContent) {
          await query("INSERT INTO messages (conversation_id, role, content, agent_id) VALUES ($1, 'assistant', $2, $3)", [conversationId, fullContent, agentId]);
          await query("UPDATE conversations SET updated_at = now(), active_agent = $2 WHERE id = $1", [conversationId, agentId]);
        }
        if (user && memoryEnabled && /\b(souviens-toi|retiens que|m[ée]morise)\b/i.test(message)) {
          const embedding = await createEmbedding(message);
          if (embedding) {
            await query(
              "INSERT INTO memories (user_id, source_type, source_id, content, embedding) VALUES ($1, 'message', $2, $3, $4::vector)",
              [user.id, conversationId, message.slice(0, 4_000), `[${embedding.join(",")}]`],
            );
          }
        }
        controller.enqueue(encodeEvent({ type: "done", content: fullContent }));
      } catch (error) {
        log("error", "chat_generation_failed", { responseId, agentId, error: error instanceof Error ? error.message : "unknown" });
        controller.enqueue(encodeEvent({ type: "error", error: "Le modèle IA est momentanément indisponible." }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": responseId,
    },
  });
}
