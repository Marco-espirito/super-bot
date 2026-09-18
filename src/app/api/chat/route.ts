import { NextResponse } from "next/server";
import { buildDemoResponse, routeIntent, type AgentId } from "@/lib/agents";

type ChatBody = {
  message?: string;
  agent?: AgentId | "auto";
  attachments?: { name: string; type: string; size: number }[];
};

export async function POST(request: Request) {
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

  const routing = routeIntent(message);
  const selected = body.agent && body.agent !== "auto"
    ? { ...routing, agent: { ...routing.agent, id: body.agent } }
    : routing;
  const agentId = selected.agent.id as AgentId;

  return NextResponse.json({
    id: crypto.randomUUID(),
    content: buildDemoResponse(message, agentId, Boolean(body.attachments?.length)),
    routing: {
      agentId,
      agentName: routing.agent.id === agentId
        ? routing.agent.name
        : agentId.charAt(0).toUpperCase() + agentId.slice(1),
      confidence: routing.confidence,
      reasons: routing.reasons,
    },
    createdAt: new Date().toISOString(),
  });
}
