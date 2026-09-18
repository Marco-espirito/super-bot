"use client";

import { useEffect, useState } from "react";
import ProductShell from "@/app/components/product-shell";

type Conversation = { id: string; title: string; activeAgent: string; updatedAt: string };
type HistoryMessage = { id: string; role: "user" | "assistant"; content: string; agentId?: string };

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("Chargement…");

  useEffect(() => {
    fetch("/api/conversations", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || "Historique indisponible.");
        setConversations(body.conversations ?? []);
        setNotice(body.mode === "local" ? "Configure PostgreSQL puis connecte-toi pour synchroniser l’historique." : body.conversations?.length ? "" : "Aucune conversation enregistrée.");
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "Historique indisponible."));
  }, []);

  async function openConversation(id: string) {
    setSelected(id); setNotice("Chargement de la conversation…");
    const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { setNotice(body.error || "Conversation indisponible."); return; }
    setMessages(body.messages ?? []); setNotice("");
  }

  async function removeConversation(id: string) {
    const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setConversations((current) => current.filter((item) => item.id !== id));
    if (selected === id) { setSelected(null); setMessages([]); }
  }

  return <ProductShell eyebrow="MÉMOIRE" title="Retrouve toutes tes conversations">
    <p className="product-lead">L’historique serveur est isolé par compte. Tu peux consulter ou supprimer chaque conversation.</p>
    <div className="history-layout">
      <aside className="history-list" aria-label="Conversations">
        {conversations.map((conversation) => <article className={selected === conversation.id ? "active" : ""} key={conversation.id}>
          <button onClick={() => void openConversation(conversation.id)}><strong>{conversation.title}</strong><small>{new Date(conversation.updatedAt).toLocaleString("fr-FR")} · {conversation.activeAgent}</small></button>
          <button className="delete-action" aria-label={`Supprimer ${conversation.title}`} onClick={() => void removeConversation(conversation.id)}>×</button>
        </article>)}
        {!conversations.length && <p>{notice}</p>}
      </aside>
      <section className="history-messages" aria-live="polite">
        {messages.map((message) => <article key={message.id} className={message.role}><strong>{message.role === "user" ? "Toi" : "SuperBot"}</strong><p>{message.content}</p></article>)}
        {!messages.length && conversations.length > 0 && <p>{notice || "Sélectionne une conversation pour la relire."}</p>}
      </section>
    </div>
  </ProductShell>;
}
