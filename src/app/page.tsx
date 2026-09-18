"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
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

const MAX_FILE_BYTES = 5 * 1024 * 1024;
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
  const content = canRead ? (await file.text()).slice(0, 20_000) : undefined;
  return { name: file.name, type: file.type, size: file.size, content };
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
    setFile(null);

    try {
      const preparedAttachment = attached ? await prepareAttachment(attached) : null;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          agent: selectedAgent,
          attachments: preparedAttachment ? [preparedAttachment] : [],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de contacter SuperBot.");
      setMessages((current) => [...current, {
        id: result.id,
        role: "assistant",
        content: result.content,
        agentId: result.routing.agentId,
        agentName: result.routing.agentName,
        confidence: result.routing.confidence,
      }]);
    } catch (cause) {
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
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
      setError("Ce fichier dépasse la limite de 5 Mo.");
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
    setSidebarOpen(false);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Navigation principale" aria-hidden={!sidebarOpen && undefined}>
        <div className="brand"><span className="brand-mark">S</span><span>SuperBot</span><span className="beta">BETA</span></div>
        <button className="new-chat" onClick={newChat}><span>＋</span> Nouvelle conversation <kbd>⌘ K</kbd></button>
        <nav>
          <p className="nav-title">ESPACE</p>
          <button className="nav-item active" aria-current="page"><span aria-hidden="true">◫</span> Chat <i>{messages.length ? 1 : 0}</i></button>
          <button className="nav-item" disabled title="Bientôt disponible"><span aria-hidden="true">✦</span> Mes skills <b>Bientôt</b></button>
          <button className="nav-item" disabled title="Bientôt disponible"><span aria-hidden="true">◇</span> Fichiers</button>
          <p className="nav-title second">OUTILS</p>
          <button className="nav-item" disabled title="Bientôt disponible"><span aria-hidden="true">⌁</span> Intégrations <b>Bientôt</b></button>
          <button className="nav-item" disabled title="Bientôt disponible"><span aria-hidden="true">▥</span> Utilisation</button>
        </nav>
        <div className="usage-card">
          <div><span>Messages ce mois</span><strong>12 / 50</strong></div>
          <div className="usage-track"><span /></div>
          <p>38 messages disponibles</p>
          <button disabled title="Bientôt disponible">Passer à Pro <span aria-hidden="true">↗</span></button>
        </div>
        <div className="profile">
          <span className="avatar">AM</span><div><strong>Arthur M.</strong><small>Plan gratuit</small></div><button disabled aria-label="Options du profil" title="Bientôt disponible">•••</button>
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
              <div className="conversation-heading"><p>CONVERSATION ACTIVE</p><h2>Comment puis-je t&apos;aider ?</h2></div>
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
