"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { agents, type AgentId, type AttachmentInput } from "@/lib/agents";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId?: AgentId;
  agentName?: string;
  confidence?: number;
  attachment?: string;
};

const starters = [
  { icon: "↗", label: "Optimiser mon CV", text: "Analyse mon CV pour un poste de Data Analyst et donne-moi les améliorations prioritaires.", tone: "orange" },
  { icon: "⌁", label: "Explorer mes données", text: "Analyse ce fichier CSV, détecte les anomalies et résume les tendances importantes.", tone: "green" },
  { icon: "⌘", label: "Débloquer mon code", text: "Aide-moi à diagnostiquer une erreur dans mon projet React et propose un correctif testé.", tone: "blue" },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 8_000;
const TEXT_EXTENSIONS = [".csv", ".txt", ".md", ".json"];

function isStoredMessages(value: unknown): value is Message[] {
  return Array.isArray(value) && value.every((message) => message
    && typeof message === "object"
    && typeof message.id === "string"
    && (message.role === "user" || message.role === "assistant")
    && typeof message.content === "string");
}

async function prepareAttachment(file: File): Promise<AttachmentInput> {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const canRead = file.type.startsWith("text/") || TEXT_EXTENSIONS.includes(extension);
  if (canRead) return { name: file.name, type: file.type, size: file.size, content: (await file.text()).slice(0, 20_000) };

  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/files/extract", { method: "POST", body: formData });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Impossible d’extraire ce document.");
  return { name: result.document.name, type: result.document.mimeType, size: result.document.size, content: result.document.text.slice(0, 20_000) };
}

