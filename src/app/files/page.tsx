"use client";

import { ChangeEvent, useState } from "react";
import ProductShell from "@/app/components/product-shell";

type DocumentResult = { name: string; size: number; text: string; pages?: number; rows?: number; warnings: string[] };

export default function FilesPage() {
  const [document, setDocument] = useState<DocumentResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setLoading(true); setError(""); setDocument(null);
    const body = new FormData(); body.append("file", file);
    const response = await fetch("/api/files/extract", { method: "POST", body });
    const result = await response.json(); setLoading(false);
    if (!response.ok) { setError(result.error || "Extraction impossible."); return; }
    setDocument(result.document);
  }
  return <ProductShell eyebrow="ESPACE DOCUMENTAIRE" title="Transforme tes fichiers en contexte exploitable">
    <p className="product-lead">PDF, DOCX, XLSX, CSV, JSON, Markdown et texte. Les signatures sont vérifiées avant extraction et les instructions suspectes sont neutralisées.</p>
    <label className="upload-zone"><input type="file" accept=".pdf,.docx,.xlsx,.csv,.json,.md,.txt" onChange={upload} /><strong>{loading ? "Extraction en cours…" : "Dépose ou sélectionne un fichier"}</strong><span>10 Mo maximum</span></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    {document && <article className="document-result"><div><h2>{document.name}</h2><p>{(document.size / 1024).toFixed(1)} Ko{document.pages ? ` · ${document.pages} pages` : ""}{document.rows ? ` · ${document.rows} lignes` : ""}</p></div><pre>{document.text.slice(0, 3000)}</pre>{document.warnings.map((warning) => <p className="document-warning" key={warning}>{warning}</p>)}</article>}
  </ProductShell>;
}
