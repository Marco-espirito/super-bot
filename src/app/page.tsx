"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { agents, type AgentId } from "@/lib/agents";

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

  useEffect(() => {
    const saved = localStorage.getItem("superbot-conversation");
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch { localStorage.removeItem("superbot-conversation"); }
    }
  }, []);

  useEffect(() => {
    if (messages.length) localStorage.setItem("superbot-conversation", JSON.stringify(messages));
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          agent: selectedAgent,
          attachments: attached ? [{ name: attached.name, type: attached.type, size: attached.size }] : [],
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
      setError(cause instanceof Error ? cause.message : "Une erreur inattendue est survenue.");
    } finally {
      setLoading(false);
    }
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
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark">S</span><span>SuperBot</span><span className="beta">BETA</span></div>
        <button className="new-chat" onClick={newChat}><span>＋</span> Nouvelle conversation <kbd>⌘ K</kbd></button>
        <nav>
          <p className="nav-title">ESPACE</p>
          <button className="nav-item active"><span>◫</span> Chat <i>1</i></button>
          <button className="nav-item"><span>✦</span> Mes skills</button>
          <button className="nav-item"><span>◇</span> Fichiers</button>
          <p className="nav-title second">OUTILS</p>
          <button className="nav-item"><span>⌁</span> Intégrations <b>3</b></button>
          <button className="nav-item"><span>▥</span> Utilisation</button>
        </nav>
        <div className="usage-card">
          <div><span>Messages ce mois</span><strong>12 / 50</strong></div>
          <div className="usage-track"><span /></div>
          <p>38 messages disponibles</p>
          <button>Passer à Pro <span>↗</span></button>
        </div>
        <div className="profile">
          <span className="avatar">AM</span><div><strong>Arthur M.</strong><small>Plan gratuit</small></div><button>•••</button>
        </div>
      </aside>
      {sidebarOpen && <button aria-label="Fermer le menu" className="backdrop" onClick={() => setSidebarOpen(false)} />}

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="status"><span className="status-orb">✦</span><div><strong>SuperBot</strong><small><i /> Tous les systèmes opérationnels</small></div></div>
          <div className="top-actions"><button title="Rechercher">⌕</button><button title="Notifications">♢</button><button className="help">?</button></div>
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
              {loading && <article className="message assistant"><div className="message-avatar">✦</div><div className="message-body"><div className="message-meta"><strong>SuperBot analyse</strong></div><div className="typing"><i /><i /><i /></div></div></article>}
              <div ref={bottom} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
          {file && <div className="file-chip"><span>◇</span><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} Ko</small></div><button onClick={() => setFile(null)}>×</button></div>}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea aria-label="Message" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Demande quelque chose à SuperBot…" rows={1} />
            <div className="composer-bottom">
              <div>
                <input ref={fileInput} type="file" hidden accept=".pdf,.doc,.docx,.csv,.xlsx,.txt,.md,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button type="button" className="attach" onClick={() => fileInput.current?.click()}>＋ <span>Ajouter un fichier</span></button>
                <label className="agent-select"><span>✦</span><select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value as AgentId | "auto")}><option value="auto">Auto-routing</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}</select></label>
              </div>
              <button className="send" type="submit" disabled={!input.trim() || loading}>↑</button>
            </div>
          </form>
          <p className="disclaimer">SuperBot peut faire des erreurs. Vérifie les informations importantes.</p>
        </div>
      </section>
    </main>
  );
}
