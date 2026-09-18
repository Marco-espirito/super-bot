import ProductShell from "@/app/components/product-shell";
import { agents } from "@/lib/agents";

export default function SkillsPage() {
  return <ProductShell eyebrow="COMPÉTENCES ACTIVES" title="Un expert pour chaque mission">
    <p className="product-lead">Le routeur analyse chaque demande et mobilise automatiquement le skill le plus pertinent. Tu peux aussi imposer un agent depuis le chat.</p>
    <div className="feature-grid">{agents.map((agent) => <article className="feature-card" key={agent.id}><span className="feature-icon" style={{ color: agent.color, background: `${agent.color}18` }}>{agent.icon}</span><div><h2>{agent.name}</h2><p className="feature-label">{agent.label}</p><p>{agent.description}</p></div><span className="status-pill">Actif</span></article>)}</div>
  </ProductShell>;
}
