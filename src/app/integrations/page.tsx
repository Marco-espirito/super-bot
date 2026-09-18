"use client";

import { useEffect, useState } from "react";
import ProductShell from "@/app/components/product-shell";

export default function IntegrationsPage() {
  const [status, setStatus] = useState<Record<string, boolean>>({});
  useEffect(() => { fetch("/api/system/status").then((response) => response.json()).then(setStatus).catch(() => undefined); }, []);
  const items = [
    ["Gemini AI", "Réponses génératives et streaming", status.gemini],
    ["PostgreSQL + pgvector", "Historique, comptes et mémoire", status.database],
    ["GitHub", "Analyse de dépôts et projets", false],
    ["Google Drive", "Documents synchronisés", false],
  ] as const;
  return <ProductShell eyebrow="CONNECTEURS" title="Branche tes outils à SuperBot"><div className="integration-list">{items.map(([name, description, connected]) => <article key={name}><div><h2>{name}</h2><p>{description}</p></div><span className={connected ? "status-pill" : "status-pill pending"}>{connected ? "Connecté" : "À configurer"}</span></article>)}</div></ProductShell>;
}