function Markup({ children }: { children: string }) {
  const parts = children.split(/(\*\*.*?\*\*|_.*?_)/g);
  return <>{parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("_") && part.endsWith("_")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part.split("\n").map((line, lineIndex) => <span key={`${index}-${lineIndex}`}>{line}{lineIndex < part.split("\n").length - 1 && <br />}</span>);
  })}</>;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentId | "auto">("auto");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; plan: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("superbot-conversation");
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (isStoredMessages(parsed)) setMessages(parsed.slice(-100));
        else localStorage.removeItem("superbot-conversation");
      } catch { localStorage.removeItem("superbot-conversation"); }
    }
    setConversationId(localStorage.getItem("superbot-conversation-id"));
    fetch("/api/auth/me").then((response) => response.json()).then((result) => setCurrentUser(result.user ?? null)).catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      if (messages.length) localStorage.setItem("superbot-conversation", JSON.stringify(messages.slice(-100)));
    } catch { setError("La conversation est trop volumineuse pour être enregistrée localement."); }
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        composerInput.current?.focus();
      }
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  async function sendMessage(value?: string) {
    const text = (value ?? input).trim();
    if (!text || loading) return;
    setError("");
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, attachment: file?.name };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    const attached = file;
    let pendingAssistantId: string | null = null;
    setFile(null);

    try {
      const preparedAttachment = attached ? await prepareAttachment(attached) : null;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          agent: selectedAgent,
          conversationId,
          attachments: preparedAttachment ? [preparedAttachment] : [],
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Impossible de contacter SuperBot.");
      }
      if (!response.body) throw new Error("Le navigateur ne prend pas en charge le streaming.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantId = crypto.randomUUID();
      while (true) {
        const { done, value: chunk } = await reader.read();
        buffer += decoder.decode(chunk ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "meta") {
            assistantId = event.id;
            pendingAssistantId = assistantId;
            if (event.conversationId) {
              setConversationId(event.conversationId);
              localStorage.setItem("superbot-conversation-id", event.conversationId);
            }
            setMessages((current) => [...current, {
              id: assistantId, role: "assistant", content: "",
              agentId: event.routing.agentId, agentName: event.routing.agentName, confidence: event.routing.confidence,
            }]);
          } else if (event.type === "delta") {
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + event.delta } : item));
          } else if (event.type === "error") {
            throw new Error(event.error || "La génération a échoué.");
          }
        }
        if (done) break;
      }
    } catch (cause) {
      setMessages((current) => current.filter((message) => message.id !== userMessage.id && message.id !== pendingAssistantId));
      setInput(text);
      setFile(attached);
      setError(cause instanceof Error ? cause.message : "Une erreur inattendue est survenue.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selected) return;
    if (selected.size > MAX_FILE_BYTES) {
      setError("Ce fichier dépasse la limite de 10 Mo.");
      return;
    }
    setError("");
    setFile(selected);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function newChat() {
    setMessages([]);
    setInput("");
    setFile(null);
    localStorage.removeItem("superbot-conversation");
    localStorage.removeItem("superbot-conversation-id");
    setConversationId(null);
    setSidebarOpen(false);
  }

  function exportMarkdown() {
    const markdown = messages.map((message) => `## ${message.role === "user" ? "Utilisateur" : message.agentName || "SuperBot"}\n\n${message.content}`).join("\n\n---\n\n");
    const url = URL.createObjectURL(new Blob([`# Conversation SuperBot\n\n${markdown}\n`], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `superbot-${new Date().toISOString().slice(0, 10)}.md`; link.click(); URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const printable = window.open("", "_blank", "width=900,height=700");
    if (!printable) { setError("Autorise les fenêtres contextuelles pour exporter en PDF."); return; }
    printable.opener = null;
    printable.document.title = "Conversation SuperBot";
    const style = printable.document.createElement("style"); style.textContent = "body{max-width:760px;margin:40px auto;font:14px/1.65 system-ui;color:#24212c}h1{color:#7147ed}article{margin:24px 0;padding:16px;border:1px solid #ddd;border-radius:10px}h2{font-size:12px;text-transform:uppercase;color:#7147ed}p{white-space:pre-wrap}"; printable.document.head.append(style);
    const heading = printable.document.createElement("h1"); heading.textContent = "Conversation SuperBot"; printable.document.body.append(heading);
    for (const message of messages) {
      const article = printable.document.createElement("article"); const title = printable.document.createElement("h2"); const content = printable.document.createElement("p");
      title.textContent = message.role === "user" ? "Utilisateur" : message.agentName || "SuperBot"; content.textContent = message.content; article.append(title, content); printable.document.body.append(article);
    }
    printable.focus(); window.setTimeout(() => printable.print(), 150);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Navigation principale" aria-hidden={!sidebarOpen && undefined}>
        <div className="brand"><span className="brand-mark">S</span><span>SuperBot</span><span className="beta">BETA</span></div>
        <button className="new-chat" onClick={newChat}><span>＋</span> Nouvelle conversation <kbd>⌘ K</kbd></button>
        <nav>
          <p className="nav-title">ESPACE</p>
          <button className="nav-item active" aria-current="page"><span aria-hidden="true">◫</span> Chat <i>{messages.length ? 1 : 0}</i></button>
          <Link className="nav-item" href="/history"><span aria-hidden="true">◷</span> Historique</Link>
          <Link className="nav-item" href="/skills"><span aria-hidden="true">✦</span> Mes skills</Link>
          <Link className="nav-item" href="/files"><span aria-hidden="true">◇</span> Fichiers</Link>
          <p className="nav-title second">OUTILS</p>
          <Link className="nav-item" href="/integrations"><span aria-hidden="true">⌁</span> Intégrations</Link>
          <Link className="nav-item" href="/usage"><span aria-hidden="true">▥</span> Utilisation</Link>
        </nav>
        <div className="usage-card">
          <div><span>Messages ce mois</span><strong>12 / 50</strong></div>
          <div className="usage-track"><span /></div>
          <p>38 messages disponibles</p>
          <button disabled title="Bientôt disponible">Passer à Pro <span aria-hidden="true">↗</span></button>
        </div>
        <div className="profile">
          <span className="avatar">{currentUser?.name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AM"}</span><div><strong>{currentUser?.name || "Arthur M."}</strong><small>{currentUser ? `Plan ${currentUser.plan}` : "Mode invité"}</small></div><Link href={currentUser ? "/settings" : "/auth"} aria-label={currentUser ? "Paramètres du profil" : "Se connecter"}>•••</Link>
        </div>
      </aside>
      {sidebarOpen && <button aria-label="Fermer le menu" className="backdrop" onClick={() => setSidebarOpen(false)} />}

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Ouvrir le menu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="status"><span className="status-orb">✦</span><div><strong>SuperBot</strong><small><i /> Tous les systèmes opérationnels</small></div></div>
          <div className="top-actions"><button aria-label="Rechercher" title="Rechercher" onClick={() => composerInput.current?.focus()}>⌕</button><button aria-label="Notifications" title="Bientôt disponible" disabled>♢</button><button className="help" aria-label="Aide" title="Raccourci : Ctrl ou Cmd + K" onClick={() => composerInput.current?.focus()}>?</button></div>
        </header>

        <div className={`chat-area ${messages.length ? "has-messages" : ""}`}>
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="hero-orbit"><span className="spark one">✦</span><span className="spark two">✦</span><div>✦</div></div>
              <p className="eyebrow">UN SEUL ASSISTANT. TOUTES LES COMPÉTENCES.</p>
              <h1>Bonjour Arthur, <span>prêt à créer ?</span></h1>
              <p className="subtitle">Décris simplement ton objectif. SuperBot sélectionne automatiquement<br />le meilleur agent pour accomplir ta mission.</p>
              <div className="starter-grid">
                {starters.map((starter) => (
                  <button key={starter.label} className={`starter ${starter.tone}`} onClick={() => void sendMessage(starter.text)}>
                    <span>{starter.icon}</span><div><strong>{starter.label}</strong><small>{starter.text.split(" et ")[0]}</small></div><b>→</b>
                  </button>
                ))}
              </div>
              <div className="skills-row"><span>SKILLS ACTIFS</span>{agents.map((agent) => <div key={agent.id}><i style={{ background: agent.color }} />{agent.label}</div>)}</div>
            </div>
          ) : (
            <div className="messages">
              <div className="conversation-heading"><div><p>CONVERSATION ACTIVE</p><h2>Comment puis-je t&apos;aider ?</h2></div><div className="export-actions"><button onClick={exportMarkdown}>Markdown</button><button onClick={exportPdf}>PDF</button></div></div>
              {messages.map((message) => {
                const agent = agents.find((item) => item.id === message.agentId);
                return <article className={`message ${message.role}`} key={message.id}>
                  <div className="message-avatar">{message.role === "user" ? "AM" : agent?.icon ?? "✦"}</div>
                  <div className="message-body">
                    <div className="message-meta"><strong>{message.role === "user" ? "Vous" : message.agentName}</strong>{message.confidence && <span>{Math.round(message.confidence * 100)}% de confiance</span>}</div>
                    {message.attachment && <div className="attachment">◇ <span>{message.attachment}</span></div>}
                    <p><Markup>{message.content}</Markup></p>
                  </div>
                </article>;
              })}
              {loading && <article className="message assistant" role="status" aria-live="polite"><div className="message-avatar">✦</div><div className="message-body"><div className="message-meta"><strong>SuperBot analyse</strong></div><div className="typing" aria-label="Réponse en cours"><i /><i /><i /></div></div></article>}
              <div ref={bottom} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && <div className="error-banner" role="alert">{error}<button aria-label="Fermer l’erreur" onClick={() => setError("")}>×</button></div>}
          {file && <div className="file-chip"><span aria-hidden="true">◇</span><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} Ko</small></div><button aria-label={`Retirer ${file.name}`} onClick={() => setFile(null)}>×</button></div>}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea ref={composerInput} aria-label="Message" value={input} maxLength={MAX_MESSAGE_LENGTH} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Demande quelque chose à SuperBot…" rows={1} />
            <div className="composer-bottom">
              <div>
                <input ref={fileInput} type="file" hidden accept=".pdf,.doc,.docx,.csv,.xlsx,.txt,.md,.json" onChange={handleFileChange} />
                <button type="button" className="attach" onClick={() => fileInput.current?.click()}>＋ <span>Ajouter un fichier</span></button>
                <label className="agent-select"><span>✦</span><select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value as AgentId | "auto")}><option value="auto">Auto-routing</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}</select></label>
              </div>
              <div className="send-zone"><span className={input.length > 7_200 ? "limit-warning" : ""}>{input.length}/{MAX_MESSAGE_LENGTH}</span><button className="send" aria-label="Envoyer le message" type="submit" disabled={!input.trim() || loading}>↑</button></div>
            </div>
          </form>
          <p className="disclaimer">SuperBot peut faire des erreurs. Vérifie les informations importantes.</p>
        </div>
      </section>
    </main>
  );
}
