import { NextResponse } from "next/server";
import { buildDemoResponse, getAgent, isAgentId, routeIntent, type AgentId, type AttachmentInput } from "@/lib/agents";

type ChatBody = {
  message?: string;
  agent?: AgentId | "auto";
  attachments?: AttachmentInput[];
};

const MAX_REQUEST_BYTES = 100_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 20_000;

function isAttachment(value: unknown): value is AttachmentInput {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.name === "string" && item.name.length > 0 && item.name.length <= 180
    && typeof item.type === "string" && item.type.length <= 120
    && typeof item.size === "number" && Number.isFinite(item.size) && item.size >= 0 && item.size <= MAX_FILE_BYTES
    && (item.content === undefined || (typeof item.content === "string" && item.content.length <= MAX_CONTENT_LENGTH));
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "La requête dépasse la limite autorisée." }, { status: 413 });
  }

  let body: ChatBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Le corps de la requête doit être un JSON valide." }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Écris un message avant de l’envoyer." }, { status: 400 });
  }
  if (message.length > 8_000) {
    return NextResponse.json({ error: "Le message dépasse la limite de 8 000 caractères." }, { status: 413 });
  }
  if (body.agent !== undefined && body.agent !== "auto" && !isAgentId(body.agent)) {
    return NextResponse.json({ error: "L’agent demandé n’existe pas." }, { status: 400 });
  }
  if (body.attachments !== undefined && (!Array.isArray(body.attachments) || body.attachments.length > 3 || !body.attachments.every(isAttachment))) {
    return NextResponse.json({ error: "La pièce jointe est invalide ou trop volumineuse." }, { status: 400 });
  }

  const automaticRouting = routeIntent(`${message} ${(body.attachments ?? []).map((item) => item.name).join(" ")}`);
  const isManual = body.agent !== undefined && body.agent !== "auto";
  const agentId: AgentId = isManual ? body.agent as AgentId : automaticRouting.agent.id;
  const selectedAgent = getAgent(agentId);

  return NextResponse.json({
    id: crypto.randomUUID(),
    content: buildDemoResponse(message, agentId, body.attachments ?? []),
    routing: {
      agentId,
      agentName: selectedAgent.name,
      confidence: isManual ? 1 : automaticRouting.confidence,
      reasons: isManual ? ["sélection manuelle"] : automaticRouting.reasons,
      mode: isManual ? "manual" : "automatic",
    },
    createdAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
